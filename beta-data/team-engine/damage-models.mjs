import {characterPackages} from './character-packages.mjs';
import {damageModelId} from './damage-contract.mjs';
import {stellarConductModel,directStellarSwirlModel,transformativeModels} from './reaction-damage.mjs';
import {stellarSwirlModel} from './stellar-swirl-damage.mjs';

// Shared mechanisms (for example a future reaction module) register here;
// character-specific models live in their character package. Both use one table.
export const sharedDamageModels=[stellarConductModel,directStellarSwirlModel,stellarSwirlModel,...transformativeModels];

// Installed JS definitions are compiled once with the team, never supplied as
// executable code in an axis. Each candidate supplies fresh stateful services.
export function compileDamageModels(profiles){
 const definitions=new Map(),builtins=new Set(['native.skill','equipment.physical']);
 const providers=[['shared',sharedDamageModels],...[...new Set(profiles.map(p=>p.character.name))].sort().map(name=>[name,characterPackages[name].damageModels??[]])];
 for(const [name,models]of providers){
  for(const definition of models){
   if(!definition.id||typeof definition.evaluate!=='function')throw Error('伤害模型定义无效：'+name);
   if(builtins.has(definition.id)||definitions.has(definition.id))throw Error('伤害模型身份重复：'+definition.id);
   definitions.set(definition.id,{evaluate:definition.evaluate,randomOutcomes:definition.randomOutcomes===true});
  }
 }
 const create=({nativeSkill,equipmentPhysical,results,...context})=>{
  const models=new Map([
   ['native.skill',nativeSkill],['equipment.physical',equipmentPhysical],
   ...[...definitions].map(([id,definition])=>{const evaluate=definition.evaluate;return [id,event=>evaluate(event,context)];}),
  ]);
  return event=>{
   const id=damageModelId(event),evaluate=models.get(id);
   if(!evaluate)throw Error('未安装伤害模型：'+id);
   const result=evaluate(event),{selected,actual=selected,row}=result;
   if(result.contributions){
    const total={non_critical:0,critical:0,expectation:0};
    for(const c of result.contributions){const actual=results.add({...event,role:c.role},c.selected,c.actual,c.row);for(const key of Object.keys(total))total[key]=context.math.add(total[key],actual[key]);}
    return total;
   }
   // Weighting, attribution and downstream actual-damage feedback are common
   // to every model. A model returns damage conditional on the hit occurring.
   return results.add(event,selected,actual,row);
  };
 };
 return Object.assign(create,{randomOutcomes:[...definitions.values()].some(d=>d.randomOutcomes===true)});
}
