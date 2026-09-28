"use strict";
/* ================= Personal bests + share image ================= */
let PB_ITEMS=[];
let PB_SELECTED=new Set();
let PB_SELECTION_READY=false;
let PB_BACKGROUND_IMAGE=null;
let PB_BACKGROUND_URL='';
let PB_SHARE_BLOB=null;
let PB_RENDER_TOKEN=0;

function personalBestEntries(){
  const rows=[];
  DB.exercises.forEach(ex=>{
    const sets=recordedSets().filter(s=>s.exId===ex.id&&s.mode!=='quick');
    if(!sets.length) return;
    const isMachine=variantOf(ex)==='Machine';
    const locations=isMachine?[...new Set(sets.map(s=>s.locationId||'home'))]:[null];
    locations.forEach(locationId=>{
      const relevant=locationId===null?sets:sets.filter(s=>(s.locationId||'home')===locationId);
      const result=bestSet(relevant);
      if(!result) return;
      const workout=DB.workouts.find(w=>w.id===result.workoutId)
        ||DB.workouts.find(w=>w.locationId===locationId&&w.date===result.date);
      const gymName=locationId===null?'':locationName(locationId)==='Unknown location'
        ? (workout?.locationName||'Unknown location')
        : locationName(locationId);
      rows.push({
        key:`${ex.id}::${locationId===null?'all':locationId}`,
        exercise:ex,
        result,
        machine:isMachine,
        locationLabel:gymName
      });
    });
  });
  return rows.sort((a,b)=>a.exercise.name.localeCompare(b.exercise.name)||a.locationLabel.localeCompare(b.locationLabel));
}

function renderPersonalBests(){
  const items=personalBestEntries();
  const previousKeys=new Set(PB_ITEMS.map(item=>item.key));
  const itemKeys=new Set(items.map(item=>item.key));
  PB_SELECTED=new Set([...PB_SELECTED].filter(key=>itemKeys.has(key)));
  if(!PB_SELECTION_READY){
    items.forEach(item=>PB_SELECTED.add(item.key));
    PB_SELECTION_READY=true;
  }else{
    items.forEach(item=>{ if(!previousKeys.has(item.key)) PB_SELECTED.add(item.key); });
  }
  PB_ITEMS=items;
  const list=document.getElementById('personalBestList');
  if(!items.length){
    list.innerHTML='<div class="empty"><div class="big">🏆</div><div>No full sets logged yet.</div><div class="sub">Quick-log set counts are excluded because they do not include weight or reps.</div></div>';
  }else{
    list.innerHTML=items.map(item=>{
      const location=item.machine?`${esc(item.locationLabel)} · Machine`:`${esc(variantOf(item.exercise))}`;
      return `<label class="pb-entry">
        <input class="pb-include" type="checkbox" data-key="${esc(item.key)}" ${PB_SELECTED.has(item.key)?'checked':''} aria-label="Include ${esc(item.exercise.name)} ${item.machine?`at ${esc(item.locationLabel)}`:''} in share image">
        <span class="pb-entry-copy"><span class="pb-name">${esc(item.exercise.name)}</span><span class="pb-meta">${location} · ${esc(fmtDate(item.result.date))}</span></span>
        <span class="pb-result">${item.result.reps} × ${esc(fmtW(item.result.kg))}</span>
      </label>`;
    }).join('');
    list.querySelectorAll('.pb-include').forEach(input=>input.onchange=()=>{
      if(input.checked) PB_SELECTED.add(input.dataset.key);
      else PB_SELECTED.delete(input.dataset.key);
      updatePBControls(true);
    });
  }
  updatePBControls(false);
}

function updatePBControls(invalidate=false){
  const selected=PB_ITEMS.filter(item=>PB_SELECTED.has(item.key)).length;
  document.getElementById('pbSelectedCount').textContent=`${selected} of ${PB_ITEMS.length} selected`;
  document.getElementById('pbCreateImage').disabled=!selected;
  if(invalidate) hidePBPreview();
}

function hidePBPreview(){
  PB_RENDER_TOKEN++;
  PB_SHARE_BLOB=null;
  document.getElementById('pbPreview').hidden=true;
}

function setPBSelection(select){
  PB_SELECTED=select?new Set(PB_ITEMS.map(item=>item.key)):new Set();
  document.querySelectorAll('#personalBestList .pb-include').forEach(input=>{ input.checked=select; });
  updatePBControls(true);
}
document.getElementById('pbSelectAll').onclick=()=>setPBSelection(true);
document.getElementById('pbSelectNone').onclick=()=>setPBSelection(false);
document.getElementById('pbChooseBackground').onclick=()=>document.getElementById('pbBackgroundInput').click();
document.getElementById('pbBackgroundInput').onchange=e=>{
  const file=e.target.files?.[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('Choose an image file'); e.target.value=''; return; }
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
    if(PB_BACKGROUND_URL) URL.revokeObjectURL(PB_BACKGROUND_URL);
    PB_BACKGROUND_URL=url;
    PB_BACKGROUND_IMAGE=image;
    document.getElementById('pbBackgroundName').textContent=file.name;
    document.getElementById('pbClearBackground').hidden=false;
    hidePBPreview();
  };
  image.onerror=()=>{ URL.revokeObjectURL(url); toast('Could not open that image'); };
  image.src=url;
  e.target.value='';
};
document.getElementById('pbClearBackground').onclick=()=>{
  if(PB_BACKGROUND_URL) URL.revokeObjectURL(PB_BACKGROUND_URL);
  PB_BACKGROUND_URL=''; PB_BACKGROUND_IMAGE=null;
  document.getElementById('pbBackgroundName').textContent='Optional · add a photo or meme from your device.';
  document.getElementById('pbClearBackground').hidden=true;
  hidePBPreview();
};

function drawPBBackground(ctx,width,height){
  if(PB_BACKGROUND_IMAGE){
    const image=PB_BACKGROUND_IMAGE;
    const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
    const drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;
    ctx.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
  }else{
    const gradient=ctx.createLinearGradient(0,0,width,height);
    gradient.addColorStop(0,'#191322'); gradient.addColorStop(.55,'#11141e'); gradient.addColorStop(1,'#17101a');
    ctx.fillStyle=gradient; ctx.fillRect(0,0,width,height);
  }
  const shade=ctx.createLinearGradient(0,0,0,height);
  shade.addColorStop(0,'rgba(7,8,12,.56)'); shade.addColorStop(.45,'rgba(7,8,12,.79)'); shade.addColorStop(1,'rgba(7,8,12,.91)');
  ctx.fillStyle=shade; ctx.fillRect(0,0,width,height);
}

function pbRoundRect(ctx,x,y,width,height,radius){
  const r=Math.min(radius,width/2,height/2);
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+width,y,x+width,y+height,r);
  ctx.arcTo(x+width,y+height,x,y+height,r); ctx.arcTo(x,y+height,x,y,r); ctx.arcTo(x,y,x+width,y,r); ctx.closePath();
}

function drawPBText(ctx,text,x,y,maxWidth,size=40,weight=700){
  ctx.font=`${weight} ${size}px system-ui, sans-serif`;
  while(ctx.measureText(text).width>maxWidth&&size>22){ size-=2; ctx.font=`${weight} ${size}px system-ui, sans-serif`; }
  ctx.fillText(text,x,y);
}

function drawPBCard(ctx,item,x,y,width,height,featured=false){
  pbRoundRect(ctx,x,y,width,height,22);
  ctx.fillStyle='rgba(15,17,23,.76)'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=2; ctx.stroke();
  const pad=featured?42:26;
  const gym=item.machine?`${item.locationLabel} · Machine`:variantOf(item.exercise);
  ctx.textAlign='left'; ctx.fillStyle='rgba(235,230,255,.72)';
  drawPBText(ctx,gym,x+pad,y+(featured?88:43),width-pad*2,featured?27:21,650);
  ctx.fillStyle='#fff';
  drawPBText(ctx,item.exercise.name,x+pad,y+(featured?158:91),width-pad*2,featured?52:34,800);
  ctx.fillStyle='#c8aaff';
  drawPBText(ctx,`${item.result.reps} × ${fmtW(item.result.kg)}`,x+pad,y+(featured?264:153),width-pad*2,featured?78:48,850);
  ctx.fillStyle='rgba(235,230,255,.67)';
  drawPBText(ctx,fmtDate(item.result.date),x+pad,y+height-(featured?44:20),width-pad*2,featured?23:18,550);
}

async function createPBShareImage(){
  const renderToken=++PB_RENDER_TOKEN;
  PB_SHARE_BLOB=null;
  const items=PB_ITEMS.filter(item=>PB_SELECTED.has(item.key));
  if(!items.length){ toast('Select at least one result'); return; }
  const canvas=document.getElementById('pbShareCanvas'),ctx=canvas.getContext('2d');
  const featured=items.length===1,width=1080;
  const cols=featured?1:2,cardHeight=featured?480:220,gap=22;
  const rows=Math.ceil(items.length/cols),height=featured?1120:360+rows*(cardHeight+gap);
  canvas.width=width; canvas.height=height;
  drawPBBackground(ctx,width,height);
  ctx.textAlign='left'; ctx.fillStyle='#c8aaff'; ctx.font='750 25px system-ui, sans-serif';
  ctx.fillText('IRONLOG  ·  PERSONAL BESTS',64,76);
  ctx.fillStyle='#fff'; ctx.font='850 56px system-ui, sans-serif';
  ctx.fillText(featured?'MY PERSONAL BEST':'MY BEST SETS',64,157);
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font='500 23px system-ui, sans-serif';
  ctx.fillText('Weight first · then reps',64,203);
  if(featured){
    drawPBCard(ctx,items[0],64,270,952,600,true);
  }else{
    items.forEach((item,index)=>{
      const x=64+(index%2)*476,y=260+Math.floor(index/2)*(cardHeight+gap);
      drawPBCard(ctx,item,x,y,454,cardHeight,false);
    });
  }
  ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='500 18px system-ui, sans-serif'; ctx.textAlign='right';
  ctx.fillText(`ironlog · ${new Date().toLocaleDateString()}`,width-64,height-30);
  document.getElementById('pbPreview').hidden=false;
  document.getElementById('pbPreview').scrollIntoView({behavior:'smooth',block:'start'});
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(renderToken!==PB_RENDER_TOKEN) return;
  PB_SHARE_BLOB=blob;
  if(!PB_SHARE_BLOB) toast('Could not create the image');
}
document.getElementById('pbCreateImage').onclick=createPBShareImage;

function downloadPBShareImage(){
  if(!PB_SHARE_BLOB){ toast('Create the image first'); return; }
  const url=URL.createObjectURL(PB_SHARE_BLOB),anchor=document.createElement('a');
  anchor.href=url; anchor.download=`ironlog-personal-bests-${todayKey()}.png`; anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.getElementById('pbDownload').onclick=downloadPBShareImage;
document.getElementById('pbShare').onclick=async()=>{
  if(!PB_SHARE_BLOB){ toast('Create the image first'); return; }
  if(typeof File==='undefined'){ downloadPBShareImage(); return; }
  const file=new File([PB_SHARE_BLOB],`ironlog-personal-bests-${todayKey()}.png`,{type:'image/png'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    try{ await navigator.share({files:[file],title:'My personal bests'}); }
    catch(error){ if(error.name!=='AbortError') toast('Could not share the image'); }
  }else{
    downloadPBShareImage();
    toast('Sharing is not available here; the image was downloaded');
  }
};
