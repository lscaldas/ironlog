"use strict";
/* ================= Add / edit exercise ================= */
let editEx=null;
let EX_CHOICES_OPEN=false;
function openEx(e){
  editEx=e||null;
  EX_CHOICES_OPEN=false;
  document.getElementById('exTitle').textContent=e?'Edit exercise':'Add exercise';
  document.getElementById('fName').value=e?e.name:'';
  document.getElementById('fVariant').value=e?variantOf(e):'Free weight';
  document.getElementById('fMuscle').value=e?muscleOf(e):'';
  document.getElementById('fArea').value=e?areaOf(e):'';
  document.getElementById('fBucket').value=e?e.bucket:(DB.exercises[0]?.bucket||'Upper');
  document.getElementById('fLow').value=e?e.low:8;
  document.getElementById('fHigh').value=e?e.high:12;
  document.getElementById('fInc').value=e?e.inc:2.5;
  document.getElementById('fNotes').value=e?(e.notes||''):'';
  document.getElementById('delExBtn').style.display=e?'block':'none';
  document.getElementById('bkDL').innerHTML=[...new Set(DB.exercises.map(x=>x.bucket).concat(['Upper','Arms','Legs','Core']))].map(b=>`<option value="${esc(b)}">`).join('');
  renderBodyChoices();
  renderExerciseChoices();
  updateMatchHint();
  openSheet('exSheet');
}
document.getElementById('addExBtn').onclick=()=>openEx(null);
document.getElementById('cancelExBtn').onclick=closeSheets;
function areaOptionsForMuscle(muscle){
  const current=document.getElementById('fArea').value.trim();
  if(!muscle) return current?[current]:[];
  const fromCatalog=catalogEntries().filter(x=>x.muscle===muscle).map(x=>x.area).filter(Boolean);
  const out=[...new Set(fromCatalog.concat(current? [current]:[],['Other']))];
  return out.filter(Boolean);
}
function renderBodyChoices(){
  const current=document.getElementById('fMuscle').value.trim();
  const muscles=MUSCLES.concat(['Other']);
  const muscleBox=document.getElementById('muscleChoices');
  muscleBox.innerHTML=muscles.map(m=>`<button type="button" class="body-chip ${m===current?'on':''}" data-muscle="${esc(m)}">${esc(m)}</button>`).join('');
  muscleBox.querySelectorAll('button').forEach(btn=>btn.onclick=()=>setPrimaryMuscle(btn.dataset.muscle));
  renderAreaChoices();
}
function renderAreaChoices(){
  const muscle=document.getElementById('fMuscle').value.trim();
  const current=document.getElementById('fArea').value.trim();
  const areaBox=document.getElementById('areaChoices');
  const help=document.getElementById('areaHelp');
  const areas=areaOptionsForMuscle(muscle);
  if(!muscle){
    areaBox.innerHTML='';
    help.textContent='Pick a primary muscle to narrow the exercise list.';
    return;
  }
  areaBox.innerHTML=areas.map(a=>`<button type="button" class="body-chip ${a===current?'on':''}" data-area="${esc(a)}">${esc(a)}</button>`).join('');
  areaBox.querySelectorAll('button').forEach(btn=>btn.onclick=()=>setAreaChoice(btn.dataset.area));
  help.textContent=current?`${muscle} / ${current}`:`Choose the area that best fits this exercise.`;
}
function setPrimaryMuscle(muscle){
  document.getElementById('fMuscle').value=muscle||'Other';
  const bucket=document.getElementById('fBucket');
  if(!bucket.value.trim()||['Upper','Arms','Legs','Core','Other'].includes(bucket.value.trim())) bucket.value=MUSCLE_REGION[muscle]||'Other';
  if(muscle==='Other') document.getElementById('fArea').value='Other';
  else document.getElementById('fArea').value='';
  EX_CHOICES_OPEN=false;
  renderBodyChoices();
  renderExerciseChoices();
  updateMatchHint();
}
function setAreaChoice(area){
  document.getElementById('fArea').value=area||'Other';
  EX_CHOICES_OPEN=false;
  renderAreaChoices();
  renderExerciseChoices();
  updateMatchHint();
}
function selectedMuscleChoices(){
  const m=document.getElementById('fMuscle').value.trim();
  const area=document.getElementById('fArea').value.trim();
  const entries=catalogEntries();
  if(!m) return [];
  if(m==='Other') return entries;
  const primary=entries.filter(x=>x.muscle===m);
  if(area&&area!=='Other'){
    const areaMatches=primary.filter(x=>x.area===area);
    if(areaMatches.length) return areaMatches;
  }
  return primary.length?primary:entries;
}
function renderExerciseChoices(){
  const entries=selectedMuscleChoices();
  const allEntries=catalogEntries();
  document.getElementById('exDL').innerHTML=(entries.length?entries:allEntries).map(x=>`<option value="${esc(x.name)}">`).join('');
  const box=document.getElementById('exSuggestList');
  box.classList.toggle('expanded',EX_CHOICES_OPEN);
  document.getElementById('exDropBtn').textContent=EX_CHOICES_OPEN?'Less':'More';
  document.getElementById('exDropBtn').title=EX_CHOICES_OPEN?'Show fewer exercise choices':'Show more exercise choices';
  if(!entries.length){
    box.innerHTML='<span class="sub">Choose a primary muscle, then pick one of the matching exercises or type your own.</span>';
    return;
  }
  const top=EX_CHOICES_OPEN?entries:entries.slice(0,8);
  box.innerHTML=top.map(x=>`<button type="button" data-ex="${esc(x.name)}">${esc(x.name)}</button>`).join('');
  box.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    chooseCatalogExercise(btn.dataset.ex);
  });
}
function chooseCatalogExercise(name){
  const entry=catalogEntries().find(x=>normName(x.name)===normName(name))||catalogEntryFromName(name,'Custom');
  document.getElementById('fName').value=entry.name;
  if(!editEx) document.getElementById('fVariant').value=variantOf(entry);
  document.getElementById('fMuscle').value=entry.muscle;
  document.getElementById('fArea').value=entry.area;
  const bucket=document.getElementById('fBucket');
  if(!bucket.value.trim()||['Upper','Arms','Legs','Core','Other'].includes(bucket.value.trim())) bucket.value=MUSCLE_REGION[entry.muscle]||bucket.value||'Other';
  renderBodyChoices();
  renderExerciseChoices();
  updateMatchHint();
}
function updateMatchHint(){
  const name=document.getElementById('fName').value.trim();
  const hint=document.getElementById('matchHint');
  const match=exerciseMatch(name);
  if(match&&match.confidence!=='exact'){
    hint.innerHTML=`Counting as <b>${esc(match.base)}</b>: ${esc(match.muscle)} · ${esc(match.area)} <button class="match-correct" type="button">Use suggested name</button>`;
    hint.classList.add('show');
    hint.querySelector('.match-correct').onclick=()=>{
      document.getElementById('fName').value=match.base;
      inferNameFields();
    };
  }else{
    hint.textContent='';
    hint.classList.remove('show');
  }
}
function inferNameFields(){
  const name=document.getElementById('fName').value.trim();
  const match=exerciseMatch(name);
  const m=document.getElementById('fMuscle');
  const a=document.getElementById('fArea');
  let changed=false;
  if(match){
    if(!m.value.trim()){ m.value=match.muscle; changed=true; }
    if(!a.value.trim()){ a.value=match.area; changed=true; }
  }else{
    if(!m.value.trim()){ m.value=guessMuscle(name); changed=true; }
    if(!a.value.trim()){ a.value=guessArea(name); changed=true; }
  }
  if(changed){ renderBodyChoices(); renderExerciseChoices(); }
  updateMatchHint();
}
document.getElementById('fName').oninput=()=>{ inferNameFields(); };
document.getElementById('fName').onchange=()=>{
  const entry=catalogEntries().find(x=>normName(x.name)===normName(document.getElementById('fName').value.trim()));
  if(entry) chooseCatalogExercise(entry.name); else inferNameFields();
};
document.getElementById('exDropBtn').onclick=()=>{ EX_CHOICES_OPEN=!EX_CHOICES_OPEN; renderExerciseChoices(); };
document.getElementById('saveExBtn').onclick=()=>{
  const name=document.getElementById('fName').value.trim(); if(!name){ toast("Name it"); return; }
  const obj={ name, variant:document.getElementById('fVariant').value, muscle:(document.getElementById('fMuscle').value.trim()||guessMuscle(name)||'Other'),
    area:(document.getElementById('fArea').value.trim()||guessArea(name)||'Other'),
    bucket:(document.getElementById('fBucket').value.trim()||'Other'),
    low:parseInt(document.getElementById('fLow').value)||8, high:parseInt(document.getElementById('fHigh').value)||12,
    inc:parseFloat(document.getElementById('fInc').value)||2.5, notes:document.getElementById('fNotes').value.trim() };
  if(editEx){ Object.assign(editEx,obj); } else { obj.id=uid('e'); DB.exercises.push(obj); }
  save(); closeSheets(); renderWeek(); toast(editEx?"Saved ✓":"Added ✓");
};
document.getElementById('delExBtn').onclick=()=>{
  if(!editEx)return;
  if(confirm(`Remove "${editEx.name}" from your program? Logged history is kept.`)){
    editEx.archived=true; save(); closeSheets(); renderWeek(); toast("Removed from program");
  }
};

/* ================= CATALOG ================= */
function contribListFor(ex){ return exerciseContributions(ex); }
function contribHtml(ex){
  return contribListFor(ex).map(p=>`<span class="cat-contrib ${p.primary?'primary':''}">${esc(p.muscle)} <b>${fmtEff(p.weight)}</b></span>`).join('');
}
function catalogSearchText(entry){
  return [entry.name,entry.source,entry.match?.base,entry.match?.matchedBase,entry.muscle,entry.area,(entry.keys||[]).join(' '),...contribListFor(entry).map(p=>p.muscle)].join(' ').toLowerCase();
}
function catalogCard(entry){
  const match=entry.match;
  const matchedBase=match?.matchedBase||match?.base||entry.name;
  const showMatch=match&&normName(matchedBase)!==normName(entry.name);
  const keys=entry.keys?.length?`<div class="cat-keys">Matches: ${entry.keys.slice(0,8).map(esc).join(', ')}</div>`:'';
  return `<div class="cat-card">
    <div class="cat-top">
      <div>
        <div class="cat-name">${esc(entry.name)}</div>
        <div class="cat-meta">${esc(entry.muscle)} · ${esc(entry.area)}${showMatch?` · <span class="cat-match">counting as ${esc(matchedBase)}</span>`:''}</div>
      </div>
      <span class="cat-tag">${esc(entry.source)}</span>
    </div>
    <div class="cat-contribs">${contribHtml(entry)}</div>
    ${keys}
  </div>`;
}
function catalogEntryFromName(name,source){
  const match=exerciseMatch(name);
  const muscle=match?.muscle||NAME_MUSCLE[name]||guessMuscle(name)||'Other';
  const area=match?.area||NAME_AREA[name]||guessArea(name)||muscle;
  return {name,source,muscle,area,match,keys:match?.keys||[]};
}
function catalogEntries(){
  const out=LIB.map(name=>catalogEntryFromName(name,'Suggested'));
  const seen=new Set(out.map(e=>normName(e.match?.base||e.name)));
  EXERCISE_TAXONOMY.forEach(x=>{
    if(seen.has(normName(x.base))) return;
    out.push({name:x.base,source:'Matcher',muscle:x.muscle,area:x.area,match:{...x,confidence:'exact'},keys:x.keys||[]});
    seen.add(normName(x.base));
  });
  return out.sort((a,b)=>a.muscle.localeCompare(b.muscle)||a.name.localeCompare(b.name));
}
function renderCatalog(){
  const q=(document.getElementById('catalogSearch')?.value||'').trim().toLowerCase();
  const matchQ=entry=>!q||catalogSearchText(entry).includes(q);
  const program=DB.exercises.filter(e=>!e.archived).map(e=>({name:e.name,source:e.bucket||'Program',muscle:muscleOf(e)||'Other',area:areaOf(e)||'Other',match:exerciseMatch(e.name),keys:exerciseMatch(e.name)?.keys||[]})).filter(matchQ);
  const catalog=catalogEntries().filter(matchQ);
  document.getElementById('catalogCount').textContent=`${catalog.length} catalogued`;
  document.getElementById('programMapCount').textContent=`${program.length}`;
  document.getElementById('catalogMapCount').textContent=`${catalog.length}`;
  document.getElementById('programMapList').innerHTML=program.length?program.map(catalogCard).join(''):`<div class="sub">No program exercises match this search.</div>`;
  document.getElementById('catalogList').innerHTML=catalog.length?catalog.map(catalogCard).join(''):`<div class="sub">No catalog exercises match this search.</div>`;
}
document.getElementById('catalogSearch').oninput=renderCatalog;

/* ================= HISTORY ================= */
let HISTORY_JOIN_MODE=false;
let HISTORY_JOIN_SELECTED=new Set();
function workoutJoinKey(workout){
  return `${workout.date||dateKey(new Date(workout.startedAt))}|${workout.locationId||'home'}`;
}
function cancelWorkoutJoin(){
  HISTORY_JOIN_MODE=false;
  HISTORY_JOIN_SELECTED.clear();
}
function undoWorkoutJoin(id){
  const primary=DB.workouts.find(w=>w.id===id&&Array.isArray(w.joinedWorkoutParts));
  if(!primary) return;
  const parts=primary.joinedWorkoutParts;
  if(!confirm(`Split this back into ${parts.length} original workout sessions? All sets and workout details will stay in your history.`)) return;
  parts.forEach(snapshot=>{
    const workout=DB.workouts.find(w=>w.id===snapshot.id);
    if(!workout) return;
    Object.keys(workout).forEach(key=>delete workout[key]);
    Object.assign(workout,snapshot,{joinedWorkoutParts:null,mergedInto:null,replaceSetIds:true});
  });
  save(); refreshAll(); toast(`Restored ${parts.length} workout sessions`);
}
function mergeSelectedWorkouts(){
  const chosen=DB.workouts.filter(w=>HISTORY_JOIN_SELECTED.has(w.id)&&w.status==='completed');
  if(chosen.length<2){ toast('Select at least two workouts'); return; }
  if(chosen.some(w=>Array.isArray(w.joinedWorkoutParts))){ toast('Undo an existing join before joining that session again'); return; }
  if(new Set(chosen.map(workoutJoinKey)).size!==1){ toast('Choose workouts from the same day and gym'); return; }
  const date=chosen[0].date||dateKey(new Date(chosen[0].startedAt));
  if(!confirm(`Join ${chosen.length} workout sessions from ${fmtDate(date)}? All logged sets and their individual times will be kept.`)) return;
  chosen.sort((a,b)=>(a.startedAt||0)-(b.startedAt||0));
  const [primary,...merged]=chosen;
  const snapshots=chosen.map(w=>({...w,setIds:[...(w.setIds||[])],joinedWorkoutParts:null,mergedInto:null}));
  const sets=chosen.flatMap(w=>setsForWorkout(w)).filter((set,index,all)=>all.findIndex(other=>other.id===set.id)===index);
  primary.joinedWorkoutParts=snapshots;
  merged.forEach(w=>{ w.mergedInto=primary.id; });
  primary.startedAt=Math.min(...chosen.map(w=>w.startedAt||Date.now()));
  primary.endedAt=Math.max(...chosen.map(w=>w.endedAt||w.startedAt||Date.now()));
  primary.date=date;
  cancelWorkoutJoin(); save(); refreshAll();
  toast(`Joined ${chosen.length} sessions · ${sets.length} sets kept · Undo join available`);
}
document.getElementById('joinWorkoutsBtn').onclick=()=>{
  if(HISTORY_JOIN_MODE){ mergeSelectedWorkouts(); return; }
  HISTORY_JOIN_MODE=true; HISTORY_JOIN_SELECTED.clear(); renderHistory();
  toast('Select 2 or more sessions from the same day and gym');
};
document.getElementById('cancelJoinWorkoutsBtn').onclick=()=>{ cancelWorkoutJoin(); renderHistory(); };
function renderHistory(){
  const nameOf=id=>(DB.exercises.find(e=>e.id===id)||{}).name||'(removed)';
  const completed=DB.workouts.filter(w=>w.status==='completed'&&!w.mergedInto).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||b.endedAt||b.startedAt)-(a.createdAt||a.endedAt||a.startedAt));
  const active=currentActiveWorkout();
  const activeSets=setsForWorkout(active);
  const shownSetIds=new Set(completed.flatMap(w=>setsForWorkout(w).map(s=>s.id)).concat(activeSets.map(s=>s.id)));
  const legacySets=recordedSets().filter(s=>!shownSetIds.has(s.id));
  const byDay={};
  legacySets.forEach(s=>{(byDay[s.date]=byDay[s.date]||[]).push(s);});
  const days=Object.keys(byDay).sort().reverse();
  const totalEntries=completed.length+days.length+(activeSets.length?1:0);
  const joinButton=document.getElementById('joinWorkoutsBtn');
  const cancelJoinButton=document.getElementById('cancelJoinWorkoutsBtn');
  joinButton.hidden=!HISTORY_JOIN_MODE&&completed.length<2;
  joinButton.textContent=HISTORY_JOIN_MODE?`Merge selected (${HISTORY_JOIN_SELECTED.size})`:'Join workouts';
  joinButton.disabled=HISTORY_JOIN_MODE&&HISTORY_JOIN_SELECTED.size<2;
  cancelJoinButton.hidden=!HISTORY_JOIN_MODE;
  document.getElementById('histEmpty').style.display=totalEntries?'none':'block';
  const recordedCount=recordedSets().length;
  document.getElementById('histCount').textContent=recordedCount?`${recordedCount} logged set${recordedCount===1?'':'s'}`:'';
  const sessionHtml=(activeSets.length?[active,...completed]:completed).map(w=>{
    const inProgress=w.status==='active';
    const sets=setsForWorkout(w); const byEx={};
    sets.forEach(s=>{(byEx[s.exId]=byEx[s.exId]||[]).push(s);});
    const rows=Object.keys(byEx).map(id=>{
      const ss=byEx[id].sort((a,b)=>a.ts-b.ts);
      return `<div class="day-ex"><div class="nm">${esc(nameOf(id))} <span style="color:var(--dim);font-weight:400">·${ss.length} set${ss.length>1?'s':''}</span></div>
        <div class="st">${ss.map(s=>s.mode==='quick'
          ? `<span class="history-set"><span>Quick set</span><button class="historyRemoveSet" type="button" data-sid="${esc(s.id)}" aria-label="Remove quick set">Remove</button></span>`
          : `<span class="history-set"><span>${s.reps}×${fmtW(s.kg)} ${effortTag(s)}</span><button class="historyEditSet" type="button" data-sid="${esc(s.id)}" aria-label="Edit ${isWarmupSet(s)?'warm-up':'hard'} set ${s.reps} by ${fmtW(s.kg)}">Edit</button></span>`).join('<span aria-hidden="true"> · </span>')}</div></div>`;
    }).join('');
    const label=`${inProgress?'Workout in progress':'Completed workout session'} ${relDay(w.date||dateKey(new Date(w.startedAt)))} ${sets.length} set${sets.length===1?'':'s'}`;
    const sessionSort=inProgress?Date.now():new Date((w.date||dateKey(new Date(w.startedAt)))+'T00:00:00').getTime()+((w.createdAt||w.endedAt||w.startedAt)%86400000)/86400000;
    const duration=w.pastEntry?'past workout':`duration ${workoutDuration(w.startedAt,w.endedAt||w.startedAt)}`;
    return `<div class="day session${HISTORY_JOIN_SELECTED.has(w.id)?' join-selected':''}" data-wid="${esc(w.id)}" data-sort="${sessionSort}">
      <button class="session-row day-h" type="button" aria-expanded="false" aria-label="${esc(label)}">
        <div><div class="day-date">${inProgress?'Workout in progress':'Completed workout session'}</div>
        <div class="day-sum">${relDay(w.date||dateKey(new Date(w.startedAt)))} · ${esc(w.locationName||locationName(w.locationId||'home'))} · ${duration} · ${sets.length} set${sets.length===1?'':'s'} · ${Object.keys(byEx).length} exercise${Object.keys(byEx).length===1?'':'s'}</div></div><span class="chev">›</span>
      </button>
      ${inProgress?'':`<div class="session-actions">${HISTORY_JOIN_MODE?(w.joinedWorkoutParts?'<button class="ghost btn-sm" type="button" disabled title="Undo this join before selecting it">Undo join first</button>':`<button class="ghost btn-sm join-select-btn" type="button" data-wid="${esc(w.id)}" aria-pressed="${HISTORY_JOIN_SELECTED.has(w.id)}" ${HISTORY_JOIN_SELECTED.size&&![...HISTORY_JOIN_SELECTED].some(id=>workoutJoinKey(DB.workouts.find(item=>item.id===id)||{})===workoutJoinKey(w))?'disabled title="Choose workouts from the same day and gym"':''}>${HISTORY_JOIN_SELECTED.has(w.id)?'Selected':'Select'}</button>`):`${w.joinedWorkoutParts?`<button class="ghost btn-sm undoWorkoutJoinBtn" type="button" data-wid="${esc(w.id)}">Undo join</button>`:''}`}<button class="ghost btn-sm deleteWorkoutBtn" type="button" ${HISTORY_JOIN_MODE?'disabled':''}>Delete</button></div>`}
      <div class="day-body">${rows||'<div class="sub">No sets saved in this workout.</div>'}</div>
    </div>`;
  }).join('');
  const legacyHtml=days.map(d=>{
    const sets=byDay[d]; const byEx={};
    sets.forEach(s=>{(byEx[s.exId]=byEx[s.exId]||[]).push(s);});
    const rows=Object.keys(byEx).map(id=>{
      const ss=byEx[id].sort((a,b)=>a.ts-b.ts);
      return `<div class="day-ex"><div class="nm">${esc(nameOf(id))} <span style="color:var(--dim);font-weight:400">·${ss.length} set${ss.length>1?'s':''}</span></div>
        <div class="st">${ss.map(s=>`<span class="history-set"><span>${s.reps}×${fmtW(s.kg)} ${effortTag(s)}</span><button class="historyEditSet" type="button" data-sid="${esc(s.id)}" aria-label="Edit ${isWarmupSet(s)?'warm-up':'hard'} set ${s.reps} by ${fmtW(s.kg)}">Edit</button></span>`).join('<span aria-hidden="true"> · </span>')}</div></div>`;
    }).join('');
    return `<div class="day legacy" data-sort="${new Date(d+'T23:59:59').getTime()}"><div class="day-h"><div><div class="day-date">${relDay(d)} logged sets</div>
      <div class="day-sum">${sets.length} sets · ${Object.keys(byEx).length} exercises</div></div><span class="chev">›</span></div>
      <div class="day-body">${rows}</div></div>`;
  }).join('');
  const list=document.getElementById('histList');
  list.innerHTML=sessionHtml+legacyHtml;
  [...list.querySelectorAll('.day')].sort((a,b)=>Number(b.dataset.sort)-Number(a.dataset.sort)).forEach(row=>list.appendChild(row));
  document.querySelectorAll('#histList .day').forEach(n=>{
    const row=n.querySelector('.day-h');
    row.onclick=()=>{
      n.classList.toggle('open');
      if(row.tagName==='BUTTON') row.setAttribute('aria-expanded',n.classList.contains('open')?'true':'false');
    };
  });
  document.querySelectorAll('#histList .deleteWorkoutBtn').forEach(btn=>{
    btn.onclick=e=>{
      e.stopPropagation();
      deleteCompletedWorkout(btn.closest('.session').dataset.wid);
    };
  });
  document.querySelectorAll('#histList .historyEditSet').forEach(btn=>{
    btn.onclick=e=>{
      e.stopPropagation();
      const set=DB.sets.find(s=>s.id===btn.dataset.sid);
      if(set) openSetEdit(set); else toast("Set not found");
    };
  });
  document.querySelectorAll('#histList .undoWorkoutJoinBtn').forEach(btn=>{
    btn.onclick=e=>{ e.stopPropagation(); undoWorkoutJoin(btn.dataset.wid); };
  });
  document.querySelectorAll('#histList .join-select-btn').forEach(btn=>{
    btn.onclick=e=>{
      e.stopPropagation();
      const id=btn.dataset.wid;
      if(HISTORY_JOIN_SELECTED.has(id)) HISTORY_JOIN_SELECTED.delete(id);
      else HISTORY_JOIN_SELECTED.add(id);
      renderHistory();
    };
  });
document.querySelectorAll('#histList .historyRemoveSet').forEach(btn=>{
    btn.onclick=e=>{ e.stopPropagation(); removeLoggedSet(btn.dataset.sid); };
  });
}

/* ================= Missed workout entry ================= */
let PAST_DRAFT=null;
let PAST_LOGGING=false;
function previousDateKey(){
  const date=new Date(); date.setDate(date.getDate()-1); return dateKey(date);
}
function openPastWorkout(){
  const options=[{id:'home',name:'Home'},...(DB.gyms||[])];
  if(!PAST_DRAFT) PAST_DRAFT={date:previousDateKey(),locationId:'home',mode:null,counts:{},sets:[],showAllExercises:false};
  const dateInput=document.getElementById('pastWorkoutDate');
  dateInput.value=PAST_DRAFT.date; dateInput.max=todayKey();
  document.getElementById('pastShowAllExercises').checked=PAST_DRAFT.showAllExercises===true;
  document.getElementById('pastWorkoutLocation').innerHTML=options.map(location=>`<option value="${esc(location.id)}">${esc(location.name)}</option>`).join('');
  document.getElementById('pastWorkoutLocation').value=PAST_DRAFT.locationId;
  renderPastWorkout(); openSheet('pastWorkoutSheet');
}
document.getElementById('addPastWorkoutBtn').onclick=openPastWorkout;
document.getElementById('cancelPastWorkoutBtn').onclick=()=>{ PAST_DRAFT=null; closeSheets(); };
document.getElementById('pastWorkoutDate').onchange=e=>{
  if(!PAST_DRAFT) return;
  PAST_DRAFT.date=e.target.value;
  const allowed=new Set(pastExercises().map(ex=>ex.id));
  PAST_DRAFT.counts=Object.fromEntries(Object.entries(PAST_DRAFT.counts).filter(([id])=>allowed.has(id)));
  PAST_DRAFT.sets=PAST_DRAFT.sets.filter(set=>allowed.has(set.exId));
  renderPastWorkout();
};
document.getElementById('pastWorkoutLocation').onchange=e=>{
  if(!PAST_DRAFT) return;
  PAST_DRAFT.locationId=e.target.value; renderPastWorkout();
};
document.getElementById('pastShowAllExercises').onchange=e=>{
  if(!PAST_DRAFT) return;
  PAST_DRAFT.showAllExercises=e.target.checked;
  renderPastWorkout();
};
function setPastMode(mode){
  if(!PAST_DRAFT) return;
  PAST_DRAFT.mode=mode; renderPastWorkout();
}
document.getElementById('pastQuickMode').onclick=()=>setPastMode('quick');
document.getElementById('pastDetailedMode').onclick=()=>setPastMode('detailed');
function pastExercises(){
  const mk=mondayOf(PAST_DRAFT.date||todayKey());
  return DB.exercises.filter(ex=>!ex.archived&&(PAST_DRAFT.showAllExercises||isGroupActive(focusGroupForExercise(ex),mk)));
}
function pastSetSummary(){
  if(!PAST_DRAFT) return {count:0,exercises:0};
  if(PAST_DRAFT.mode==='quick'){
    const counts=Object.values(PAST_DRAFT.counts);
    return {count:counts.reduce((sum,n)=>sum+n,0),exercises:counts.filter(Boolean).length};
  }
  const ids=new Set(PAST_DRAFT.sets.map(set=>set.exId));
  return {count:PAST_DRAFT.sets.length,exercises:ids.size};
}
function renderPastWorkout(){
  if(!PAST_DRAFT) return;
  const list=document.getElementById('pastWorkoutExercises');
  const hiddenSelectionHelp=document.getElementById('pastHiddenSelectionHelp');
  hiddenSelectionHelp.hidden=true;
  const summary=pastSetSummary();
  document.getElementById('pastWorkoutSummary').textContent=`${fmtDate(PAST_DRAFT.date)} · ${locationName(PAST_DRAFT.locationId)} · ${summary.count} set${summary.count===1?'':'s'} across ${summary.exercises} exercise${summary.exercises===1?'':'s'}`;
  const saveButton=document.getElementById('savePastWorkoutBtn');
  saveButton.disabled=!summary.count;
  saveButton.textContent=`Save past workout · ${summary.count} set${summary.count===1?'':'s'}`;
  document.getElementById('pastQuickMode').classList.toggle('on',PAST_DRAFT.mode==='quick');
  document.getElementById('pastDetailedMode').classList.toggle('on',PAST_DRAFT.mode==='detailed');
  if(!PAST_DRAFT.mode){ list.innerHTML='<div class="sub">Choose Quick log or Detailed log to add exercises.</div>'; return; }
  const exercises=pastExercises();
  if(!exercises.length){ list.innerHTML='<div class="sub">No exercises are planned for that week. Update its weekly loadout or choose a different date.</div>'; return; }
  list.innerHTML=exercises.map(ex=>{
    if(PAST_DRAFT.mode==='quick'){
      const selected=PAST_DRAFT.counts[ex.id]||0;
      return `<div class="past-exercise past-quick-row"><div class="past-exercise-name">${esc(ex.name)}</div><div class="past-counts" role="group" aria-label="Sets completed for ${esc(ex.name)}">${[1,2,3,4,5].map(n=>`<button type="button" class="past-count ${selected===n?'on':''}" data-ex="${esc(ex.id)}" data-count="${n}" aria-pressed="${selected===n}">${n}</button>`).join('')}</div></div>`;
    }
    const sets=PAST_DRAFT.sets.map((set,index)=>({...set,index})).filter(set=>set.exId===ex.id);
    const setRows=sets.map(set=>`<span class="past-set-chip">${set.reps}×${fmtW(set.kg)} <button type="button" data-remove-set="${set.index}" aria-label="Remove set">×</button></span>`).join('');
    return `<div class="past-exercise"><div class="past-detail-head"><div class="past-exercise-name">${esc(ex.name)}</div><button class="ghost btn-sm past-add-set" type="button" data-ex="${esc(ex.id)}">＋ Add set</button></div>${setRows?`<div class="past-set-list">${setRows}</div>`:'<div class="sub">No sets added</div>'}</div>`;
  }).join('');
  list.querySelectorAll('.past-count').forEach(button=>button.onclick=()=>{
    const id=button.dataset.ex,count=Number(button.dataset.count);
    PAST_DRAFT.counts[id]=(PAST_DRAFT.counts[id]||0)===count?0:count; renderPastWorkout();
  });
  list.querySelectorAll('.past-add-set').forEach(button=>button.onclick=()=>openPastSet(exerciseById(button.dataset.ex)));
  list.querySelectorAll('[data-remove-set]').forEach(button=>button.onclick=()=>{
    PAST_DRAFT.sets.splice(Number(button.dataset.removeSet),1); renderPastWorkout();
  });
  const visibleIds=new Set(exercises.map(ex=>ex.id));
  const selectedIds=PAST_DRAFT.mode==='quick'
    ? Object.keys(PAST_DRAFT.counts).filter(id=>PAST_DRAFT.counts[id]>0)
    : PAST_DRAFT.sets.map(set=>set.exId);
  hiddenSelectionHelp.hidden=!selectedIds.some(id=>!visibleIds.has(id));
}
function openPastSet(ex){
  if(!ex||!PAST_DRAFT) return;
  PAST_LOGGING=true; editSetId=null; logEx=ex;
  setSetEffort('hard');
  setLogButtonsBusy(false);
  const sg=suggest(ex,{locationId:PAST_DRAFT.locationId,date:PAST_DRAFT.date});
  document.getElementById('saveSetBtn').textContent='Add set';
  document.getElementById('saveSetMoreBtn').hidden=true;
  document.getElementById('restBarsBtn').hidden=true;
  document.getElementById('restStatus').hidden=true;
  document.getElementById('logTitle').textContent=ex.name;
  document.getElementById('logSub').textContent=`Past workout · ${fmtDate(PAST_DRAFT.date)}`;
  document.getElementById('inReps').value=sg.reps;
  document.getElementById('inKg').value=sg.kg;
  const hint=document.getElementById('logHint'); hint.className='sugg '+(sg.up?'up':''); hint.innerHTML=`<span class="ic">💡</span><span class="m">${sg.msg}</span>`;
  openSheet('logSheet');
}
function appendPastDetailedSet(){
  const values=readSetInput();
  if(!values) return false;
  PAST_DRAFT.sets.push({exId:logEx.id,...values,effort:SET_EFFORT,variant:variantOf(logEx)});
  PAST_LOGGING=false; setLogButtonsBusy(false); closeSheets(); renderPastWorkout(); openSheet('pastWorkoutSheet');
  return true;
}
function savePastWorkout(){
  if(!PAST_DRAFT) return;
  const date=PAST_DRAFT.date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>todayKey()){ toast('Choose today or an earlier date'); return; }
  const summary=pastSetSummary();
  if(!summary.count){ toast('Select at least one set'); return; }
  const now=Date.now(),id=uid('w'),locationId=PAST_DRAFT.locationId;
  const workout={id,status:'completed',startedAt:new Date(date+'T12:00:00').getTime(),endedAt:new Date(date+'T12:00:00').getTime(),createdAt:now,date,pastEntry:true,entryMode:PAST_DRAFT.mode,locationId,locationName:locationName(locationId),setIds:[]};
  const entries=PAST_DRAFT.mode==='quick'
    ? Object.entries(PAST_DRAFT.counts).flatMap(([exId,count])=>Array.from({length:count},()=>({exId,mode:'quick',effort:'hard',reps:0,kg:0,variant:variantOf(exerciseById(exId)||{})})))
    : PAST_DRAFT.sets;
  entries.forEach((entry,index)=>{
    const set={id:uid('s'),workoutId:id,exId:entry.exId,date,ts:now+index,locationId,variant:entry.variant||variantOf(exerciseById(entry.exId)||{}),effort:entry.effort==='warmup'?'warmup':'hard',reps:entry.reps,kg:entry.kg};
    if(entry.mode==='quick') set.mode='quick';
    DB.sets.push(set); workout.setIds.push(set.id);
  });
  DB.workouts.push(workout); PAST_DRAFT=null; save(); closeSheets(); refreshAll();
  toast('Past workout saved ✓');
}
document.getElementById('savePastWorkoutBtn').onclick=savePastWorkout;
