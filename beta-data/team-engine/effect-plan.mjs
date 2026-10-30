import {characterPackages} from './character-packages.mjs';
import {equipmentEffects} from './equipment-effects.mjs';
import {createEventScheduler} from './scheduler.mjs';
import {eventKey} from './event-order.mjs';
import {validateEffectDefinition} from './effect-contract.mjs';

/**
 * Definitions own value/target/read contracts; instances own activation state.
 * stages name the existing native read contracts, not an inferred "final stat".
 * base: native panel + fixed equipment; attack: character/conversion additions;
 * damage: hit-scoped contributions. A definition only reads an earlier stage.
 */
export function compileEffectPlan(profiles,rotation,settings){
 const elements=profiles.map(profile=>characterPackages[profile.character.name].element);
 const sources=profiles.flatMap((profile,role)=>{
  const character=characterPackages[profile.character.name];
  const definitions=[...equipmentEffects,...(character.effects?.({...profile,role},{profiles,elements,rotation,settings})||[])];
  return definitions.map(definition=>{
   validateEffectDefinition(definition);
   return {definition,role,actorId:rotation.slots[role],key:definition.id+'/'+rotation.slots[role]};
  });
 }).sort((a,b)=>a.key.localeCompare(b.key));
 const identities=new Set(),groups=new Map();
 for(const {key,definition}of sources){
  if(identities.has(key))throw Error('效果身份重复：'+key);
  identities.add(key);
  if(definition.stacking){
   const {group,mode='highest'}=definition.stacking,contract=definition.stage+'/'+mode;
   if(groups.has(group)&&groups.get(group)!==contract)throw Error('效果分组合同冲突：'+group);
   groups.set(group,contract);
  }
 }
 const events=[...rotation.roots.filter(e=>['cast','action','switch'].includes(e.kind)),...(rotation.reactionFacts??[]),...rotation.events.map(e=>({...e,kind:'hit',element:e.element??characterPackages[profiles[e.role].character.name].hitElement?.(e)??characterPackages[profiles[e.role].character.name].element,eventKey:eventKey(e)}))];
 const schedule=[...createEventScheduler(events).events()];
 return {sources,schedule,settings,rotation};
}
