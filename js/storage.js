"use strict";
/* ================= Storage ================= */
const LEGACY_KEY="ironlog.v2";
const KEY_PREFIX="ironlog.v2.";
const PROFILE_KEY="ironlog.profile";
const SESSION_KEY="ironlog.session";
const SESSION_TTL_MS=1000*60*60*24*30;
function sanitizeProfileId(s){
  return (s||'').toLowerCase().trim()
    .replace(/[^a-z0-9_-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,32);
}
function blankDB(){
  return {schemaVersion:4,initialized:false,exercises:[],sets:[],workouts:[],activeWorkout:null,weekPlans:{}};
}
function profileKeyFor(profile){ return KEY_PREFIX+profile; }
function profileKey(){ return profileKeyFor(ACTIVE_PROFILE); }
function hasStoredProfile(profile){
  return Boolean(localStorage.getItem(profileKeyFor(profile)) || (profile==='lucas' && localStorage.getItem(LEGACY_KEY)));
}
function readSession(){
  try{
    const s=JSON.parse(localStorage.getItem(SESSION_KEY));
    const profile=sanitizeProfileId(s&&s.profile);
    if(!profile||!s.expiresAt||Date.now()>s.expiresAt) throw new Error('Expired session');
    if(!hasStoredProfile(profile)) throw new Error('Missing profile data');
    return {profile,mode:s.mode==='cloud'?'cloud':'local',issuedAt:s.issuedAt||Date.now(),expiresAt:s.expiresAt};
  }catch(e){
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}
const AUTH_SESSION=readSession();
let ACTIVE_PROFILE=sanitizeProfileId((AUTH_SESSION&&AUTH_SESSION.profile)||localStorage.getItem(PROFILE_KEY)||'lucas')||'lucas';
let DB=load();
function load(profile=ACTIVE_PROFILE){
  try{
    const d=JSON.parse(localStorage.getItem(profileKeyFor(profile)));
    if(d&&d.exercises) return d;
  }catch(e){}
  if(profile==='lucas'){
    try{
      const d=JSON.parse(localStorage.getItem(LEGACY_KEY));
      if(d&&d.exercises) return d;
    }catch(e){}
  }
  return blankDB();
}
function save(){
  DB.schemaVersion=4;
  DB.initialized=true;
  localStorage.setItem(profileKey(),JSON.stringify(DB));
  queueCloudSave();
}
function rememberSession(mode='local'){
  localStorage.setItem(PROFILE_KEY,ACTIVE_PROFILE);
  localStorage.setItem(SESSION_KEY,JSON.stringify({
    profile:ACTIVE_PROFILE,
    mode,
    issuedAt:Date.now(),
    expiresAt:Date.now()+SESSION_TTL_MS
  }));
}
function clearSession(){
  localStorage.removeItem(SESSION_KEY);
}
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);

/* ================= Dates / weeks (Monday) ================= */
function dateKey(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
const todayKey=()=>dateKey(new Date());
function mondayOf(dStr){ const d=new Date(dStr+"T00:00:00"); const off=(d.getDay()+6)%7; d.setDate(d.getDate()-off); return dateKey(d); }
const thisWeek=()=>mondayOf(todayKey());
function weekLabel(mk){ const d=new Date(mk+"T00:00:00"); const e=new Date(d); e.setDate(e.getDate()+6);
  const o={month:'short',day:'numeric'}; return d.toLocaleDateString(undefined,o)+" – "+e.toLocaleDateString(undefined,o); }
function fmtDate(k){ return new Date(k+"T00:00:00").toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); }
function relDay(k){ if(k===todayKey())return"Today"; const y=new Date();y.setDate(y.getDate()-1);
  if(k===dateKey(y))return"Yesterday"; return fmtDate(k); }
