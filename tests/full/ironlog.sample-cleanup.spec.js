const {test,expect}=require('@playwright/test');

async function openLocal(page){
  await page.goto('/');
  await page.locator('#gateProfile').fill(`sample_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  await page.locator('#gateLocalBtn').click();
  await expect(page.locator('#profileGate')).toBeHidden();
}

test('generated sample sets can be removed without deleting real logs or returning from cloud',async({page})=>{
  await openLocal(page);
  await page.evaluate(()=>{
    const ex=DB.exercises[0];
    const day=new Date(thisWeek()+'T00:00:00'); day.setDate(day.getDate()-21);
    const created=Date.now();
    for(let i=0;i<12;i++) DB.sets.push({id:'s'+(created+i).toString(36)+'abc',exId:ex.id,date:dateKey(day),ts:day.getTime()+i*1000+123.456,reps:10,kg:20});
    DB.sets.push({id:'s'+(created+12).toString(36)+'def',exId:ex.id,date:dateKey(day),ts:day.getTime()+1500,reps:9,kg:22.5});
    DB.sets.push({id:'real-set',exId:ex.id,date:dateKey(day),ts:day.getTime()+10*60*60*1000,reps:8,kg:25});
    normalizeDB();
    save();
    window.beforeCleanup=structuredClone(DB);
    refreshAll();
  });
  await expect(page.locator('#aVol')).toHaveText('1');
  await page.locator('nav button[data-view="history"]').click();
  await expect(page.locator('#histCount')).toHaveText('1 logged set');
  await page.locator('#menuBtn').click();
  await expect(page.locator('#removeSampleBtn')).toHaveText('Remove 13 generated sample sets');
  await expect(page.locator('#demoBtn')).toHaveCount(0);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#removeSampleBtn').click();
  const state=await page.evaluate(()=>{
    DB=mergeProfileData(DB,window.beforeCleanup);
    normalizeDB(); save(); refreshAll();
    return {ids:DB.sets.map(set=>set.id),deleted:DB.deletedSetIds.length,copies:recoveryCopyKeys().length};
  });
  expect(state.ids).toEqual(['real-set']);
  expect(state.deleted).toBe(13);
  expect(state.copies).toBeGreaterThan(0);
  await page.locator('#sheetBg').click({position:{x:2,y:2}});
  await page.locator('nav button[data-view="history"]').click();
  await expect(page.locator('#histCount')).toHaveText('1 logged set');
  await expect(page.locator('#histList .legacy')).toHaveCount(1);
  await page.locator('#histList .legacy .day-h').click();
  await expect(page.locator('#histList .legacy .day-body')).toContainText('8×25kg');
});

test('empty progress range explicitly shows zero and has no sample generator',async({page})=>{
  await openLocal(page);
  await page.locator('nav button[data-view="stats"]').click();
  await page.locator('#rangeSeg button[data-w="8"]').click();
  await expect(page.locator('#aVol')).toHaveText('0');
  await expect(page.locator('#groupVolumeHelp')).toHaveText('No sets logged in this range. Every week is 0.');
  await expect(page.locator('#muscleVolumeHelp')).toContainText('0 effective sets');
});

test('history shows sets from a workout that is still in progress',async({page})=>{
  await openLocal(page);
  await page.locator('#startWorkoutBtn').click();
  await page.locator('#weekList .log-plus').first().click();
  await page.locator('#saveSetBtn').click();
  await page.locator('nav button[data-view="history"]').click();
  await expect(page.locator('#histCount')).toHaveText('1 logged set');
  const active=page.getByRole('button',{name:/Workout in progress/i});
  await expect(active).toBeVisible();
  await active.click();
  await expect(page.locator('#histList .session .day-body')).toContainText('×');
});
