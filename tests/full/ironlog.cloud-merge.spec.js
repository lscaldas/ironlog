const {test,expect}=require('@playwright/test');

async function openLocal(page){
  await page.goto('/');
  await page.locator('#gateProfile').fill('merge_'+Date.now());
  await page.locator('#gateLocalBtn').click();
  await expect(page.locator('#profileGate')).toBeHidden();
}
async function fakeFirestore(page){
  await page.evaluate(()=>{
    const docs=new Map();
    window.fakeCloudDocs=docs;
    CLOUD.sdk={
      doc:(_db,...parts)=>parts.join('/'),
      serverTimestamp:()=>Date.now(),
      runTransaction:async(_db,action)=>{
        const writes=[];
        const transaction={
          get:async ref=>({exists:()=>docs.has(ref),data:()=>docs.get(ref)}),
          set:(ref,value)=>writes.push([ref,value]),
          delete:ref=>writes.push([ref,null])
        };
        const result=await action(transaction);
        for(const [ref,value] of writes){ if(value===null) docs.delete(ref); else docs.set(ref,value); }
        return result;
      }
    };
    CLOUD.firestore={};
  });
}

test('Android Chrome Google sign-in opens a popup without redirecting',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    const auth={currentUser:null};
    window.signInCalls=[];
    window.IRONLOG_FIREBASE_SDK={
      initializeApp:()=>({}),
      getAuth:()=>auth,
      getFirestore:()=>({}),
      onAuthStateChanged:()=>{},
      getRedirectResult:async()=>null,
      GoogleAuthProvider:class {},
      signInWithPopup:async()=>{ window.signInCalls.push('popup'); },
      signInWithRedirect:async()=>{ window.signInCalls.push('redirect'); }
    };
  });
  await page.goto('/');
  await page.locator('#gateProfile').fill('android_user');
  await page.locator('#gateGoogleBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.signInCalls)).toEqual(['popup']);
});

test('Google sign-in merges local and cloud sets with a recovery copy',async({page})=>{
  await openLocal(page);
  await fakeFirestore(page);
  const result=await page.evaluate(async()=>{
    const source=ACTIVE_PROFILE;
    const ex=DB.exercises[0];
    DB.sets.push({id:'local-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:10,kg:20});
    save();
    const remote=structuredClone(DB);
    remote.exercises=remote.exercises.map(e=>({...e,id:'remote-'+e.id}));
    remote.sets=[{id:'remote-set',exId:remote.exercises[0].id,date:todayKey(),ts:Date.now(),reps:8,kg:25}];
    fakeCloudDocs.set('users/google-user/ironlog/head',{count:1});
    fakeCloudDocs.set('users/google-user/ironlog/chunk-0000',{body:JSON.stringify(remote)});
    sessionStorage.setItem(FIREBASE_IMPORT_PROFILE,source);
    await openFirebaseProfile({uid:'google-user',email:'test@example.com'});
    return {
      localIds:DB.sets.map(s=>s.id),
      cloudIds:JSON.parse(fakeCloudDocs.get('users/google-user/ironlog/chunk-0000').body).sets.map(s=>s.id),
      referencesValid:DB.sets.every(s=>DB.exercises.some(e=>e.id===s.exId)),
      recoveryCount:recoveryCopyKeys(source).length
    };
  });
  expect(result.localIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
  expect(result.cloudIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
  expect(result.referencesValid).toBe(true);
  expect(result.recoveryCount).toBe(1);
});

test('sync retains newer cloud sets when this device has a stale cache',async({page})=>{
  await openLocal(page);
  await fakeFirestore(page);
  const result=await page.evaluate(async()=>{
    const ex=DB.exercises[0];
    CLOUD.user={uid:'google-user',email:'test@example.com'};
    CLOUD.unlocked=true;
    DB.sets.push({id:'local-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:10,kg:20});
    const remote=structuredClone(DB);
    remote.sets=[{id:'remote-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:8,kg:25}];
    fakeCloudDocs.set('users/google-user/ironlog/head',{count:1});
    fakeCloudDocs.set('users/google-user/ironlog/chunk-0000',{body:JSON.stringify(remote)});
    const ok=await saveCloudProfile(true);
    return {ok,localIds:DB.sets.map(s=>s.id),cloudIds:JSON.parse(fakeCloudDocs.get('users/google-user/ironlog/chunk-0000').body).sets.map(s=>s.id)};
  });
  expect(result.ok).toBe(true);
  expect(result.localIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
  expect(result.cloudIds).toEqual(expect.arrayContaining(['local-set','remote-set']));
});

test('Google accounts have isolated workout records',async({page})=>{
  await openLocal(page);
  await fakeFirestore(page);
  const result=await page.evaluate(async()=>{
    await openFirebaseProfile({uid:'first-user',email:'first@example.com'});
    const ex={id:'one-ex',name:'Row',muscle:'Back',area:'Back',bucket:'Pull'};
    DB.exercises.push(ex);
    DB.sets.push({id:'first-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:8,kg:30});
    await saveCloudProfile();
    await openFirebaseProfile({uid:'second-user',email:'second@example.com'});
    return {
      first:JSON.parse(fakeCloudDocs.get('users/first-user/ironlog/chunk-0000').body).sets.map(s=>s.id),
      second:DB.sets.map(s=>s.id)
    };
  });
  expect(result.first).toContain('first-set');
  expect(result.second).not.toContain('first-set');
});

test('cached Google workouts open offline and merge after reconnect',async({page,context})=>{
  await openLocal(page);
  await page.evaluate(async()=>{
    await navigator.serviceWorker.ready;
    const cached=structuredClone(DB);
    cached.sets.push({id:'offline-set',exId:cached.exercises[0].id,date:todayKey(),ts:Date.now(),reps:8,kg:20});
    localStorage.setItem('ironlog.v2.firebase_offline-user',JSON.stringify(cached));
    localStorage.setItem(FIREBASE_LAST_USER,JSON.stringify({uid:'offline-user',email:'offline@example.com'}));
    clearSession();
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#gateOfflineBtn')).toBeVisible();
  await page.locator('#gateOfflineBtn').click();
  await expect(page.locator('#profileSyncMode')).toHaveText('Offline cache');
  const offlineIds=await page.evaluate(()=>{
    const ex=DB.exercises[0];
    DB.sets.push({id:'new-offline-set',exId:ex.id,date:todayKey(),ts:Date.now(),reps:9,kg:20});
    save();
    return DB.sets.map(set=>set.id);
  });
  expect(offlineIds).toEqual(expect.arrayContaining(['offline-set','new-offline-set']));
  await context.setOffline(false);
  await fakeFirestore(page);
  const synced=await page.evaluate(async()=>{
    await openFirebaseProfile({uid:'offline-user',email:'offline@example.com'});
    return JSON.parse(fakeCloudDocs.get('users/offline-user/ironlog/chunk-0000').body).sets.map(set=>set.id);
  });
  expect(synced).toEqual(expect.arrayContaining(['offline-set','new-offline-set']));
  await expect(page.locator('#profileSyncMode')).toHaveText('Live');
});
