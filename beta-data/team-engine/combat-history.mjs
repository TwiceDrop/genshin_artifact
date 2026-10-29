import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {eventBefore} from './event-order.mjs';
import {observeProcHit} from './proc-outcomes.mjs';

// Read the history of actual facts. A symbolic gate is a candidate condition,
// never a probability or JS truth value. Cooldowns advance only on accepted facts.
export function createCombatHistory(m=scalarMath){
 const possible=value=>typeof value==='object'||!!value;
 const gate=row=>{const enabled=row.enabled??1;return possible(enabled)?m.choose(enabled,observeProcHit(row),0):0;};
 const within=(row,event,span)=>eventBefore(row,event)&&event.time<row.time+span;
 const any=(rows,predicate=()=>true)=>rows.reduce((value,row)=>predicate(row)?m.max(value,gate(row)):value,0);
 function spaced(rows,interval=0){
  let last=-Infinity;const accepted=[];
  for(const row of rows){
   const enabled=m.choose(gate(row),m.ge(row.time,m.add(last,interval-1e-9)),0);
   if(!possible(enabled))continue;
   last=m.choose(enabled,row.time,last);
   accepted.push(enabled===1||enabled===true?row:{...row,enabled});
  }
  return accepted;
 }
 function count(rows,event,span,limit=Infinity,interval=0){
  return m.min(limit,spaced(rows.filter(row=>eventBefore(row,event)),interval).reduce((value,row)=>within(row,event,span)?m.add(value,gate(row)):value,0));
 }
 function refreshed(rows,event,span,limit,interval=0){
  let last=-Infinity,value=0;
  for(const row of spaced(rows.filter(row=>eventBefore(row,event)),interval)){
   const enabled=gate(row),next=m.choose(m.ge(row.time,m.add(last,span)),1,m.min(limit,m.add(value,1)));
   value=m.choose(enabled,next,value);last=m.choose(enabled,row.time,last);
  }
  return m.choose(m.lt(event.time,m.add(last,span)),value,0);
 }
 function latest(rows,event){
  let taken=0;const selected=[];
  for(let i=rows.length-1;i>=0;i--){
   const row=rows[i];if(!eventBefore(row,event))continue;
   const enabled=m.choose(taken,0,gate(row));
   if(possible(enabled))selected.push({...row,enabled});
   taken=m.max(taken,enabled);if(taken===1||taken===true)break;
  }
  return selected;
 }
 return {gate,any,spaced,count,refreshed,latest,within};
}
