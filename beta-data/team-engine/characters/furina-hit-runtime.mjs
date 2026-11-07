import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {actionTime} from '../rule-utils.mjs';
import {eventKey} from '../event-order.mjs';

export function createFurinaHitRuntime({role,profile,enqueue,emitHealth,math:m=scalarMath}){
 if(profile.character.constellation<6)return;
 const and=(a,b)=>m.choose(a,b,0),possible=value=>typeof value==='object'||!!value;
 let cast=-Infinity,last=-Infinity,uses=0,end=-Infinity,next=Infinity;
 const scheduled=new Set();
 function tick(time){
  if(scheduled.has(time))return;scheduled.add(time);
  enqueue({kind:'timer',mechanic:'furina.c6',role,time,rootOrder:-Infinity,eventId:'furina.c6/timer/'+time});
 }
 return {
  onEvent(e){
   if(e.role!==role)return;
   const enabled=e.enabled??1;
   if(e.kind==='cast'&&e.action==='skill'){cast=m.choose(enabled,e.time,cast);uses=m.choose(enabled,0,uses);}
   if(e.mechanic==='furina.c6'){
    const due=and(enabled,m.eq(next,e.time)),live=and(due,m.ge(end,e.time));
    if(possible(live))emitHealth({kind:'heal',healing:'furina_c6',recipients:[0,1,2,3],role,time:e.time,
     rootOrder:e.rootOrder,eventId:'furina.c6/heal/'+e.time,parentEventId:eventKey(e),enabled:live});
    next=m.choose(due,m.choose(live,actionTime(e.time+1),Infinity),next);
    if(possible(live))tick(actionTime(e.time+1));
   }
  },
  prepareHit(e){
   if(!['normal','charged','plunge'].includes(e.category))return;
   const active=and(m.lt(e.time,m.add(cast,10)),m.lt(uses,6)),enabled=e.enabled??1;
   if(e.arkheStrike)e.hpRatioBonus=m.mul(.18,active);
   else if(!e.plungeCollision){
    const trigger=and(enabled,and(active,m.ge(e.time,m.add(last,.1-1e-9))));
    if(possible(trigger)){
     if(e.arkhe==='pneuma')emitHealth({kind:'current_hp_drain',time:e.time,role,rootOrder:e.rootOrder+.1,eventId:e.eventId+'/furina.c6-drain',parentEventId:eventKey(e),hpDrain:.01,label:'芙宁娜·六命芒性生命消耗',enabled:trigger});
     else{
      const start=and(trigger,m.ge(e.time,end)),at=actionTime(e.time+1);
      // Match actionTime rounding for repeated 2.9-second extensions in both backends.
      end=m.choose(trigger,m.choose(start,actionTime(e.time+2.9),m.div(m.floor(m.add(m.mul(m.add(end,2.9),1e12),.5)),1e12)),end);
      next=m.choose(start,at,next);if(possible(start))tick(at);
     }
     last=m.choose(trigger,e.time,last);uses=m.add(uses,m.choose(trigger,1,0));
    }
   }
   const prepare=(value,gate)=>({...e,furinaC6:value,element:e.arkheStrike||value?'Hydro':'Physical',enabled:gate});
   if(typeof active!=='object'){Object.assign(e,prepare(!!active,enabled));return;}
   return [
    {...prepare(true,and(enabled,active)),variant:'furina.c6'},
    {...prepare(false,m.choose(active,0,enabled)),variant:'furina.ordinary'},
   ];
  },
 };
}
