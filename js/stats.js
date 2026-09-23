"use strict";
/* ================= STATS ================= */
let RW=999;
let SELECTED_MUSCLE='';
document.querySelectorAll('#rangeSeg button').forEach(b=>b.onclick=()=>{ document.querySelectorAll('#rangeSeg button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); RW=+b.dataset.w; renderStats(); });
function weekList(n){ const out=[]; let d=new Date(thisWeek()+"T00:00:00"); for(let i=0;i<n;i++){ out.unshift(dateKey(d)); d.setDate(d.getDate()-7); } return out; }
function addWeeks(mk,n){ const d=new Date(mk+"T00:00:00"); d.setDate(d.getDate()+n*7); return dateKey(d); }
function statWeeks(){
  if(RW<999) return weekList(Math.min(RW,52));
  const current=thisWeek();
  const logged=recordedSets().map(s=>mondayOf(s.date)).sort();
  const start=logged[0]&&logged[0]<current ? logged[0] : current;
  const out=[];
  for(let mk=start; mk<=current; mk=addWeeks(mk,1)) out.push(mk);
  return out.length?out:[current];
}
function renderStats(){
  const weeks=statWeeks();
  const inRange=s=>weeks.includes(mondayOf(s.date));
  const sets=recordedSets().filter(inRange);
  document.getElementById('aVol').textContent=sets.length;
  document.getElementById('aSets').textContent=new Set(sets.map(s=>s.exId)).size;
  document.getElementById('groupVolumeHelp').textContent=sets.length
    ? 'Effective sets each week, including weeks with no training.'
    : 'No sets logged in this range. Every week is 0.';
  // Empty weeks count as zero so the summary reflects lapses in training.
  const hitSum=weeks.reduce((sum,mk)=>{ const progress=weeklyMaintainProgress(mk); return sum+(progress.target?progress.done/progress.target:0); },0);
  document.getElementById('aHit').textContent=(weeks.length?Math.round(hitSum/weeks.length*100):0)+"%";

  drawVolumeCharts(weeks);
  // best-set progress per exercise
  const pl=document.getElementById('progList');
  const rows=DB.exercises.map(e=>{
    const all=allSetsFor(e.id).filter(inRange); if(all.length<1)return null;
    const weekly=topSetPerWeek(e.id,weeks);
    const seen=weekly.filter(Boolean);
    const first=seen[0], last=seen[seen.length-1];
    const delta=setDelta(first,last);
    return {e,series:weekly.map(setScore),delta,last};
  }).filter(Boolean).sort((a,b)=>b.delta.rank-a.delta.rank);
  pl.innerHTML=rows.length?rows.map((r,i)=>
    `<div class="prog"><div class="pn">${esc(r.e.name)}<div class="sub">${fmtSet(r.last)}</div></div><canvas class="spark" id="sp${i}" width="70" height="26"></canvas>
     <div class="pd ${r.delta.cls}">${r.delta.arrow} ${r.delta.label}</div></div>`).join('')
    :`<div class="sub">Log a few weeks to see trends.</div>`;
  rows.forEach((r,i)=>drawSpark(document.getElementById('sp'+i),r.series));
  // set volume by exercise
  const byEx={}; sets.forEach(s=>{ byEx[s.exId]=(byEx[s.exId]||0)+1; });
  const top=Object.entries(byEx).sort((a,b)=>b[1]-a[1]).slice(0,8); const max=top.length?top[0][1]:1;
  const nameOf=id=>(DB.exercises.find(e=>e.id===id)||{}).name||'(removed)';
  document.getElementById('volBars').innerHTML=top.length?top.map(([id,v])=>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:12.5px;">
      <span style="width:96px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)">${esc(nameOf(id))}</span>
      <div style="flex:1;background:var(--bg2);border-radius:6px;height:16px;overflow:hidden"><div style="height:100%;width:${Math.max(4,v/max*100)}%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:6px"></div></div>
      <span style="width:54px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${v} set${v===1?'':'s'}</span></div>`).join('')
    :`<div class="sub">No set volume yet.</div>`;
}
function topSetPerWeek(exId,weeks){ return weeks.map(mk=>bestSet(recordedSets().filter(s=>s.exId===exId&&mondayOf(s.date)===mk))); }

/* ===== charts ===== */
function setupCanvas(cv){
  const dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth||cv.parentElement?.clientWidth||cv.width||300;
  const h=+(cv.dataset.baseHeight||cv.getAttribute('height'))||cv.clientHeight||cv.height||140;
  cv.dataset.baseHeight=h;
  cv.style.height=h+"px";
  cv.width=Math.max(1,Math.round(w*dpr));
  cv.height=Math.max(1,Math.round(h*dpr));
  const ctx=cv.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}
const GROUP_CHART_COLORS={Legs:'#34d399',Core:'#fbbf24',Push:'#f2556a',Pull:'#a98bff'};
function drawVolumeCharts(weeks){
  const muscleNames=[...new Set(MUSCLES.concat(DB.exercises.map(e=>muscleOf(e)||'Other')))].filter(Boolean);
  const select=document.getElementById('muscleChartSelect');
  if(!muscleNames.includes(SELECTED_MUSCLE)) SELECTED_MUSCLE=muscleNames[0]||'Other';
  select.innerHTML=muscleNames.map(m=>`<option value="${esc(m)}" ${m===SELECTED_MUSCLE?'selected':''}>${esc(m)}</option>`).join('');
  const effective=weeks.map(mk=>muscleEffective(mk));
  document.getElementById('muscleVolumeHelp').textContent=effective.some(rows=>(rows[SELECTED_MUSCLE]?.eff||0)>0)
    ? 'Effective sets each week; gaps are 0.'
    : '0 effective sets for this muscle in the selected weeks.';
  const groupSeries=['Legs','Core','Push','Pull'].map(group=>({
    name:group,color:GROUP_CHART_COLORS[group],
    values:effective.map(rows=>Object.values(rows).filter(r=>(MUSCLE_PPL[r.muscle]||'Other')===group).reduce((sum,r)=>sum+r.eff,0))
  }));
  drawWeeklyLines(document.getElementById('groupsChart'),weeks,groupSeries,[]);
  document.getElementById('groupChartLegend').innerHTML=groupSeries.map(s=>`<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  const thresholds=muscleThresholds(SELECTED_MUSCLE);
  drawWeeklyLines(document.getElementById('muscleChart'),weeks,[{
    name:SELECTED_MUSCLE,color:'#a98bff',values:effective.map(rows=>rows[SELECTED_MUSCLE]?.eff||0)
  }],thresholds);
}
document.getElementById('muscleChartSelect').onchange=e=>{ SELECTED_MUSCLE=e.target.value; renderStats(); };
function drawWeeklyLines(cv,weeks,series,thresholds){
  cv.style.width=Math.max(cv.parentElement.clientWidth,weeks.length*42+55)+'px';
  const {ctx,w,h}=setupCanvas(cv); ctx.clearRect(0,0,w,h);
  const pad={l:35,r:15,t:16,b:30};
  const max=Math.max(1,...thresholds,...series.flatMap(s=>s.values));
  const top=Math.ceil(max*1.12);
  const X=i=>pad.l+(weeks.length===1?(w-pad.l-pad.r)/2:i*(w-pad.l-pad.r)/(weeks.length-1));
  const Y=v=>h-pad.b-v/top*(h-pad.t-pad.b);
  ctx.font='10px sans-serif'; ctx.fillStyle='#a5a9b8'; ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const value=top*i/4,y=Y(value);
    ctx.fillText(Number.isInteger(value)?String(value):value.toFixed(1),pad.l-7,y+3);
    ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
  }
  thresholds.forEach((value,i)=>{
    ctx.strokeStyle=['#8c76c9','#bfa4ff','#f7d78b'][i]; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(pad.l,Y(value)); ctx.lineTo(w-pad.r,Y(value)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=ctx.strokeStyle; ctx.textAlign='right'; ctx.fillText(['M','B','Beast'][i],w-pad.r-2,Y(value)-3);
  });
  if(series.every(s=>s.values.every(value=>value===0))){
    weeks.forEach((_,i)=>{ ctx.fillStyle='#a5a9b8'; ctx.beginPath(); ctx.arc(X(i),Y(0),3.5,0,Math.PI*2); ctx.fill(); });
  }else{
    series.forEach(s=>{
      ctx.strokeStyle=s.color; ctx.lineWidth=2.5; ctx.beginPath();
      s.values.forEach((value,i)=>{ if(i) ctx.lineTo(X(i),Y(value)); else ctx.moveTo(X(i),Y(value)); }); ctx.stroke();
      s.values.forEach((value,i)=>{ ctx.fillStyle=s.color; ctx.beginPath(); ctx.arc(X(i),Y(value),3.5,0,Math.PI*2); ctx.fill(); });
    });
  }
  ctx.fillStyle='#a5a9b8'; ctx.textAlign='center'; ctx.font='10px sans-serif';
  weeks.forEach((mk,i)=>{ const d=new Date(mk+'T00:00:00');ctx.fillText(`${d.getMonth()+1}/${d.getDate()}`,X(i),h-8); });
}
function drawSpark(cv,series){ const {ctx,w,h}=setupCanvas(cv); ctx.clearRect(0,0,w,h);
  const v=series.map(x=>x); const nz=v.filter(x=>x>0); if(nz.length<1)return;
  const max=Math.max(...nz),min=Math.min(...nz); const rng=max-min||1;
  const X=i=>v.length===1?w/2:i*(w-4)/(v.length-1)+2; const Y=val=>h-3-((val-min)/rng)*(h-6);
  ctx.beginPath(); let started=false;
  v.forEach((val,i)=>{ if(val<=0){ started=false; return; } const x=X(i),y=Y(val); started?ctx.lineTo(x,y):(ctx.moveTo(x,y),started=true); });
  ctx.strokeStyle='#5b9dff'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  v.forEach((val,i)=>{ if(val>0){ ctx.beginPath(); ctx.arc(X(i),Y(val),2.5,0,7); ctx.fillStyle='#5b9dff'; ctx.fill(); } });
}
