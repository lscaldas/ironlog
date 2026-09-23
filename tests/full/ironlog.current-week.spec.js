const {test,expect}=require('@playwright/test');

test('home bars and exercises move to the real week after a long gap',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-08-10T12:00:00'));
  await page.goto('/');
  await page.locator('#gateProfile').fill(`week_${Date.now()}`);
  await page.locator('#gateLocalBtn').click();
  await expect(page.locator('#profileGate')).toBeHidden();
  await page.evaluate(()=>{
    const oldWeek=thisWeek();
    DB.weekPlans[oldWeek]={groups:['Legs'],chosen:true};
    const exercise=DB.exercises.find(ex=>ex.name==='Cable Squats');
    DB.sets.push({id:'old-week-set',exId:exercise.id,date:todayKey(),ts:Date.now(),reps:10,kg:40});
    save();
    refreshAll();
  });
  await expect(page.locator('#weekSetup')).toBeHidden();
  await expect(page.locator('#weekList .ex',{hasText:'Cable Squats'})).toBeVisible();
  await expect(page.locator('#weekList .ex',{hasText:'Pullups'})).toHaveCount(0);

  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#muscleWeekLabel')).toHaveText(await page.evaluate(()=>weekLabel(thisWeek())));
  await expect(page.locator('#weekSetup')).toBeVisible();
  await expect(page.locator('#weekList .ex',{hasText:'Pullups'})).toBeVisible();
  await expect(page.locator('#weekList .wkchip')).toHaveCount(0);
  const state=await page.evaluate(()=>({
    currentWeek:thisWeek(),
    renderedWeek:LAST_RENDERED_WEEK,
    defaultGroups:weekGroupsFor(),
    barVolume:muscleEffective()[muscleOf(DB.exercises.find(ex=>ex.name==='Cable Squats'))].eff,
    oldSetPreserved:DB.sets.some(set=>set.id==='old-week-set')
  }));
  expect(state.renderedWeek).toBe(state.currentWeek);
  expect(state.defaultGroups).toEqual(expect.arrayContaining(['Push','Pull','Legs','Core']));
  expect(state.barVolume).toBe(0);
  expect(state.oldSetPreserved).toBe(true);
});
