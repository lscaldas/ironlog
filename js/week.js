"use strict";
/* ================= WEEK view ================= */
let GMODE=localStorage.getItem('ironlog.gmode')||'muscle';
if(GMODE==='program'||GMODE==='area') GMODE='muscle';
let LAST_RENDERED_WEEK=null;
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
function groupedExercises(mode,exercises=DB.exercises){
  const m={}, seen=[];
  exercises.forEach(e=>{
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
  return items.reduce((sum,e)=>sum+setsFor(e.id,mk).length,0);
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
function sortForWeek(items,mk,eff){
  const need=e=>{
    const m=muscleOf(e)||'Other';
    const st=muscleBarState(eff[m]?.eff||0,m);
    return st.cleared===0?2:(st.next!==null?1:0);
  };
  return items.slice().sort((a,b)=>need(b)-need(a));
}
function renderGroupChips(){
  document.querySelectorAll('#groupSeg .gchip').forEach(b=>b.classList.toggle('on',b.dataset.g===GMODE));
}
document.querySelectorAll('#groupSeg .gchip').forEach(b=>b.onclick=()=>{
  GMODE=b.dataset.g; localStorage.setItem('ironlog.gmode',GMODE); renderWeek();
});

/* ===== Central muscle bars — boss-HP style: three equal sub-bars per muscle,
   one purple family that brightens each phase (maintain → build → beast) ===== */
const TIER_COLORS=['var(--tier-maintain)','var(--tier-build)','var(--tier-beast)'];
function renderMuscleBars(mk){
  const rows=muscleEffective(mk);
  const order=MUSCLES.concat(['Other']);
  const data=Object.values(rows).filter(r=>isGroupActive(MUSCLE_PPL[r.muscle]||'Other',mk)&&(r.inProgram||r.eff>0)).sort((a,b)=>{
    const ia=order.indexOf(a.muscle), ib=order.indexOf(b.muscle);
    return (ia<0?99:ia)-(ib<0?99:ib)||a.muscle.localeCompare(b.muscle);
  });
  document.getElementById('mbalList').innerHTML=data.length?data.map(r=>{
    const st=muscleBarState(r.eff,r.muscle);
    const segs=BAR_TIERS.map((t,i)=>{
      const lo=i===0?0:st.thresholds[i-1], hi=st.thresholds[i];
      const pct=Math.max(0,Math.min(1,(r.eff-lo)/(hi-lo)))*100;
      const locked=r.eff<lo-1e-9;
      const full=pct>=100;
      return `<span class="mseg${locked?' locked':''}${full?' full':''}" title="${t.label} at ${hi} sets"><i style="width:${pct.toFixed(1)}%;background:${TIER_COLORS[i]}"></i><b class="${full?'in':''}">${hi}</b></span>`;
    }).join('');
    return `<div class="mrow" title="${r.direct} direct set${r.direct===1?'':'s'} · ${fmtEff(r.eff)} effective this week">
      <div class="mname">${esc(r.muscle)}</div>
      <div class="mbar">${segs}<span class="val">${fmtEff(r.eff)}</span></div>
    </div>`;
  }).join(''):`<div class="sub">Add exercises to see weekly muscle bars.</div>`;
}

/* ===== Weekly loadout picker — shows once per week, then collapses to a chip row ===== */
function setupGroupList(){
  return WEEK_LOADOUT_GROUPS.filter(g=>g.id!=='Other'||DB.exercises.some(ex=>!ex.archived&&focusGroupForExercise(ex)===g.id));
}
function renderWeekSetup(mk){
  const card=document.getElementById('weekSetup');
  const row=document.getElementById('weekFocusRow');
  const plan=weekPlanFor(mk);
  const groups=setupGroupList();
  if(!plan.chosen){
    card.hidden=false; row.hidden=true;
    const active=weekGroupsFor(mk);
    document.getElementById('setupGroups').innerHTML=groups.map(g=>{
      const count=DB.exercises.filter(ex=>!ex.archived&&focusGroupForExercise(ex)===g.id).length;
      return `<button type="button" class="setup-chip ${active.includes(g.id)?'on':''}" data-group="${g.id}" aria-pressed="${active.includes(g.id)}">
        <span aria-hidden="true">${g.icon}</span><b>${g.id}</b><small>${g.muscles} · ${count} exercise${count===1?'':'s'}</small></button>`;
    }).join('');
    document.querySelectorAll('#setupGroups .setup-chip').forEach(btn=>btn.onclick=()=>{
      const p=weekPlanFor(mk,true);
      if(!Array.isArray(p.groups)||!p.groups.length) p.groups=weekGroupsFor(mk);
      const id=btn.dataset.group;
      if(p.groups.includes(id)){
        if(p.groups.length===1){ toast("Keep at least one group"); return; }
        p.groups=p.groups.filter(g=>g!==id);
      }else{
        p.groups=p.groups.concat(id);
      }
      save(); renderWeek();
    });
  }else{
    card.hidden=true; row.hidden=false;
    const active=weekGroupsFor(mk).filter(id=>groups.some(g=>g.id===id));
    row.innerHTML=`<span class="focus-label">This week:</span>${active.map(id=>{
      const g=WEEK_LOADOUT_GROUPS.find(x=>x.id===id);
      return `<span class="focus-chip">${g?.icon||''} ${esc(id)}</span>`;
    }).join('')}<button type="button" id="editWeekBtn">Change</button>`;
    row.querySelector('#editWeekBtn').onclick=()=>{
      weekPlanFor(mk,true).chosen=false;
      save(); renderWeek();
    };
  }
}
document.getElementById('setupConfirmBtn').onclick=()=>{
  const plan=weekPlanFor(thisWeek(),true);
  plan.chosen=true;
  save(); refreshAll();
  toast("Weekly loadout locked ✓");
};

function visibleExercises(mk){
  const locationId=currentActiveWorkout()?.locationId;
  return DB.exercises.filter(ex=>!ex.archived&&isGroupActive(focusGroupForExercise(ex),mk)&&(!locationId||!Array.isArray(ex.locations)||ex.locations.includes(locationId)));
}

function renderWeek(){
  const mk=thisWeek();
  LAST_RENDERED_WEEK=mk;
  document.getElementById('muscleWeekLabel').textContent=weekLabel(mk);
  document.getElementById('weekEmpty').style.display=visibleExercises(mk).length?'none':'block';
  const activeLocation=currentActiveWorkout();
  const programCount=DB.exercises.filter(e=>!e.archived).length;
  document.getElementById('weekEmptyMessage').textContent=activeLocation&&programCount?`No exercises available at ${activeLocation.locationName||locationName(activeLocation.locationId)}.`:programCount?'No exercises in this week’s selected groups.':'No exercises in your program yet.';
  document.getElementById('weekEmptyHint').textContent=activeLocation&&programCount?'Add an exercise here, or edit an exercise’s Available at setting.':programCount?'Change the weekly loadout to show another group.':'Add one above, or load the sample program from ⋯.';
  renderGroupChips();
  renderWeekSetup(mk);
  renderMuscleBars(mk);
  renderWorkoutPanel();

  const eff=muscleEffective(mk);
  const exs=visibleExercises(mk);
  const groups=groupedExercises(GMODE,exs);
  const wl=document.getElementById('weekList'); wl.innerHTML='';
  groups.forEach(([b,rawItems])=>{
    const items=sortForWeek(rawItems,mk,eff);
    const bd=groupProgress(items,mk);
    const visible=isGroupVisible(GMODE,b);
    const section=document.createElement('div'); section.className='group-section'+(visible?'':' collapsed');
    const head=document.createElement('div'); head.className='bucket-h';
    head.innerHTML=`<h2>${esc(b)}</h2><div class="ln"></div><div class="bcount">${bd} set${bd===1?'':'s'}</div><button class="group-toggle ${visible?'on':''}" type="button">${visible?'Hide':'Show'}</button>`;
    head.querySelector('.group-toggle').onclick=()=>toggleGroup(GMODE,b);
    section.appendChild(head);
    items.forEach(e=>section.appendChild(exCard(e,mk)));
    wl.appendChild(section);
  });
}

function contribSummary(e,max=3){
  const parts=exerciseContributions(e).slice(0,max);
  return parts.map(p=>`+${fmtEff(p.weight)} ${p.muscle}`).join(' · ');
}
function exCard(e,mk){
  const sets=setsFor(e.id,mk).sort((a,b)=>a.ts-b.ts);
  const done=sets.length;
  const sg=suggest(e);
  const node=document.createElement('div'); node.className='ex';
  // Keep the card compact: only this week's three latest sets are shown.
  const recentSets=sets.slice(-3);
  const best=bestSet(recentSets);
  const chips=recentSets.map(s=>`<span class="wkchip ${best&&s.id===best.id&&recentSets.length>1?'best':''}"><b>${s.reps}</b>×${fmtW(s.kg)}<button class="editSet" type="button" data-sid="${esc(s.id)}" aria-label="Edit set ${s.reps} by ${fmtW(s.kg)}">Edit</button><button class="x" type="button" data-sid="${esc(s.id)}" aria-label="Remove set ${s.reps} by ${fmtW(s.kg)}">x</button></span>`).join('');
  const contribChips=exerciseContributions(e).map(p=>`<span class="contrib ${p.primary?'primary':''}">+${fmtEff(p.weight)} ${esc(p.muscle)}</span>`).join('');
  const progressTip=sg.tip.replace(/\s*·\s*last [^·]+$/i,'').replace(/^Last [^·]+·\s*/i,'');
  const tip=progressTip+(e.notes?` · ${esc(e.notes)}`:'');
  const inferredMatch=exerciseMatch(e.name);
  const matchNote=inferredExerciseNote(e);
  node.innerHTML=`
    <div class="ex-top">
      <div class="ex-main">
        <div class="exname">${esc(e.name)}</div><small class="variant-tag">${esc(variantOf(e))}</small>
        <div class="ex-meta"><span class="remain"><b>${done}</b> set${done===1?'':'s'} this week</span></div>
        <div class="contribs"><span class="contrib-note">each set</span>${contribChips}</div>
        <div class="exsub">${tip}</div>
        ${matchNote?`<div class="match-note">${matchNote}</div>`:''}
      </div>
      ${inferredMatch&&inferredMatch.confidence!=='exact'?`<button class="correctEx" type="button" title="Correct exercise name" aria-label="Use ${esc(inferredMatch.base)} as exercise name">✓</button>`:''}
      <button class="editEx" title="Edit">⚙︎</button>
      <button class="log-plus" title="Log set">＋</button>
    </div>
    ${chips?`<div class="wkchips">${chips}</div>`:''}`;
  node.querySelector('.log-plus').onclick=()=>openLog(e);
  node.querySelector('.editEx').onclick=()=>openEx(e);
  const correctBtn=node.querySelector('.correctEx');
  if(correctBtn) correctBtn.onclick=()=>{
    const match=exerciseMatch(e.name);
    if(!match||match.confidence==='exact') return;
    e.name=match.base;
    save();
    renderWeek();
    toast("Exercise name corrected ✓");
  };
  node.querySelectorAll('.editSet').forEach(btn=>btn.onclick=()=>{ const s=DB.sets.find(x=>x.id===btn.dataset.sid); if(s) openSetEdit(s); });
  node.querySelectorAll('.x').forEach(x=>x.onclick=()=>removeLoggedSet(x.dataset.sid));
  return node;
}

/* ================= Log set flow ================= */
let logEx=null;
let editSetId=null;
let LOG_SUBMITTING=false;
let LAST_LOG_SIGNATURE={sig:'',at:0};
let REST_UNTIL=0;
let REST_INTERVAL=null;
function updateRestStatus(){
  const el=document.getElementById('restStatus');
  const banner=document.getElementById('restBanner');
  const remaining=Math.max(0,Math.ceil((REST_UNTIL-Date.now())/1000));
  el.hidden=!remaining;
  banner.hidden=!remaining;
  if(remaining){
    const label=`Rest ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    el.textContent=`${label} · muscle bars are available below`;
    banner.textContent=`${label} · tap an exercise to log the next set`;
  }
  else if(REST_INTERVAL){ clearInterval(REST_INTERVAL); REST_INTERVAL=null; }
}
function clearRestTimer(){
  REST_UNTIL=0;
  if(REST_INTERVAL){ clearInterval(REST_INTERVAL); REST_INTERVAL=null; }
  updateRestStatus();
}
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
  document.getElementById('saveSetBtn').textContent='Log & move to the next';
  document.getElementById('saveSetMoreBtn').hidden=false;
  document.getElementById('restBarsBtn').hidden=false;
  updateRestStatus();
  logEx=e; const sg=suggest(e);
  document.getElementById('logTitle').textContent=e.name;
  const sets=setsFor(e.id,thisWeek()).length;
  document.getElementById('logSub').textContent=`Set ${sets+1} this week · each set: ${contribSummary(e)}`;
  document.getElementById('inReps').value=sg.reps;
  document.getElementById('inKg').value=sg.kg;
  const hint=document.getElementById('logHint'); hint.className='sugg '+(sg.up?'up':''); hint.innerHTML=`<span class="ic">💡</span><span class="m">${sg.msg}</span>`;
  openSheet('logSheet');
}
function exerciseById(id){ return DB.exercises.find(e=>e.id===id); }
function openSetEdit(set){
  const e=exerciseById(set.exId);
  if(!e){ toast("Exercise missing"); return; }
  setLogButtonsBusy(false);
  logEx=e;
  editSetId=set.id;
  document.getElementById('saveSetBtn').textContent='Save set';
  document.getElementById('saveSetMoreBtn').hidden=true;
  document.getElementById('restBarsBtn').hidden=true;
  document.getElementById('restStatus').hidden=true;
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
  const set={id:uid('s'),workoutId:w.id,exId:logEx.id,date:d,ts:now,reps,kg,locationId:w.locationId||'home',variant:variantOf(logEx)};
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
/* Toast for the videogame moment: a logged set pushing a muscle bar past a tier threshold. */
function tierCrossToast(e,mk,before){
  if(!e||!before) return null;
  const after=muscleEffective(mk);
  for(const p of exerciseContributions(e)){
    const b=before[p.muscle]?.eff||0, a=after[p.muscle]?.eff||0;
    const th=muscleThresholds(p.muscle);
    for(let i=th.length-1;i>=0;i--){
      if(b<th[i]-1e-9&&a>=th[i]-1e-9) return `${p.muscle} ${BAR_TIERS[i].label.toLowerCase()}! ${BAR_TIERS[i].icon}`;
    }
  }
  return null;
}
document.getElementById('saveSetBtn').onclick=()=>{
  if(editSetId){ if(doUpdateSet()){ closeSheets(); refreshAll(); toast("Set updated"); } else setLogButtonsBusy(false); return; }
  const e=logEx;
  const before=e?muscleEffective(thisWeek()):null;
  if(doLog()){
    closeSheets(); renderWeek();
    toast(tierCrossToast(e,thisWeek(),before)||`${contribSummary(e)} ✓`);
  } else setLogButtonsBusy(false);
};
document.getElementById('saveSetMoreBtn').onclick=()=>{
  const e=logEx;
  const before=e?muscleEffective(thisWeek()):null;
  if(doLog()){
    REST_UNTIL=Date.now()+90*1000;
    if(REST_INTERVAL) clearInterval(REST_INTERVAL);
    REST_INTERVAL=setInterval(updateRestStatus,1000);
    renderWeek(); openLog(e);
    toast(tierCrossToast(e,thisWeek(),before)||`${contribSummary(e)} ✓`);
  } else setLogButtonsBusy(false);
};
document.getElementById('restBarsBtn').onclick=()=>{
  closeSheets();
  document.getElementById('mbalCard').scrollIntoView({behavior:'smooth',block:'start'});
  toast('Rest timer continues · tap + to log another set');
};

/* ================= Session recovery and locations ================= */
function showRecoveryIfNeeded(){
  const w=currentActiveWorkout();
  if(!w || document.getElementById('profileGate').classList.contains('hide')===false) return;
  const elapsed=Math.max(1,Math.floor((Date.now()-w.startedAt)/60000));
  const estimate=Math.min(60,elapsed);
  document.getElementById('recoveryMinutes').value=estimate;
  document.getElementById('recoverySub').textContent=`This workout at ${w.locationName||locationName(w.locationId||'home')} was left active. We estimate ${estimate} min. Choose a different duration if needed.`;
  openSheet('recoverySheet');
}
document.querySelectorAll('#recoverySheet [data-minutes]').forEach(btn=>btn.onclick=()=>{
  document.getElementById('recoveryMinutes').value=btn.dataset.minutes;
});
document.getElementById('recoverySaveBtn').onclick=()=>{
  const w=currentActiveWorkout();
  if(!w){ closeSheets(); return; }
  const minutes=Number(document.getElementById('recoveryMinutes').value);
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440){ toast('Choose 1–1440 minutes'); return; }
  if(!setsForWorkout(w).length){ DB.activeWorkout=null; save(); closeSheets(); refreshAll(); toast('Empty workout closed'); return; }
  completeActiveWorkout(Math.min(Date.now(),w.startedAt+minutes*60000));
};
function renderGymList(){
  const list=document.getElementById('gymList');
  list.innerHTML=(DB.gyms||[]).length?DB.gyms.map(g=>`<div class="gym-row"><span>${esc(g.name)}</span><button type="button" data-id="${esc(g.id)}" aria-label="Delete ${esc(g.name)}">Delete</button></div>`).join(''):'<p class="sub">Home is always available. Add gyms for separate weight history.</p>';
  list.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.id;
    if(!confirm(`Delete ${locationName(id)}? Past workouts keep their location label in history.`)) return;
    if(DB.activeWorkout?.locationId===id) DB.activeWorkout.locationName=locationName(id);
    DB.workouts.filter(w=>w.locationId===id).forEach(w=>{w.locationName=w.locationName||locationName(id);});
    DB.gyms=DB.gyms.filter(g=>g.id!==id);
    save(); renderGymList(); renderWeek();
  });
}
document.getElementById('addGymBtn').onclick=()=>{
  const input=document.getElementById('gymName');
  const name=input.value.trim();
  if(!name){ toast('Enter a gym name'); return; }
  if(name.toLowerCase()==='home'){ toast('Home is already available'); return; }
  if((DB.gyms||[]).some(g=>g.name.toLowerCase()===name.toLowerCase())){ toast('Gym already added'); return; }
  DB.gyms.push({id:uid('g'),name}); input.value=''; save(); renderGymList(); renderWeek();
};
document.getElementById('menuBtn').addEventListener('click',renderGymList);
document.getElementById('profilePill').addEventListener('click',renderGymList);

/* Workout completion is handled directly by the Finish workout button. */
