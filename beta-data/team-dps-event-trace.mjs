import {eventKey} from './team-engine/event-order.mjs';

const channels=['hits','health','heals','bonds','effects','resources'];
const isRef=value=>value&&typeof value==='object'&&Object.keys(value).length===1&&Number.isInteger(value.index);

// A trace reads the evaluator's expressions, never a second combat model.
// Templates keep correlated fields in one observation. Probability is absolute
// event mass; distributions at different events are not complete trajectories.
export function compileEventTrace(result,m){
 const groups=[],branches=[];
 const outcomes=result.trace_outcomes??[{output:result,probability:1,label:''}];
 for(const [branch,outcome]of outcomes.entries()){
  const mass=outcome.probability;branches.push({branch,label:outcome.label,group:groups.length});
  groups.push({id:'outcome/'+branch,channel:'outcome',branch,label:outcome.label,template:{},nodes:[],mass:isRef(mass)?{node:mass.index}:{constant:mass}});
  for(const channel of channels){
  for(const [ordinal,row]of (outcome.output[channel]??[]).entries()){
   const nodes=[],indexes=new Map();
   function encode(value){
    if(isRef(value)){
     if(!indexes.has(value.index)){indexes.set(value.index,nodes.length);nodes.push(value.index);}
     return {$value:indexes.get(value.index)};
    }
    if(Array.isArray(value))return value.map(encode);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined&&typeof v!=='function').map(([k,v])=>[k,encode(v)]));
    return value;
   }
   // Legacy hit rows are expected contributions. Observations instead carry
   // occurrence mass and the conditional damage, without a second weighting.
   const {damageOnOccurrence,...value}=row;
   const conditional=damageOnOccurrence?{...value,...damageOnOccurrence,analysis:{...value.analysis,event_probability:1,normal:{...damageOnOccurrence}}}:value;
   const template=encode(conditional),mass=m.mul(m.mul(outcome.probability,row.enabled??1),channel==='hits'?row.probability??1:1);
   groups.push({id:channel+'/'+branch+'/'+ordinal,channel,eventId:row.contactId??eventKey(row),branch,label:outcome.label,template,nodes,consumedRoleMask:row.consumedRoles?.some(isRef)??false,mass:isRef(mass)?{node:mass.index}:{constant:mass}});
  }
  }
 }
 return {semantics:'event-local-joint-values',groups,branches};
}

export function decodeEventTrace(plan,distributions){
 return {semantics:plan.semantics,events:plan.groups.flatMap((group,i)=>{
  if(group.channel==='outcome')return [];
  function decode(value,values){
   if(value&&typeof value==='object'&&Object.hasOwn(value,'$value'))return values[value.$value];
   if(Array.isArray(value))return value.map(v=>decode(v,values));
   if(value&&typeof value==='object'){
    const out=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v,values)]));
    for(const key of ['hpRecipients','healedRecipients'])if(out[key])out[key]=out[key].flatMap(row=>typeof row==='object'?(row.enabled?[row.role]:[]):[row]);
    return out;
   }
   return value;
  }
  const states=distributions[i].map(({values,probability,index},ordinal)=>{
   const value=decode(group.template,values);
   if(value.instanceKey!==undefined)value.instanceId=value.instanceKey+'/'+value.generation;
   if(group.consumedRoleMask)value.consumedRoles=value.consumedRoles.flatMap((enabled,role)=>enabled?[role]:[]);
   return {state:index??ordinal,probability,value};
  });
  return {id:group.id,eventId:group.eventId,channel:group.channel,branch:group.branch,label:group.label,probability:states.reduce((n,s)=>n+s.probability,0),states};
 }).filter(event=>event.states.length)};
}
