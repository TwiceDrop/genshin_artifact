import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {sharedDamageModels} from '../../beta-data/team-engine/damage-models.mjs';
import {reactionDamageEvent} from '../../beta-data/team-engine/reaction-events.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {scalarMath} from '../../beta-data/team-dps-numeric-rules.mjs';

export const reactionModelId='test.reaction.linear';
const model={id:reactionModelId,evaluate(e,{math:m,numeric,panelAt,actorIds,targets,effects,trace}){
 const sum=o=>Object.values(o).reduce((n,v)=>m.add(n,v),0),hp=sum(panelAt(actorIds.indexOf(e.sourceActorId),e).hp),flat=effects('damage',e.role,e).reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.ExtraDmgBase??0),0),base=m.add(m.add(100,m.mul(hp,.001)),flat),ids=targets(e);
 const calculate=targets=>numeric.damage(base,0,1,1,m.mul(targets.length,e.enabled??1),0,0),selected=calculate(ids.scored),actual=calculate(ids.actual);
 return {selected,actual,row:trace?{...e,...selected,hp,flat,analysis:{team_hit:true,target_count:ids.scored.length,element:e.element,normal:{...selected},atk:{},hp:{source:hp},def:{},em:{},atk_ratio:{},hp_ratio:{source:.001},def_ratio:{},em_ratio:{},atk_additive_ratio:{},extra_damage:{fixture:m.add(100,flat)},critical:{},critical_damage:{},bonus:{},independent_damage_multiplier:{},def_minus:{},def_penetration:{},res_minus:{}}}:undefined};
}};

export function installReactionFixture(mode='regular'){
 const source=characterPackages.Vodyanitsa,receiver=characterPackages.Escoffier,old={expand:source.expand,createCombat:source.createCombat,createTimeline:source.createTimeline,effects:receiver.effects};
 if(mode==='dual')source.expand=ctx=>old.expand({...ctx,hit:(a,t,...args)=>ctx.hit(a,a.id==='seed'&&t.category==='normal'?{...t,parts:2}:t,...args)});
 function runtime(ctx){
  const m=ctx.math??scalarMath,slot=name=>ctx.actorIds[ctx.profiles.findIndex(p=>p.character.name===name)];
  return {
   onHit(e){
    if(e.role!==ctx.role||e.reactionDamage||!(mode==='proc'?e.category==='equipment':e.eventId==='seed/normal.1'))return;
    ctx.emitReaction(e,{reactionType:'Frozen',elements:['Hydro','Cryo'],instanceId:'test.fact',enabled:e.testReactionEnabled??1,
     sourceActorId:slot('Furina'),triggerActorId:slot('Escoffier'),ownerActorId:slot('Skirk'),contributors:[{actorId:slot('Furina'),element:'Hydro'},{actorId:slot('Escoffier'),element:'Cryo'}]});
   },
   onEvent(e){if(e.kind==='reaction'&&e.reactionOrigin==='resolved')ctx.enqueue(reactionDamageEvent(e,{damageModel:reactionModelId,element:'Cryo',label:'测试反应伤害'}, {actorIds:ctx.actorIds,math:m}));},
  };
 }
 source.createTimeline=runtime;source.createCombat=runtime;
 receiver.effects=(...args)=>[...old.effects(...args),{id:'test.reaction.buff',label:'测试事实增益',stage:'damage',target:'team',trigger:{kind:'reaction',reactionType:'Frozen',reactionOrigin:'resolved'},duration:5,reads:{},filter:{damageModel:reactionModelId},value:()=>({ExtraDmgBase:5})}];
 sharedDamageModels.push(model);
 return ()=>{source.expand=old.expand;for(const key of ['createCombat','createTimeline'])if(old[key]===undefined)delete source[key];else source[key]=old[key];receiver.effects=old.effects;sharedDamageModels.splice(sharedDamageModels.indexOf(model),1);};
}

export function reactionEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const e of plan.events)if(e.eventId==='seed/normal.1')e.testReactionEnabled=execution.setCount?execution.math.ge(execution.setCount(e.role,'GladiatorsFinale'),4):input.testReactionEnabled??1;
  return plan;
 }});
}
