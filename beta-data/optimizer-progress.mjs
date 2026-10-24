// Read-only observations from the native search. Result counts are not work counts.
let active = null
function searchStages(mode, sets, mains) {
 const stage = (mask, name, groups) => ({mask,name,groups:groups*mains})
 if(mode?.Set4)return [stage(5,'set4',5)]
 if(mode?.Set22)return [stage(30,'set22',30)]
 if(mode?.Set2)return [stage(5,'set4',5),stage(30,'set22',30*sets),stage(10,'set2',10)]
 return [stage(5,'set4',5*sets),stage(30,'set22',15*sets*(sets+1)),stage(10,'set2',10*sets),stage(1,'any',1)]
}
export function progressImports(memory) {
 return {observe(kind,ptr,mask) {
  if (!active) return
  const s=active
  if(kind===0){
   if(s.stages===null){
    const v=new DataView(memory().buffer),n=v.getUint32(ptr+152,true),m=v.getUint32(ptr+164,true)*v.getUint32(ptr+176,true)*v.getUint32(ptr+188,true)
    s.stages=searchStages(s.setMode,n,m)
    s.totalGroups=s.stages.reduce((sum,stage)=>sum+stage.groups,0)
   }
   if(s.stage?.mask!==mask){
    s.stage=s.stages.find(stage=>stage.mask===mask)
    s.stageOffset=s.entered
    s.samples=[]
   }
  }else if(kind===1||kind===5)s.entered++
  else if(kind===2)s.evaluated++
  s.publish(false)
 }}
}
export function beginOptimizationProgress(input,artifacts,notify){
 const started=performance.now(),s={setMode:input.constraint?.set_mode,totalGroups:null,entered:0,evaluated:0,last:-Infinity,stages:null,stage:null,stageOffset:0,samples:[]}
 const slots=['Flower','Feather','Sand','Goblet','Head'],sizes=slots.map(slot=>artifacts.filter(a=>a.slot===slot).length)
 // This is the candidate Cartesian space, before native set/attribute pruning.
 if(input.algorithm==='Naive'){
  const n=new Set(artifacts.map(a=>a.set_name)).size,m=slots.reduce((v,slot)=>v*Math.max(1,new Set(artifacts.filter(a=>a.slot===slot).map(a=>a.main_stat[0])).size),1),mode=s.setMode
  s.totalGroups=mode?.Set2?null:m*(mode?.Set4?5:mode?.Set22?30:15*n*n+1)
  s.stage={name:'enumeration',groups:s.totalGroups};s.stages=[s.stage]
 }
 const candidateSpace=sizes.reduce((a,b)=>a*Math.max(1,b),1)
 s.publish=(force,done=false)=>{
  const now=performance.now()
  if(!force&&now-s.last<250)return
  s.last=now
  const completedGroups=done?s.totalGroups:Math.max(0,s.entered-1)
  const remainingGroups=done?0:s.totalGroups===null?null:Math.max(0,s.totalGroups-completedGroups)
  const stageCompleted=Math.max(0,s.entered-s.stageOffset-1),stageRemaining=s.stage?.groups==null?null:Math.max(0,s.stage.groups-stageCompleted)
  s.samples.push({at:now,completed:stageCompleted})
  while(s.samples.length>2&&s.samples[1].at<=now-8000)s.samples.shift()
  const sample=s.samples[0],groups=stageCompleted-sample.completed,duration=now-sample.at
  // Do not extrapolate cheap earlier phases into costly later ones. A stalled
  // current group remains unfinished and slows the recent rate, then clears it.
  const etaMs=done?0:stageRemaining!==null&&groups>=3&&duration>=1000?stageRemaining*duration/groups:null
  notify({visitedGroups:s.entered,phase:done?'complete':s.totalGroups===null?'preparing':'searching',candidateSpace,evaluated:s.evaluated,totalGroups:s.totalGroups,completedGroups,remainingGroups,elapsedMs:now-started,searchStage:s.stage?.name||null,stageRemainingGroups:done?0:stageRemaining,etaScope:s.stage&&s.stage===s.stages?.at(-1)?'total':'stage',etaMs,percent:done?100:s.totalGroups?Math.min(99.9,completedGroups/s.totalGroups*100):null})
 }
 active=s;s.publish(true)
 return {complete(){s.publish(true,true)},dispose(){active=null}}
}
// The page clock advances even when a native branch emits no observations.
export function remainingOptimizationTime(progress,ageMs){
 return progress.etaMs==null||ageMs>=progress.etaMs?null:Math.max(0,progress.etaMs-ageMs)
}
