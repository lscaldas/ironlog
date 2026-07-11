"use strict";
/* ================= Helpers ================= */
const setsFor=(exId,mk)=>DB.sets.filter(s=>s.exId===exId && mondayOf(s.date)===mk);
const allSetsFor=exId=>DB.sets.filter(s=>s.exId===exId).sort((a,b)=>a.ts-b.ts);
const fmtW=kg=>kg>0?kg+"kg":"BW";
const WEEK_LOADOUT_GROUPS=[
  {id:'Push',icon:'⚡',muscles:'Chest · shoulders · triceps'},
  {id:'Pull',icon:'⛓',muscles:'Back · biceps · traps'},
  {id:'Legs',icon:'💥',muscles:'Quads · hamstrings · calves'},
  {id:'Core',icon:'◈',muscles:'Core · stability'},
  {id:'Other',icon:'✦',muscles:'Other movements'}
];
const ALL_GROUP_IDS=WEEK_LOADOUT_GROUPS.map(g=>g.id);
/* One "life" per training-week intensity: fill maintain, then build loads on top, then beast. */
const BAR_TIERS=[
  {id:'maintain',label:'Maintained',icon:'🍃'},
  {id:'build',label:'Built',icon:'💪'},
  {id:'beast',label:'Beast',icon:'🔥'}
];
function normalizeWeekPlan(raw){
  const plan={groups:ALL_GROUP_IDS.slice(),chosen:false};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return plan;
  let groups=Array.isArray(raw.groups)?raw.groups.filter(g=>ALL_GROUP_IDS.includes(g)):null;
  if(!groups&&raw.focus&&typeof raw.focus==='object'&&!Array.isArray(raw.focus)){
    groups=ALL_GROUP_IDS.filter(g=>raw.focus[g]!=='rest');
  }
  if(groups&&groups.length) plan.groups=[...new Set(groups)];
  plan.chosen=raw.chosen===true||(raw.chosen===undefined&&(raw.tier!==undefined||raw.focus!==undefined));
  return plan;
}
function defaultWeekPlan(mk=thisWeek()){
  const previousKey=Object.keys(DB.weekPlans||{}).filter(key=>key<mk).sort().reverse()[0];
  const previous=previousKey&&DB.weekPlans[previousKey];
  const groups=Array.isArray(previous?.groups)?previous.groups.filter(g=>ALL_GROUP_IDS.includes(g)):[];
  return {groups:groups.length?groups:ALL_GROUP_IDS.slice(),chosen:false};
}
function weekPlanFor(mk=thisWeek(),create=false){
  if(DB.weekPlans&&DB.weekPlans[mk]) return DB.weekPlans[mk];
  const plan=defaultWeekPlan(mk);
  if(create){
    if(!DB.weekPlans||typeof DB.weekPlans!=='object') DB.weekPlans={};
    DB.weekPlans[mk]=plan;
  }
  return plan;
}
function weekGroupsFor(mk=thisWeek()){
  const groups=weekPlanFor(mk).groups;
  return Array.isArray(groups)&&groups.length?groups:ALL_GROUP_IDS.slice();
}
function isGroupActive(group,mk=thisWeek()){ return weekGroupsFor(mk).includes(group); }
function focusGroupForExercise(ex){
  const group=pplOf(ex);
  return ALL_GROUP_IDS.includes(group)?group:'Other';
}
/* What one set of this exercise adds to the muscle bars: primary 1.0 + weighted secondaries. */
function exerciseContributions(ex){
  const primary=muscleOf(ex)||'Other';
  const parts=[{muscle:primary,weight:1,primary:true}];
  Object.entries(secondaryMuscles(ex)).sort((a,b)=>b[1]-a[1]).forEach(([muscle,weight])=>{
    if(muscle&&muscle!==primary&&weight>0) parts.push({muscle,weight,primary:false});
  });
  return parts;
}
function muscleThresholds(muscle){
  return BAR_TIERS.map(t=>{ const tier=REC_SETS_TIERS[t.id]; return tier[muscle]||tier.Other; });
}
function muscleEffective(mk=thisWeek()){
  const rows={};
  const ensure=m=>rows[m]||(rows[m]={muscle:m,eff:0,direct:0,inProgram:false});
  DB.exercises.forEach(ex=>{
    ensure(muscleOf(ex)||'Other').inProgram=true;
    const n=setsFor(ex.id,mk).length;
    if(!n) return;
    exerciseContributions(ex).forEach(p=>{
      const row=ensure(p.muscle);
      row.eff+=n*p.weight;
      if(p.primary) row.direct+=n;
    });
  });
  return rows;
}
function muscleBarState(eff,muscle){
  const thresholds=muscleThresholds(muscle);
  let cleared=0;
  while(cleared<thresholds.length&&eff>=thresholds[cleared]-1e-9) cleared++;
  const prev=cleared>0?thresholds[cleared-1]:0;
  const next=cleared<thresholds.length?thresholds[cleared]:null;
  const pct=next===null?100:Math.max(0,Math.min(100,(eff-prev)/(next-prev)*100));
  return {thresholds,cleared,prev,next,pct};
}
function weeklyMaintainProgress(mk=thisWeek()){
  const list=Object.values(muscleEffective(mk)).filter(r=>r.inProgram&&isGroupActive(MUSCLE_PPL[r.muscle]||'Other',mk));
  const done=list.filter(r=>r.eff>=muscleThresholds(r.muscle)[0]-1e-9).length;
  return {done,target:list.length};
}
function setScore(s){ return s ? ((s.kg||0)>0 ? (s.kg*1000+s.reps) : s.reps) : 0; }
function betterSet(a,b){
  if(!a) return b;
  if(!b) return a;
  const ak=a.kg||0, bk=b.kg||0;
  if(Math.abs(ak-bk)>0.001) return ak>bk ? a : b;
  if(a.reps!==b.reps) return a.reps>b.reps ? a : b;
  return (a.ts||0)>=(b.ts||0) ? a : b;
}
function bestSet(sets){ return sets.reduce((best,s)=>betterSet(best,s),null); }
function fmtSet(s){ return s?`${s.reps}×${fmtW(s.kg)}`:'—'; }
function currentActiveWorkout(){
  return DB.activeWorkout&&DB.activeWorkout.status==='active'?DB.activeWorkout:null;
}
function setsForWorkout(w){
  if(!w) return [];
  const ids=new Set(w.setIds||[]);
  return DB.sets.filter(s=>s.workoutId===w.id||ids.has(s.id)).sort((a,b)=>a.ts-b.ts);
}
function workoutTime(ms){
  return new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function workoutDuration(start,end=Date.now()){
  const mins=Math.max(0,Math.round((end-start)/60000));
  if(mins<60) return `${mins} min`;
  const h=Math.floor(mins/60), m=mins%60;
  return `${h}h ${m}m`;
}
function ensureActiveWorkout(message){
  let w=currentActiveWorkout();
  if(w) return w;
  const now=Date.now();
  w={id:uid('w'),status:'active',startedAt:now,date:todayKey(),setIds:[]};
  DB.activeWorkout=w;
  save();
  if(message) toast(message);
  return w;
}
function startWorkout(){
  const existed=Boolean(currentActiveWorkout());
  ensureActiveWorkout(existed?"Workout already active":"Workout started");
  renderWeek();
}
function cancelActiveWorkout(){
  const w=currentActiveWorkout();
  if(!w){ toast("No active workout"); return; }
  const sets=setsForWorkout(w);
  if(sets.length && !confirm("Cancel this active workout and delete its logged sets?")){
    toast("Workout kept");
    return;
  }
  if(sets.length){
    const ids=new Set(sets.map(s=>s.id));
    DB.sets=DB.sets.filter(s=>!ids.has(s.id));
  }
  DB.activeWorkout=null;
  save();
  refreshAll();
  toast(sets.length?"Workout cancelled":"Empty workout cancelled");
}
let FINISHING_WORKOUT=false;
function completeActiveWorkout(){
  if(FINISHING_WORKOUT) return false;
  const w=currentActiveWorkout();
  if(!w){ toast("No active workout"); return false; }
  const sets=setsForWorkout(w);
  if(!sets.length){ toast("Log a set before finishing"); return false; }
  FINISHING_WORKOUT=true;
  document.getElementById('finDoneBtn').disabled=true;
  const endedAt=Date.now();
  const setIds=sets.map(s=>s.id);
  if(!DB.workouts.some(done=>done.id===w.id)){
    DB.workouts.push({
      id:w.id,
      status:'completed',
      startedAt:w.startedAt,
      endedAt,
      date:dateKey(new Date(w.startedAt)),
      setIds
    });
  }
  sets.forEach(s=>{ s.workoutId=w.id; });
  DB.activeWorkout=null;
  save();
  closeSheets();
  refreshAll();
  toast("Workout saved");
  setTimeout(()=>{ FINISHING_WORKOUT=false; document.getElementById('finDoneBtn').disabled=false; },250);
  return true;
}
function deleteCompletedWorkout(id){
  const w=DB.workouts.find(x=>x.id===id&&x.status==='completed');
  if(!w){ toast("Workout not found"); return; }
  if(!confirm("Delete this completed workout? This removes its logged sets and cannot be undone.")) return;
  const ids=new Set((w.setIds||[]).concat(DB.sets.filter(s=>s.workoutId===id).map(s=>s.id)));
  DB.sets=DB.sets.filter(s=>!ids.has(s.id));
  DB.workouts=DB.workouts.filter(x=>x.id!==id);
  save();
  refreshAll();
  toast("Workout deleted");
}
function removeLoggedSet(id){
  const set=DB.sets.find(s=>s.id===id);
  if(!set){ toast("Set not found"); return false; }
  if(!confirm(`Remove logged set ${fmtSet(set)}? This cannot be undone.`)) return false;
  DB.sets=DB.sets.filter(s=>s.id!==id);
  if(DB.activeWorkout&&Array.isArray(DB.activeWorkout.setIds)){
    DB.activeWorkout.setIds=DB.activeWorkout.setIds.filter(setId=>setId!==id);
  }
  DB.workouts.forEach(workout=>{
    if(Array.isArray(workout.setIds)) workout.setIds=workout.setIds.filter(setId=>setId!==id);
  });
  save();
  refreshAll();
  toast("Set removed");
  return true;
}
function renderWorkoutPanel(){
  const panel=document.getElementById('workoutPanel');
  const w=currentActiveWorkout();
  if(!w){
    panel.innerHTML=`<div class="workout-status"><strong>No active workout</strong>Start a session before logging sets.</div>
      <div class="workout-actions"><button class="btn" id="startWorkoutBtn" type="button">Start workout</button></div>`;
    panel.querySelector('#startWorkoutBtn').onclick=startWorkout;
    return;
  }
  const count=setsForWorkout(w).length;
  panel.innerHTML=`<div class="workout-status"><strong>Workout in progress</strong>Started ${workoutTime(w.startedAt)} · ${count} set${count===1?'':'s'} logged</div>
    <div class="workout-actions">
      <button class="ghost" id="cancelWorkoutBtn" type="button">Cancel workout</button>
      <button class="finbtn" id="finishBtn" type="button" style="margin:0;">Finish workout</button>
    </div>`;
  panel.querySelector('#cancelWorkoutBtn').onclick=cancelActiveWorkout;
  panel.querySelector('#finishBtn').onclick=openFinish;
}
function setDelta(first,last){
  if(!first||!last) return {cls:'flat',arrow:'—',label:'—',rank:0};
  const kgDelta=Math.round(((last.kg||0)-(first.kg||0))*100)/100;
  if(Math.abs(kgDelta)>0.001){
    return {cls:kgDelta>0?'up':'down',arrow:kgDelta>0?'▲':'▼',label:`${kgDelta>0?'+':''}${kgDelta}kg`,rank:kgDelta*1000};
  }
  const repDelta=last.reps-first.reps;
  return {cls:repDelta>0?'up':repDelta<0?'down':'flat',arrow:repDelta>0?'▲':repDelta<0?'▼':'—',
    label:repDelta?`${repDelta>0?'+':''}${repDelta} rep${Math.abs(repDelta)===1?'':'s'}`:'same',rank:repDelta};
}

/* Double-progression suggestion from most recent set.
   The prefilled reps/kg always REPEAT the last set (realistic — no auto jump in weight).
   Progression is shown only as a text hint the lifter can choose to act on. */
function suggest(ex){
  const all=allSetsFor(ex.id);
  if(!all.length) return {reps:ex.low, kg:0, up:false,
    tip:`New — aim ${ex.low}–${ex.high} reps`,
    msg:`First time — find a weight you can do for ${ex.low}–${ex.high} reps`};
  const last=all[all.length-1];
  const nextKg=Math.round((last.kg+ex.inc)*4)/4;
  if(last.reps>=ex.high){
    return {reps:last.reps, kg:last.kg, up:true,
      tip:`<span class="up">↑ ready for ${fmtW(nextKg)}</span> · last ${last.reps}×${fmtW(last.kg)}`,
      msg:`Last hit ${last.reps} reps 🎯 — when you're ready, move up to <b>${fmtW(nextKg)}</b> and drop back to ~${ex.low} reps`};
  }
  const aim=Math.min(last.reps+1,ex.high);
  return {reps:last.reps, kg:last.kg, up:false,
    tip:`Last ${last.reps}×${fmtW(last.kg)} · aim ${aim}+ reps`,
    msg:`Last: <b>${last.reps}×${fmtW(last.kg)}</b> — keep the weight, aim for ${aim}+ reps`};
}

/* ================= View switching ================= */
const views={week:"v-week",history:"v-history",stats:"v-stats",catalog:"v-catalog"};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  Object.values(views).forEach(id=>document.getElementById(id).classList.remove('active'));
  document.getElementById(views[b.dataset.view]).classList.add('active');
  if(b.dataset.view==='history')renderHistory();
  if(b.dataset.view==='stats')requestAnimationFrame(renderStats);
  if(b.dataset.view==='catalog')renderCatalog();
  window.scrollTo(0,0);
});

/* ================= Toast / sheets ================= */
let tT; function toast(m){ const e=document.getElementById('toast'); e.textContent=m; e.classList.add('show'); clearTimeout(tT); tT=setTimeout(()=>e.classList.remove('show'),1800); }
const bg=document.getElementById('sheetBg');
function setSheetHidden(sheet,hidden){
  sheet.inert=hidden;
  sheet.setAttribute('aria-hidden',hidden?'true':'false');
}
function openSheet(id){
  bg.classList.add('show');
  document.body.classList.add('sheet-open');
  document.querySelectorAll('.sheet').forEach(s=>{ s.classList.remove('show'); setSheetHidden(s,true); });
  const sheet=document.getElementById(id);
  sheet.classList.add('show');
  setSheetHidden(sheet,false);
}
function closeSheets(){
  bg.classList.remove('show');
  document.body.classList.remove('sheet-open');
  document.querySelectorAll('.sheet').forEach(s=>{ s.classList.remove('show'); setSheetHidden(s,true); });
}
bg.onclick=closeSheets;
closeSheets();
