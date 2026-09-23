const {test,expect}=require('@playwright/test');

async function openLocal(page){
  await page.goto('/');
  await page.locator('#gateProfile').fill(`merge_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  await page.locator('#gateLocalBtn').click();
  await expect(page.locator('#profileGate')).toBeHidden();
}

test('loading cloud preserves local sets and offers a recovery copy',async({page})=>{
  await openLocal(page);
  const result=await page.evaluate(async()=>{
    window.IRONLOG_CLOUD={supabaseUrl:'https://example.invalid',supabaseAnonKey:'test'};
    const localEx=DB.exercises[0];
    DB.sets.push({id:'local-set',exId:localEx.id,date:todayKey(),ts:Date.now(),reps:10,kg:20});
    save();
    const remote=structuredClone(DB);
    remote.exercises=remote.exercises.map(ex=>({...ex,id:'remote-'+ex.id}));
    remote.sets=[{id:'remote-set',exId:remote.exercises[0].id,date:todayKey(),ts:Date.now(),reps:8,kg:25}];
    const blob=await encryptProfile('1234',remote);
    supabaseRequest=async(path,opts={})=>opts.method==='POST'?null:[{data:blob}];
    const ok=await loadCloudProfile({pin:'1234'});
    return {ok,ready:cloudReady(),toast:document.getElementById('toast').textContent,ids:DB.sets.map(s=>s.id),exerciseCount:DB.exercises.length,
      validReferences:DB.sets.every(s=>DB.exercises.some(ex=>ex.id===s.exId)),
      copyKeys:recoveryCopyKeys(),storedIds:JSON.parse(localStorage.getItem(profileKey())).sets.map(s=>s.id)};
  });
  expect(result.ok).toBe(true);
  expect(result.ids).toEqual(expect.arrayContaining(['local-set','remote-set']));
  expect(result.storedIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
  expect(result.validReferences).toBe(true);
  expect(result.copyKeys).toHaveLength(1);
  await page.locator('#menuBtn').click();
  await expect(page.locator('#recoveryCopies')).toBeVisible();
  await expect(page.locator('#recoveryCopySelect option')).toContainText('1 sets');
  await page.evaluate(()=>{ DB.sets=DB.sets.filter(s=>s.id!=='local-set'); save(); });
  await page.locator('#mergeRecoveryBtn').click();
  expect(await page.evaluate(()=>DB.sets.some(s=>s.id==='local-set'))).toBe(true);
});

test('saving cloud merges newer cloud sets into a stale local profile',async({page})=>{
  await openLocal(page);
  const result=await page.evaluate(async()=>{
    window.IRONLOG_CLOUD={supabaseUrl:'https://example.invalid',supabaseAnonKey:'test'};
    const ex=DB.exercises[0];
    DB.sets.push({id:'local-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:10,kg:20});
    save();
    const remote=structuredClone(DB);
    remote.sets=[{id:'remote-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:8,kg:25}];
    let blob=await encryptProfile('1234',remote);
    let writes=0;
    supabaseRequest=async(path,opts={})=>{
      if(opts.method==='POST'){ blob=JSON.parse(opts.body)[0].data; writes++; return null; }
      return [{data:blob}];
    };
    document.getElementById('cloudPin').value='1234';
    await saveCloudProfile(true);
    const saved=await decryptProfile(blob,'1234');
    return {writes,ready:cloudReady(),toast:document.getElementById('toast').textContent,cloudIds:saved.sets.map(s=>s.id),localIds:DB.sets.map(s=>s.id)};
  });
  expect(result.writes).toBe(1);
  expect(result.cloudIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
  expect(result.localIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
});

test('a wrong PIN cannot overwrite an existing cloud profile',async({page})=>{
  await openLocal(page);
  const result=await page.evaluate(async()=>{
    window.IRONLOG_CLOUD={supabaseUrl:'https://example.invalid',supabaseAnonKey:'test'};
    const blob=await encryptProfile('correct',DB);
    let writes=0;
    supabaseRequest=async(path,opts={})=>{
      if(opts.method==='POST'){ writes++; return null; }
      return [{data:blob}];
    };
    document.getElementById('cloudPin').value='wrong';
    const ok=await saveCloudProfile(true);
    return {ok,writes,unlocked:CLOUD.unlocked};
  });
  expect(result).toEqual({ok:false,writes:0,unlocked:false});
});
