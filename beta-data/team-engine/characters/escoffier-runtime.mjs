import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {eventKey} from '../event-order.mjs';

export function createEscoffierRuntime({role,profile,activeRole,enqueue,math:m=scalarMath}){
 const c6=profile.character.constellation>=6;
 const and=(a,b)=>m.choose(a,b,0);
 let last=-Infinity,remaining=0,cast=-Infinity,arkheReady=-Infinity;
 return {
  prepareHit(e){
   if(!e.escoArkhe)return;
   const gate=and(e.enabled??1,m.ge(e.time,arkheReady));
   e.enabled=gate;arkheReady=m.choose(gate,e.time+10,arkheReady);
  },
  onEvent(e){
   if(c6&&e.kind==='cast'&&e.role===role&&e.action==='skill'){
    cast=m.choose(e.enabled??1,e.time,cast);remaining=m.choose(e.enabled??1,6,remaining);
   }
  },
  onHit(e){
   if(!c6||e.role!==activeRole(e.time,e.rootOrder)||!['normal','charged','plunge'].includes(e.category))return;
   const gate=and(e.enabled??1,and(m.lt(e.time,m.add(cast,20)),and(m.gt(remaining,0),m.ge(e.time,m.add(last,.5)))));
   if(typeof gate!=='object'&&!gate)return;
   enqueue({kind:'hit',role,index:8,category:'skill',parts:1,ratio:5,element:'Cryo',time:e.time,
    label:'特级冻霜芭菲·六命追加',part:0,rootOrder:e.rootOrder+.01,eventId:e.eventId+'/escoffier.c6',parentEventId:eventKey(e),enabled:gate});
   last=m.choose(gate,e.time,last);remaining=m.sub(remaining,m.choose(gate,1,0));
  },
 };
}
