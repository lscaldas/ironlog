"use strict";
/* ================= Add / edit exercise ================= */
let editEx=null;
let EX_CHOICES_OPEN=false;
function openEx(e){
  editEx=e||null;
  EX_CHOICES_OPEN=false;
  document.getElementById('exTitle').textContent=e?'Edit exercise':'Add exercise';
  document.getElementById('fName').value=e?e.name:'';
  document.getElementById('fMuscle').value=e?muscleOf(e):'';
  document.getElementById('fArea').value=e?areaOf(e):'';
  document.getElementById('fBucket').value=e?e.bucket:(DB.exercises[0]?.bucket||'Upper');
  document.getElementById('fTarget').value=e?e.target:4;
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
    hint.innerHTML=`Counting as <b>${esc(match.base)}</b>: ${esc(match.muscle)} · ${esc(match.area)}`;
    hint.classList.add('show');
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
  const obj={ name, muscle:(document.getElementById('fMuscle').value.trim()||guessMuscle(name)||'Other'),
    area:(document.getElementById('fArea').value.trim()||guessArea(name)||'Other'),
    bucket:(document.getElementById('fBucket').value.trim()||'Other'),
    target:Math.max(1,parseInt(document.getElementById('fTarget').value)||4),
    low:parseInt(document.getElementById('fLow').value)||8, high:parseInt(document.getElementById('fHigh').value)||12,
    inc:parseFloat(document.getElementById('fInc').value)||2.5, notes:document.getElementById('fNotes').value.trim() };
  if(editEx){ Object.assign(editEx,obj); } else { obj.id=uid('e'); DB.exercises.push(obj); }
  save(); closeSheets(); renderWeek(); toast(editEx?"Saved ✓":"Added ✓");
};
document.getElementById('delExBtn').onclick=()=>{
  if(!editEx)return;
  if(confirm(`Remove "${editEx.name}" from your program? Logged history is kept.`)){
    DB.exercises=DB.exercises.filter(x=>x.id!==editEx.id); save(); closeSheets(); renderWeek(); toast("Removed");
  }
};

/* ================= CATALOG ================= */
function contribListFor(ex){
  const primary=muscleOf(ex)||'Other';
  const parts=[{muscle:primary,weight:1,primary:true}];
  Object.entries(secondaryMuscles(ex)).sort((a,b)=>b[1]-a[1]).forEach(([muscle,weight])=>{
    if(muscle&&muscle!==primary&&weight>0) parts.push({muscle,weight,primary:false});
  });
  return parts;
}
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
  const program=DB.exercises.map(e=>({name:e.name,source:e.bucket||'Program',muscle:muscleOf(e)||'Other',area:areaOf(e)||'Other',match:exerciseMatch(e.name),keys:exerciseMatch(e.name)?.keys||[]})).filter(matchQ);
  const catalog=catalogEntries().filter(matchQ);
  document.getElementById('catalogCount').textContent=`${catalog.length} catalogued`;
  document.getElementById('programMapCount').textContent=`${program.length}`;
  document.getElementById('catalogMapCount').textContent=`${catalog.length}`;
  document.getElementById('programMapList').innerHTML=program.length?program.map(catalogCard).join(''):`<div class="sub">No program exercises match this search.</div>`;
  document.getElementById('catalogList').innerHTML=catalog.length?catalog.map(catalogCard).join(''):`<div class="sub">No catalog exercises match this search.</div>`;
}
document.getElementById('catalogSearch').oninput=renderCatalog;

/* ================= HISTORY ================= */
function renderHistory(){
  const nameOf=id=>(DB.exercises.find(e=>e.id===id)||{}).name||'(removed)';
  const completed=DB.workouts.filter(w=>w.status==='completed').sort((a,b)=>(b.endedAt||b.startedAt)-(a.endedAt||a.startedAt));
  const completedIds=new Set(completed.map(w=>w.id));
  const completedSetIds=new Set(completed.flatMap(w=>w.setIds||[]));
  const activeId=currentActiveWorkout()?.id;
  const legacySets=DB.sets.filter(s=>!completedSetIds.has(s.id)&&s.workoutId!==activeId&&!completedIds.has(s.workoutId));
  const byDay={};
  legacySets.forEach(s=>{(byDay[s.date]=byDay[s.date]||[]).push(s);});
  const days=Object.keys(byDay).sort().reverse();
  const totalEntries=completed.length+days.length;
  document.getElementById('histEmpty').style.display=totalEntries?'none':'block';
  document.getElementById('histCount').textContent=completed.length?`${completed.length} session${completed.length===1?'':'s'}`:(days.length?days.length+" legacy days":'');
  const sessionHtml=completed.map(w=>{
    const sets=setsForWorkout(w); const byEx={};
    sets.forEach(s=>{(byEx[s.exId]=byEx[s.exId]||[]).push(s);});
    const rows=Object.keys(byEx).map(id=>{
      const ss=byEx[id].sort((a,b)=>a.ts-b.ts);
      return `<div class="day-ex"><div class="nm">${esc(nameOf(id))} <span style="color:var(--dim);font-weight:400">·${ss.length} set${ss.length>1?'s':''}</span></div>
        <div class="st">${ss.map(s=>`<span class="history-set"><span>${s.reps}×${fmtW(s.kg)}</span><button class="historyEditSet" type="button" data-sid="${esc(s.id)}" aria-label="Edit set ${s.reps} by ${fmtW(s.kg)}">Edit</button></span>`).join('<span aria-hidden="true"> · </span>')}</div></div>`;
    }).join('');
    const label=`Completed workout session ${relDay(w.date||dateKey(new Date(w.startedAt)))} duration ${workoutDuration(w.startedAt,w.endedAt||w.startedAt)} ${sets.length} set${sets.length===1?'':'s'}`;
    return `<div class="day session" data-wid="${esc(w.id)}">
      <button class="session-row day-h" type="button" aria-expanded="false" aria-label="${esc(label)}">
        <div><div class="day-date">Completed workout session</div>
        <div class="day-sum">${relDay(w.date||dateKey(new Date(w.startedAt)))} · duration ${workoutDuration(w.startedAt,w.endedAt||w.startedAt)} · ${sets.length} set${sets.length===1?'':'s'} · ${Object.keys(byEx).length} exercise${Object.keys(byEx).length===1?'':'s'}</div></div><span class="chev">›</span>
      </button>
      <div class="session-actions"><button class="ghost btn-sm deleteWorkoutBtn" type="button">Delete</button></div>
      <div class="day-body">${rows||'<div class="sub">No sets saved in this workout.</div>'}</div>
    </div>`;
  }).join('');
  const legacyHtml=days.map(d=>{
    const sets=byDay[d]; const byEx={};
    sets.forEach(s=>{(byEx[s.exId]=byEx[s.exId]||[]).push(s);});
    const rows=Object.keys(byEx).map(id=>{
      const ss=byEx[id].sort((a,b)=>a.ts-b.ts);
      return `<div class="day-ex"><div class="nm">${esc(nameOf(id))} <span style="color:var(--dim);font-weight:400">·${ss.length} set${ss.length>1?'s':''}</span></div>
        <div class="st">${ss.map(s=>s.reps+'×'+fmtW(s.kg)).join('  ·  ')}</div></div>`;
    }).join('');
    return `<div class="day legacy"><div class="day-h"><div><div class="day-date">${relDay(d)} legacy sets</div>
      <div class="day-sum">${sets.length} sets · ${Object.keys(byEx).length} exercises</div></div><span class="chev">›</span></div>
      <div class="day-body">${rows}</div></div>`;
  }).join('');
  document.getElementById('histList').innerHTML=sessionHtml+legacyHtml;
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
}
