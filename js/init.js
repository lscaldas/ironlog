"use strict";
/* ================= utils / init ================= */
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function normalizeDB(){
  let dirty=false;
  if(DB.schemaVersion!==6){ DB.schemaVersion=6; dirty=true; }
  if(!Array.isArray(DB.gyms)){ DB.gyms=[]; dirty=true; }
  if(DB.initialized!==true && (DB.exercises?.length||DB.sets?.length)){ DB.initialized=true; dirty=true; }
  if(!Array.isArray(DB.exercises)){ DB.exercises=[]; dirty=true; }
  if(!Array.isArray(DB.sets)){ DB.sets=[]; dirty=true; }
  if(!Array.isArray(DB.workouts)){ DB.workouts=[]; dirty=true; }
  for(const key of ['deletedSetIds','deletedWorkoutIds']){
    if(!Array.isArray(DB[key])){ DB[key]=[]; dirty=true; }
    else{
      const clean=[...new Set(DB[key].filter(id=>typeof id==='string'&&id))];
      if(clean.length!==DB[key].length){ DB[key]=clean; dirty=true; }
    }
  }
  const deletedSets=new Set(DB.deletedSetIds),deletedWorkouts=new Set(DB.deletedWorkoutIds);
  if(deletedSets.size){
    const before=DB.sets.length;
    DB.sets=DB.sets.filter(set=>!deletedSets.has(set.id));
    if(DB.sets.length!==before) dirty=true;
  }
  if(deletedWorkouts.size){
    const before=DB.workouts.length;
    DB.workouts=DB.workouts.filter(workout=>!deletedWorkouts.has(workout.id));
    if(DB.workouts.length!==before) dirty=true;
    if(DB.activeWorkout&&deletedWorkouts.has(DB.activeWorkout.id)){ DB.activeWorkout=null; dirty=true; }
  }
  if(!DB.weekPlans || typeof DB.weekPlans!=='object' || Array.isArray(DB.weekPlans)){ DB.weekPlans={}; dirty=true; }
  Object.keys(DB.weekPlans).forEach(mk=>{
    const plan=DB.weekPlans[mk];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(mk)){ delete DB.weekPlans[mk]; dirty=true; return; }
    const norm=normalizeWeekPlan(plan);
    if(JSON.stringify(plan)!==JSON.stringify(norm)){ DB.weekPlans[mk]=norm; dirty=true; }
  });
  if(!DB.activeWorkout || typeof DB.activeWorkout!=='object' || DB.activeWorkout.status!=='active'){
    if(DB.activeWorkout!==null){ dirty=true; }
    DB.activeWorkout=null;
  }
  const byName=()=>Object.fromEntries(DB.exercises.map(e=>[e.name,e]));
  let names=byName();
  const canonicalByName=Object.fromEntries(SEED.map(e=>[e.name,e]));
  const renameExercise=(from,to)=>{
    names=byName();
    if(names[from]&&!names[to]){
      const e=names[from], src=canonicalByName[to];
      e.name=to;
      if(src){
        e.bucket=src.bucket; e.muscle=src.muscle; e.area=src.area; e.notes=src.notes;
        e.low=src.low; e.high=src.high; e.inc=src.inc;
      }else{
        e.muscle=guessMuscle(to)||e.muscle; e.area=guessArea(to)||e.area;
      }
      dirty=true;
    }
  };
  [
    ["Rows","Cable Rows"],
    ["Shoulder Press","Overhead Press"],
    ["Face Pulls","Single-arm Face Pulls"],
    ["Cable Flys","Ring Dips"],
    ["Biceps Curls","Bayesian Single-arm Curl"],
    ["Shrugs","Single-arm Cable Shrugs"],
    ["Squats","Cable Squats"],
    ["Leg Curls","Single Cable Leg Curl"],
    ["Calf Raises","Cable Single-leg Calf Raise"]
  ].forEach(([from,to])=>renameExercise(from,to));
  names=byName();
  const oldLat=names["Lateral Raises"];
  if(oldLat && !names["Cable Lateral Raise - Lower Path"]){
    oldLat.name="Cable Lateral Raise - Lower Path";
    oldLat.muscle="Shoulders";
    oldLat.area="Side delts - lower path";
    oldLat.notes=oldLat.notes||"start low, finish around shoulder height";
    dirty=true;
    names=byName();
  }
  const looksLikeBuiltIn=["Cable Rows","Pullups","Pushups","Overhead Press","Single-arm Face Pulls"].every(n=>names[n]);
  const addSeedIfMissing=name=>{
    names=byName();
    if(!names[name]){
      const src=SEED.find(e=>e.name===name);
      if(src){ DB.exercises.push({id:uid('e'),...src}); dirty=true; }
    }
  };
  if(looksLikeBuiltIn){
    ["Cable Squats","Single Cable Leg Curl","Cable Single-leg Calf Raise","Cable Lateral Raise - Upper Path"].forEach(addSeedIfMissing);
  }
  DB.exercises.forEach(e=>{
    if(!e.id){ e.id=uid('e'); dirty=true; }
    if(!e.bucket){ e.bucket='Other'; dirty=true; }
    if(!e.muscle){ e.muscle=guessMuscle(e.name)||'Other'; dirty=true; }
    if(!e.area){ e.area=guessArea(e.name)||e.muscle||'Other'; dirty=true; }
    if(!e.target){ e.target=4; dirty=true; }
    if(!e.low){ e.low=8; dirty=true; }
    if(!e.high){ e.high=12; dirty=true; }
    if(!e.inc){ e.inc=2.5; dirty=true; }
    if(!EQUIPMENT_VARIANTS.includes(e.variant)){ e.variant=variantOf(e); dirty=true; }
  });
  DB.sets.forEach(s=>{
    if(!s.id){ s.id=uid('s'); dirty=true; }
    if(!s.date){ s.date=s.ts?dateKey(new Date(s.ts)):todayKey(); dirty=true; }
    if(!Number.isFinite(s.ts)){ s.ts=new Date(s.date+"T12:00:00").getTime(); dirty=true; }
    if(typeof s.kg!=='number'){ s.kg=parseFloat(s.kg)||0; dirty=true; }
    if(typeof s.reps!=='number'){ s.reps=parseInt(s.reps)||1; dirty=true; }
    if(!s.locationId){ s.locationId='home'; dirty=true; }
    if(!EQUIPMENT_VARIANTS.includes(s.variant)){ s.variant=variantOf(DB.exercises.find(e=>e.id===s.exId)||{}); dirty=true; }
  });
  detectGeneratedSampleSets(DB.sets).forEach(set=>{
    if(set.generatedSample!==true){ set.generatedSample=true; dirty=true; }
  });
  const setIds=new Set(DB.sets.map(s=>s.id));
  const seenWorkouts=new Set();
  DB.workouts=DB.workouts.filter(w=>{
    if(!w||typeof w!=='object'||!w.id||seenWorkouts.has(w.id)) { dirty=true; return false; }
    seenWorkouts.add(w.id);
    if(w.status!=='completed'){ dirty=true; return false; }
    if(!Array.isArray(w.setIds)){ w.setIds=DB.sets.filter(s=>s.workoutId===w.id).map(s=>s.id); dirty=true; }
    const before=w.setIds.length;
    w.setIds=[...new Set(w.setIds.filter(id=>setIds.has(id)))];
    if(w.setIds.length!==before) dirty=true;
    if(!w.startedAt){ w.startedAt=w.setIds.map(id=>DB.sets.find(s=>s.id===id)?.ts).filter(Boolean).sort()[0]||Date.now(); dirty=true; }
    if(!w.endedAt){ w.endedAt=w.startedAt; dirty=true; }
    if(!w.date){ w.date=dateKey(new Date(w.startedAt)); dirty=true; }
    if(!w.locationId){ w.locationId='home'; dirty=true; }
    return true;
  });
  if(DB.activeWorkout){
    if(!DB.activeWorkout.id){ DB.activeWorkout.id=uid('w'); dirty=true; }
    if(!DB.activeWorkout.startedAt){ DB.activeWorkout.startedAt=Date.now(); dirty=true; }
    if(!DB.activeWorkout.date){ DB.activeWorkout.date=dateKey(new Date(DB.activeWorkout.startedAt)); dirty=true; }
    if(!DB.activeWorkout.locationId){ DB.activeWorkout.locationId='home'; dirty=true; }
    if(!Array.isArray(DB.activeWorkout.setIds)){ DB.activeWorkout.setIds=[]; dirty=true; }
    const activeIds=DB.sets.filter(s=>s.workoutId===DB.activeWorkout.id).map(s=>s.id);
    const merged=[...new Set(DB.activeWorkout.setIds.concat(activeIds).filter(id=>setIds.has(id)))];
    if(merged.length!==DB.activeWorkout.setIds.length){ DB.activeWorkout.setIds=merged; dirty=true; }
  }
  if(dirty) save();
}
function refreshAll(){ renderWeek(); renderHistory(); renderStats(); document.getElementById('greeting').textContent=({0:"Sunday",1:"Monday",2:"Tuesday",3:"Wednesday",4:"Thursday",5:"Friday",6:"Saturday"})[new Date().getDay()]+" · weekly sets"; }
function syncCurrentWeekView(){ if(LAST_RENDERED_WEEK!==thisWeek()) refreshAll(); }
function scheduleDateRefresh(){
  const now=new Date(),next=new Date(now);
  next.setHours(24,0,0,0);
  setTimeout(()=>{ syncCurrentWeekView(); scheduleDateRefresh(); },next-now+250);
}
window.addEventListener('resize',()=>{ if(document.getElementById('v-stats').classList.contains('active'))renderStats(); });

// Initialize the selected profile; new local profiles get the starter program when opened.
normalizeDB();
refreshAll();
scheduleDateRefresh();
window.addEventListener('focus',syncCurrentWeekView);
renderCatalog();
updateCloudUI();
if(AUTH_SESSION) hideProfileGate(); else showProfileGate();
initFirebaseSync();

// A hidden page or closed app ends a session at the last observable time.
function saveWorkoutOnLeave(){
  const w=currentActiveWorkout();
  if(!w) return;
  if(document.getElementById('recoverySheet').classList.contains('show')) return;
  completeActiveWorkout(Date.now(),true);
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden') saveWorkoutOnLeave();
  else syncCurrentWeekView();
});
window.addEventListener('pagehide',saveWorkoutOnLeave);

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js?v=40').then(reg=>reg.update()).catch(()=>{});
  });
}
