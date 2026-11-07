import {modelInput} from './team-stellar-model-definition.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {effect} from '../../beta-data/team-engine/rule-utils.mjs';
import {transformativeReactions} from '../../beta-data/team-engine/transformative-reactions.mjs';
export function hydroModelInput(kind,role){
 const input=modelInput('all');input.testReactionRole=role;input.testReactionKind=kind;
 input.single_interfaces[0].buffs=[];input.single_interfaces[role].buffs=[effect('反应独立预期',{[transformativeReactions[kind].effect]:.5,ATKFixed:10000,CriticalBase:1,CriticalDamageBase:5,BonusElectro:3,BonusPhysical:3,DefMinus:.9})];
 input.team_dps.enemy.electro_res=.35;input.team_dps.enemy.physical_res=.2;
 input.team_dps.axis.timeline.push({id:'star-3',kind:'action',actor:'member1',action:'charged',timeMs:2200});
 return input;
}
export function hydroModelEvaluator(api,input,execution={}){
 const reaction=transformativeReactions[input.testReactionKind];
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const e of plan.events)if(e.eventId.startsWith('star-'))Object.assign(e,{damageModel:reaction.id,category:'reaction',reactionDamage:true,element:reaction.element,role:input.testReactionRole,targetIds:[2,0,1],
   // A parent's skill snapshot must be ignored. Only a reaction's explicit
   // capture selects EM/bonus; target resistance is always read at impact.
   statSnapshot:{time:0,rootOrder:0},...(e.eventId.startsWith('star-2')?{reactionSnapshot:{time:1,rootOrder:Infinity,fields:['em',reaction.bonus]}}:{})});
  return plan;
 }});
}
export function installHydroModelEffects(){
 const source=characterPackages.Furina,previous=source.effects;
 source.effects=(...args)=>[...(previous?.(...args)??[]),{id:'test.hydro.live',label:'反应捕获后的属性变化',stage:'attack',target:'team',trigger:{kind:'cast',action:'burst'},duration:10,reads:{},value:()=>({ElementalMastery:500})},
  {id:'test.hydro.damage',label:'反应捕获后的反应增益及减抗',stage:'damage',target:'team',trigger:{kind:'cast',action:'burst'},duration:10,reads:{},value:()=>({EnhanceElectroCharged:.25,EnhanceShatter:.25,ResMinusBase:.3})}];
 return ()=>{if(previous)source.effects=previous;else delete source.effects;};
}
