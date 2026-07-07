"use strict";
/* ================= Helpers ================= */
const setsFor=(exId,mk)=>DB.sets.filter(s=>s.exId===exId && mondayOf(s.date)===mk);
const allSetsFor=exId=>DB.sets.filter(s=>s.exId===exId).sort((a,b)=>a.ts-b.ts);
const fmtW=kg=>kg>0?kg+"kg":"BW";
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
