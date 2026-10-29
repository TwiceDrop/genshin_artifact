import {scalarMath} from '../team-dps-numeric-rules.mjs';

const possible=value=>typeof value==='object'||!!value;
const ratio=(m,n,d)=>m.div(n,m.choose(m.gt(d,0),d,1));
function transitions(clock,trial,ready,observed,m){
 const required=observed.get(trial.trialKey);
 const chance=ready<=trial.time?m.mul(trial.enabled??1,trial.chance??clock.chance):0;
 return [
  {success:0,ready:ready<=trial.time?-Infinity:ready,weight:m.sub(1,chance)},
  {success:1,ready:trial.time+clock.cooldown,weight:chance},
 ].filter(row=>possible(row.weight)&&(required===undefined||row.success===required));
}

// Actual trial streams keep candidate-valued existence gates. Children of the
// same proc share a trial key; observing one conditions all of them.
export function createProcClock(clock,observed=new Map(),m=scalarMath){
 let states=new Map([[-Infinity,1]]);
 return {accept(trial){
  const next=new Map();let success=0,total=0;
  for(const [ready,mass]of states){
   total=m.add(total,mass);
   for(const row of transitions(clock,trial,ready,observed,m)){
    const weight=m.mul(mass,row.weight);
    next.set(row.ready,m.add(next.get(row.ready)??0,weight));
    if(row.success)success=m.add(success,weight);
   }
  }
  states=next;
  return {probability:observed.has(trial.trialKey)?observed.get(trial.trialKey):ratio(m,success,total),possible:m.gt(success,0)};
 }};
}

// Forward/backward messages include later observations. A forward marginal is
// sufficient for discovery, but not for scoring earlier unobserved children
// once a later success/failure has conditioned the shared cooldown.
export function conditionProcClock(clock,observed=new Map(),m=scalarMath){
 const {trials}=clock,forward=[new Map([[-Infinity,1]])];
 for(const trial of trials){
  const next=new Map();
  for(const [ready,mass]of forward.at(-1))for(const row of transitions(clock,trial,ready,observed,m))
   next.set(row.ready,m.add(next.get(row.ready)??0,m.mul(mass,row.weight)));
  forward.push(next);
 }
 const probability=[...forward.at(-1).values()].reduce((a,b)=>m.add(a,b),0);
 const backward=Array.from({length:trials.length+1},()=>new Map());
 for(const ready of forward.at(-1).keys())backward.at(-1).set(ready,1);
 const marginals=new Map();
 for(let i=trials.length-1;i>=0;i--){
  let success=0;
  for(const [ready,mass]of forward[i]){
   let suffix=0;
   for(const row of transitions(clock,trials[i],ready,observed,m)){
    const weight=m.mul(row.weight,backward[i+1].get(row.ready)??0);suffix=m.add(suffix,weight);
    if(row.success)success=m.add(success,m.mul(mass,weight));
   }
   backward[i].set(ready,suffix);
  }
  marginals.set(trials[i].trialKey,observed.has(trials[i].trialKey)?m.choose(m.gt(probability,0),observed.get(trials[i].trialKey),0):ratio(m,success,probability));
 }
 return {probability,marginals};
}
export function conditionProcClocks(clocks,observed,m=scalarMath){
 let probability=1;const marginals=new Map();
 for(const clock of clocks){
  const result=conditionProcClock(clock,observed,m);probability=m.mul(probability,result.probability);
  for(const [key,value]of result.marginals)marginals.set(key,value);
 }
 return {probability,marginals};
}
export function conditionEquipmentPlan(plan,observed,m=scalarMath){
 const {probability,marginals}=conditionProcClocks(plan.clocks,observed,m);
 return {...plan,probability,procs:plan.procs.map(event=>event.trialKey?{...event,probability:marginals.get(event.trialKey)}:event)};
}
export class ProcOutcomeRequired extends Error {
 constructor(event){super('需要相关触发结果：'+event.trialKey);this.trialKey=event.trialKey;this.label=event.label;}
}
export function observeProcHit(event){
 const probability=event.probability??1;
 if(probability===0||probability===1)return probability;
 if(!event.trialKey)throw Error('概率命中缺少触发身份：'+event.eventId);
 throw new ProcOutcomeRequired(event);
}
