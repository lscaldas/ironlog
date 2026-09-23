"use strict";
/* ================= Import validation ================= */
function isPlainObject(v){ return Boolean(v && typeof v==='object' && !Array.isArray(v)); }
function isValidDateKeyValue(v){
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y,m,d]=v.split('-').map(Number);
  const dt=new Date(v+"T00:00:00");
  return dt.getFullYear()===y && dt.getMonth()+1===m && dt.getDate()===d;
}
function importNumber(v,{integer=false,min=-Infinity,max=Infinity,decimals=null}={}){
  if(typeof v==='string'){
    if(integer && !/^\d+$/.test(v)) return {ok:false};
    if(!integer && !/^\d+(\.\d+)?$/.test(v)) return {ok:false};
    v=Number(v);
  }
  if(typeof v!=='number'||!Number.isFinite(v)) return {ok:false};
  if(integer && !Number.isInteger(v)) return {ok:false};
  if(v<min||v>max) return {ok:false};
  if(decimals!==null && Math.abs(Math.round(v*(10**decimals))-v*(10**decimals))>1e-7) return {ok:false};
  return {ok:true,value:v};
}
function validateImportDate(date,ts){
  const today=todayKey();
  if(date!==undefined){
    if(!isValidDateKeyValue(date)) return {ok:false,message:"Invalid file"};
    if(date>today) return {ok:false,message:"Invalid file: future data"};
  }
  if(ts!==undefined){
    if(typeof ts!=='number'||!Number.isFinite(ts)||ts<0) return {ok:false,message:"Invalid file"};
    if(ts>Date.now()+5*60*1000) return {ok:false,message:"Invalid file: future data"};
  }
  return {ok:true};
}
function validateImportedDB(raw){
  if(!isPlainObject(raw)) return {ok:false,message:"Invalid file"};
  if(!Array.isArray(raw.exercises)||!Array.isArray(raw.sets)) return {ok:false,message:"Invalid file"};
  if(raw.workouts!==undefined&&!Array.isArray(raw.workouts)) return {ok:false,message:"Invalid file"};
  if(raw.activeWorkout!==undefined&&raw.activeWorkout!==null&&!isPlainObject(raw.activeWorkout)) return {ok:false,message:"Invalid file"};
  if(raw.weekPlans!==undefined&&!isPlainObject(raw.weekPlans)) return {ok:false,message:"Invalid file"};
  if(raw.gyms!==undefined&&!Array.isArray(raw.gyms)) return {ok:false,message:"Invalid file"};
  for(const key of ['deletedSetIds','deletedWorkoutIds']){
    if(raw[key]!==undefined&&(!Array.isArray(raw[key])||raw[key].some(id=>typeof id!=='string'||!id))) return {ok:false,message:"Invalid file"};
  }

  const next=Object.assign(blankDB(), raw, {
    exercises: raw.exercises.map(e=>isPlainObject(e)?Object.assign({}, e):e),
    sets: [],
    workouts: (raw.workouts||[]).map(w=>isPlainObject(w)?Object.assign({}, w, {setIds:Array.isArray(w.setIds)?w.setIds.slice():w.setIds}):w),
    activeWorkout: isPlainObject(raw.activeWorkout) ? Object.assign({}, raw.activeWorkout, {setIds:Array.isArray(raw.activeWorkout.setIds)?raw.activeWorkout.setIds.slice():raw.activeWorkout.setIds}) : null,
    weekPlans: isPlainObject(raw.weekPlans) ? Object.fromEntries(Object.entries(raw.weekPlans).map(([mk,plan])=>[mk,normalizeWeekPlan(plan)])) : {},
    gyms:(raw.gyms||[]).map(g=>isPlainObject(g)?{id:g.id,name:g.name}:g)
  });
  const gymIds=new Set(['home']);
  for(const gym of next.gyms){
    if(!isPlainObject(gym)||typeof gym.id!=='string'||!gym.id.trim()||gymIds.has(gym.id)||typeof gym.name!=='string'||!gym.name.trim()) return {ok:false,message:"Invalid file"};
    gymIds.add(gym.id);
  }

  for(const mk of Object.keys(next.weekPlans)){
    if(!isValidDateKeyValue(mk)) return {ok:false,message:"Invalid file"};
  }

  const exerciseIds=new Set();
  for(const ex of next.exercises){
    if(!isPlainObject(ex)) return {ok:false,message:"Invalid file"};
    if(ex.id!==undefined){
      if(typeof ex.id!=='string'||!ex.id.trim()||exerciseIds.has(ex.id)) return {ok:false,message:"Invalid file"};
      exerciseIds.add(ex.id);
    }else if(raw.sets.length){
      return {ok:false,message:"Invalid file"};
    }
    if(ex.name!==undefined&&typeof ex.name!=='string') return {ok:false,message:"Invalid file"};
    if(ex.variant!==undefined&&!EQUIPMENT_VARIANTS.includes(ex.variant)) return {ok:false,message:"Invalid file"};
    if(ex.locations!==undefined&&ex.locations!==null&&(!Array.isArray(ex.locations)||ex.locations.some(id=>typeof id!=='string'||!gymIds.has(id)))) return {ok:false,message:"Invalid file"};
    for(const key of ['target','low','high']){
      if(ex[key]!==undefined&&!importNumber(ex[key],{integer:true,min:1,max:999}).ok) return {ok:false,message:"Invalid file"};
    }
    if(ex.inc!==undefined&&!importNumber(ex.inc,{min:0.01,max:999,decimals:2}).ok) return {ok:false,message:"Invalid file"};
  }

  const setIds=new Set();
  for(const set of raw.sets){
    if(!isPlainObject(set)) return {ok:false,message:"Invalid file"};
    if(typeof set.id!=='string'||!set.id.trim()||setIds.has(set.id)) return {ok:false,message:"Invalid file"};
    if(typeof set.exId!=='string'||!exerciseIds.has(set.exId)) return {ok:false,message:"Invalid file"};
    const reps=importNumber(set.reps,{integer:true,min:1,max:999});
    if(!reps.ok) return {ok:false,message:"Invalid file"};
    const kg=importNumber(set.kg===undefined?0:set.kg,{min:0,max:999,decimals:2});
    if(!kg.ok) return {ok:false,message:"Invalid file"};
    if(set.locationId!==undefined&&typeof set.locationId!=='string') return {ok:false,message:"Invalid file"};
    if(set.variant!==undefined&&!EQUIPMENT_VARIANTS.includes(set.variant)) return {ok:false,message:"Invalid file"};
    if(set.generatedSample!==undefined&&typeof set.generatedSample!=='boolean') return {ok:false,message:"Invalid file"};
    const dateCheck=validateImportDate(set.date,set.ts);
    if(!dateCheck.ok) return dateCheck;
    next.sets.push(Object.assign({}, set, {reps:reps.value, kg:kg.value}));
  }

  const knownSetIds=new Set(next.sets.map(s=>s.id));
  const workoutIds=new Set();
  for(const workout of next.workouts){
    if(!isPlainObject(workout)) return {ok:false,message:"Invalid file"};
    if(typeof workout.id!=='string'||!workout.id.trim()||workoutIds.has(workout.id)) return {ok:false,message:"Invalid file"};
    workoutIds.add(workout.id);
    if(workout.locationId!==undefined&&typeof workout.locationId!=='string') return {ok:false,message:"Invalid file"};
    if(workout.status!==undefined&&workout.status!=='completed') return {ok:false,message:"Invalid file"};
    if(workout.setIds!==undefined){
      if(!Array.isArray(workout.setIds)) return {ok:false,message:"Invalid file"};
      for(const id of workout.setIds){
        if(typeof id!=='string'||!knownSetIds.has(id)) return {ok:false,message:"Invalid file"};
      }
    }
    for(const key of ['startedAt','endedAt']){
      if(workout[key]!==undefined){
        const check=validateImportDate(undefined,workout[key]);
        if(!check.ok) return check;
      }
    }
    if(workout.date!==undefined){
      const check=validateImportDate(workout.date,undefined);
      if(!check.ok) return check;
    }
  }

  if(next.activeWorkout!==null){
    const active=next.activeWorkout;
    if(!isPlainObject(active)||active.status!=='active'||typeof active.id!=='string'||!active.id.trim()) return {ok:false,message:"Invalid file"};
    if(active.locationId!==undefined&&typeof active.locationId!=='string') return {ok:false,message:"Invalid file"};
    if(active.setIds!==undefined){
      if(!Array.isArray(active.setIds)) return {ok:false,message:"Invalid file"};
      for(const id of active.setIds){
        if(typeof id!=='string'||!knownSetIds.has(id)) return {ok:false,message:"Invalid file"};
      }
    }
    for(const key of ['startedAt','endedAt']){
      if(active[key]!==undefined){
        const check=validateImportDate(undefined,active[key]);
        if(!check.ok) return check;
      }
    }
    if(active.date!==undefined){
      const check=validateImportDate(active.date,undefined);
      if(!check.ok) return check;
    }
  }

  return {ok:true,db:next};
}

/* ================= Data menu ================= */
function generatedSampleSets(){
  return DB.sets.filter(set=>set.generatedSample===true);
}
function updateSampleCleanupUI(){
  const count=generatedSampleSets().length;
  const button=document.getElementById('removeSampleBtn');
  button.hidden=!count;
  document.getElementById('sampleCleanupHelp').hidden=!count;
  button.textContent=`Remove ${count} generated sample set${count===1?'':'s'}`;
}
function updateRecoveryUI(){
  const keys=recoveryCopyKeys();
  const wrap=document.getElementById('recoveryCopies');
  const select=document.getElementById('recoveryCopySelect');
  wrap.hidden=!keys.length;
  select.replaceChildren();
  keys.forEach(key=>{
    const option=document.createElement('option');
    option.value=key;
    try{
      const snapshot=JSON.parse(localStorage.getItem(key));
      const timestamp=Number(key.slice((RECOVERY_PREFIX+ACTIVE_PROFILE+'.').length).split('.')[0]);
      option.textContent=`${new Date(timestamp).toLocaleString()} · ${snapshot.sets?.length||0} sets`;
    }catch(_){ option.textContent='Saved local copy'; }
    select.appendChild(option);
  });
}
function openDataSheet(){ updateRecoveryUI(); updateSampleCleanupUI(); openSheet('dataSheet'); }
document.getElementById('menuBtn').onclick=openDataSheet;
document.getElementById('profilePill').onclick=openDataSheet;
document.getElementById('mergeRecoveryBtn').onclick=()=>{
  const key=document.getElementById('recoveryCopySelect').value;
  if(!key||!key.startsWith(RECOVERY_PREFIX+ACTIVE_PROFILE+'.')) return;
  try{
    const result=validateImportedDB(JSON.parse(localStorage.getItem(key)));
    if(!result.ok){ toast('Saved copy is invalid'); return; }
    saveRecoveryCopy();
    DB=mergeProfileData(DB,result.db);
    normalizeDB();
    save();
    refreshAll();
    updateRecoveryUI();
    toast('Saved copy merged');
  }catch(_){ toast('Could not merge saved copy'); }
};
document.getElementById('removeSampleBtn').onclick=()=>{
  const sampleSets=generatedSampleSets();
  if(!sampleSets.length){ updateSampleCleanupUI(); return; }
  if(!confirm(`Remove ${sampleSets.length} generated sample sets? Real logged sets will remain. A local recovery copy will be saved first.`)) return;
  try{ if(!saveRecoveryCopy()) throw new Error('No local backup'); }
  catch(_){ toast('Could not save a recovery copy. Export JSON first.'); return; }
  const ids=new Set(sampleSets.map(set=>set.id));
  markDeletedRecords([...ids]);
  DB.sets=DB.sets.filter(set=>!ids.has(set.id));
  save(); refreshAll(); updateRecoveryUI(); updateSampleCleanupUI();
  toast(`${ids.size} sample sets removed`);
};
document.getElementById('exportBtn').onclick=()=>{ const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ironlog-'+todayKey()+'.json'; a.click(); toast("Exported ✓"); };
document.getElementById('importBtn').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{ try{ const parsed=JSON.parse(r.result); const result=validateImportedDB(parsed); if(!result.ok){ toast(result.message||"Invalid file"); return; } DB=result.db; normalizeDB(); save(); rememberSession('local'); refreshAll(); closeSheets(); toast("Imported ✓"); }catch(_){ toast("Could not read file"); } finally{ e.target.value=''; } }; r.readAsText(f); };
document.getElementById('seedBtn').onclick=()=>{ seed(); closeSheets(); toast("Program loaded 📋"); };
document.getElementById('logoutBtn').onclick=()=>logout();
document.getElementById('wipeBtn').onclick=()=>{ if(confirm("Erase ALL data? Cannot be undone.")){ DB=blankDB(); DB.initialized=true; save(); refreshAll(); document.getElementById('importBtn').scrollIntoView({block:'center'}); toast("Erased"); } };
