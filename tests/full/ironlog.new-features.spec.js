const {test,expect}=require('@playwright/test');

async function openLocal(page){
  await page.goto('/');
  await page.locator('#gateProfile').fill(`new_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  await page.locator('#gateLocalBtn').click();
  await expect(page.locator('#profileGate')).toBeHidden();
}
async function logFirst(page,weight){
  await page.locator('#weekList .log-plus').first().click();
  await page.locator('#inReps').fill('10');
  await page.locator('#inKg').fill(String(weight));
  await page.locator('#saveSetBtn').click();
}

test('finishing saves immediately and leaving the page saves an active workout',async({page})=>{
  await openLocal(page);
  await page.locator('#startWorkoutBtn').click();
  await logFirst(page,20);
  await page.locator('#finishBtn').click();
  await expect(page.locator('#startWorkoutBtn')).toBeVisible();
  await expect(page.locator('#finSheet')).toHaveCount(0);
  await page.locator('#startWorkoutBtn').click();
  await logFirst(page,22.5);
  await page.reload();
  await expect(page.locator('#startWorkoutBtn')).toBeVisible();
  const saved=await page.evaluate(()=>DB.workouts.length);
  expect(saved).toBe(2);
});

test('an old active workout offers a duration before saving',async({page})=>{
  await openLocal(page);
  await page.evaluate(()=>{
    const ex=DB.exercises[0],startedAt=Date.now()-3*24*60*60*1000;
    DB.activeWorkout={id:'forgotten',status:'active',startedAt,date:dateKey(new Date(startedAt)),locationId:'home',setIds:['forgotten-set']};
    DB.sets.push({id:'forgotten-set',workoutId:'forgotten',exId:ex.id,date:dateKey(new Date(startedAt)),ts:startedAt+60000,reps:10,kg:20,locationId:'home',variant:variantOf(ex)});
    localStorage.setItem(profileKey(),JSON.stringify(DB));
    DB.activeWorkout=null;
  });
  await page.reload();
  await expect(page.locator('#recoverySheet')).toBeVisible();
  await expect(page.locator('#recoveryMinutes')).toHaveValue('60');
  await page.locator('#recoveryMinutes').fill('45');
  await page.locator('#recoverySaveBtn').click();
  const duration=await page.evaluate(()=>Math.round((DB.workouts.at(-1).endedAt-DB.workouts.at(-1).startedAt)/60000));
  expect(duration).toBe(45);
});

test('gym and equipment variant isolate previous weights',async({page})=>{
  await openLocal(page);
  await page.locator('#menuBtn').click();
  await page.locator('#gymName').fill('FitX Alexanderplatz');
  await page.locator('#addGymBtn').click();
  await page.locator('#sheetBg').click({position:{x:2,y:2}});
  await page.locator('#startLocation').selectOption({label:'FitX Alexanderplatz'});
  await page.locator('#startWorkoutBtn').click();
  await logFirst(page,35);
  await page.locator('#finishBtn').click();
  await page.locator('#startWorkoutBtn').click();
  await page.locator('#weekList .log-plus').first().click();
  await expect(page.locator('#inKg')).toHaveValue('0');
  await page.locator('#sheetBg').click({position:{x:2,y:2}});
  await page.locator('#cancelWorkoutBtn').click();
  await page.locator('#startLocation').selectOption({label:'FitX Alexanderplatz'});
  await page.locator('#startWorkoutBtn').click();
  await page.locator('#weekList .log-plus').first().click();
  await expect(page.locator('#inKg')).toHaveValue('35');
  await page.locator('#sheetBg').click({position:{x:2,y:2}});
  const {isolatedName,gymId}=await page.evaluate(()=>({isolatedName:logEx.name,gymId:DB.gyms[0].id}));
  await page.locator('.ex',{has:page.locator('.exname',{hasText:isolatedName})}).locator('.editEx').click();
  await page.locator('#fVariant').selectOption('Machine');
  await page.locator('#fLocations input[value="all"]').uncheck();
  await page.locator(`#fLocations input[value="${gymId}"]`).check();
  await page.locator('#saveExBtn').click();
  await page.locator('#weekList .log-plus').first().click();
  await expect(page.locator('#inKg')).toHaveValue('0');
  await page.locator('#sheetBg').click({position:{x:2,y:2}});
  await page.locator('#finishBtn').click();
  await page.locator('#startWorkoutBtn').click();
  await expect(page.locator('#weekList .exname',{hasText:isolatedName})).toHaveCount(0);
});

test('rest timer remains available beside muscle bars and progress includes empty weeks',async({page})=>{
  await openLocal(page);
  await page.locator('#startWorkoutBtn').click();
  await page.locator('#weekList .log-plus').first().click();
  await page.locator('#saveSetMoreBtn').click();
  await expect(page.locator('#restStatus')).toBeVisible();
  await page.locator('#restBarsBtn').click();
  await expect(page.locator('#restBanner')).toBeVisible();
  await expect(page.locator('#mbalCard')).toBeVisible();
  await page.evaluate(()=>{
    const d=new Date(thisWeek()+'T00:00:00');d.setDate(d.getDate()-14);
    const ex=DB.exercises[0];
    DB.sets.push({id:'old-week',exId:ex.id,date:dateKey(d),ts:d.getTime()+60000,reps:8,kg:20,locationId:'home',variant:variantOf(ex)});
    save();
  });
  await page.locator('nav button[data-view="stats"]').click();
  await expect(page.locator('#groupsChart')).toBeVisible();
  await expect(page.locator('#muscleChartSelect option')).not.toHaveCount(0);
  const gap=await page.evaluate(()=>{
    const weeks=statWeeks(),previous=weeks.at(-2);
    return {length:weeks.length,volume:DB.sets.filter(s=>mondayOf(s.date)===previous).length};
  });
  expect(gap.length).toBe(3);
  expect(gap.volume).toBe(0);
  const archivedVolume=await page.evaluate(()=>{
    const set=DB.sets.find(s=>s.id==='old-week');
    const ex=DB.exercises.find(e=>e.id===set.exId);
    ex.archived=true; save();
    return muscleEffective(mondayOf(set.date))[muscleOf(ex)].eff;
  });
  expect(archivedVolume).toBeGreaterThan(0);
});
