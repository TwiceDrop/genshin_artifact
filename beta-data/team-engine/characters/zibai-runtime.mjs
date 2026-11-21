import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,compareEventPosition,eventKey} from '../event-order.mjs';
import {hasAscendantGleam} from '../moon-crystallize.mjs';

export function createZibaiRuntime({role,profile,profiles,roots,math:m=scalarMath,enqueue,resources,previewWindow,recordResource,observeHit=e=>e.enabled??1,complete=(a,t)=>{a.completionTime=t;}}){
 const c=profile.character,full=hasAscendantGleam(profiles),limit=c.constellation>=1?5:4,efficiency=c.constellation===6?1.5:1;
 const history=[],save=recordResource??(entry=>resources.push(entry));
 const initialCycle=roots.find(e=>e.role===role&&e.action==='skill')?.actionId==='skill.cycle';
 const s={until:-Infinity,light:0,used:0,lightAt:0,origin:0,reactionReady:-Infinity,normalReady:-Infinity,c4:0,c6Excess:0,c6Until:-Infinity,cycle:initialCycle};
 const and=(a,b)=>m.choose(a,b,0),possible=a=>typeof a==='object'||!!a;
 const hitFrames=[[11],[12],[17,27],[27],[32,32]];
 const active=t=>and(m.lt(t,s.until),m.lt(s.used,limit));
 function advance(t){
  const tick=x=>m.floor(m.add(m.mul(10,m.sub(x,s.origin)),1e-7));
  const steps=m.max(0,m.sub(tick(m.min(t,s.until)),tick(s.lightAt)));
  s.light=m.choose(m.lt(s.used,limit),m.min(100,m.add(s.light,m.mul(steps,efficiency))),s.light);
  s.lightAt=t;
 }
 let window;
 function remember(e){
  history.push({at:afterEvent(e),...s});
  if(!previewWindow)return;
  if(active(e.time)){if(window&&window.end>=e.time)window.end=s.until;else window=previewWindow('月转时隙',e,s.until-e.time);}
  else if(window&&window.end>e.time)window.end=e.time;
 }
 function emit(e,index,category,element,label,key,gate,extra={}){
  if(!possible(gate))return;
  enqueue({kind:'hit',index,role,category,element,label,time:actionTime(e.time+(extra.delay??0)),rootOrder:e.rootOrder+20,order:e.order,eventId:e.id+'/'+key,
   completionRoot:e.id,enabled:gate,part:0,parts:1,...extra});
 }
 const ordinary=application(1,'zibai.normal',3,2.5);
 return {stateAt(e){const row=history.findLast(row=>compareEventPosition(row.at,e)<=0);
  return row?{phase:and(m.lt(e.time,row.until),m.lt(row.used,limit)),excess:row.cycle&&c.constellation===6?30:m.choose(m.lt(e.time,row.c6Until),row.c6Excess,0)}:{phase:0,excess:initialCycle&&c.constellation===6?30:0};
 },onEvent(e){
  if(e.kind==='switch'&&e.from===role&&e.role!==role){advance(e.time);s.until=-Infinity;s.c4=0;s.cycle=false;remember(e);return;}
  if(e.kind==='reaction'&&e.reactionType==='LunarCrystallize'&&full){
   advance(e.time);const gate=and(e.enabled??1,and(active(e.time),m.ge(e.time,s.reactionReady)));
   s.light=m.choose(gate,m.min(100,m.add(s.light,35*efficiency)),s.light);
   s.reactionReady=m.choose(gate,actionTime(e.time+4),s.reactionReady);remember(e);return;
  }
  if(e.role!==role||!['action','cast'].includes(e.kind))return;
  advance(e.time);const gate=e.enabled??1,id=e.actionId??e.action;
  if(e.action==='skill'){
   s.cycle=id==='skill.cycle';s.origin=e.time;s.until=e.time+15;s.used=0;s.reactionReady=-Infinity;s.normalReady=-Infinity;s.c4=0;
   if(c.constellation>=1||s.cycle)s.light=100;
  }else if(e.action==='burst'){
   s.until=m.choose(active(e.time),m.add(s.until,1.7),s.until);
   emit(e,16,'burst','Geo','三垣威仪法·第一段','first',gate,{delay:1.8,application:application()});
   emit(e,17,'burst','Geo','三垣威仪法·第二段','second',gate,{delay:1.8,damageModel:'direct.lunarCrystallize',lunarStat:'def'});
  }else if(id==='stride'){
   const before=s.light,usable=and(gate,and(active(e.time),m.ge(s.light,70))),first=c.constellation>=1?m.choose(m.eq(s.used,0),1,0):0;
   const excess=c.constellation===6?m.max(0,m.sub(s.light,70)):0;
   s.light=m.choose(usable,c.constellation===6?0:m.sub(s.light,70),s.light);
   s.c6Excess=m.choose(usable,excess,s.c6Excess);s.c6Until=m.choose(usable,e.time+3,s.c6Until);
   s.used=m.add(s.used,usable);s.reactionReady=m.choose(usable,-Infinity,s.reactionReady);
   save({time:e.time,role,eventId:e.id,resource:'时隙浮光',before,after:s.light,reason:'灵驹飞踏',enabled:usable});
   const delay1=s.cycle?0:30/60,delay2=s.cycle?0:34/60;
   complete(e,m.choose(usable,actionTime(e.time+delay2),e.time));
   const common={zibaiPhase:1,zibaiExcess:s.cycle&&c.constellation===6?30:excess};
   emit(e,14,'skill','Geo','灵驹飞踏·第一段','first',usable,{...common,delay:delay1,application:application()});
   emit(e,15,'skill','Geo','灵驹飞踏·第二段','second',usable,{...common,delay:delay2,damageModel:'direct.lunarCrystallize',lunarStat:'def',initialStride:first});
  }else{
   const normal=id.startsWith('normal.'),phase=active(e.time),i=normal?Number(id.at(-1))-1:4;
   if(normal||id==='charged'){
    const end=actionTime(e.time+hitFrames[i].at(-1)/60);
    complete(e,s.cycle?e.time:i===3&&full?m.choose(phase,actionTime(e.time+47/60),end):end);
    for(const empowered of [false,true]){
     const enabled=and(gate,empowered?phase:m.choose(phase,0,1)),index=(empowered?8:0)+i,element=empowered?'Geo':'Physical';
     const category=normal?'normal':'charged',label=(empowered?'月转时隙·':'')+(normal?'普通攻击·第'+(i+1)+'段':'重击');
     const touches=i===2||i===4?2:1;
     for(let part=0;part<touches;part++)emit(e,index,category,element,label,element+'/'+part,enabled,{
      part,delay:s.cycle?0:hitFrames[i][part]/60,zibaiPhase:empowered,application:empowered&&(part===0||!s.cycle)?(normal?ordinary:application(1,'zibai.charged',3,2.5)):null,
     });
     if(empowered&&i===3&&full){
      emit(e,13,'normal','Geo','月转时隙第四段额外伤害','extra',enabled,{delay:s.cycle?0:47/60,damageModel:'direct.lunarCrystallize',lunarStat:'def',zibaiPhase:1,c4Bonus:s.c4,application:application(),rootOrder:e.rootOrder+21});
      s.c4=m.choose(enabled,0,s.c4);
     }
    }
   }else{
    const index={'plunge.collision':5,'plunge.low':6,plunge:7}[id];
    emit(e,index,'plunge','Physical','下落攻击',id,gate);
   }
  }
  remember(e);
 },onHit(e){
  if(e.role!==role)return;
  if(e.index===14&&c.constellation>=4){s.c4=m.max(s.c4,and(e.enabled??1,observeHit(e)));remember(e);}
  if(e.category!=='normal'||e.damageModel||!e.zibaiPhase)return;
  advance(e.time);const gate=and(e.enabled??1,and(observeHit(e),and(active(e.time),m.ge(e.time,s.normalReady))));
  s.light=m.choose(gate,m.min(100,m.add(s.light,5*efficiency)),s.light);
  s.normalReady=m.choose(gate,e.time+.5,s.normalReady);remember(e);
 }};
}
