import {characterPackages} from './character-packages.mjs';
import {equipmentEffects} from './equipment-effects.mjs';
import {createEventScheduler} from './scheduler.mjs';
import {eventKey} from './event-order.mjs';
import {EFFECT_STAGES,TEAM_STAT_FIELDS} from './stat-contract.mjs';

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
   const stage=EFFECT_STAGES.indexOf(definition.stage);
   if(stage<0)throw Error('效果写入阶段无效：'+definition.id);
   if(definition.stacks){
    const {limit,refresh,overflow,gain=1}=definition.stacks;
    if(!Number.isInteger(limit)||limit<1||!['all','independent'].includes(refresh)||refresh==='independent'&&overflow!=='replaceOldest'||typeof gain!=='function'&&(!Number.isInteger(gain)||gain<1))throw Error('效果叠层生命周期无效：'+definition.id);
   }
   for(const [name,dependency]of Object.entries(definition.reads)){
    const readStage=EFFECT_STAGES.indexOf(dependency.stage);
    if(readStage<0||readStage>=stage)throw Error('效果属性依赖成环或读取阶段无效：'+definition.id+'/'+name);
    if(!TEAM_STAT_FIELDS.includes(dependency.stat))throw Error('效果属性读取字段无效：'+definition.id+'/'+name);
    if(!['live','activation','stack'].includes(dependency.timing))throw Error('效果属性读取时机无效：'+definition.id+'/'+name);
    if(dependency.timing==='stack'&&definition.stacks?.refresh!=='independent')throw Error('逐层快照需要独立叠层：'+definition.id+'/'+name);
   }
   return {definition,role,actorId:rotation.slots[role],key:definition.id+'/'+rotation.slots[role]};
  });
 }).sort((a,b)=>a.key.localeCompare(b.key));
 const events=[...rotation.roots.filter(e=>['cast','action','switch'].includes(e.kind)),...rotation.events.map(e=>({...e,kind:'hit',element:e.element??characterPackages[profiles[e.role].character.name].hitElement?.(e)??characterPackages[profiles[e.role].character.name].element,eventKey:eventKey(e)}))];
 const schedule=[...createEventScheduler(events).events()];
 return {sources,schedule,settings,rotation};
}
