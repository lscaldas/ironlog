"use strict";
/* ================= Cloud sync ================= */
const CLOUD_TABLE='ironlog_profiles';
const CLOUD_ITERATIONS=150000;
const CLOUD={pin:'',unlocked:false,saving:false,pending:false,timer:null,lastSaved:'',syncError:false};
const enc=new TextEncoder();
const dec=new TextDecoder();
function cloudConfig(){
  const cfg=window.IRONLOG_CLOUD||{};
  const supabaseUrl=(cfg.supabaseUrl||'').replace(/\/+$/,'');
  const supabaseAnonKey=cfg.supabaseAnonKey||'';
  return {supabaseUrl,supabaseAnonKey,enabled:Boolean(supabaseUrl&&supabaseAnonKey)};
}
const cloudReady=()=>cloudConfig().enabled && window.crypto && crypto.subtle;
function bytesToB64(bytes){
  let s='';
  new Uint8Array(bytes).forEach(b=>s+=String.fromCharCode(b));
  return btoa(s);
}
function b64ToBytes(b64){
  const s=atob(b64);
  const out=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i);
  return out;
}
async function deriveCloudKey(pin,saltB64){
  const material=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt:b64ToBytes(saltB64),iterations:CLOUD_ITERATIONS,hash:'SHA-256'},
    material,
    {name:'AES-GCM',length:256},
    false,
    ['encrypt','decrypt']
  );
}
async function encryptProfile(pin,db=DB){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const saltB64=bytesToB64(salt);
  const key=await deriveCloudKey(pin,saltB64);
  const plain={version:2,profileId:ACTIVE_PROFILE,savedAt:new Date().toISOString(),db};
  const cipher=await crypto.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:enc.encode(ACTIVE_PROFILE)},
    key,
    enc.encode(JSON.stringify(plain))
  );
  return {v:1,alg:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:CLOUD_ITERATIONS,salt:saltB64,iv:bytesToB64(iv),cipher:bytesToB64(cipher)};
}
async function decryptProfile(blob,pin){
  const key=await deriveCloudKey(pin,blob.salt);
  const plain=await crypto.subtle.decrypt(
    {name:'AES-GCM',iv:b64ToBytes(blob.iv),additionalData:enc.encode(ACTIVE_PROFILE)},
    key,
    b64ToBytes(blob.cipher)
  );
  const payload=JSON.parse(dec.decode(plain));
  if(!payload.db||!payload.db.exercises) throw new Error('Invalid cloud data');
  return payload.db;
}
async function supabaseRequest(path,opts={}){
  const cfg=cloudConfig();
  const headers=Object.assign({
    apikey:cfg.supabaseAnonKey,
    Authorization:'Bearer '+cfg.supabaseAnonKey,
    'Content-Type':'application/json'
  },opts.headers||{});
  const res=await fetch(cfg.supabaseUrl+'/rest/v1/'+path,Object.assign({},opts,{headers}));
  if(!res.ok){
    const text=await res.text().catch(()=>'');
    throw new Error(text||('Cloud request failed: '+res.status));
  }
  if(res.status===204) return null;
  const text=await res.text();
  return text ? JSON.parse(text) : null;
}
async function loadCloudProfile(opts={}){
  const pin=(opts.pin||document.getElementById('cloudPin').value).trim();
  if(!cloudReady()){ toast("Cloud not configured"); updateCloudUI(); return; }
  if(!pin){ toast("Enter profile PIN"); return; }
  setCloudState("Loading...");
  try{
    const rows=await supabaseRequest(`${CLOUD_TABLE}?profile_id=eq.${encodeURIComponent(ACTIVE_PROFILE)}&select=data,updated_at`);
    if(!rows.length||!rows[0].data||!rows[0].data.cipher){
      CLOUD.pin=pin; CLOUD.unlocked=true;
      await saveCloudProfile(true);
      toast("Cloud profile created");
      if(opts.fromGate){ rememberSession('cloud'); hideProfileGate(); }
      return true;
    }
    DB=await decryptProfile(rows[0].data,pin);
    CLOUD.pin=pin; CLOUD.unlocked=true;
    normalizeDB();
    save();
    refreshAll();
    toast("Cloud loaded");
    if(opts.fromGate){ rememberSession('cloud'); hideProfileGate(); }
    updateCloudUI();
    return true;
  }catch(err){
    CLOUD.unlocked=false;
    toast(err.name==='OperationError'?"Wrong PIN":"Cloud load failed");
  }
  updateCloudUI();
  return false;
}
async function saveCloudProfile(manual=false){
  const pin=(CLOUD.pin||document.getElementById('cloudPin').value||'').trim();
  if(!cloudReady()){ if(manual) toast("Cloud not configured"); updateCloudUI(); return; }
  if(!pin){ if(manual) toast("Enter profile PIN"); return; }
  if(CLOUD.saving){ CLOUD.pending=true; return; }
  CLOUD.saving=true;
  setCloudState("Saving...");
  try{
    const data=await encryptProfile(pin);
    await supabaseRequest(`${CLOUD_TABLE}?on_conflict=profile_id`,{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify([{profile_id:ACTIVE_PROFILE,data}])
    });
    CLOUD.pin=pin; CLOUD.unlocked=true; CLOUD.lastSaved=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    CLOUD.syncError=false;
    if(manual) toast("Cloud saved");
  }catch(err){
    CLOUD.syncError=true;
    if(manual) toast("Cloud save failed");
    else queueCloudSave(30000);
  }finally{
    CLOUD.saving=false;
    updateCloudUI();
    if(CLOUD.pending){ CLOUD.pending=false; queueCloudSave(250); }
  }
}
async function changeCloudPin(){
  const oldPin=document.getElementById('oldCloudPin').value.trim();
  const newPin=document.getElementById('newCloudPin').value.trim();
  const msg=document.getElementById('pinChangeMsg');
  msg.textContent='';
  if(!cloudReady()){ toast("Cloud not configured"); updateCloudUI(); return; }
  if(!oldPin||!newPin){ toast("Enter old and new PIN"); return; }
  if(oldPin===newPin){ toast("New PIN must be different"); return; }
  setCloudState("Changing PIN...");
  msg.textContent="Verifying old PIN...";
  try{
    const rows=await supabaseRequest(`${CLOUD_TABLE}?profile_id=eq.${encodeURIComponent(ACTIVE_PROFILE)}&select=data,updated_at`);
    if(!rows.length||!rows[0].data||!rows[0].data.cipher){
      toast("No cloud profile found");
      msg.textContent="Save this profile to cloud before changing its PIN.";
      updateCloudUI();
      return;
    }
    const cloudDb=await decryptProfile(rows[0].data,oldPin);
    const dbForNewPin=(CLOUD.unlocked&&CLOUD.pin===oldPin)?DB:cloudDb;
    msg.textContent="Saving with new PIN...";
    const data=await encryptProfile(newPin,dbForNewPin);
    await supabaseRequest(`${CLOUD_TABLE}?on_conflict=profile_id`,{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify([{profile_id:ACTIVE_PROFILE,data}])
    });
    CLOUD.pin=newPin; CLOUD.unlocked=true; CLOUD.lastSaved=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(dbForNewPin!==DB){
      DB=dbForNewPin;
      normalizeDB();
      save();
      refreshAll();
    }
    document.getElementById('cloudPin').value=newPin;
    document.getElementById('oldCloudPin').value='';
    document.getElementById('newCloudPin').value='';
    msg.textContent="PIN changed. Future loads need the new PIN.";
    toast("PIN changed");
  }catch(err){
    CLOUD.unlocked=false;
    msg.textContent=err.name==='OperationError'?"Old PIN did not unlock this profile.":"PIN change failed.";
    toast(err.name==='OperationError'?"Wrong old PIN":"PIN change failed");
  }
  updateCloudUI();
}
function queueCloudSave(delay=900){
  if(!CLOUD.unlocked||!cloudReady()) return;
  clearTimeout(CLOUD.timer);
  CLOUD.timer=setTimeout(()=>saveCloudProfile(false),delay);
}
function setCloudState(text){ document.getElementById('cloudState').textContent=text; }
function updateCloudUI(){
  document.getElementById('profileInput').value=ACTIVE_PROFILE;
  document.getElementById('gateProfile').value=ACTIVE_PROFILE;
  document.getElementById('activeProfileName').textContent=ACTIVE_PROFILE;
  if(!cloudConfig().enabled){
    setCloudState("Local only");
    document.getElementById('cloudHelp').textContent="Cloud sync needs Supabase URL/key in cloud-config.js.";
    return;
  }
  document.getElementById('cloudHelp').textContent=CLOUD.unlocked
    ? "Unlocked. Local changes auto-save encrypted to cloud."
    : "Enter this profile's PIN, then load or save cloud.";
  if(CLOUD.unlocked&&CLOUD.syncError){
    setCloudState("Sync failed — retrying");
    document.getElementById('cloudHelp').textContent="Last save didn't reach the cloud. Retrying automatically; changes are safe locally.";
    return;
  }
  setCloudState(CLOUD.unlocked ? `Cloud on${CLOUD.lastSaved?' · '+CLOUD.lastSaved:''}` : "Locked");
}
function syncGateLock(){
  const locked=!document.getElementById('profileGate').classList.contains('hide');
  document.querySelector('.wrap').inert=locked;
  document.querySelector('nav').inert=locked;
  document.querySelector('.wrap').setAttribute('aria-hidden',locked?'true':'false');
  document.querySelector('nav').setAttribute('aria-hidden',locked?'true':'false');
}
function showProfileGate(message=''){
  const gate=document.getElementById('profileGate');
  gate.classList.remove('hide');
  document.getElementById('gateMsg').textContent=message;
  syncGateLock();
  requestAnimationFrame(()=>document.getElementById('gateProfile').focus());
}
function hideProfileGate(){
  document.getElementById('profileGate').classList.add('hide');
  document.getElementById('gateMsg').textContent='';
  syncGateLock();
}
function logout(){
  clearSession();
  CLOUD.pin=''; CLOUD.unlocked=false; CLOUD.lastSaved='';
  document.getElementById('cloudPin').value='';
  closeSheets();
  updateCloudUI();
  showProfileGate("Logged out.");
}
function switchProfile(profile,opts={}){
  const next=sanitizeProfileId(profile);
  if(!next){ toast("Enter profile name"); return false; }
  const existed=hasStoredProfile(next);
  if(next===ACTIVE_PROFILE && (!opts.createDefault || existed)) return true;
  ACTIVE_PROFILE=next;
  localStorage.setItem(PROFILE_KEY,ACTIVE_PROFILE);
  CLOUD.pin=''; CLOUD.unlocked=false; CLOUD.lastSaved='';
  document.getElementById('cloudPin').value='';
  DB=load();
  normalizeDB();
  if(opts.createDefault && !existed && !DB.exercises.length) seed(false); else refreshAll();
  updateCloudUI();
  if(opts.toast!==false) toast("Profile switched");
  return true;
}
async function openProfileFromGate(useCloud=true){
  const profile=document.getElementById('gateProfile').value;
  const pin=document.getElementById('gatePin').value;
  if(!switchProfile(profile,{createDefault:!useCloud,toast:false})) return;
  document.getElementById('cloudPin').value=pin;
  if(!useCloud){
    rememberSession('local');
    hideProfileGate();
    toast("Local profile opened");
    return;
  }
  if(!pin.trim()){ toast("Enter profile PIN"); return; }
  document.getElementById('gateMsg').textContent="Opening profile...";
  const ok=await loadCloudProfile({pin,fromGate:true});
  document.getElementById('gateMsg').textContent=ok?"":"Could not open cloud profile. Check the PIN or cloud setup.";
}
document.getElementById('cloudLoadBtn').onclick=()=>{ if(switchProfile(document.getElementById('profileInput').value)) loadCloudProfile(); };
document.getElementById('cloudSaveBtn').onclick=()=>{ if(switchProfile(document.getElementById('profileInput').value)) saveCloudProfile(true); };
document.getElementById('changePinBtn').onclick=()=>{ if(switchProfile(document.getElementById('profileInput').value)) changeCloudPin(); };
document.getElementById('gateOpenBtn').onclick=()=>openProfileFromGate(true);
document.getElementById('gateLocalBtn').onclick=()=>openProfileFromGate(false);
['gateProfile','gatePin'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{ if(e.key==='Enter') openProfileFromGate(true); }));
document.getElementById('profileGate').addEventListener('keydown',e=>{
  if(document.getElementById('profileGate').classList.contains('hide')) return;
  const controls=[...document.querySelectorAll('#profileGate input,#profileGate button')].filter(el=>!el.disabled);
  if(!controls.length) return;
  if(e.key==='Escape'){
    e.preventDefault();
    controls[0].focus();
    return;
  }
  if(e.key!=='Tab') return;
  const first=controls[0], last=controls[controls.length-1];
  if(e.shiftKey && document.activeElement===first){
    e.preventDefault();
    last.focus();
  }else if(!e.shiftKey && document.activeElement===last){
    e.preventDefault();
    first.focus();
  }
});

function seed(withHistory){
  DB={schemaVersion:3,initialized:true,exercises:SEED.map(s=>({id:uid('e'),...s})), sets:[],workouts:[],activeWorkout:null};
  if(withHistory){
    // 7 weeks of progressing data
    const baseKg={"Cable Rows":30,"Overhead Press":30,"Single-arm Face Pulls":15,"Cable Squats":40,"Single Cable Leg Curl":30,"Cable Single-leg Calf Raise":35,"Ring Dips":0,"Triceps Pulldown":22.5,"Triceps Overhead Ext.":20,"Cable Lateral Raise - Lower Path":10,"Cable Lateral Raise - Upper Path":7.5,"Bayesian Single-arm Curl":12.5,"Single-arm Cable Shrugs":25,Pullups:0,Pushups:0};
    for(let wk=6; wk>=0; wk--){
      const mon=new Date(thisWeek()+"T00:00:00"); mon.setDate(mon.getDate()-wk*7);
      DB.exercises.forEach(e=>{
        const sets = wk===0 ? Math.floor(Math.random()*e.target) : e.target; // current week partial
        let kg=(baseKg[e.name]||10)+(6-wk)*e.inc*0.7;
        kg=Math.round(kg/e.inc)*e.inc;
        for(let i=0;i<sets;i++){
          const day=new Date(mon); day.setDate(day.getDate()+Math.floor(i*1.6)%6);
          const reps=e.name==='Pushups'?18+Math.floor(Math.random()*10): (e.name==='Pullups'||e.name==='Ring Dips')?e.low+Math.floor(Math.random()*4): e.low+Math.floor(Math.random()*(e.high-e.low+1));
          DB.sets.push({id:uid('s'),exId:e.id,date:dateKey(day),ts:day.getTime()+i*1000+Math.random()*999,reps,kg:(e.name==='Pullups'||e.name==='Pushups'||e.name==='Ring Dips')?0:kg});
        }
      });
    }
  }
  save(); refreshAll();
}
