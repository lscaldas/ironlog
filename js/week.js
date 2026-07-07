"use strict";
/* ================= WEEK view ================= */
let GMODE=localStorage.getItem('ironlog.gmode')||'muscle';
if(GMODE==='program'||GMODE==='area') GMODE='muscle';
let MBAL_MODE=localStorage.getItem('ironlog.mbalMode')||'plan';
let GROUP_VIS={};
try{ GROUP_VIS=JSON.parse(localStorage.getItem('ironlog.groupVis')||'{}')||{}; }catch{ GROUP_VIS={}; }
const GROUP_ORDER={ region:['Upper','Lower','Core','Other'], ppl:['Push','Pull','Legs','Core','Other'], muscle:MUSCLES.concat(['Other']), area:AREAS.concat(['Other']) };
function groupOf(ex,mode){
  const m=muscleOf(ex); if(!m) return 'Other';
  if(mode==='muscle') return m;
  if(mode==='area') return areaOf(ex);
  if(mode==='region') return MUSCLE_REGION[m]||'Other';
  if(mode==='ppl') return pplOf(ex);
  return ex.bucket||'Other';
}
/* → ordered [ [groupName, [exercises]], ... ] for the active mode */
function groupedExercises(mode){
  const m={}, seen=[];
  DB.exercises.forEach(e=>{
    const k=groupOf(e,mode);
    if(!m[k]){ m[k]=[]; seen.push(k); }
    m[k].push(e);
  });
  const order=GROUP_ORDER[mode]; let keys=Object.keys(m);
  if(order) keys.sort((a,b)=>{ const ia=order.indexOf(a),ib=order.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b); });
  else keys=seen;
  return keys.map(k=>[k,m[k]]);
}
function groupProgress(items,mk){
  let done=0,target=0;
  items.forEach(e=>{ done+=Math.min(setsFor(e.id,mk).length,e.target); target+=e.target; });
  return {done,target};
}
function groupVisKey(mode,name){ return `${mode}:${name}`; }
function isGroupVisible(mode,name){ return GROUP_VIS[groupVisKey(mode,name)]!==false; }
function setGroupVisible(mode,name,val){
  GROUP_VIS[groupVisKey(mode,name)]=!!val;
  localStorage.setItem('ironlog.groupVis',JSON.stringify(GROUP_VIS));
}
function toggleGroup(mode,name){
  setGroupVisible(mode,name,!isGroupVisible(mode,name));
  renderWeek();
}
function sortForWeek(items,mk){
  return items.slice().sort((a,b)=>{
    const ar=Math.max(0,a.target-setsFor(a.id,mk).length);
    const br=Math.max(0,b.target-setsFor(b.id,mk).length);
    return (br>0)-(ar>0);
  });
}
function renderGroupChips(){
  document.querySelectorAll('#groupSeg .gchip').forEach(b=>b.classList.toggle('on',b.dataset.g===GMODE));
  document.querySelectorAll('#tierSeg .tchip').forEach(b=>b.classList.toggle('on',b.dataset.t===TRAINING_TIER));
}
function renderMuscleBalance(mk){
  const rows={};
  const ensure=muscle=>rows[muscle]||(rows[muscle]={muscle,done:0,target:0,actual:0,effective:0});
  DB.exercises.forEach(e=>{
    const m=muscleOf(e)||'Other';
    const ss=setsFor(e.id,mk);
    const primary=ensure(m);
    primary.done+=Math.min(ss.length,e.target);
    primary.actual+=ss.length;
    primary.target+=e.target;
    primary.effective+=ss.length;
    const secondary=secondaryMuscles(e);
    Object.entries(secondary).forEach(([muscle,weight])=>{
      ensure(muscle).effective+=ss.length*weight;
    });
  });
  const order=MUSCLES.concat(['Other']);
  const data=Object.values(rows).filter(r=>r.target>0||r.effective>0).sort((a,b)=>{
    const ia=order.indexOf(a.muscle), ib=order.indexOf(b.muscle);
    return (ia<0?99:ia)-(ib<0?99:ib)||a.muscle.localeCompare(b.muscle);
  });
  document.querySelectorAll('#mbalMode button').forEach(b=>b.classList.toggle('on',b.dataset.m===MBAL_MODE));
  const isEff=MBAL_MODE==='effective';
  const totalDone=data.reduce((a,r)=>a+r.done,0), totalTarget=data.reduce((a,r)=>a+r.target,0);
  document.getElementById('mbalSub').textContent=isEff
    ? `effective sets / ${TIER_META[TRAINING_TIER].label} recommended`
    : (totalTarget?`${totalDone}/${totalTarget} planned sets`:'');
  document.getElementById('mbalList').innerHTML=data.length?data.map(r=>{
    const eff=Math.round(r.effective*10)/10;
    const rec=recMin(r.muscle);
    const value=isEff?eff:r.done;
    const target=isEff?rec:r.target;
    const rawPct=target>0?value/target*100:0;
    const pct=value>0?Math.max(3,Math.min(100,rawPct)):3;
    const cls=target>0&&value===0?' ignored':'';
    const color=value>=target?'var(--good)':value>0?'var(--blue)':'var(--bad)';
    return `<div class="mrow${cls}" title="${r.actual} direct logged set${r.actual===1?'':'s'} this week">
      <div class="mname">${esc(r.muscle)}</div>
      <div class="mbar"><i style="width:${pct}%;background:${color}"></i></div>
      <div class="mct">${fmtEff(value)}/${target}</div>
    </div>`;
  }).join(''):`<div class="sub">Add exercises to see weekly muscle balance.</div>`;
}
document.querySelectorAll('#tierSeg .tchip').forEach(b=>b.onclick=()=>{
  TRAINING_TIER=b.dataset.t; localStorage.setItem('ironlog.tier',TRAINING_TIER);
  // Surface the effect: jump to the effective view where recommended sets live.
  MBAL_MODE='effective'; localStorage.setItem('ironlog.mbalMode',MBAL_MODE);
  document.getElementById('mbalCard').classList.remove('closed');
  renderWeek();
  toast(`${TIER_META[TRAINING_TIER].icon} ${TIER_META[TRAINING_TIER].label} week`);
});
document.querySelectorAll('#groupSeg .gchip').forEach(b=>b.onclick=()=>{
  GMODE=b.dataset.g; localStorage.setItem('ironlog.gmode',GMODE); renderWeek();
});
document.getElementById('mbalToggle').onclick=()=>document.getElementById('mbalCard').classList.toggle('closed');
document.querySelectorAll('#mbalMode button').forEach(b=>b.onclick=e=>{
  e.stopPropagation();
  MBAL_MODE=b.dataset.m;
  localStorage.setItem('ironlog.mbalMode',MBAL_MODE);
  document.getElementById('mbalCard').classList.remove('closed');
  renderMuscleBalance(thisWeek());
});

function renderWeek(){
  const mk=thisWeek();
  document.getElementById('weekLabel').textContent="Week of "+weekLabel(mk);
  const exs=DB.exercises;
  document.getElementById('weekEmpty').style.display=exs.length?'none':'block';
  // totals
  let doneT=0,tgtT=0;
  exs.forEach(e=>{ doneT+=Math.min(setsFor(e.id,mk).length,e.target); tgtT+=e.target; });
  const pct=tgtT?Math.round(doneT/tgtT*100):0;
  const ring=document.getElementById('ring');
  const col=pct>=100?'var(--good)':'var(--accent)';
  ring.style.background=`conic-gradient(${col} ${pct*3.6}deg, var(--line) 0deg)`;
  document.getElementById('ringPct').textContent=pct+"%";
  document.getElementById('ringTxt').textContent=doneT+"/"+tgtT+" sets";
  document.getElementById('weekHead').textContent =
    !tgtT?"Add exercises to begin": pct>=100?"Week complete — beast 🔥": doneT===0?"Fresh week. Let's go 💪":(tgtT-doneT)+" sets to go this week";
  renderGroupChips();
  renderMuscleBalance(mk);
  renderWorkoutPanel();

  const groups=groupedExercises(GMODE);
  const wl=document.getElementById('weekList'); wl.innerHTML='';
  groups.forEach(([b,rawItems])=>{
    const items=sortForWeek(rawItems,mk);
    const {done:bd,target:bt}=groupProgress(items,mk);
    const visible=isGroupVisible(GMODE,b);
    const section=document.createElement('div'); section.className='group-section'+(visible?'':' collapsed');
    const head=document.createElement('div'); head.className='bucket-h';
    head.innerHTML=`<h2>${esc(b)}</h2><div class="ln"></div><div class="bcount">${bd}/${bt}</div><button class="group-toggle ${visible?'on':''}" type="button">${visible?'Hide':'Show'}</button>`;
    head.querySelector('.group-toggle').onclick=()=>toggleGroup(GMODE,b);
    section.appendChild(head);
    items.forEach(e=>section.appendChild(exCard(e,mk)));
    wl.appendChild(section);
  });
}

function exCard(e,mk){
  const sets=setsFor(e.id,mk).sort((a,b)=>a.ts-b.ts);
  const done=sets.length;
  const isDone=done>=e.target;
  const sg=suggest(e);
  const node=document.createElement('div'); node.className='ex'+(isDone?' done':'');
  // dots — one per target set, extras dashed
  let dots='';
  for(let i=0;i<e.target;i++) dots+=`<span class="dot ${i<done?'fill':''}">${i<done?'✓':''}</span>`;
  for(let i=e.target;i<done;i++) dots+=`<span class="dot fill extra">+</span>`;
  // this week's sets, compact
  const best=bestSet(sets);
  const chips=sets.map(s=>`<span class="wkchip ${best&&s.id===best.id&&done>1?'best':''}"><b>${s.reps}</b>×${fmtW(s.kg)}<button class="editSet" type="button" data-sid="${esc(s.id)}" aria-label="Edit set ${s.reps} by ${fmtW(s.kg)}">Edit</button><button class="x" type="button" data-sid="${esc(s.id)}" aria-label="Remove set ${s.reps} by ${fmtW(s.kg)}">x</button></span>`).join('');
  const tip=sg.tip+(e.notes?` · ${esc(e.notes)}`:'');
  const matchNote=inferredExerciseNote(e);
  node.innerHTML=`
    <div class="ex-top">
      <div class="ex-main">
        <div class="exname">${esc(e.name)}</div>
        <div class="ex-meta"><span class="dots">${dots}</span><span class="remain">${isDone?'done ✓':'<b>'+done+'</b>/'+e.target}</span></div>
        <div class="exsub">${tip}</div>
        ${matchNote?`<div class="match-note">${matchNote}</div>`:''}
      </div>
      <button class="editEx" title="Edit">⚙︎</button>
      <button class="log-plus" title="Log set">＋</button>
    </div>
    ${chips?`<div class="wkchips">${chips}</div>`:''}`;
  node.querySelector('.log-plus').onclick=()=>openLog(e);
  node.querySelector('.editEx').onclick=()=>openEx(e);
  node.querySelectorAll('.editSet').forEach(btn=>btn.onclick=()=>{ const s=DB.sets.find(x=>x.id===btn.dataset.sid); if(s) openSetEdit(s); });
  node.querySelectorAll('.x').forEach(x=>x.onclick=()=>{ DB.sets=DB.sets.filter(s=>s.id!==x.dataset.sid); save(); renderWeek(); toast("Set removed"); });
  return node;
}

/* ================= Log set flow ================= */
let logEx=null;
let editSetId=null;
let LOG_SUBMITTING=false;
let LAST_LOG_SIGNATURE={sig:'',at:0};
function setLogButtonsBusy(busy){
  LOG_SUBMITTING=busy;
  document.getElementById('saveSetBtn').disabled=busy;
  document.getElementById('saveSetMoreBtn').disabled=busy;
}
function openLog(e){
  ensureActiveWorkout("Workout started");
  renderWorkoutPanel();
  setLogButtonsBusy(false);
  editSetId=null;
  document.getElementById('saveSetBtn').textContent='Log this set';
  document.getElementById('saveSetMoreBtn').hidden=false;
  logEx=e; const sg=suggest(e);
  document.getElementById('logTitle').textContent=e.name;
  const sets=setsFor(e.id,thisWeek()).length;
  document.getElementById('logSub').textContent=`Set ${sets+1} of ${e.target} this week · ${muscleOf(e)||e.bucket||''}`;
  document.getElementById('inReps').value=sg.reps;
  document.getElementById('inKg').value=sg.kg;
  const hint=document.getElementById('logHint'); hint.className='sugg '+(sg.up?'up':''); hint.innerHTML=`<span class="ic">💡</span><span class="m">${sg.msg}</span>`;
  openSheet('logSheet');
}
function openSetEdit(set){
  const e=exerciseById(set.exId);
  if(!e){ toast("Exercise missing"); return; }
  setLogButtonsBusy(false);
  logEx=e;
  editSetId=set.id;
  document.getElementById('saveSetBtn').textContent='Save set';
  document.getElementById('saveSetMoreBtn').hidden=true;
  document.getElementById('logTitle').textContent='Edit set';
  document.getElementById('logSub').textContent=e.name;
  document.getElementById('inReps').value=set.reps;
  document.getElementById('inKg').value=set.kg;
  const hint=document.getElementById('logHint');
  hint.className='sugg';
  hint.innerHTML='<span class="ic">i</span><span class="m">Update this logged set without changing its workout.</span>';
  openSheet('logSheet');
}
document.querySelectorAll('#logSheet .step button').forEach(b=>b.onclick=()=>{
  const inp=document.getElementById(b.dataset.t==='reps'?'inReps':'inKg');
  const stepv=b.dataset.t==='reps'?1:(logEx?logEx.inc:2.5);
  let v=parseFloat(inp.value)||0; v=Math.max(0,Math.round((v+stepv*(+b.dataset.d))*100)/100); inp.value=v;
});
function readSetInput(){
  const repsRaw=document.getElementById('inReps').value.trim();
  const kgRaw=document.getElementById('inKg').value.trim();
  if(!/^\d+$/.test(repsRaw)){ toast("Reps must be a whole number"); return null; }
  const reps=Number(repsRaw);
  if(!Number.isInteger(reps)||reps<1||reps>999){ toast("Reps must be 1-999"); return null; }
  if(kgRaw && !/^\d+(\.\d{1,2})?$/.test(kgRaw)){ toast("Weight must be a non-negative decimal"); return null; }
  const kg=kgRaw?Number(kgRaw):0;
  if(!Number.isFinite(kg)||kg<0||kg>999){ toast("Weight must be 0-999 kg"); return null; }
  return {reps,kg};
}
function doLog(){
  if(LOG_SUBMITTING) return false;
  if(!logEx)return false;
  const values=readSetInput();
  if(!values) return false;
  const {reps,kg}=values;
  const w=ensureActiveWorkout();
  const sig=[w.id,logEx.id,reps,kg].join(':');
  const now=Date.now();
  if(LAST_LOG_SIGNATURE.sig===sig && now-LAST_LOG_SIGNATURE.at<900){
    toast("Set already logged");
    return false;
  }
  setLogButtonsBusy(true);
  const d=todayKey();
  const set={id:uid('s'),workoutId:w.id,exId:logEx.id,date:d,ts:now,reps,kg};
  DB.sets.push(set);
  w.setIds=[...new Set((w.setIds||[]).concat(set.id))];
  LAST_LOG_SIGNATURE={sig,at:now};
  save(); return true;
}
function doUpdateSet(){
  if(LOG_SUBMITTING) return false;
  const set=DB.sets.find(s=>s.id===editSetId);
  if(!set){ toast("Set not found"); return false; }
  const values=readSetInput();
  if(!values) return false;
  setLogButtonsBusy(true);
  set.reps=values.reps;
  set.kg=values.kg;
  save();
  return true;
}
document.getElementById('saveSetBtn').onclick=()=>{ if(editSetId){ if(doUpdateSet()){ closeSheets(); renderWeek(); toast("Set updated"); } else setLogButtonsBusy(false); return; } if(doLog()){ closeSheets(); renderWeek(); const r=Math.max(0,logEx.target-setsFor(logEx.id,thisWeek()).length); toast(r?`Logged ✓ — ${r} left`:`${logEx.name} complete! ✓`); } else setLogButtonsBusy(false); };
document.getElementById('saveSetMoreBtn').onclick=()=>{ if(doLog()){ const e=logEx; renderWeek(); openLog(e); toast("Logged ✓"); } else setLogButtonsBusy(false); };

/* ================= Finish workout ================= */
function exerciseById(id){ return DB.exercises.find(e=>e.id===id); }
function openFinish(){
  const w=currentActiveWorkout();
  if(!w){ toast("Start a workout first"); return; }
  const d=w.date||todayKey(), mk=thisWeek();
  const todays=setsForWorkout(w);
  const byEx={};
  todays.forEach(s=>{ (byEx[s.exId]=byEx[s.exId]||[]).push(s); });
  document.getElementById('finSub').textContent=todays.length
    ? `Workout session · ${todays.length} set${todays.length===1?'':'s'} · ${Object.keys(byEx).length} exercise${Object.keys(byEx).length===1?'':'s'}`
    : `Workout session · no sets logged yet`;
  document.getElementById('finDoneBtn').disabled=false;

  const rows=Object.entries(byEx).map(([id,sets])=>{
    const e=exerciseById(id), name=e?e.name:'(removed)';
    const setTxt=sets.map(s=>`${s.reps}×${fmtW(s.kg)}`).join('  ·  ');
    return `<div class="day-ex"><div class="nm">${esc(name)} <span style="color:var(--dim);font-weight:400">· ${sets.length} set${sets.length>1?'s':''}</span></div>
      <div class="st">${setTxt}</div></div>`;
  }).join('');

  const byMuscle={};
  todays.forEach(s=>{
    const e=exerciseById(s.exId);
    const m=e?(muscleOf(e)||'Other'):'Other';
    byMuscle[m]=(byMuscle[m]||0)+1;
  });
  const muscleChips=Object.entries(byMuscle).sort((a,b)=>b[1]-a[1]).map(([m,c])=>
    `<span class="wkchip">${esc(m)} <b>${c}</b></span>`).join('');

  const remaining=groupedExercises('muscle').map(([m,items])=>{
    const left=items.reduce((a,e)=>a+Math.max(0,e.target-setsFor(e.id,mk).length),0);
    return {m,left};
  }).filter(r=>r.left>0).sort((a,b)=>b.left-a.left);
  const remTxt=remaining.length
    ? remaining.slice(0,6).map(r=>`<span class="wkchip">${esc(r.m)} <b>${r.left}</b> left</span>`).join('')
    : `<span class="wkchip best">weekly targets hit</span>`;

  const byArea={};
  todays.forEach(s=>{
    const e=exerciseById(s.exId);
    const area=e?(areaOf(e)||'Other'):'Other';
    byArea[area]=(byArea[area]||0)+1;
  });
  const areaChips=Object.entries(byArea).sort((a,b)=>b[1]-a[1]).map(([a,c])=>
    `<span class="wkchip">${esc(a)} <b>${c}</b></span>`).join('');

  document.getElementById('finBody').innerHTML=`
    <div class="card" style="box-shadow:none;margin-bottom:10px;">
      <div class="card-h"><h2>${relDay(d)}</h2><div class="sub">${todays.length?'logged sets':'nothing logged'}</div></div>
      ${rows||'<div class="sub">Log a set first, then come back here to close out the session.</div>'}
    </div>
    <div class="card" style="box-shadow:none;margin-bottom:10px;">
      <div class="card-h"><h2>Muscles hit today</h2></div>
      <div class="finchips">${muscleChips||'<span class="sub">No muscle groups yet.</span>'}</div>
    </div>
    <div class="card" style="box-shadow:none;margin-bottom:10px;">
      <div class="card-h"><h2>Areas hit today</h2></div>
      <div class="finchips">${areaChips||'<span class="sub">No areas yet.</span>'}</div>
    </div>
    <div class="card" style="box-shadow:none;margin-bottom:0;">
      <div class="card-h"><h2>Still left this week</h2></div>
      <div class="finchips">${remTxt}</div>
    </div>`;
  openSheet('finSheet');
}
document.getElementById('finDoneBtn').onclick=completeActiveWorkout;
