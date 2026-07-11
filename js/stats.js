"use strict";
/* ================= STATS ================= */
let RW=8;
document.querySelectorAll('#rangeSeg button').forEach(b=>b.onclick=()=>{ document.querySelectorAll('#rangeSeg button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); RW=+b.dataset.w; renderStats(); });
function weekList(n){ const out=[]; let d=new Date(thisWeek()+"T00:00:00"); for(let i=0;i<n;i++){ out.unshift(dateKey(d)); d.setDate(d.getDate()-7); } return out; }
function addWeeks(mk,n){ const d=new Date(mk+"T00:00:00"); d.setDate(d.getDate()+n*7); return dateKey(d); }
function statWeeks(){
  if(RW<999) return weekList(Math.min(RW,52));
  const current=thisWeek();
  const logged=DB.sets.map(s=>mondayOf(s.date)).sort();
  const start=logged[0]&&logged[0]<current ? logged[0] : current;
  const out=[];
  for(let mk=start; mk<=current; mk=addWeeks(mk,1)) out.push(mk);
  return out.length?out:[current];
}
function renderStats(){
  const weeks=statWeeks();
  const inRange=s=>weeks.includes(mondayOf(s.date));
  const sets=DB.sets.filter(inRange);
  document.getElementById('aVol').textContent=sets.length;
  document.getElementById('aSets').textContent=new Set(sets.map(s=>s.exId)).size;
  // share of program muscles kept at maintenance, averaged over trained weeks
  const wks=weeks;
  let hitSum=0,wkCount=0;
  wks.forEach(mk=>{ if(mk>thisWeek())return; const progress=weeklyMaintainProgress(mk);
    if(setsForWeekAny(mk)||mk===thisWeek()){ hitSum+=progress.target?progress.done/progress.target:0; wkCount++; } });
  document.getElementById('aHit').textContent=(wkCount?Math.round(hitSum/wkCount*100):0)+"%";

  drawSets(weeks);
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
const setsForWeekAny=mk=>DB.sets.some(s=>mondayOf(s.date)===mk);
function topSetPerWeek(exId,weeks){ return weeks.map(mk=>bestSet(DB.sets.filter(s=>s.exId===exId&&mondayOf(s.date)===mk))); }

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
function drawSets(weeks){
  const cv=document.getElementById('setsChart'); const {ctx,w,h}=setupCanvas(cv); ctx.clearRect(0,0,w,h);
  const data=weeks.map(mk=>DB.sets.filter(s=>mondayOf(s.date)===mk).length);
  const muscles=new Set(DB.exercises.map(e=>muscleOf(e)||'Other'));
  let tgt=0; muscles.forEach(m=>{ tgt+=REC_SETS_TIERS.maintain[m]||REC_SETS_TIERS.maintain.Other; });
  document.getElementById('targetLineLbl').textContent=tgt?('maintain ≈'+tgt+'/wk'):'';
  const pad={l:6,r:6,t:14,b:20}; const max=Math.max(tgt,...data,1);
  const bw=(w-pad.l-pad.r)/data.length; const Y=v=>h-pad.b-(v/max)*(h-pad.t-pad.b);
  // target line
  if(tgt){ ctx.strokeStyle='rgba(201,182,255,.6)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad.l,Y(tgt)); ctx.lineTo(w-pad.r,Y(tgt)); ctx.stroke(); ctx.setLineDash([]); }
  data.forEach((v,i)=>{ const x=pad.l+i*bw+bw*0.18, bwid=bw*0.64, y=Y(v);
    ctx.fillStyle=v>=tgt&&tgt?'#34d399':'#f2556a'; const r=4;
    const hh=h-pad.b-y; roundRect(ctx,x,y,bwid,Math.max(2,hh),r); ctx.fill();
  });
  ctx.fillStyle='#5d6885'; ctx.font='9px sans-serif'; ctx.textAlign='center';
  weeks.forEach((mk,i)=>{ if(weeks.length>10&&i%2)return; const d=new Date(mk+"T00:00:00"); ctx.fillText((d.getMonth()+1)+'/'+d.getDate(), pad.l+i*bw+bw/2, h-7); });
}
function roundRect(ctx,x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,0); ctx.arcTo(x,y+h,x,y,0); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawSpark(cv,series){ const {ctx,w,h}=setupCanvas(cv); ctx.clearRect(0,0,w,h);
  const v=series.map(x=>x); const nz=v.filter(x=>x>0); if(nz.length<1)return;
  const max=Math.max(...nz),min=Math.min(...nz); const rng=max-min||1;
  const X=i=>v.length===1?w/2:i*(w-4)/(v.length-1)+2; const Y=val=>h-3-((val-min)/rng)*(h-6);
  ctx.beginPath(); let started=false;
  v.forEach((val,i)=>{ if(val<=0)return; const x=X(i),y=Y(val); started?ctx.lineTo(x,y):(ctx.moveTo(x,y),started=true); });
  ctx.strokeStyle='#5b9dff'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  // last point
  for(let i=v.length-1;i>=0;i--){ if(v[i]>0){ ctx.beginPath(); ctx.arc(X(i),Y(v[i]),2.5,0,7); ctx.fillStyle='#5b9dff'; ctx.fill(); break; } }
}
