import {ProcOutcomeRequired} from './proc-outcomes.mjs';

export function createOutcomeChoices(m,observed=new Map(),symbolic){
 const choices=new Map();let weight=1;
 return {
  draw(id,probability,label=id){
   if(choices.has(id))return choices.get(id);
   let value;
   if(probability===0||probability===1)value=probability;
   else if(symbolic)value=symbolic(id,probability);
   else{
    value=observed.get(id);
    if(value===undefined)throw new ProcOutcomeRequired({trialKey:id,label});
    weight=m.mul(weight,value?probability:m.sub(1,probability));
   }
   choices.set(id,value);return value;
  },
  get weight(){return weight;},
 };
}
