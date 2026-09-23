"use strict";
function starterExerciseKey(ex){
  if(!ex||typeof ex.name!=='string'||(Array.isArray(ex.locations)&&ex.locations.length)) return '';
  if(!SEED.some(seed=>normName(seed.name)===normName(ex.name))) return '';
  return normName(ex.name)+'|'+variantOf(ex);
}
function mergeProfileData(local,remote){
  const deletedSetIds=[...new Set([...(remote.deletedSetIds||[]),...(local.deletedSetIds||[])])];
  const deletedWorkoutIds=[...new Set([...(remote.deletedWorkoutIds||[]),...(local.deletedWorkoutIds||[])])];
  const deletedSets=new Set(deletedSetIds),deletedWorkouts=new Set(deletedWorkoutIds);
  const localGyms=Array.isArray(local.gyms)?local.gyms:[];
  const remoteGyms=Array.isArray(remote.gyms)?remote.gyms:[];
  const gyms=remoteGyms.map(g=>({...g}));
  const gymIds=new Map(gyms.map(g=>[g.id,g]));
  const gymAliases=new Map();
  localGyms.forEach(g=>{
    const same=gymIds.get(g.id)||gyms.find(other=>other.name.toLowerCase()===g.name.toLowerCase());
    if(same){ gymAliases.set(g.id,same.id); Object.assign(same,g,{id:same.id}); }
    else { gyms.push({...g}); gymIds.set(g.id,g); }
  });
  const mapGym=id=>gymAliases.get(id)||id;
  const exercises=(Array.isArray(remote.exercises)?remote.exercises:[]).map(ex=>({...ex}));
  const exerciseIds=new Map(exercises.map(ex=>[ex.id,ex]));
  const exerciseAliases=new Map();
  (Array.isArray(local.exercises)?local.exercises:[]).forEach(ex=>{
    const key=starterExerciseKey(ex);
    const same=exerciseIds.get(ex.id)||(key?exercises.find(other=>starterExerciseKey(other)===key):null);
    const mapped={...ex,locations:Array.isArray(ex.locations)?ex.locations.map(mapGym):ex.locations};
    if(same){ exerciseAliases.set(ex.id,same.id); Object.assign(same,mapped,{id:same.id}); }
    else { exercises.push(mapped); exerciseIds.set(ex.id,mapped); }
  });
  const sets=(Array.isArray(remote.sets)?remote.sets:[]).map(set=>({...set}));
  const setIds=new Map(sets.map((set,index)=>[set.id,index]));
  (Array.isArray(local.sets)?local.sets:[]).forEach(set=>{
    const mapped={...set,exId:exerciseAliases.get(set.exId)||set.exId,locationId:mapGym(set.locationId)};
    const index=setIds.get(set.id);
    if(index!==undefined) sets[index]=mapped;
    else { setIds.set(set.id,sets.length); sets.push(mapped); }
  });
  const workouts=(Array.isArray(remote.workouts)?remote.workouts:[]).map(w=>({...w,setIds:[...(w.setIds||[])]}));
  const workoutIds=new Map(workouts.map((w,index)=>[w.id,index]));
  (Array.isArray(local.workouts)?local.workouts:[]).forEach(w=>{
    const index=workoutIds.get(w.id);
    const previous=index===undefined?null:workouts[index];
    const mapped={...w,locationId:mapGym(w.locationId),setIds:[...new Set([...(previous?.setIds||[]),...(w.setIds||[])])]};
    if(index!==undefined) workouts[index]=mapped;
    else { workoutIds.set(w.id,workouts.length); workouts.push(mapped); }
  });
  const active=local.activeWorkout||remote.activeWorkout;
  const activeWorkout=active&&!workoutIds.has(active.id)&&!deletedWorkouts.has(active.id)?{...active,locationId:mapGym(active.locationId),setIds:(active.setIds||[]).filter(id=>!deletedSets.has(id))}:null;
  return {...remote,...local,initialized:true,schemaVersion:6,gyms,exercises,
    sets:sets.filter(set=>!deletedSets.has(set.id)),
    workouts:workouts.filter(workout=>!deletedWorkouts.has(workout.id)).map(workout=>({...workout,setIds:workout.setIds.filter(id=>!deletedSets.has(id))})),
    deletedSetIds,deletedWorkoutIds,activeWorkout,
    weekPlans:{...(remote.weekPlans||{}),...(local.weekPlans||{})}};
}

function seed(){
  markDeletedRecords(DB.sets.map(set=>set.id),DB.workouts.map(workout=>workout.id).concat(DB.activeWorkout?.id||[]));
  const deletedSetIds=DB.deletedSetIds,deletedWorkoutIds=DB.deletedWorkoutIds;
  DB={schemaVersion:6,initialized:true,exercises:SEED.map(s=>({id:uid('e'),...s,variant:variantOf(s)})),
    sets:[],workouts:[],activeWorkout:null,weekPlans:{},gyms:[],deletedSetIds,deletedWorkoutIds};
  save(); refreshAll();
}
