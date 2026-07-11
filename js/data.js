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

  const next=Object.assign(blankDB(), raw, {
    exercises: raw.exercises.map(e=>isPlainObject(e)?Object.assign({}, e):e),
    sets: [],
    workouts: (raw.workouts||[]).map(w=>isPlainObject(w)?Object.assign({}, w, {setIds:Array.isArray(w.setIds)?w.setIds.slice():w.setIds}):w),
    activeWorkout: isPlainObject(raw.activeWorkout) ? Object.assign({}, raw.activeWorkout, {setIds:Array.isArray(raw.activeWorkout.setIds)?raw.activeWorkout.setIds.slice():raw.activeWorkout.setIds}) : null,
    weekPlans: isPlainObject(raw.weekPlans) ? Object.fromEntries(Object.entries(raw.weekPlans).map(([mk,plan])=>[mk,isPlainObject(plan)?Object.assign({},plan,{focus:isPlainObject(plan.focus)?Object.assign({},plan.focus):plan.focus}):plan])) : {}
  });

  for(const [mk,plan] of Object.entries(next.weekPlans)){
    if(!isValidDateKeyValue(mk)||!isPlainObject(plan)||!REC_SETS_TIERS[plan.tier]||!isPlainObject(plan.focus)) return {ok:false,message:"Invalid file"};
    for(const [group,state] of Object.entries(plan.focus)){
      if(!WEEK_LOADOUT_GROUPS.some(item=>item.id===group)||!WEEK_FOCUS_STATES.includes(state)) return {ok:false,message:"Invalid file"};
    }
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
document.getElementById('menuBtn').onclick=()=>openSheet('dataSheet');
document.getElementById('profilePill').onclick=()=>openSheet('dataSheet');
document.getElementById('exportBtn').onclick=()=>{ const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ironlog-'+todayKey()+'.json'; a.click(); toast("Exported ✓"); };
document.getElementById('importBtn').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{ try{ const parsed=JSON.parse(r.result); const result=validateImportedDB(parsed); if(!result.ok){ toast(result.message||"Invalid file"); return; } DB=result.db; normalizeDB(); save(); rememberSession('local'); refreshAll(); closeSheets(); toast("Imported ✓"); }catch(_){ toast("Could not read file"); } finally{ e.target.value=''; } }; r.readAsText(f); };
document.getElementById('seedBtn').onclick=()=>{ seed(false); closeSheets(); toast("Program loaded 📋"); };
document.getElementById('demoBtn').onclick=()=>{ seed(true); closeSheets(); toast("Sample loaded ✨"); };
document.getElementById('logoutBtn').onclick=()=>logout();
document.getElementById('wipeBtn').onclick=()=>{ if(confirm("Erase ALL data? Cannot be undone.")){ DB=blankDB(); DB.initialized=true; save(); refreshAll(); document.getElementById('importBtn').scrollIntoView({block:'center'}); toast("Erased"); } };
