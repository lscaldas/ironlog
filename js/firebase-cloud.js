"use strict";
/* Google sign-in and per-user Firebase sync. Workout data is saved locally first. */
const FIREBASE_SDK_VERSION='12.19.0';
const FIREBASE_IMPORT_PROFILE='ironlog.firebase.importProfile';
const FIREBASE_LAST_USER='ironlog.firebase.lastUser';
const FIREBASE_CHUNK_LENGTH=180000;
const FIREBASE_MAX_BYTES=4*1024*1024;
const CLOUD={sdk:null,auth:null,firestore:null,user:null,unlocked:false,saving:false,pending:false,
  timer:null,lastSaved:'',syncError:false,initPromise:null,offlineCache:false,preferLocal:AUTH_SESSION?.mode==='local'};

function firebaseConfig(){ return window.IRONLOG_FIREBASE||{}; }
function cloudReady(){
  const c=firebaseConfig();
  return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId);
}
function firebaseProfileId(user){ return 'firebase_'+user.uid; }
function cachedFirebaseUser(){
  try{
    const user=JSON.parse(localStorage.getItem(FIREBASE_LAST_USER));
    return user&&typeof user.uid==='string'&&user.uid&&hasStoredProfile(firebaseProfileId(user))?user:null;
  }catch(_){ return null; }
}
function firebaseChunkId(index){ return 'chunk-'+String(index).padStart(4,'0'); }
function parseFirebaseProfile(raw){
  if(raw==null) return blankDB();
  if(typeof raw!=='string') throw new Error('Invalid cloud profile');
  const result=validateImportedDB(JSON.parse(raw));
  if(!result.ok) throw new Error('Invalid cloud profile');
  return result.db;
}
function splitFirebaseProfile(db){
  const json=JSON.stringify(db);
  if(new TextEncoder().encode(json).length>FIREBASE_MAX_BYTES) throw new Error('Profile is too large to sync');
  const parts=[];
  for(let i=0;i<json.length;i+=FIREBASE_CHUNK_LENGTH) parts.push(json.slice(i,i+FIREBASE_CHUNK_LENGTH));
  return parts;
}
async function firebaseSdk(){
  if(window.IRONLOG_FIREBASE_SDK) return window.IRONLOG_FIREBASE_SDK;
  const base=`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;
  const [app,auth,firestore]=await Promise.all([
    import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')
  ]);
  return {...app,...auth,...firestore};
}
function initFirebaseSync(){
  if(CLOUD.initPromise) return CLOUD.initPromise;
  if(!cloudReady()){ updateCloudUI(); return Promise.resolve(false); }
  CLOUD.initPromise=(async()=>{
    const api=await firebaseSdk();
    const app=api.initializeApp(firebaseConfig());
    CLOUD.sdk=api;
    CLOUD.auth=api.getAuth(app);
    CLOUD.firestore=api.getFirestore(app);
    api.onAuthStateChanged(CLOUD.auth,user=>{
      if(user){
        if(CLOUD.preferLocal){ api.signOut(CLOUD.auth).catch(()=>{}); return; }
        openFirebaseProfile(user).catch(()=>{
          CLOUD.syncError=true;
          updateCloudUI();
          toast('Could not open Google profile. Local data is still on this device.');
        });
      }else if(CLOUD.user&&!CLOUD.offlineCache){
        leaveFirebaseProfile();
      }
    });
    api.getRedirectResult(CLOUD.auth).catch(()=>{
      sessionStorage.removeItem(FIREBASE_IMPORT_PROFILE);
      document.getElementById('gateMsg').textContent='Google sign-in did not complete. Please try again.';
    });
    return true;
  })().catch(()=>{
    CLOUD.initPromise=null;
    CLOUD.syncError=true;
    updateCloudUI();
    return false;
  });
  return CLOUD.initPromise;
}
async function signInWithGoogle(){
  CLOUD.preferLocal=false;
  document.getElementById('gateMsg').textContent='Connecting to Google...';
  if(!document.getElementById('profileGate').classList.contains('hide')){
    const selected=document.getElementById('gateProfile').value.trim();
    if(selected&&!switchProfile(selected,{toast:false})) return false;
  }
  if(!await initFirebaseSync()){
    document.getElementById('gateMsg').textContent='Firebase is unavailable. You can continue locally.';
    return false;
  }
  const source=ACTIVE_PROFILE.startsWith('firebase_')?'':ACTIVE_PROFILE;
  if(source&&hasStoredProfile(source)) sessionStorage.setItem(FIREBASE_IMPORT_PROFILE,source);
  else sessionStorage.removeItem(FIREBASE_IMPORT_PROFILE);
  try{
    if(CLOUD.auth.currentUser){ await openFirebaseProfile(CLOUD.auth.currentUser); return true; }
    const provider=new CLOUD.sdk.GoogleAuthProvider();
    if(window.matchMedia('(max-width: 700px)').matches){
      await CLOUD.sdk.signInWithRedirect(CLOUD.auth,provider);
    }else{
      await CLOUD.sdk.signInWithPopup(CLOUD.auth,provider);
    }
    return true;
  }catch(err){
    sessionStorage.removeItem(FIREBASE_IMPORT_PROFILE);
    document.getElementById('gateMsg').textContent=err.code==='auth/popup-closed-by-user'
      ? 'Google sign-in was cancelled.' : 'Google sign-in failed. Please try again.';
    updateCloudUI();
    return false;
  }
}
async function openFirebaseProfile(user){
  if(CLOUD.user?.uid===user.uid && CLOUD.unlocked && !CLOUD.offlineCache) return;
  const source=sessionStorage.getItem(FIREBASE_IMPORT_PROFILE);
  sessionStorage.removeItem(FIREBASE_IMPORT_PROFILE);
  const importDb=source&&hasStoredProfile(source)?load(source):null;
  const profile=firebaseProfileId(user);
  CLOUD.user=user;
  CLOUD.offlineCache=false;
  CLOUD.unlocked=false;
  CLOUD.syncError=false;
  ACTIVE_PROFILE=profile;
  DB=load(profile);
  if(importDb){
    try{ saveRecoveryCopy(source); saveRecoveryCopy(profile); }catch(_){ /* Existing local copy remains intact. */ }
    DB=mergeProfileData(DB,importDb);
  }
  normalizeDB();
  localStorage.setItem(profileKey(),JSON.stringify(DB));
  localStorage.setItem(FIREBASE_LAST_USER,JSON.stringify({uid:user.uid,email:user.email||'',displayName:user.displayName||''}));
  clearSession();
  CLOUD.unlocked=true;
  refreshAll();
  updateCloudUI();
  hideProfileGate();
  if(importDb) toast('Local workouts added to your Google account');
  await saveCloudProfile(false);
}
async function saveCloudProfile(manual=false){
  if(!CLOUD.user||!CLOUD.unlocked||!CLOUD.sdk||CLOUD.offlineCache) return false;
  if(CLOUD.saving){ CLOUD.pending=true; return false; }
  if(!navigator.onLine){
    CLOUD.syncError=true;
    updateCloudUI();
    if(manual) toast('Offline. Your changes are saved on this device.');
    return false;
  }
  clearTimeout(CLOUD.timer); CLOUD.timer=null;
  CLOUD.saving=true;
  updateCloudUI();
  const userId=CLOUD.user.uid;
  const localSnapshot=JSON.parse(JSON.stringify(DB));
  let failed=false;
  try{
    const api=CLOUD.sdk;
    const headRef=api.doc(CLOUD.firestore,'users',userId,'ironlog','head');
    const chunkRef=i=>api.doc(CLOUD.firestore,'users',userId,'ironlog',firebaseChunkId(i));
    const result=await api.runTransaction(CLOUD.firestore,async transaction=>{
      const head=await transaction.get(headRef);
      const oldCount=head.exists()?head.data().count:0;
      if(!Number.isInteger(oldCount)||oldCount<0||oldCount>100) throw new Error('Invalid cloud index');
      const chunks=await Promise.all(Array.from({length:oldCount},(_,i)=>transaction.get(chunkRef(i))));
      if(chunks.some(chunk=>!chunk.exists()||typeof chunk.data().body!=='string')) throw new Error('Incomplete cloud profile');
      const remote=oldCount?parseFirebaseProfile(chunks.map(chunk=>chunk.data().body).join('')):blankDB();
      const merged=mergeProfileData(localSnapshot,remote);
      const parts=splitFirebaseProfile(merged);
      if(parts.length>100) throw new Error('Profile is too large to sync');
      parts.forEach((part,i)=>transaction.set(chunkRef(i),{body:part}));
      for(let i=parts.length;i<oldCount;i++) transaction.delete(chunkRef(i));
      transaction.set(headRef,{count:parts.length,version:1,updatedAt:api.serverTimestamp()});
      return merged;
    });
    if(CLOUD.user?.uid!==userId) return false;
    DB=mergeProfileData(DB,result);
    normalizeDB();
    localStorage.setItem(profileKey(),JSON.stringify(DB));
    refreshAll();
    CLOUD.syncError=false;
    CLOUD.lastSaved=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(manual) toast('Google account synced');
    return true;
  }catch(err){
    if(CLOUD.user?.uid!==userId) return false;
    failed=true;
    CLOUD.syncError=true;
    if(manual) toast('Sync failed. Your workouts remain saved on this device.');
    return false;
  }finally{
    CLOUD.saving=false;
    updateCloudUI();
    if(CLOUD.pending||failed){ CLOUD.pending=false; queueCloudSave(failed?30000:250); }
  }
}
function queueCloudSave(delay=900){
  if(!CLOUD.user||!CLOUD.unlocked||CLOUD.offlineCache) return;
  if(CLOUD.saving){ CLOUD.pending=true; return; }
  clearTimeout(CLOUD.timer);
  CLOUD.timer=setTimeout(()=>{ CLOUD.timer=null; saveCloudProfile(false); },delay);
  updateCloudUI();
}
function profileSyncStatus(){
  if(!CLOUD.user) return {mode:'local',label:'Local'};
  if(CLOUD.offlineCache) return {mode:'offline',label:'Offline cache'};
  if(!navigator.onLine) return {mode:'offline',label:'Offline'};
  if(CLOUD.syncError) return {mode:'error',label:'Sync issue'};
  if(!CLOUD.unlocked||CLOUD.saving||CLOUD.pending||CLOUD.timer) return {mode:'syncing',label:'Syncing'};
  return {mode:'live',label:'Live'};
}
function updateCloudUI(){
  const signedIn=Boolean(CLOUD.user);
  const cached=cachedFirebaseUser();
  const label=signedIn?(CLOUD.user.displayName||CLOUD.user.email||'Google account'):ACTIVE_PROFILE;
  document.getElementById('activeProfileName').textContent=label;
  document.getElementById('profileInput').value=signedIn?'':ACTIVE_PROFILE;
  document.getElementById('localProfileField').hidden=signedIn;
  document.getElementById('cloudIdentity').textContent=signedIn?(CLOUD.user.email||label):'No Google account connected';
  document.getElementById('cloudSignInBtn').hidden=signedIn&&!CLOUD.offlineCache;
  document.getElementById('cloudSyncBtn').hidden=!signedIn||CLOUD.offlineCache;
  document.getElementById('cloudSignOutBtn').hidden=!signedIn;
  const offlineBtn=document.getElementById('gateOfflineBtn');
  offlineBtn.hidden=!cached||(navigator.onLine&&!CLOUD.syncError);
  if(cached) offlineBtn.textContent='Open cached workouts as '+(cached.email||cached.displayName||'Google account');
  document.getElementById('wipeBtn').hidden=signedIn;
  const status=profileSyncStatus();
  const pill=document.getElementById('profilePill');
  pill.dataset.mode=status.mode;
  pill.setAttribute('aria-label',`${label} · ${status.label}`);
  document.getElementById('profileSyncMode').textContent=status.label;
  document.getElementById('cloudState').textContent=status.label+(CLOUD.lastSaved?' · '+CLOUD.lastSaved:'');
  document.getElementById('cloudHelp').textContent=!cloudReady()
    ? 'Firebase is not configured. Your workouts are saved locally.'
    : !signedIn ? 'Sign in with Google to merge this local profile and sync between devices.'
    : CLOUD.offlineCache ? 'Cached workouts are available here. Sign in with Google to resume syncing.'
    : status.mode==='offline'||status.mode==='error'
      ? 'Changes remain on this device and will sync when the connection returns.'
      : 'Your workouts are saved locally and synced to your Google account.';
}
function syncGateLock(){
  const locked=!document.getElementById('profileGate').classList.contains('hide');
  document.querySelector('.wrap').inert=locked;
  document.querySelector('nav').inert=locked;
  document.querySelector('.wrap').setAttribute('aria-hidden',locked?'true':'false');
  document.querySelector('nav').setAttribute('aria-hidden',locked?'true':'false');
}
function showProfileGate(message=''){
  document.getElementById('profileGate').classList.remove('hide');
  document.getElementById('gateMsg').textContent=message;
  syncGateLock();
  requestAnimationFrame(()=>document.getElementById('gateGoogleBtn').focus());
}
function hideProfileGate(){
  document.getElementById('profileGate').classList.add('hide');
  document.getElementById('gateMsg').textContent='';
  syncGateLock();
  requestAnimationFrame(showRecoveryIfNeeded);
}
function openOfflineFirebaseProfile(){
  const user=cachedFirebaseUser();
  if(!user) return;
  CLOUD.preferLocal=false;
  CLOUD.user=user;
  CLOUD.offlineCache=true;
  CLOUD.unlocked=true;
  ACTIVE_PROFILE=firebaseProfileId(user);
  DB=load();
  normalizeDB();
  refreshAll();
  updateCloudUI();
  hideProfileGate();
}
function leaveFirebaseProfile(){
  clearTimeout(CLOUD.timer); CLOUD.timer=null; CLOUD.pending=false;
  CLOUD.user=null; CLOUD.unlocked=false; CLOUD.offlineCache=false; CLOUD.syncError=false; CLOUD.lastSaved='';
  ACTIVE_PROFILE=sanitizeProfileId(localStorage.getItem(PROFILE_KEY))||'lucas';
  DB=load();
  normalizeDB(); refreshAll(); updateCloudUI();
  showProfileGate('Signed out of Google.');
}
async function logout(){
  saveWorkoutOnLeave();
  if(CLOUD.user){
    if(CLOUD.offlineCache){
      CLOUD.preferLocal=true;
      if(CLOUD.auth?.currentUser&&CLOUD.sdk) await CLOUD.sdk.signOut(CLOUD.auth);
      localStorage.removeItem(FIREBASE_LAST_USER);
      clearSession();
      closeSheets();
      leaveFirebaseProfile();
      return;
    }
    if(navigator.onLine) await saveCloudProfile(false);
    localStorage.removeItem(FIREBASE_LAST_USER);
    clearSession();
    await CLOUD.sdk.signOut(CLOUD.auth);
    closeSheets();
    return;
  }
  clearSession();
  closeSheets();
  showProfileGate('Logged out.');
}
function switchProfile(profile,opts={}){
  if(CLOUD.user){ toast('Sign out of Google before switching local profiles.'); return false; }
  const next=sanitizeProfileId(profile);
  if(!next){ toast('Enter a local profile name'); return false; }
  const existed=hasStoredProfile(next);
  if(next===ACTIVE_PROFILE&&(!opts.createDefault||existed)) return true;
  saveWorkoutOnLeave();
  ACTIVE_PROFILE=next;
  localStorage.setItem(PROFILE_KEY,next);
  DB=load();
  normalizeDB();
  if(opts.createDefault&&!existed&&!DB.exercises.length) seed(false); else refreshAll();
  updateCloudUI();
  if(opts.toast!==false) toast('Local profile switched');
  return true;
}
async function openLocalProfile(){
  CLOUD.preferLocal=true;
  if(CLOUD.auth?.currentUser) await CLOUD.sdk.signOut(CLOUD.auth);
  if(!switchProfile(document.getElementById('gateProfile').value,{createDefault:true,toast:false})) return;
  rememberSession('local');
  hideProfileGate();
  toast('Local profile opened');
}
window.addEventListener('online',()=>{ updateCloudUI(); queueCloudSave(250); });
window.addEventListener('offline',updateCloudUI);
window.addEventListener('focus',()=>{ if(CLOUD.user) queueCloudSave(250); });
document.getElementById('gateGoogleBtn').onclick=signInWithGoogle;
document.getElementById('gateOfflineBtn').onclick=openOfflineFirebaseProfile;
document.getElementById('gateLocalBtn').onclick=openLocalProfile;
document.getElementById('cloudSignInBtn').onclick=signInWithGoogle;
document.getElementById('cloudSyncBtn').onclick=()=>saveCloudProfile(true);
document.getElementById('cloudSignOutBtn').onclick=logout;
document.getElementById('logoutBtn').onclick=logout;
document.getElementById('gateProfile').addEventListener('keydown',e=>{ if(e.key==='Enter') openLocalProfile(); });
document.getElementById('profileGate').addEventListener('keydown',e=>{
  if(document.getElementById('profileGate').classList.contains('hide')||e.key!=='Tab') return;
  const controls=[...document.querySelectorAll('#profileGate input,#profileGate button')].filter(el=>!el.disabled);
  if(e.shiftKey&&document.activeElement===controls[0]){ e.preventDefault(); controls.at(-1).focus(); }
  else if(!e.shiftKey&&document.activeElement===controls.at(-1)){ e.preventDefault(); controls[0].focus(); }
});
