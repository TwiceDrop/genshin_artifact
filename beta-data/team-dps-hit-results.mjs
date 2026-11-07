import {observeProcHit} from './team-engine/proc-outcomes.mjs';

const keys=['expectation','critical','non_critical'];
const empty=()=>Object.fromEntries(keys.map(key=>[key,0]));

// A resolved contact has one damage calculation and two target selections.
// Unknown proc probabilities can be conditioned later without replaying that
// calculation or the combat state. Reading damage to drive another mechanic
// observes the actual proc first; reporting only reads finalized expectations.
export function createHitResults(m,roleCount,{defer=false}={}){
 const totals=empty(),byRole=Array.from({length:roleCount},empty),rows=[],pending=[];
 let finalized=false,marginals,visible=()=>1;
 const probability=event=>event.trialKey&&marginals?.has(event.trialKey)?marginals.get(event.trialKey):(event.probability??1);
 const weighted=(damage,p)=>p===1?damage:Object.fromEntries(keys.map(key=>[key,m.mul(damage[key],p)]));
 function accumulate(role,damage){for(const key of keys){totals[key]=m.add(totals[key],damage[key]);byRole[role][key]=m.add(byRole[role][key],damage[key]);}}
 function add(event,selected,actual=selected,row){
  if(!defer){
   const p=observeProcHit(event),damage=weighted(selected,p);accumulate(event.role,damage);
   if(row&&p!==0)for(const detail of Array.isArray(row)?row:[row]){
    if(p!==1){const value=Array.isArray(row)?weighted(detail,p):damage;Object.assign(detail,value);Object.assign(detail.analysis.normal,value);}rows.push(detail);
   }
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
 function finish(posterior,visibility=()=>1){
  marginals=posterior;visible=visibility;finalized=true;
  for(const {event,selected,row}of pending){
   const occurrence=probability(event),gate=visible(event),p=m.mul(occurrence,gate),damage=weighted(selected,p);accumulate(event.role,damage);
   if(!row||p===0)continue;
   for(const detail of Array.isArray(row)?row:[row]){
    const conditional=Array.isArray(row)?Object.fromEntries(keys.map(key=>[key,detail[key]])):selected,contribution=Array.isArray(row)?weighted(conditional,p):damage;
    if(occurrence!==1)detail.damageOnOccurrence={...conditional};
    if(gate!==1)detail.enabled=m.choose(gate,detail.enabled??1,0);
    Object.assign(detail,contribution);Object.assign(detail.analysis.normal,contribution);
    if(event.probability!==undefined){detail.probability=occurrence;detail.analysis.event_probability=m.mul(p,event.enabled??1);}
    rows.push(detail);
   }
  }
 }
 function report(event){
  const gate=visible(event),p=probability(event);if(p===0||gate===0||gate===false)return;
  if(gate!==1&&gate!==true)event={...event,enabled:m.choose(gate,event.enabled??1,0)};
  return event.trialKey?{...event,probability:p}:event;
 }
 return {totals,byRole,rows,add,finish,report};
}
