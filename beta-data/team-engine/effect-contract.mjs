import {EFFECT_STAGES,TEAM_STAT_FIELDS} from './stat-contract.mjs';
import {damageModelId} from './damage-contract.mjs';

export const EFFECT_TARGETS=['self','other','team','selfOnField','selfOffField','otherOnField','otherOffField','teamOnField','teamOffField'];

// Existing scalar fields use equality (or a list of alternatives). Damage tags
// are an explicit set: all requested tags must be present. No reaction inference.
export const matchesEffect=(filter,event)=>Object.entries(filter).every(([key,value])=>{
 if(key==='damageTags')return value.every(tag=>event.damageTags?.includes(tag));
 const actual=key==='damageModel'?damageModelId(event):event[key];
 return Array.isArray(value)?value.includes(actual):(actual??null)===value;
});

export function validateEffectDefinition(definition){
 const stage=EFFECT_STAGES.indexOf(definition.stage),id=definition.id;
 if(stage<0)throw Error('效果写入阶段无效：'+id);
 if(!id||!EFFECT_TARGETS.includes(definition.target)||typeof definition.value!=='function')throw Error('效果定义或目标无效：'+id);
 if(!(definition.duration>=0)||definition.uses!==undefined&&(!Number.isInteger(definition.uses)||definition.uses<1))throw Error('效果持续时间或次数无效：'+id);
 if(definition.uses!==undefined&&definition.stage!=='damage')throw Error('有限次数效果必须在命中阶段求值：'+id);
 if(definition.targetAggregation!==undefined&&(definition.targetAggregation!=='linearFlat'||definition.uses===undefined))throw Error('效果目标汇总合同无效：'+id);
 for(const filter of [definition.trigger,definition.filter])if(filter?.damageTags!==undefined&&(!Array.isArray(filter.damageTags)||filter.damageTags.some(tag=>typeof tag!=='string')))throw Error('效果伤害标签无效：'+id);
 if(definition.stacking){
  const {group,mode='highest'}=definition.stacking;
  if(!group||!['highest','sum'].includes(mode))throw Error('效果叠加策略无效：'+id);
 }
 if(definition.stacks){
  const {limit,refresh,overflow,gain=1}=definition.stacks;
  if(!Number.isInteger(limit)||limit<1||!['all','independent'].includes(refresh)||refresh==='independent'&&overflow!=='replaceOldest'||typeof gain!=='function'&&(!Number.isInteger(gain)||gain<1))throw Error('效果叠层生命周期无效：'+id);
 }
 for(const [name,dependency]of Object.entries(definition.reads)){
  const readStage=EFFECT_STAGES.indexOf(dependency.stage);
  if(readStage<0||readStage>=stage)throw Error('效果属性依赖成环或读取阶段无效：'+id+'/'+name);
  if(!TEAM_STAT_FIELDS.includes(dependency.stat))throw Error('效果属性读取字段无效：'+id+'/'+name);
  if(!['live','activation','stack'].includes(dependency.timing))throw Error('效果属性读取时机无效：'+id+'/'+name);
  if(dependency.timing==='stack'&&definition.stacks?.refresh!=='independent')throw Error('逐层快照需要独立叠层：'+id+'/'+name);
 }
}
