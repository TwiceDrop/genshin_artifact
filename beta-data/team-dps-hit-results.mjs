import {observeProcHit} from './team-engine/proc-outcomes.mjs';

const keys=['expectation','critical','non_critical'];
const empty=()=>Object.fromEntries(keys.map(key=>[key,0]));

// A resolved contact has one damage calculation and two target selections.
// Unknown proc probabilities can be conditioned later without replaying that
// calculation or the combat state. Reading damage to drive another mechanic
// observes the actual proc first; reporting only reads finalized expectations.
export function createHitResults(m,roleCount,{defer=false}={}){
 const totals=empty(),byRole=Array.from({length:roleCount},empty),rows=[],pending=[];
 let finalized=false,marginals;
 const probability=event=>event.trialKey&&marginals?.has(event.trialKey)?marginals.get(event.trialKey):(event.probability??1);
 const weighted=(damage,p)=>p===1?damage:Object.fromEntries(keys.map(key=>[key,m.mul(damage[key],p)]));
 function accumulate(role,damage){for(const key of keys){totals[key]=m.add(totals[key],damage[key]);byRole[role][key]=m.add(byRole[role][key],damage[key]);}}
 function add(event,selected,actual=selected,row){
  if(!defer){
   const p=observeProcHit(event),damage=weighted(selected,p);accumulate(event.role,damage);
   if(row&&p!==0){if(p!==1){Object.assign(row,damage);Object.assign(row.analysis.normal,damage);}rows.push(row);}
   return weighted(actual,p);
  }
  pending.push({event,selected,row});
  if((event.probability??1)===1)return actual;
  const view={};
  for(const key of keys)Object.defineProperty(view,key,{enumerable:true,get(){
   if(finalized)return m.mul(actual[key],probability(event));
   const enabled=event.enabled??1;
   if(typeof enabled!=='object'&&!enabled)return 0;
   return m.mul(actual[key],observeProcHit(event));
  }});
  return view;
 }
 function finish(posterior){
  marginals=posterior;finalized=true;
  for(const {event,selected,row}of pending){
   const p=probability(event),damage=weighted(selected,p);accumulate(event.role,damage);
   if(!row||p===0)continue;
   Object.assign(row,damage);Object.assign(row.analysis.normal,damage);
   if(event.probability!==undefined){row.probability=p;row.analysis.event_probability=m.mul(p,event.enabled??1);}
   rows.push(row);
  }
 }
 function report(event){
  const p=probability(event);if(p===0)return;
  return event.trialKey?{...event,probability:p}:event;
 }
 return {totals,byRole,rows,add,finish,report};
}
