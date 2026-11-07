import {fixture} from '../../beta-tools/interface-audit-7108.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {effect} from '../../beta-data/team-engine/rule-utils.mjs';
export function modelInput(scope='all'){
 const names=['Mona','Furina','Escoffier','Vodyanitsa'],axis=createActionAxis('stellar-model-contract',names);
 axis.timeline=[{id:'pool',actor:'member3',kind:'action',action:'skill',timeMs:0},{id:'star-1',actor:'member1',kind:'action',action:'charged',timeMs:1000},{id:'change',actor:'member2',kind:'action',action:'burst',timeMs:1500},{id:'star-2',actor:'member1',kind:'action',action:'charged',timeMs:2000},{id:'end',actor:'member1',kind:'switch',timeMs:2500}];
 const profiles=names.map((name,r)=>{const p=fixture(name);p.artifacts=p.artifacts.map((a,i)=>({...a,id:100*r+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 profiles[0].buffs=[effect('测试星伤基础',{StellarConductBaseBonus:.2,EnhanceStellarSuperconduct:.4,StellarConductFlat:50,StellarConductCritRate:.15,StellarConductCritDamage:.4,CriticalBase:.2,CriticalDamageBase:.3,BonusBase:3,CriticalChargedAttack:.7,CriticalDamageChargedAttack:4})];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:3,damage_scope:scope}};
}
export function modelEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const e of plan.events)if(e.eventId.startsWith('star-'))Object.assign(e,{damageModel:'reaction.stellarConduct',stellarRatio:2,stellarCoefficient:1.5,element:'Cryo',nativeElement:'Cryo',targetIds:[2,0,1],...(e.eventId.startsWith('star-2')?{statSnapshot:{time:.5,rootOrder:0,fields:['atk','em','direct_stellarconduct_compose']}}:{})});
  return plan;
 }});
}
export function superconductEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const e of plan.events)if(e.eventId.startsWith('star-'))Object.assign(e,{damageModel:'reaction.superconduct',category:'reaction',reactionDamage:true,element:'Cryo',role:input.testReactionRole??0,targetIds:[2,0,1],statSnapshot:{time:.5,rootOrder:0}});
  return plan;
 }});
}
export function installEffects(){
 const owner=characterPackages.Escoffier,old=owner.effects,source=characterPackages.Furina,previous=source.effects;
 owner.effects=(...args)=>[...old(...args),{id:'test.stellar.pool',label:'星伤次数测试',stage:'damage',target:'otherOnField',trigger:{kind:'cast',action:'skill'},duration:10,uses:4,filter:{damageModel:'reaction.stellarConduct'},reads:{},value:()=>({StellarConductFlat:100})}];
 source.effects=(...args)=>[...(previous?.(...args)??[]),{id:'test.stellar.live',label:'快照后属性变化',stage:'attack',target:'team',trigger:{kind:'cast',action:'burst'},duration:10,reads:{},value:()=>({ATKFixed:100,ElementalMastery:500,ResMinusCryo:.2})}];
 return ()=>{owner.effects=old;if(previous)source.effects=previous;else delete source.effects;};
}

