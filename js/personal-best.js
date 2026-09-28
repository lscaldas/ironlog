"use strict";
/* ================= Personal bests + share image ================= */
let PB_ITEMS=[];
let PB_SELECTED=new Set();
let PB_SELECTION_READY=false;
let PB_BACKGROUND_IMAGE=null;
let PB_BACKGROUND_URL='';
let PB_SHARE_BLOB=null;
let PB_RENDER_TOKEN=0;
let PB_STANDARD_DATA=null;
let PB_STANDARD_LOAD=null;

const PB_1RM_PERCENT=[1,.97,.94,.92,.89,.86,.83,.81,.78,.75,.73,.71,.70,.68,.67,.65,.64,.63,.61,.60,.59,.58,.57,.56,.55,.54,.53,.52,.51,.50];

function loadPBStandards(){
  if(PB_STANDARD_DATA) return Promise.resolve(PB_STANDARD_DATA);
  if(PB_STANDARD_LOAD) return PB_STANDARD_LOAD;
  PB_STANDARD_LOAD=fetch('./data/strengthlevel-standards.json')
    .then(response=>{ if(!response.ok) throw new Error('Standards unavailable'); return response.json(); })
    .then(data=>{ PB_STANDARD_DATA=data; PB_STANDARD_LOAD=null; if(document.getElementById('v-personalBest').classList.contains('active')) renderPersonalBests(); return data; })
    .catch(()=>{ PB_STANDARD_LOAD=null; return null; });
  return PB_STANDARD_LOAD;
}

function pbEstimate1RM(weight,reps){
  if(!(weight>0)||!Number.isFinite(reps)||reps<1||reps>PB_1RM_PERCENT.length) return null;
  return weight/PB_1RM_PERCENT[reps-1];
}

function pbThresholdNumber(value){
  if(typeof value==='number') return value;
  return typeof value==='string'&&/^<\s*1$/.test(value.trim())?0.5:NaN;
}

function pbInterpolateThresholds(rows,bodyweightKg){
  if(!Array.isArray(rows)||!rows.length||!Number.isFinite(bodyweightKg)) return null;
  const sorted=rows.slice().sort((a,b)=>a[0]-b[0]);
  let lower=sorted[0],upper=sorted[sorted.length-1];
  if(bodyweightKg<=lower[0]) upper=lower;
  else if(bodyweightKg>=upper[0]) lower=upper;
  else{
    for(let i=1;i<sorted.length;i++){
      if(sorted[i][0]>=bodyweightKg){ lower=sorted[i-1]; upper=sorted[i]; break; }
    }
  }
  const ratio=upper[0]===lower[0]?0:(bodyweightKg-lower[0])/(upper[0]-lower[0]);
  const thresholds=[];
  for(let i=1;i<6;i++){
    const a=pbThresholdNumber(lower[i]),b=pbThresholdNumber(upper[i]);
    if(!Number.isFinite(a)||!Number.isFinite(b)) return null;
    thresholds.push(a+(b-a)*ratio);
  }
  return thresholds;
}

function pbRankFor(item){
  const settings=normalizeUserSettings(DB.userSettings);
  if(!PB_STANDARD_DATA||!settings.standardsSex||!settings.bodyweightKg) return null;
  const mapping=PB_STANDARD_DATA.exerciseMappings?.[item.exercise.name];
  const page=mapping&&PB_STANDARD_DATA.standardsBySlug?.[mapping.slug];
  const metric=item.bodyweightMode==='reps'?'reps':item.bodyweightMode==='added'?'addedWeight1RM':'weight1RM';
  const rows=page?.bySex?.[settings.standardsSex]?.[metric];
  const thresholds=pbInterpolateThresholds(rows,settings.bodyweightKg);
  if(!thresholds) return null;
  const value=metric==='reps'?item.result.reps:pbEstimate1RM(item.result.kg,item.result.reps);
  if(value===null||!Number.isFinite(value)) return null;
  let index=-1;
  thresholds.forEach((threshold,i)=>{ if(value>=threshold) index=i; });
  if(index<0) index=0;
  const levels=PB_STANDARD_DATA.metadata?.levels||['beginner','novice','intermediate','advanced','elite'];
  return index<0?null:{label:levels[index][0].toUpperCase()+levels[index].slice(1),metric,value};
}

function pbResultText(item){
  if(item.bodyweightMode==='reps') return `${item.result.reps} reps · Bodyweight`;
  if(item.bodyweightMode==='added') return `${item.result.reps} × +${fmtW(item.result.kg)}`;
  return `${item.result.reps} × ${fmtW(item.result.kg)}`;
}
function pbVariantLabel(item){
  if(item.bodyweightMode==='reps') return 'Bodyweight reps';
  if(item.bodyweightMode==='added') return 'Added weight';
  return variantOf(item.exercise);
}

function pbProfileReady(){
  const settings=normalizeUserSettings(DB.userSettings);
  return Boolean(settings.standardsSex&&settings.bodyweightKg);
}

function updatePBStandardsHelp(){
  const help=document.getElementById('pbStandardsHelp');
  const button=document.getElementById('pbOpenSettings');
  const message=document.getElementById('pbStandardsMessage');
  const setup=document.getElementById('pbFirstVisitSetup');
  const settings=normalizeUserSettings(DB.userSettings);
  const ready=pbProfileReady();
  const showSetup=!ready&&!settings.pbPromptDismissed;
  help.hidden=!ready&&!showSetup;
  setup.hidden=!showSetup;
  button.hidden=showSetup;
  button.textContent=ready?'Edit profile':'Set profile';
  message.textContent=ready
    ? `Using ${settings.bodyweightKg} kg and ${settings.standardsSex} standards. Bodyweight reps and added-weight sets rank separately; some exercises have no matching standard.`
    : 'Add your body weight and gender to see strength badges. Bodyweight reps and added-weight personal bests are ranked separately when standards are available.';
  document.getElementById('pbSetupSex').value=settings.standardsSex;
  document.getElementById('pbSetupWeight').value=settings.bodyweightKg??'';
}

function personalBestEntries(){
  const rows=[];
  DB.exercises.forEach(ex=>{
    const sets=recordedSets().filter(s=>s.exId===ex.id&&s.mode!=='quick');
    if(!sets.length) return;
    const isMachine=variantOf(ex)==='Machine';
    const locations=isMachine?[...new Set(sets.map(s=>s.locationId||'home'))]:[null];
    const standardSlug=PB_STANDARD_DATA?.exerciseMappings?.[ex.name]?.slug;
    const sexTables=PB_STANDARD_DATA?.standardsBySlug?.[standardSlug]?.bySex;
    const supportsBodyweightModes=Boolean(sexTables?.male?.reps||sexTables?.female?.reps||sexTables?.male?.addedWeight1RM||sexTables?.female?.addedWeight1RM);
    locations.forEach(locationId=>{
      const relevant=locationId===null?sets:sets.filter(s=>(s.locationId||'home')===locationId);
      const gymName=locationId===null?'':locationName(locationId)==='Unknown location'
        ? (DB.workouts.find(w=>w.locationId===locationId)?.locationName||'Unknown location')
        : locationName(locationId);
      const partitions=variantOf(ex)==='Bodyweight'||supportsBodyweightModes
        ? [
            {bodyweightMode:'reps',sets:relevant.filter(s=>(s.kg||0)===0)},
            {bodyweightMode:'added',sets:relevant.filter(s=>(s.kg||0)>0)}
          ]
        : [{bodyweightMode:'strength',sets:relevant}];
      partitions.forEach(partition=>{
        const result=bestSet(partition.sets);
        if(!result) return;
        const item={
          key:`${ex.id}::${locationId===null?'all':locationId}::${partition.bodyweightMode}`,
          exercise:ex,result,machine:isMachine,locationLabel:gymName,bodyweightMode:partition.bodyweightMode
        };
        item.rank=pbRankFor(item);
        rows.push(item);
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
  updatePBStandardsHelp();
  const list=document.getElementById('personalBestList');
  if(!items.length){
    list.innerHTML='<div class="empty"><div class="big">🏆</div><div>No full sets logged yet.</div><div class="sub">Quick-log set counts are excluded because they do not include weight or reps.</div></div>';
  }else{
    list.innerHTML=items.map(item=>{
      const location=item.machine?`${esc(item.locationLabel)} · Machine`:esc(pbVariantLabel(item));
      const accessibleMode=item.bodyweightMode==='reps'?' bodyweight reps':item.bodyweightMode==='added'?' added-weight':'';
      return `<label class="pb-entry">
        <input class="pb-include" type="checkbox" data-key="${esc(item.key)}" ${PB_SELECTED.has(item.key)?'checked':''} aria-label="Include ${esc(item.exercise.name)}${accessibleMode}${item.machine?` at ${esc(item.locationLabel)}`:''} in share image">
        <span class="pb-entry-copy"><span class="pb-name">${esc(item.exercise.name)}</span><span class="pb-meta">${location} · ${esc(fmtDate(item.result.date))}</span></span>
        <span class="pb-result">${esc(pbResultText(item))}</span>
        ${item.rank?`<span class="pb-rank" aria-label="${esc(item.rank.label)} level"><span class="pb-medal-star" aria-hidden="true">★</span>${esc(item.rank.label)}</span>`:''}
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

function drawPBMedal(ctx,label,right,centerY,featured=false){
  const height=featured?44:34,iconSize=featured?28:22,pad=featured?15:12;
  ctx.font=`800 ${featured?19:15}px system-ui, sans-serif`;
  const width=Math.ceil(ctx.measureText(label).width+iconSize+pad*2+6),x=right-width,y=centerY-height/2;
  ctx.save();
  ctx.shadowColor='rgba(169,139,255,.38)'; ctx.shadowBlur=featured?18:12; ctx.shadowOffsetY=3;
  pbRoundRect(ctx,x,y,width,height,height/2);
  const gradient=ctx.createLinearGradient(x,y,x+width,y+height);
  gradient.addColorStop(0,'#45346f'); gradient.addColorStop(.55,'#30234f'); gradient.addColorStop(1,'#211b32');
  ctx.fillStyle=gradient; ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.strokeStyle='rgba(211,190,255,.8)'; ctx.lineWidth=featured?2:1.5; ctx.stroke();
  const cx=x+pad+iconSize/2,cy=centerY;
  ctx.beginPath(); ctx.arc(cx,cy,iconSize/2,0,Math.PI*2);
  ctx.fillStyle='#a98bff'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.52)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font=`800 ${featured?15:12}px system-ui, sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★',cx,cy+.5);
  ctx.fillStyle='#f3eaff'; ctx.font=`800 ${featured?19:15}px system-ui, sans-serif`;
  ctx.textAlign='left'; ctx.fillText(label,x+pad+iconSize+7,centerY+.5);
  ctx.restore();
  return width;
}

function drawPBCard(ctx,item,x,y,width,height,featured=false){
  pbRoundRect(ctx,x,y,width,height,22);
  ctx.fillStyle='rgba(15,17,23,.76)'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=2; ctx.stroke();
  const pad=featured?42:26;
  const gym=item.machine?`${item.locationLabel} · Machine`:pbVariantLabel(item);
  ctx.textAlign='left'; ctx.fillStyle='rgba(235,230,255,.72)';
  const badgeWidth=item.rank?drawPBMedal(ctx,item.rank.label,x+width-pad,y+(featured?88:43),featured):0;
  drawPBText(ctx,gym,x+pad,y+(featured?88:43),width-pad*2-badgeWidth-(badgeWidth?12:0),featured?27:21,650);
  ctx.fillStyle='#fff';
  drawPBText(ctx,item.exercise.name,x+pad,y+(featured?158:91),width-pad*2,featured?52:34,800);
  ctx.fillStyle='#c8aaff';
  drawPBText(ctx,pbResultText(item),x+pad,y+(featured?264:153),width-pad*2,featured?78:40,850);
  ctx.fillStyle='rgba(235,230,255,.67)';
  drawPBText(ctx,fmtDate(item.result.date),x+pad,y+height-(featured?44:20),width-pad*2,featured?23:18,550);
}

function updatePBProfileFields(){
  const settings=normalizeUserSettings(DB.userSettings);
  document.getElementById('standardsSex').value=settings.standardsSex;
  document.getElementById('bodyweightKg').value=settings.bodyweightKg??'';
}
function savePBProfileFields(){
  const sex=document.getElementById('standardsSex').value;
  const raw=document.getElementById('bodyweightKg').value.trim();
  const bodyweight=raw===''?null:Number(raw);
  if(sex!==''&&!['male','female'].includes(sex)){ toast('Choose a standards profile'); updatePBProfileFields(); return; }
  if(bodyweight!==null&&(!Number.isFinite(bodyweight)||bodyweight<30||bodyweight>300||Math.round(bodyweight*100)!==bodyweight*100)){
    toast('Body weight must be 30–300 kg'); updatePBProfileFields(); return;
  }
  const currentSettings=normalizeUserSettings(DB.userSettings);
  DB.userSettings={...currentSettings,bodyweightKg:bodyweight,standardsSex:sex,pbPromptDismissed:currentSettings.pbPromptDismissed||(Boolean(sex)&&bodyweight!==null),updatedAt:Date.now()};
  save();
  renderPersonalBests();
}
document.getElementById('standardsSex').addEventListener('change',savePBProfileFields);
document.getElementById('bodyweightKg').addEventListener('change',savePBProfileFields);
document.getElementById('menuBtn').addEventListener('click',updatePBProfileFields);
document.getElementById('profilePill').addEventListener('click',updatePBProfileFields);
document.getElementById('pbOpenSettings').onclick=()=>{
  document.getElementById('menuBtn').click();
  requestAnimationFrame(()=>document.getElementById('strengthProfileSettings').scrollIntoView({behavior:'smooth',block:'center'}));
};
document.getElementById('pbSetupSave').onclick=()=>{
  const sex=document.getElementById('pbSetupSex').value;
  const raw=document.getElementById('pbSetupWeight').value.trim();
  const bodyweight=raw===''?null:Number(raw);
  if(!['male','female'].includes(sex)||bodyweight===null){ toast('Enter your gender and body weight to show badges'); return; }
  if(!Number.isFinite(bodyweight)||bodyweight<30||bodyweight>300||Math.round(bodyweight*100)!==bodyweight*100){ toast('Body weight must be 30–300 kg'); return; }
  DB.userSettings={...normalizeUserSettings(DB.userSettings),bodyweightKg:bodyweight,standardsSex:sex,pbPromptDismissed:true,updatedAt:Date.now()};
  save();
  renderPersonalBests();
};
document.getElementById('pbSetupSkip').onclick=()=>{
  DB.userSettings={...normalizeUserSettings(DB.userSettings),pbPromptDismissed:true,updatedAt:Date.now()};
  save();
  renderPersonalBests();
};
updatePBProfileFields();
loadPBStandards();

function personalBestDisplayName(){
  const name=(CLOUD.user?.displayName||cachedFirebaseUser()?.displayName||ACTIVE_PROFILE||'').trim()
    .replace(/[_-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
  return name?`${name}’s Personal Bests`:'Personal Bests';
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
  ctx.fillStyle='#fff';
  drawPBText(ctx,personalBestDisplayName(),64,163,width-128,56,850);
  if(featured){
    drawPBCard(ctx,items[0],64,220,952,600,true);
  }else{
    items.forEach((item,index)=>{
      const x=64+(index%2)*476,y=220+Math.floor(index/2)*(cardHeight+gap);
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
