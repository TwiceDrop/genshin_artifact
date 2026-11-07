import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';

export const testModelId='test.resistance-only';
export const testEffect={id:'test.model-pool',label:'测试模型次数池',stage:'damage',target:'otherOnField',
 trigger:{kind:'cast',action:'skill'},duration:10,uses:4,targetAggregation:'linearFlat',
 filter:{damageModel:testModelId,element:'Cryo',damageTags:['test:contact','test:marked'],reactionType:'test-reaction'},
 reads:{attack:{stat:'atk',stage:'base',timing:'live'}},value:({m,read})=>({ExtraDmgBase:m.mul(.25,read('attack'))}),
};

// A deliberately different damage model: source HP + limited flat additions,
// resistance only, no defense/bonus/crit. No native damage index or new game rule.
export const testDamageModel={id:testModelId,randomOutcomes:true,evaluate(e,{math:m,numeric,panelAt,effects,targets,trace,outcomes}){
 const sum=record=>Object.values(record).reduce((n,v)=>m.add(n,v),0),p=panelAt(e.role,e),base=m.mul(sum(p.hp),.01),res=numeric.resistance(.1),cr=e.testCritical?.25:0,cd=e.testCritical?1:0;
 const resolve=ids=>{
  const buffs=effects('damage',e.role,e,ids),flat=buffs.reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.ExtraDmgBase??0),0);
  return {damage:numeric.damage(m.add(base,flat),0,1,res,m.mul(ids.length,e.enabled??1),cr,cd),flat};
 };
 const ids=targets(e),scored=resolve(ids.scored),actual=ids.scored.length===ids.actual.length?scored:resolve(ids.actual);
 let contacts;
 if(e.testCritical){
  outcomes.begin(e);contacts=ids.actual.map(id=>outcomes.contact(e,id,cr,resolve([id]).damage));
  scored.damage={...scored.damage,expectation:contacts.filter(c=>ids.scored.includes(c.targetId)).reduce((n,c)=>m.add(n,c.damage),0)};
  actual.damage={...actual.damage,expectation:contacts.reduce((n,c)=>m.add(n,c.damage),0)};
 }
 const analysis={team_hit:true,target_count:ids.scored.length,element:e.element,ignore_defense:true,is_heal:false,is_shield:false,normal:{...scored.damage},
  atk:{},hp:{...p.hp},def:{},em:{},atk_ratio:{},hp_ratio:{'测试生命倍率':.01},def_ratio:{},em_ratio:{},atk_additive_ratio:{},extra_damage:{'测试次数池':scored.flat},independent_damage_multiplier:{},critical:{'测试暴击':cr},critical_damage:{'测试暴击':cd},bonus:{},def_minus:{},def_penetration:{},res_minus:{}};
 return {selected:scored.damage,actual:actual.damage,row:trace?{...e,...scored.damage,analysis,hp:sum(p.hp),atk:sum(p.atk),crit:cr,crit_damage:cd,bonus:0,flat:scored.flat,def:1,res,...(contacts?{contacts}:{})}:undefined};
}};

export function installTestDamageModel(){
 const owner=characterPackages.Escoffier,oldModels=owner.damageModels,oldEffects=owner.effects;
 owner.damageModels=[testDamageModel];owner.effects=(...args)=>[...oldEffects(...args),testEffect];
 return ()=>{if(oldModels===undefined)delete owner.damageModels;else owner.damageModels=oldModels;owner.effects=oldEffects;};
}

// Test-only decoration of an installed character hit; no public axis input added.
export function modelEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const event of plan.events)if(event.eventId.startsWith('model-')){
   Object.assign(event,{damageModel:testModelId,element:'Cryo',index:9999,targetIds:[2,0,1],damageTags:['test:marked','test:contact'],reactionType:'test-reaction'});
   if(input.testCritical)Object.assign(event,{testCritical:true,targetIds:[0]});
   if(input.testGate&&event.eventId.startsWith('model-1'))event.enabled=execution.setCount?execution.math.ge(execution.setCount(event.role,'GladiatorsFinale'),4):input.testGate===1?1:0;
  }
  return plan;
 }});
}
