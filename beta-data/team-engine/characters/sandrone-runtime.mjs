import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {eventKey,afterEvent,compareEventPosition} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

// Retains the provisional clock previously accepted for the source project.
export const SANDRONE_TIMING=Object.freeze({windup:.5,sweep:1/3,firstRay:1.5,ray:1,heatTick:.2,heatPerTick:4,heatPerRay:12,passiveCooling:5,skillInitialCooling:40,skillCoolingTick:.1,skillCooling:10,overloadSweep:.5,c6Delay:.2,skillHits:[.2,.4],burstBombs:[2,2.1,2.2],burstRay:2.6});
export function createSandroneRuntime({role,profile,roots,math:m=scalarMath,reactions,enqueue,activeRole,observeHit=e=>e.enabled??1,resources,recordResource=row=>resources.push(row),complete=(a,time)=>{a.completionTime=time;}}){
 const c=profile.character,T=SANDRONE_TIMING,scale=c.constellation>=1?.5:1,a1=teamTalentUnlocked(c,1),and=(a,b)=>m.choose(a,b,0),not=a=>m.choose(a,0,1),possible=v=>typeof v==='object'||!!v;
 const s={heat:0,overloaded:0,decoding:0,holding:0,hoverUntil:-Infinity,cooled:0,rays:0,token:0,c4Ready:-Infinity,onField:activeRole(0)===role},history=[];let tactics=Array(10).fill(-Infinity),clock=0,serial=0,held;
 const count=time=>tactics.reduce((n,end)=>m.add(n,m.lt(time,end)),0);
 function remember(e,before=false){history.push({at:before?{...e}:afterEvent(e),decoding:s.decoding,heat:s.heat,tactics:count(e.time),overloaded:s.overloaded});}
 function power(e,value,gate=1,cooling){
  const previous=s.heat;s.heat=m.choose(gate,m.max(0,m.min(100,value)),s.heat);
  if(a1){
   const lost=m.max(0,m.sub(previous,s.heat)),before=s.cooled,total=m.add(before,lost),gained=m.min(10,m.floor(m.div(m.add(total,1e-9),10)));
   s.cooled=m.max(0,m.sub(total,m.mul(gained,10)));
   for(let i=0;i<10;i++){
    const won=m.gt(gained,i);if(!possible(won))continue;
    const time=cooling?m.add(cooling.start,m.div(m.max(0,m.sub((i+1)*10,before)),cooling.rate)):e.time;
    tactics=tactics.map((old,j)=>m.choose(won,j===9?m.add(time,60):tactics[j+1],old));
   }
  }
  s.overloaded=m.choose(m.ge(s.heat,100),1,m.choose(m.lt(s.heat,50),0,s.overloaded));
  if(!cooling){const changed=m.gt(m.abs(m.sub(s.heat,previous)),0);if(possible(changed))recordResource({...e,kind:'resource',resource:'sandrone.power',label:'桑多涅·功率',before:previous,after:s.heat,value:s.heat,tactics:count(e.time),enabled:changed});}
 }
 function timer(cause,delay,mechanic,values={},phase=10){
  const time=actionTime(cause.time+delay),action=cause.actionRoot??cause;
  enqueue({kind:'timer',role,time,rootOrder:action.rootOrder+phase,eventId:action.id+'/'+mechanic+'/'+time+'/'+(values.n??0),mechanic,actionRoot:action,...values});
 }
 function hit(cause,delay,values,key){
  if(!possible(values.enabled??1))return;
  if(values.damageModel==='reaction.stellarConduct'&&!values.stellarVariant){const swirl=reactions.view().swirlRadiance??0;hit(cause,delay,{...values,stellarVariant:true,enabled:and(values.enabled??1,not(swirl))},key);hit(cause,delay,{...values,stellarVariant:true,index:{5:18,11:19,14:20,15:21,17:22}[values.index],damageModel:'direct.stellarSwirl',enabled:and(values.enabled??1,swirl),label:values.label.replace('星超导','星扩散')},key+'/swirl');return;}
  const action=cause.actionRoot??cause,time=actionTime(cause.time+delay);
  enqueue({kind:'hit',role,time,rootOrder:action.rootOrder+20,order:cause.order,step:delay?0:(cause.step??0)+1,part:0,parts:1,element:'Cryo',application:null,completionRoot:action.id??cause.completionRoot,...values,eventId:eventKey(cause)+'/'+key,parentEventId:eventKey(cause)});
  if(held?.action.id===action.id)held.end=m.max(held.end,m.choose(values.enabled??1,time,action.time));
 }
 function stop(gate){
  if(held)complete(held.action,held.end);
  s.decoding=m.choose(gate,0,s.decoding);s.holding=m.choose(gate,0,s.holding);s.hoverUntil=m.choose(gate,-Infinity,s.hoverUntil);s.token=m.choose(gate,++serial,s.token);
 }
 const live=e=>and(e.enabled??1,and(s.holding,m.eq(e.token,s.token)));
 function overheat(e,enabled){
  const ends=and(enabled,s.overloaded);s.decoding=m.choose(ends,0,s.decoding);
  if(e.terminal){s.holding=m.choose(ends,0,s.holding);if(possible(ends)&&held)complete(held.action,m.choose(ends,held.end,held.upper));}
  else if(possible(ends))timer(e,T.overloadSweep,'sandrone.overload',{token:e.token,terminal:false,enabled:ends});
 }
 function begin(e,delay,gate){if(possible(gate))timer(e,delay,'sandrone.begin',{token:e.token,terminal:e.terminal,enabled:gate});}
 return {
  stateAt(e){return history.findLast(h=>compareEventPosition(h.at,e)<=0)??{decoding:0,heat:0,tactics:0,overloaded:0};},
  beforeEvent(e){
   if(e.time<=clock)return;
   const start=m.max(clock,s.hoverUntil),rate=T.passiveCooling*(s.onField?1:3),cooling=and(not(s.decoding),m.gt(e.time,start));
   power(e,m.sub(s.heat,m.mul(m.max(0,m.sub(e.time,start)),rate)),cooling,{start,rate});clock=e.time;remember(e,true);
  },
  onEvent(e){
   const gate=e.enabled??1;
   if(e.kind==='switch'){if(e.from===role&&e.role!==role)stop(gate);s.onField=e.role===role;remember(e);return;}
   if(e.role!==role||!possible(gate))return;
   if(e.kind==='cast'||e.kind==='action'){
    stop(gate);
    if(e.action==='charged'){
     const next=roots.find(r=>compareEventPosition(r,e)>0&&(r.role===role&&r.kind!=='switch'||r.kind==='switch'&&r.from===role&&r.role!==role));
     const terminal=!next,token=++serial;s.token=m.choose(gate,token,s.token);s.holding=m.choose(gate,1,s.holding);s.rays=m.choose(gate,0,s.rays);held={action:e,end:e.time,upper:actionTime(e.time+8)};
     const over=and(gate,s.overloaded),normal=and(gate,not(s.overloaded)),cause={...e,token,terminal};
     if(terminal){hit(e,0,{index:6,category:'charged',application:application(1,'sandrone.sweep',2,1.4),enabled:over,label:'功率过载·扫射'},'overload');s.holding=m.choose(over,0,s.holding);if(possible(over))complete(e,m.choose(over,e.time,held.upper));}
     else if(possible(over))timer(cause,T.overloadSweep,'sandrone.overload',{token,terminal,enabled:over});
     begin(cause,T.windup,normal);
    }else if(e.action==='skill'){
     const stellar=m.max(reactions.view().radiance,reactions.view().swirlRadiance??0),overcharge=a1?and(stellar,m.gt(s.heat,50)):0;
     power(e,m.sub(s.heat,T.skillInitialCooling),gate);s.hoverUntil=m.choose(gate,actionTime(e.time+6),s.hoverUntil);
     timer(e,T.skillCoolingTick,'sandrone.cool',{token:s.token,enabled:gate,n:1});
     hit(e,T.skillHits[0],{index:10,category:'skill',application:application(1,'sandrone.skill',3,2.5),enabled:gate,label:'游衍解析·第一枚棱晶弹'},'skill/0');
     hit(e,T.skillHits[1],{index:10,category:'skill',application:application(1,'sandrone.skill',3,2.5),enabled:and(gate,not(stellar)),label:'游衍解析·第二枚棱晶弹'},'skill/ordinary');
     hit(e,T.skillHits[1],{index:11,category:'skill',damageModel:'reaction.stellarConduct',enabled:and(gate,stellar),sandroneOvercharge:m.choose(overcharge,true,false),label:'游衍解析·星超导'},'skill/star');complete(e,actionTime(e.time+T.skillHits[1]));
    }else if(e.action==='burst'){
     const stellar=m.max(reactions.view().radiance,reactions.view().swirlRadiance??0),stacks=a1?m.choose(stellar,count(e.time),0):0;tactics=tactics.map(end=>m.choose(and(gate,stellar),-Infinity,end));
     for(const [part,delay]of T.burstBombs.entries())hit(e,delay,{index:12,category:'burst',parts:3,part,application:application(1,'sandrone.burst',4,3),enabled:gate,label:'万理证毕·轰炸第'+(part+1)+'段'},'burst/'+part);
     hit(e,T.burstRay,{index:13,category:'burst',application:application(),enabled:and(gate,not(stellar)),label:'负温聚能光束'},'burst/ordinary');
     hit(e,T.burstRay,{index:14,category:'burst',damageModel:'reaction.stellarConduct',enabled:and(gate,stellar),sandroneTactics:stacks,label:'负温聚能光束·星超导'},'burst/star');complete(e,actionTime(e.time+T.burstRay));
    }
    remember(e);return;
   }
   if(e.mechanic==='sandrone.cool'){
    const enabled=and(gate,m.eq(s.token,e.token));power(e,m.sub(s.heat,T.skillCooling),enabled);if(e.n<60&&possible(enabled))timer(e.actionRoot,(e.n+1)*T.skillCoolingTick,'sandrone.cool',{token:e.token,enabled,n:e.n+1});
   }else if(e.mechanic==='sandrone.begin'){
    const enabled=live(e);s.decoding=m.choose(enabled,1,s.decoding);s.rays=m.choose(enabled,0,s.rays);
    if(possible(enabled)){const values={token:e.token,terminal:e.terminal,enabled};timer(e,T.heatTick,'sandrone.heat',values);timer(e,0,'sandrone.sweep',{...values,origin:e.time,n:0},14);timer(e,T.firstRay-T.windup,'sandrone.ray',{...values,n:0},12);}
   }else if(e.mechanic==='sandrone.heat'){
    const enabled=and(live(e),s.decoding);power(e,m.add(s.heat,T.heatPerTick*scale),enabled);overheat(e,enabled);const next=and(enabled,s.decoding);if(possible(next))timer(e,T.heatTick,'sandrone.heat',{token:e.token,terminal:e.terminal,enabled:next});
   }else if(e.mechanic==='sandrone.sweep'){
    const enabled=and(live(e),s.decoding);hit(e,0,{index:3,category:'charged',application:application(1,'sandrone.sweep',2,1.4),enabled,label:'解算模式·扫射'},'sweep');
    if(possible(enabled))timer({...e,time:e.origin},(e.n+1)*T.sweep,'sandrone.sweep',{token:e.token,terminal:e.terminal,enabled,origin:e.origin,n:e.n+1},14);
   }else if(e.mechanic==='sandrone.ray'){
    const enabled=and(live(e),s.decoding),stellar=m.max(reactions.view().radiance,reactions.view().swirlRadiance??0);s.rays=m.choose(enabled,m.add(s.rays,1),s.rays);const stacks=m.min(s.rays,3);
    for(const star of [false,true]){
     const on=and(enabled,star?stellar:not(stellar));hit(e,0,{index:star?5:4,category:'charged',...(star?{damageModel:'reaction.stellarConduct'}:{}),application:star?null:application(),enabled:on,sandroneRay:true,sandroneRayStacks:stacks,label:star?'冷凝射线·星超导':'冷凝射线'},star?'ray/star':'ray/ordinary');
     if(c.constellation>=6)hit(e,T.c6Delay,{index:star?17:16,category:'charged',...(star?{damageModel:'reaction.stellarConduct'}:{}),followup:true,enabled:and(on,and(m.ge(s.rays,3),m.ge(6,s.rays))),sandroneRayStacks:stacks,label:star?'集束型冷凝射线·星超导':'集束型冷凝射线'},star?'c6/star':'c6/ordinary');
    }
    if(possible(enabled)){timer(e,0,'sandrone.rayHeat',{token:e.token,terminal:e.terminal,enabled},30);timer(e,T.ray,'sandrone.ray',{token:e.token,terminal:e.terminal,enabled,n:e.n+1},12);}
   }else if(e.mechanic==='sandrone.rayHeat'){
    const enabled=live(e);power(e,m.add(s.heat,T.heatPerRay*scale),enabled);overheat(e,enabled);
   }else if(e.mechanic==='sandrone.overload'){
    const enabled=live(e),over=and(enabled,s.overloaded);hit(e,0,{index:6,category:'charged',application:application(1,'sandrone.sweep',2,1.4),enabled:over,label:'功率过载·扫射'},'overload');
    if(possible(over))timer(e,T.overloadSweep,'sandrone.overload',{token:e.token,terminal:e.terminal,enabled:over});begin(e,0,and(enabled,not(s.overloaded)));
   }
   remember(e);
  },
  onHit(e){if(e.role!==role||!['reaction.stellarConduct','direct.stellarSwirl'].includes(e.damageModel)||c.constellation<4||e.sandroneC4)return;const gate=and(e.enabled??1,and(observeHit(e),m.ge(e.time,s.c4Ready)));s.c4Ready=m.choose(gate,actionTime(e.time+4),s.c4Ready);hit(e,0,{index:15,category:'other',damageModel:'reaction.stellarConduct',followup:true,enabled:gate,sandroneC4:true,label:'桑多涅·四命谐振炮'},'c4');},
 };
}
