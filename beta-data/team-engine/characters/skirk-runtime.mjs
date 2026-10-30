import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {createSkirkHitRuntime} from './skirk-hit-runtime.mjs';

// Integer tenths keep the published 1.4 drain exact. Reachable timer times
// are concrete; gates, balances, windows and native talent values use m.
export function createSkirkRuntime(context){
 const {role,profile,hit,addWindow,enqueue,resources,catalog,math:m=scalarMath,
  complete=(a,time)=>{a.completionTime=time;},recordResource=row=>resources.push(row)}=context;
 const c=profile.character.constellation,a1=teamTalentUnlocked(profile.character,1);
 const and=(a,b)=>m.choose(a,b,0),not=a=>m.choose(a,0,1),possible=x=>typeof x==='object'||!!x;
 const phases=[],bursts=[],pauseTimes=new Set();let units=0,pause=0,nextPause=Infinity,pauseHorizon=-Infinity;
 const live=(w,e)=>{
  if(e.time<w.start||e.time===w.start&&e.rootOrder<w.rootOrder)return 0;
  return and(w.enabled??1,m.choose(m.lt(e.time,w.end),1,and(m.eq(e.time,w.end),m.lt(e.rootOrder,w.endOrder??-Infinity))));
 };
 const covered=(time,rootOrder=Infinity,key='skirkPhase')=>(key==='skirkC2'?bursts:phases.map(p=>p.window)).reduce((n,w)=>m.max(n,live(w,{time,rootOrder})),0);
 const hitRuntime=createSkirkHitRuntime({...context,covered:(key,t,o)=>covered(t,o,key),
  burstWindows:e=>bursts.map((w,i)=>({key:i,active:live(w,e),qRifts:w.qRifts}))});
 const record=(a,label,before,gate)=>{
  if(!possible(gate))return;
  recordResource({time:a.time,role,rootOrder:a.rootOrder,eventId:a.id??a.eventId,resource:'蛇之狡谋',
   before:m.div(before,10),after:m.div(units,10),amount:m.div(m.sub(units,before),10),value:m.div(units,10),pauseStacks:pause,label,enabled:gate});
 };
 const close=(w,a,gate)=>{
  const earlier=m.choose(m.lt(a.time,w.end),1,and(m.eq(a.time,w.end),m.lt(a.rootOrder,w.endOrder??-Infinity))),stop=and(gate,earlier);
  w.end=m.choose(stop,a.time,w.end);w.endOrder=m.choose(stop,a.rootOrder,w.endOrder??-Infinity);
 };
 const closeAll=(a,gate)=>{
  for(const p of phases){close(p.window,a,gate);p.active=m.choose(gate,0,p.active);}
  for(const w of bursts)close(w,a,gate);
 };
 const exit=(a,label,gate)=>{const before=units;units=m.choose(gate,0,units);closeAll(a,gate);record(a,label,before,gate);};
 const timer=(a,time,mechanic,extra={})=>enqueue({kind:'timer',mechanic,role,time:actionTime(time),rootOrder:-1,finalizePlan:true,
  order:mechanic==='skirk.phase.end'?0:mechanic==='skirk.pause'?1:2,eventId:a.id+'/resource/'+actionTime(time),...extra});
 const queuePause=(a,time)=>{time=actionTime(time);if(pauseTimes.has(time))return;pauseTimes.add(time);timer(a,time,'skirk.pause');};
 const absorb=(a,gate)=>{
  const count=a1?(a.params?.absorbedRifts??0):0;if(!count||!possible(gate))return count;
  const before=units;units=m.choose(gate,m.min(1000,m.add(units,80*count)),units);
  const begin=and(gate,m.eq(pause,0)),next=actionTime(a.time+.15);
  // At most six remaining 0.15s ticks: this structural bound also terminates
  // symbolic clocks whose zero condition cannot be folded during compilation.
  pauseHorizon=Math.max(pauseHorizon,actionTime(a.time+.9));
  nextPause=m.choose(begin,next,nextPause);pause=m.choose(gate,m.min(6,m.add(pause,2*count)),pause);
  if(possible(begin))queuePause(a,next);
  if(c>=1)for(let i=0;i<count;i++)hit(a,{index:17,category:'charged',parts:1,element:'Cryo',enabled:gate,label:'一命·晶刃'},0,'c1/'+i,22);
  record(a,'吸收裂隙',before,gate);return count;
 };
 function clocks(e){
  const gate=e.enabled??1;
  if(e.mechanic==='skirk.pause'){
   const due=and(gate,m.eq(nextPause,e.time));pause=m.choose(due,m.max(0,m.sub(pause,1)),pause);
   nextPause=m.choose(due,m.choose(m.gt(pause,0),actionTime(e.time+.15),Infinity),nextPause);
   if(actionTime(e.time+.15)<=pauseHorizon&&possible(and(due,m.gt(pause,0))))queuePause({id:e.eventId},e.time+.15);return true;
  }
  if(!['skirk.phase.end','skirk.drain'].includes(e.mechanic))return false;
  const p=phases[e.phase],due=and(gate,p.active);if(!possible(due))return true;
  const at={...e,id:p.action.id+'/resource/'+e.time};
  if(e.mechanic==='skirk.phase.end'){exit(at,'七相一闪到期',due);return true;}
  const before=units,paused=and(due,m.gt(pause,0)),drain=and(due,not(m.gt(pause,0)));
  units=m.choose(drain,m.max(0,m.sub(units,14)),units);
  record(at,'吸收暂停消耗',before,paused);record(at,'七相自然消耗',before,drain);
  exit(at,'资源耗尽·退出七相',and(drain,m.eq(units,0)));
  if(possible(p.active)&&actionTime(e.time+.2)<p.limit)timer(p.action,e.time+.2,'skirk.drain',{phase:e.phase});return true;
 }
 return {
  covered,prepareHit:hitRuntime.prepareHit,onHit:hitRuntime.onHit,
  onEvent(e){
   if(e.kind==='switch'&&e.from===role&&e.role!==role){exit(e,'离开七相一闪',and(e.enabled??1,covered(e.time,e.rootOrder)));return;}
   if(e.role!==role)return;
   if(clocks(e))return;
   if(!['cast','action'].includes(e.kind)){hitRuntime.onEvent(e);return;}
   const gate=e.enabled??1;if(!possible(gate))return;
   if(e.action==='skill'){
    closeAll(e,gate);const before=units;units=m.choose(gate,m.min(1000,m.add(units,c>=2?550:450)),units);record(e,'施放元素战技',before,gate);
    if(e.actionId==='skill.hold'){
     const count=absorb(e,gate);hitRuntime.onEvent({...e,skirkAbsorbedRifts:count});
    }else{
     const p={action:e,active:gate,limit:actionTime(e.time+12.5),window:addWindow('skirkPhase',e,12.5,0,{enabled:gate})},phase=phases.length;phases.push(p);
     timer(e,e.time+.2,'skirk.drain',{phase});timer(e,p.limit,'skirk.phase.end',{phase});hitRuntime.onEvent(e);
    }
    return;
   }
   const phase=covered(e.time,e.rootOrder),ice=and(gate,phase),ordinary=and(gate,not(phase));
   if(e.action==='burst'){
    const before=units,cunning=m.div(units,10),cunningBonus=m.min(c>=2?22:12,m.max(0,m.sub(cunning,50)));
    complete(e,m.choose(ordinary,actionTime(e.time+158/60),e.time));
    if(possible(ice)){
     const count=absorb(e,ice);for(const w of bursts)close(w,e,ice);
     bursts.push(addWindow('skirkC2',e,12.5,0,{enabled:ice,qRifts:count}));
     hitRuntime.onEvent({...e,enabled:ice,burstMode:'extinction',skirkAbsorbedRifts:count});
    }
    if(possible(ordinary)){
     for(const [i,frame]of [109,111,114,125,135].entries())hit(e,{index:15,category:'burst',parts:1,part:i,element:'Cryo',cunning,cunningBonus,skirkBurst:true,talentRatioFields:['蛇之狡谋加成'],enabled:ordinary,label:'极恶技·灭·斩击'},frame/60,'burst/'+i);
     hit(e,{index:16,category:'burst',parts:1,element:'Cryo',cunning,cunningBonus,skirkBurst:true,talentRatioFields:['蛇之狡谋加成'],enabled:ordinary,label:'极恶技·灭·最终斩击'},158/60,'burst/final');
     hitRuntime.onEvent({...e,enabled:ordinary,burstMode:'ruin'});units=m.choose(ordinary,0,units);record(e,'元素爆发消耗',before,ordinary);
    }
    return;
   }
   hitRuntime.onEvent(e);
   const alternatives=[[true,ice],[false,ordinary]].filter(([,enabled])=>possible(enabled));
   for(const [sevenPhase,enabled]of alternatives){
    const suffix=e.action,variant=alternatives.length>1?{variant:sevenPhase?'seven':'ordinary'}:{};
    if(e.action.startsWith('plunge')){
     const index={plunge:8,'plunge.low':7,'plunge.collision':6}[e.action],element=sevenPhase?'Cryo':'Physical';
     hit(e,{index,parts:1,sevenPhase,...variant,category:'plunge',element,nativeElement:element,enabled,label:(sevenPhase?'七相一闪·':'普通形态·')+catalog.find(a=>a.id===e.action).label},0,suffix);
    }else{
     const charged=e.action==='charged',step=Number(e.action.split('.')[1]),index=charged?(sevenPhase?14:5):(sevenPhase?8+step:step-1),parts=sevenPhase?(charged?3:[1,1,2,2,1][step-1]):charged||step===3?2:1;
     const sever=c>=6&&a1&&sevenPhase&&['normal.3','normal.5'].includes(e.action)?{skirkSeverCommand:e.id}:{};
     hit(e,{index,parts,sevenPhase,...variant,...sever,category:charged?'charged':'normal',element:sevenPhase?'Cryo':'Physical',nativeElement:sevenPhase?null:'Physical',enabled,label:(sevenPhase?'七相一闪·':'普通形态·')+(charged?'重击':e.action)},0,suffix);
    }
   }
   if(e.action==='charged'&&possible(ice)){const count=absorb(e,ice);hitRuntime.onEvent({...e,enabled:ice,skirkAbsorbedRifts:count});}
  },
 };
}
