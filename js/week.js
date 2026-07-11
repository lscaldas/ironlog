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
  items.forEach(e=>{ const goal=weeklyTargetForExercise(e,mk); done+=Math.min(setsFor(e.id,mk).length,goal); target+=goal; });
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
  const tier=weekTierFor(thisWeek());
  document.querySelectorAll('#tierSeg .tchip').forEach(b=>b.classList.toggle('on',b.dataset.t===tier));
}
function renderMuscleBalance(mk){
  const rows={};
  const ensure=muscle=>rows[muscle]||(rows[muscle]={muscle,done:0,target:0,actual:0,effective:0});
  DB.exercises.forEach(e=>{
    const m=muscleOf(e)||'Other';
    const ss=setsFor(e.id,mk);
    const primary=ensure(m);
    const goal=weeklyTargetForExercise(e,mk);
    primary.done+=Math.min(ss.length,goal);
    primary.actual+=ss.length;
    primary.target+=goal;
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
    const color=target>0&&value>=target?'var(--good)':value>0?'var(--blue)':'var(--dim)';
    return `<div class="mrow${cls}" title="${r.actual} direct logged set${r.actual===1?'':'s'} this week">
      <div class="mname">${esc(r.muscle)}</div>
      <div class="mbar"><i style="width:${pct}%;background:${color}"></i></div>
      <div class="mct">${fmtEff(value)}/${target}</div>
    </div>`;
  }).join(''):`<div class="sub">Add exercises to see weekly muscle balance.</div>`;
}
document.querySelectorAll('#tierSeg .tchip').forEach(b=>b.onclick=()=>{
  const plan=weekPlanFor(thisWeek(),true);
  plan.tier=b.dataset.t;
  TRAINING_TIER=plan.tier;
  localStorage.setItem('ironlog.tier',TRAINING_TIER);
  save();
  refreshAll();
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

function setWeeklyFocus(group,state){
  if(!WEEK_FOCUS_STATES.includes(state)) return;
  const plan=weekPlanFor(thisWeek(),true);
  plan.focus[group]=state;
  save();
  refreshAll();
  const labels={quest:'Quest',bonus:'Bonus',rest:'Rest'};
  toast(`${group} set to ${labels[state]}`);
}
function loadoutGroupExercises(group){ return DB.exercises.filter(ex=>focusGroupForExercise(ex)===group); }
function loadoutProgress(group,mk){
  const exercises=loadoutGroupExercises(group);
  const state=focusStateFor(group,mk);
  const actual=exercises.reduce((sum,ex)=>sum+setsFor(ex.id,mk).length,0);
  const target=exercises.reduce((sum,ex)=>sum+weeklyTargetForExercise(ex,mk),0);
  const done=exercises.reduce((sum,ex)=>sum+Math.min(setsFor(ex.id,mk).length,weeklyTargetForExercise(ex,mk)),0);
  return {exercises,state,actual,target,done};
}
function renderWeeklyLoadout(mk){
  const list=document.getElementById('loadoutList');
  const groups=WEEK_LOADOUT_GROUPS.filter(group=>loadoutGroupExercises(group.id).length||group.id!=='Other');
  list.innerHTML=groups.map(group=>{
    const p=loadoutProgress(group.id,mk);
    const pct=p.target?Math.min(100,Math.round(p.done/p.target*100)):0;
    const metric=p.state==='quest'?`${p.done}/${p.target}`:(p.actual?`${p.actual} logged`:'Optional');
    return `<div class="loadout-row role-${p.state}" data-loadout-group="${group.id}">
      <div class="ability-icon" aria-hidden="true">${group.icon}</div>
      <div class="ability-copy"><div><b>${group.ability}</b><span>${group.id}</span></div><small>${group.muscles}</small>
        <div class="ability-bar"><i style="width:${pct}%"></i></div></div>
      <div class="ability-state"><span>${metric}</span><select aria-label="${group.id} weekly role" data-focus-group="${group.id}">
        <option value="quest" ${p.state==='quest'?'selected':''}>Quest</option>
        <option value="bonus" ${p.state==='bonus'?'selected':''}>Bonus</option>
        <option value="rest" ${p.state==='rest'?'selected':''}>Rest</option>
      </select></div>
    </div>`;
  }).join('');
  list.querySelectorAll('select[data-focus-group]').forEach(select=>select.onchange=()=>setWeeklyFocus(select.dataset.focusGroup,select.value));
}
function renderNextQuests(mk){
  const candidates=DB.exercises.map(ex=>{
    const target=weeklyTargetForExercise(ex,mk);
    const done=Math.min(setsFor(ex.id,mk).length,target);
    return {ex,target,done,left:Math.max(0,target-done)};
  }).filter(item=>item.target>0&&item.left>0).sort((a,b)=>a.done/a.target-b.done/b.target||b.left-a.left).slice(0,3);
  document.getElementById('nextQuestSub').textContent=candidates.length?`${candidates.length} suggested moves`:'';
  const list=document.getElementById('nextQuestList');
  list.innerHTML=candidates.length?candidates.map(item=>{
    const group=WEEK_LOADOUT_GROUPS.find(entry=>entry.id===focusGroupForExercise(item.ex));
    return `<div class="next-quest" data-exid="${esc(item.ex.id)}"><div><b>${esc(item.ex.name)}</b><span>${item.left} set${item.left===1?'':'s'} left · ${group?.ability||'Wildcard'} XP</span></div>
      <button type="button" title="Log set" aria-label="Log set for ${esc(item.ex.name)}">＋</button></div>`;
  }).join(''):`<div class="quest-clear"><b>Quest clear</b><span>Your selected weekly targets are complete. Every exercise is still available below.</span></div>`;
  list.querySelectorAll('.next-quest button').forEach(button=>button.onclick=()=>{ const ex=exerciseById(button.closest('.next-quest').dataset.exid); if(ex) openLog(ex); });
}

function renderWeek(){
  const mk=thisWeek();
  TRAINING_TIER=weekTierFor(mk);
  document.getElementById('weekLabel').textContent="Week of "+weekLabel(mk);
  const exs=DB.exercises;
  document.getElementById('weekEmpty').style.display=exs.length?'none':'block';
  const {done:doneT,target:tgtT}=weeklyQuestProgress(mk);
  const pct=tgtT?Math.round(doneT/tgtT*100):0;
  const ring=document.getElementById('ring');
  const col=pct>=100?'var(--good)':'var(--accent)';
  ring.style.background=`conic-gradient(${col} ${pct*3.6}deg, var(--line) 0deg)`;
  document.getElementById('ringPct').textContent=pct+"%";
  document.getElementById('ringTxt').textContent=doneT+"/"+tgtT+" sets";
  document.getElementById('weekHead').textContent =
    !tgtT?"Free training week": pct>=100?"Quest complete 🔥": doneT===0?"Choose your path. Start anywhere.":(tgtT-doneT)+" quest sets remaining";
  const tierLabels={maintain:'Maintain',build:'Build',beast:'Beast'};
  const tierNotes={maintain:'Light recovery-friendly volume',build:'Balanced progression',beast:'High-volume challenge'};
  document.getElementById('tierSummary').textContent=`${tierLabels[TRAINING_TIER]} · ${tierNotes[TRAINING_TIER]} · ${tgtT} quest sets`;
  renderGroupChips();
  renderWeeklyLoadout(mk);
  renderNextQuests(mk);
  renderMuscleBalance(mk);
  renderWorkoutPanel();

  const groups=groupedExercises(GMODE);
  const wl=document.getElementById('weekList'); wl.innerHTML='';
  groups.forEach(([b,rawItems])=>{
    const items=sortForWeek(rawItems,mk);
    const {done:bd,target:bt}=groupProgress(items,mk);
    const roles=[...new Set(items.map(ex=>focusStateFor(focusGroupForExercise(ex),mk)))];
    const role=roles.length===1?roles[0]:'mixed';
    const visible=isGroupVisible(GMODE,b);
    const section=document.createElement('div'); section.className=`group-section group-${role}`+(visible?'':' collapsed');
    const head=document.createElement('div'); head.className='bucket-h';
    const count=bt?`${bd}/${bt}`:(role==='rest'?'Rest':role==='bonus'?'Bonus':'Optional');
    head.innerHTML=`<h2>${esc(b)}</h2><span class="group-role role-${role}">${role}</span><div class="ln"></div><div class="bcount">${count}</div><button class="group-toggle ${visible?'on':''}" type="button">${visible?'Hide':'Show'}</button>`;
    head.querySelector('.group-toggle').onclick=()=>toggleGroup(GMODE,b);
    section.appendChild(head);
    items.forEach(e=>section.appendChild(exCard(e,mk)));
    wl.appendChild(section);
  });
}

function exCard(e,mk){
  const sets=setsFor(e.id,mk).sort((a,b)=>a.ts-b.ts);
  const done=sets.length;
  const target=weeklyTargetForExercise(e,mk);
  const focusState=focusStateFor(focusGroupForExercise(e),mk);
  const isDone=target>0&&done>=target;
  const sg=suggest(e);
  const node=document.createElement('div'); node.className=`ex focus-${focusState}`+(isDone?' done':'');
  // dots — one per target set, extras dashed
  let dots='';
  for(let i=0;i<target;i++) dots+=`<span class="dot ${i<done?'fill':''}">${i<done?'✓':''}</span>`;
  for(let i=target;i<done;i++) dots+=`<span class="dot fill extra">+</span>`;
  // this week's sets, compact
  const best=bestSet(sets);
  const chips=sets.map(s=>`<span class="wkchip ${best&&s.id===best.id&&done>1?'best':''}"><b>${s.reps}</b>×${fmtW(s.kg)}<button class="editSet" type="button" data-sid="${esc(s.id)}" aria-label="Edit set ${s.reps} by ${fmtW(s.kg)}">Edit</button><button class="x" type="button" data-sid="${esc(s.id)}" aria-label="Remove set ${s.reps} by ${fmtW(s.kg)}">x</button></span>`).join('');
  const tip=sg.tip+(e.notes?` · ${esc(e.notes)}`:'');
  const matchNote=inferredExerciseNote(e);
  node.innerHTML=`
    <div class="ex-top">
      <div class="ex-main">
        <div class="exname">${esc(e.name)}</div>
        <div class="ex-meta"><span class="dots">${dots}</span><span class="remain">${target?(isDone?'done ✓':'<b>'+Math.min(done,target)+'</b>/'+target):`<b>${done}</b> logged · ${focusState}`}</span></div>
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
  node.querySelectorAll('.x').forEach(x=>x.onclick=()=>removeLoggedSet(x.dataset.sid));
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
  const target=weeklyTargetForExercise(e,thisWeek());
  const state=focusStateFor(focusGroupForExercise(e),thisWeek());
  document.getElementById('logSub').textContent=target
    ? `Set ${sets+1} of ${target} this quest · ${muscleOf(e)||e.bucket||''}`
    : `${state==='rest'?'Rest-day training':'Bonus training'} · always available · ${muscleOf(e)||e.bucket||''}`;
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
document.getElementById('saveSetBtn').onclick=()=>{ if(editSetId){ if(doUpdateSet()){ closeSheets(); refreshAll(); toast("Set updated"); } else setLogButtonsBusy(false); return; } if(doLog()){ const state=focusStateFor(focusGroupForExercise(logEx),thisWeek()); const target=weeklyTargetForExercise(logEx,thisWeek()); closeSheets(); renderWeek(); const r=Math.max(0,target-setsFor(logEx.id,thisWeek()).length); toast(state==='quest'?(r?`Quest +1 · ${r} left`:`${logEx.name} quest clear! ✓`):`${state==='rest'?'Free training':'Bonus XP'} · set logged ✓`); } else setLogButtonsBusy(false); };
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
    const left=items.reduce((a,e)=>a+Math.max(0,weeklyTargetForExercise(e,mk)-setsFor(e.id,mk).length),0);
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
