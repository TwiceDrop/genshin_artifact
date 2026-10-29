import {equipmentHealingDamage} from './equipment-healing-damage-rules.mjs';
import {scalarMath} from './team-dps-numeric-rules.mjs';
import {compareEvents,eventKey} from './team-engine/event-order.mjs';
import {createProcClock,observeProcHit} from './team-engine/proc-outcomes.mjs';
import {compileEquipmentProcRules,procChildren} from './equipment-proc-rules.mjs';
export {compileEquipmentProcRules};

const possible=value=>typeof value==='object'||!!value;
export function procProbabilities(hits,chance,cooldown){
 const clock=createProcClock({chance,cooldown}),out=[];
 for(const h of hits){const {probability}=clock.accept(h);if(probability)out.push({...h,probability});}
 return out;
}

// Both outcomes start the 0.2s trial cooldown; a success covers 0.05s.
// Candidate gates decide whether a contact exists, not how much cooldown it uses.
export function createEchoesClock(m=scalarMath){
 let mass=[1,0,0,0,0],ready=-Infinity,expires=-Infinity,success=0;
 return {hit(h){
  const enabled=h.enabled??1,trigger=m.choose(enabled,m.ge(h.time,m.sub(ready,1e-9)),0);
  if(possible(trigger)){
   const next=[0,0,0,0,0];let wonTotal=0;
   for(let k=0;k<mass.length;k++){
    const won=m.mul(mass[k],Math.min(1,.36+.2*k));
    wonTotal=m.add(wonTotal,won);next[0]=m.add(next[0],won);
    const i=h.onField?Math.min(4,k+1):k;next[i]=m.add(next[i],m.sub(mass[k],won));
   }
   mass=next.map((value,i)=>m.choose(trigger,value,mass[i]));
   success=m.choose(trigger,wonTotal,success);ready=m.choose(trigger,h.time+.2,ready);expires=m.choose(trigger,h.time+.05,expires);
  }
  return m.choose(m.lt(h.time,m.sub(expires,1e-9)),success,0);
 }};
}
export function echoesProbabilities(hits){
 const clock=createEchoesClock(),out=new Map();
 for(const h of hits)out.set(h.order,clock.hit(h));return out;
}

export function createRuntimeEquipmentEvents(profiles,rotation,m,settings={},options={}){
 const rules=options.rules??compileEquipmentProcRules(profiles,settings),observed=options.observed??new Map();
 const ready=profiles.map(()=>-Infinity),burstEnds=profiles.map(()=>-Infinity),harmonics=profiles.map(()=>[]);
 const clocks=[],random=rules.map((rule,r)=>{
  if(!rule||rule.chance===1)return;
  const data={key:rotation.slots[r]+'/'+rule.name,chance:rule.chance,cooldown:rule.cooldown,trials:[]};clocks.push(data);
  return {data,state:createProcClock(data,observed,m)};
 });
 const echoes=new Map(),echoClocks=profiles.map((_,r)=>!options.echoesEnabled||possible(options.echoesEnabled(r))?createEchoesClock(m):undefined);
 function afterEvent(h,enqueue){
  const r=h.role,rule=rules[r];if(!rule)return;
  if(h.kind==='cast'&&h.action==='burst'&&rule.burstWindow){burstEnds[r]=m.choose(h.enabled??1,h.time+rule.burstWindow,burstEnds[r]);return;}
  if(h.kind!=='hit'||!rule.accept(h))return;
  let enabled=h.enabled??1;
  if(!possible(enabled))return;
  enabled=m.choose(enabled,observeProcHit(h),0);
  if(rule.burstWindow)enabled=m.choose(enabled,m.lt(h.time,burstEnds[r]),0);
  let probability=1,trialKey;
  if(random[r]){
   const {data,state}=random[r];trialKey=data.key+'/'+eventKey(h);
   const trial={time:h.time,trialKey,enabled};data.trials.push(trial);
   const result=state.accept(trial);
   probability=observed.has(trialKey)?observed.get(trialKey):(options.posterior?.get(trialKey)??result.probability);
   if(observed.get(trialKey)===1)enabled=m.choose(enabled,result.possible,0);
  }else{
   enabled=m.choose(enabled,m.ge(h.time,m.sub(ready[r],rule.harmonics?1e-9:0)),0);
   ready[r]=m.choose(enabled,h.time+rule.cooldown,ready[r]);
   if(rule.harmonics){
    const pool=harmonics[r].filter(row=>h.time<row.time+rule.harmonics.lifetime);pool.push({time:h.time,enabled});
    const count=pool.reduce((sum,row)=>m.add(sum,row.enabled),0),trigger=m.choose(enabled,m.ge(count,rule.harmonics.count),0);
    harmonics[r]=pool.map(row=>({...row,enabled:m.choose(trigger,0,row.enabled)}));enabled=trigger;
   }
  }
  if(!possible(enabled)||!possible(probability))return;
  for(const child of procChildren(rule,h,settings)){
   const event={kind:'hit',category:'equipment',element:'Physical',role:r,rootOrder:h.rootOrder,part:h.part??0,
    eventId:h.eventId??h.id,enabled,probability,trialKey,stat:rule.stat,ratio:rule.ratio,label:rule.label,
    ...(rule.forceCritical?{forceCritical:true}:{}),
    ...(rule.live?{}:{snapshot:{...h,order:h.order+.5}}),
    ...(rule.targetCount?{targetIds:Array.from({length:rule.targetCount},(_,i)=>i)}:h.targetIds?{targetIds:h.targetIds}:{}),...child};
   const id=(rule.name==='AshGravenDrinkingHorn'?eventKey(h):eventKey(event))+'/equipment/'+rule.name;
   enqueue({...event,eventId:id,eventKey:id,parentEventId:eventKey(h),onField:rotation.activeRole(event.time,event.rootOrder)===r,characterPrepared:true});
  }
 }
 return {clocks,echoes,afterEvent,beforeHit(h){
  if(h.category==='normal'&&echoClocks[h.role])echoes.set(eventKey(h),echoClocks[h.role].hit(h));
 }};
}

// Compatibility inspection uses the same clocks over an already resolved
// rotation. Production feeds these reducers from the candidate event queue.
export function compileEquipmentDamageEvents(profiles,rotation,settings={}){
 const runtime=createRuntimeEquipmentEvents(profiles,rotation,scalarMath,settings),procs=[],echoes=new Map();
 for(const h of [...rotation.roots.filter(e=>e.kind==='cast'),...rotation.events.map(e=>({...e,kind:'hit'}))].sort(compareEvents)){
  if(h.kind==='hit'){runtime.beforeHit(h);if(runtime.echoes.has(eventKey(h)))echoes.set(h.order,runtime.echoes.get(eventKey(h)));}
  runtime.afterEvent(h,event=>{if(event.time<rotation.duration||event.time===rotation.duration&&rotation.endHit==='include')procs.push(event);});
 }
 return {echoes,clocks:runtime.clocks,procs:procs.sort(compareEvents)};
}
export function equipmentDamageEvents(profiles,builds,rotation,healAmount,settings={},execution={}){
 const m=execution.math||scalarMath,sets=builds.map(b=>{const x={};for(const a of b)x[a.set_name]=(x[a.set_name]||0)+1;return x;});
 const has=(r,name)=>m.ge(execution.setCount?execution.setCount(r,name):(sets[r][name]||0),4);
 const healing=equipmentHealingDamage(profiles,rotation,healAmount,has,settings,m),compiled=compileEquipmentDamageEvents(profiles,rotation,settings),echoes=new Map();
 for(const e of rotation.events){const gate=has(e.role,'EchoesOfAnOffering');if(compiled.echoes.has(e.order)&&possible(gate))echoes.set(e.order,m.choose(gate,compiled.echoes.get(e.order),0));}
 return {...healing,echoes,procs:[...healing.procs,...compiled.procs].filter(p=>p.time<rotation.duration||(p.time===rotation.duration&&rotation.endHit==='include')).sort(compareEvents)};
}
