import {normalizeEnemy} from './enemy-interface.mjs';
import {normalizeBonusInput} from './interface-contracts.mjs';
import {compileTeamDpsAxis} from './team-dps-rotation.mjs';
import {createEquipmentAxisRules,AUTO_EQUIPMENT_BUFFS} from './equipment-axis-rules.mjs';
import {compileEquipmentProcRules,createRuntimeEquipmentEvents} from './equipment-damage-events.mjs';
import {createEquipmentHealingDamage} from './equipment-healing-damage-rules.mjs';
import {createPortableHealth} from './team-dps-portable-health.mjs';
import {resolveCombatTimeline} from './team-engine/combat-runtime.mjs';
import {teamDpsBuffComposition,royalHit} from './team-dps-public-stats.mjs';
import {equipmentWeakpoint} from './equipment-combat-facts.mjs';
import {WIDSITH_THEMES,widsithTriggers} from './team-dps-weapon-options.mjs';
import {scalarMath,createTeamNumericRules} from './team-dps-numeric-rules.mjs';
import {normalizeTeamProfiles,createCharacterRules,characterRules} from './team-engine/registry.mjs';
import {equipmentHealingBase,equipmentRecipientHealing,equipmentObservesCritical} from './team-engine/equipment-healing.mjs';
import {createHitOutcomes} from './team-engine/hit-outcomes.mjs';
import {describeTeamBuffSources} from './team-dps-source-detail.mjs';
import {compileActionAxis} from './team-engine/timeline.mjs';
import {compileEffectPlan} from './team-engine/effect-plan.mjs';
import {createEffectState} from './team-engine/effect-state.mjs';
import {createEffectResolver} from './team-engine/effect-resolver.mjs';
import {hitTargets,scoredTargets} from './team-engine/hit-targets.mjs';
import {compareEvents,eventKey} from './team-engine/event-order.mjs';
import {createCharacterCombat} from './team-engine/character-combat.mjs';
import {observeProcHit,conditionProcClocks,ProcOutcomeRequired} from './team-engine/proc-outcomes.mjs';
import {combineTeamOutcomes} from './team-dps-outcome-results.mjs';
import {createHitResults} from './team-dps-hit-results.mjs';
import {createOutcomeChoices} from './team-engine/outcome-choices.mjs';
import {scaleTalentPart} from './team-engine/rule-utils.mjs';
export const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const effect=(label,values)=>({name:'ExtensionEffect',config:{ExtensionEffect:{label,values}}});
export function createTeamDpsEvaluator(api,input,execution={}){
 execution={...execution,compileRotation:execution.compileRotation||(input.team_dps.axis.format==='mona-action-axis'?compileActionAxis:compileTeamDpsAxis)};
 const m=execution.math||scalarMath;
 const profiles=normalizeTeamProfiles(input.single_interfaces);
 const rotation=execution.compileRotation(input.team_dps.axis,profiles,input.team_dps,{runtime:true});
 const effectPlan=compileEffectPlan(profiles,rotation,input.team_dps);
 const equipmentPlan=compileEquipmentProcRules(profiles,input.team_dps);
 let plans=[{themes:{},labels:[]}];
 for(let r=0;r<input.single_interfaces.length;r++)if(input.single_interfaces[r].weapon.name==='TheWidsith'){
  const mode=input.team_dps.widsith_mode?.[r]??'average';
  const themes=mode==='average'?WIDSITH_THEMES.slice(1):WIDSITH_THEMES.filter(([key])=>key===mode);
  for(const trigger of widsithTriggers(rotation,r))plans=plans.flatMap(p=>themes.map(([theme,label])=>({themes:{...p.themes,[r]:[...(p.themes[r]||[]),theme]},labels:[...p.labels,`${Number(trigger.time.toFixed(2))}秒 ${label}`]})));
 }
 const branching=equipmentPlan.some(rule=>rule&&rule.chance>0&&rule.chance<1)||profiles.some(p=>p.weapon.name==='TheBlackSword'||characterRules[p.character.name].randomHealth?.(p));
 const entries=plans.map(plan=>{
  const captured={events:[],rotation:null},runExecution=branching?{...execution,
   captureCombatEvent:execution.captureCombatEvent?event=>captured.events.push(event):undefined,
   captureRotation:execution.captureRotation?rotation=>{captured.rotation=rotation;}:undefined,
  }:execution;
  return {plan,captured,evaluator:createFixedTeamDpsEvaluator(api,{...input,team_dps:{...input.team_dps,widsith_themes:plan.themes}},runExecution,{profiles,rotation,effectPlan,equipmentPlan})};
 });
 if(!branching&&entries.length===1)return entries[0].evaluator;
 const average=values=>m.div(values.reduce((a,b)=>m.add(a,b),0),values.length);
 const panel=values=>Object.fromEntries(Object.keys(values[0]).map(key=>[key,Object.fromEntries([...new Set(values.flatMap(p=>Object.keys(p[key])))].map(source=>[source,average(values.map(p=>p[key][source]||0))]))]));
 return {profiles,events:rotation.events,
  constraints:(role,builds)=>panel(entries.map(entry=>entry.evaluator.constraints(role,builds))),
  evaluate(builds,trace=false){
   const outputs=[];
   function run(entry,observed,labels){
    const {evaluator,captured}=entry,context={observed};
    captured.events=[];captured.rotation=null;
    try{
     const output=evaluator.evaluate(builds,trace,context),probability=context.probability;
     if(typeof probability!=='object'&&!probability)return;
     outputs.push({output,weight:probability,captured:{events:captured.events,rotation:captured.rotation},label:[...entry.plan.labels,...labels].join(' / ')});
    }catch(error){
     if(!(error instanceof ProcOutcomeRequired))throw error;
     for(const outcome of [0,1])run(entry,new Map([...observed,[error.trialKey,outcome]]),[...labels,error.label+'：'+(outcome?'触发':'未触发')]);
    }
   }
   for(const entry of entries)run(entry,new Map(),[]);
   if(branching){
    const weight=outputs.reduce((n,row)=>m.add(n,row.weight),0);
    for(const row of outputs){const outcome={label:row.label,probability:m.div(row.weight,weight)};for(const event of row.captured.events)execution.captureCombatEvent({...event,outcome});if(row.captured.rotation)execution.captureRotation({...row.captured.rotation,outcome});}
   }
   return combineTeamOutcomes(outputs,m,trace);
  },
 };
}

function createFixedTeamDpsEvaluator(api,input,execution,{profiles,rotation,effectPlan,equipmentPlan}){
 const m=execution.math||scalarMath,numeric=createTeamNumericRules(m),sum=x=>Object.values(x||{}).reduce((a,b)=>m.add(a,b),0);
 const settings=input.team_dps,defer=equipmentPlan.some(rule=>rule&&rule.chance>0&&rule.chance<1);
 let currentRotation=rotation,equipment=createEquipmentAxisRules(profiles,rotation,settings,execution);
 const refresh=next=>{currentRotation=next;equipment=createEquipmentAxisRules(profiles,next,settings,execution);};
 const readPanel=(x,r,e)=>execution.query?execution.query(x,r,e,false):api.CommonInterface.get_attribute(x);
 const readDamage=(x,r,e)=>execution.query?execution.query(x,r,e,true):api.CalculatorInterface.get_damage_analysis(x,e.nativeElement??null);
 const {events,activeRole,covered}=rotation;
 const enemy=normalizeEnemy(settings.enemy);
 const characters=createCharacterRules(profiles,()=>currentRotation,m,settings);
 let effectState,effects;
  function beginEffects(builds,trace=false,read){
  const counts=builds.map(build=>{const out={};for(const item of build)out[item.set_name]=(out[item.set_name]||0)+1;return out;});
   effectState=createEffectState(effectPlan,{math:m,trace,read,events:[],enabled:({role,definition})=>definition.equipment?m.ge(execution.setCount?execution.setCount(role,definition.equipment.set):(counts[role][definition.equipment.set]||0),definition.equipment.count):1});
  effects=createEffectResolver(effectPlan,effectState,m);
 }
 const caches=profiles.map(()=>new Map()),sourceCaches=profiles.map(()=>new Map());
 const key=b=>b.map(a=>a.id).join(',');
 const activeSetConfig=(config,build)=>execution.query?config:Object.fromEntries([...new Set(build.map(a=>a.set_name))].map(n=>{const k='config_'+n.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase();return [k,config[k]];}));
  function context(role,build,e,extra=[],equipmentBuffs=[]){
  const p=structuredClone(profiles[role]),name=p.character.name,t=e.time,on=e.onField;
  characters.prepare(p,role,e);
  equipment.prepare(p,role,e,build);
  const config=characters.rules[role].skillConfig?.(e,currentRotation)||'NoConfig';
   const x={...p,artifacts:build,enemy,buffs:[...p.buffs,...characters.baseBuffs,...extra,...equipmentBuffs],skill:{index:e.index,config},team_effects:{on_field:on,recipient_on_field:on}};
  return execution.query?x:normalizeBonusInput(x);
 }
  function source(role,build,event,extra=[],equipmentBuffs=[]){
  const e={...event,role,onField:activeRole(event.time,event.rootOrder)===role,index:characters.rules[role].panelIndex,category:'skill'};
  const x=context(role,build,e,extra,equipmentBuffs),k=key(build)+'/'+JSON.stringify([x.character.params,x.weapon.params,activeSetConfig(x.artifact_config,build),extra,equipmentBuffs]);
  if(!sourceCaches[role].has(k))sourceCaches[role].set(k,readPanel(x,role,e));
  return sourceCaches[role].get(k);
 }
 function equipmentState(builds,e){
  const baseBuffs=(r,at)=>[...equipment.baseBuffs(builds,r,at),...effects.resolve('base',r,at)];
  const base=profiles.map((_,r)=>baseBuffs(r,e));
   const panels=profiles.map((_,r)=>source(r,builds[r],e,[],base[r]));
   const panelsAt=at=>profiles.map((_,r)=>source(r,builds[r],at,[],baseBuffs(r,at)));
  const buffs=base.map((b,r)=>[...b,...equipment.derivedBuffs(builds,r,e,panels,panelsAt)]);
  return {panels,buffs};
 }
 function constraintPanel(role,builds){
   const e={time:0,rootOrder:-1,order:-1},s=equipmentState(builds,e),p=source(role,builds[role],e,[],s.buffs[role]);
  return {...p,recharge:{...p.recharge,...equipment.convertedRecharge(role,s.panels)}};
 }
 // Constraint panels are read before the first command; no future lifecycle
 // needs replaying merely to read that pre-combat state.
  function constraints(role,builds){beginEffects(builds);refresh(rotation);return constraintPanel(role,builds);}
 const attackBuffs=(role,e,panels)=>[...characters.attackBuffs(role,e,panels),...effects.resolve('attack',role,e,(source,dependency)=>sum(panels[source][dependency.stat]))];
 function evaluate(builds,trace=false,procContext={}){
   const outcomePrefix=JSON.stringify([settings.widsith_themes,[...(procContext.observed??[])]]);
   const choices=createOutcomeChoices(m,procContext.observed,execution.random?(id,p)=>execution.random(outcomePrefix+'/'+id,p):undefined);
   const outcomes=createHitOutcomes(m,choices.draw,role=>rotation.slots[role]);
  const combat=rotation.runtimeRoles?createCharacterCombat(profiles,rotation,{math:m,observeHit:observeProcHit,refresh}):null;
  const candidateRotation=combat?.rotation??rotation;
  
  beginEffects(builds,trace,readEffectStat);
  refresh({...candidateRotation,heals:[],bonds:[]});
  const results=createHitResults(m,profiles.length,{defer}),{rows,totals,byRole}=results;
  const capturedEvents=defer&&execution.captureCombatEvent?[]:undefined;
  const panelAt=(r,h)=>{const s=equipmentState(builds,h);return source(r,builds[r],h,attackBuffs(r,h,s.panels),s.buffs[r]);};
  function readEffectStat(role,dependency,event){
   const s=equipmentState(builds,event);
   const panel=dependency.stage==='base'?s.panels[role]:source(role,builds[role],event,attackBuffs(role,event,s.panels),s.buffs[role]);
   return sum(panel[dependency.stat]);
  }
  const healAt=h=>{
   const s=equipmentState(builds,h),r=h.role,extra=attackBuffs(r,h,s.panels);
   const panel=source(r,builds[r],h,extra,s.buffs[r]);
   const native=index=>{
    const x=context(r,builds[r],{...h,index,onField:activeRole(h.time,h.rootOrder)===r},extra,s.buffs[r]);
    const d=readDamage(x,r,{...h,index});
    return {amount:m.add(m.add(m.add(m.add(m.mul(sum(d.atk),sum(d.atk_ratio)),m.mul(sum(d.hp),sum(d.hp_ratio))),m.mul(sum(d.def),sum(d.def_ratio))),m.mul(sum(d.em),sum(d.em_ratio))),sum(d.extra_damage)),outgoing:sum(d.healing_bonus)};
   };
   const {amount,outgoing}=equipmentHealingBase(h,panel,profiles[r],m)??characters.instances[r].healingBase(h,panel,native);
   return h.recipients.map(j=>{
     const recipient=source(j,builds[j],h,[],s.buffs[j]),x=context(j,builds[j],h,[],s.buffs[j]);
    let value=equipmentRecipientHealing(h,amount,recipient,profiles[r],m);
    value=characters.instances[r].recipientHealing?.(h,j,value,recipient)??value;
    const incoming=m.add(characters.incoming(h),sum(teamDpsBuffComposition(x,['IncomingHealingBonus'],m).IncomingHealingBonus));
    return numeric.healAmount(value,outgoing,incoming);
   });
  };
  const counts=builds.map(b=>{const out={};for(const a of b)out[a.set_name]=(out[a.set_name]||0)+1;return out;});
  const has=(r,name)=>m.ge(execution.setCount?execution.setCount(r,name):(counts[r][name]||0),4);
   const runtimeEquipment=createRuntimeEquipmentEvents(profiles,candidateRotation,m,settings,{...procContext,rules:equipmentPlan,echoesEnabled:r=>has(r,'EchoesOfAnOffering')});
   procContext.clocks=runtimeEquipment.clocks;
  const healingDamage=createEquipmentHealingDamage(profiles,rotation,h=>sum(h.rawAmounts),has,settings,m);
  const royal=profiles.map(()=>[1,0,0,0,0,0]);
  function scoreSkill(e){
    let row;
    const actualTargets=hitTargets(e,settings),selectedTargets=scoredTargets(e,settings),royalBefore=royal[e.role];
    // Selection is a read of the same resolved contact. It must never advance
    // probability state or consume an effect a second time. The current finite
    // effects add flat base damage, so their per-target sums can be reduced here.
    function resolveDamage(targetIds,collect,observe=false){
   const {time:t,role:r}=e,element=characters.hitElement(r,e);
    const targets=targetIds.length;
   const state=equipmentState(builds,e),at=e.statSnapshot?{...e,...e.statSnapshot}:e,statState=e.statSnapshot?equipmentState(builds,at):state,values=attackBuffs(r,at,statState.panels);
   const sourceAt=role=>source(role,builds[role],e,attackBuffs(role,e,state.panels),state.buffs[role]);
   values.push(...characters.damageBuffs(r,{...e,element},state.panels,sourceAt));
     values.push(...effects.resolve('damage',r,{...e,element},(role,dependency)=>sum((dependency.stage==='base'?state.panels[role]:sourceAt(role))[dependency.stat]),targetIds));
    if(healingDamage.flat.has(e.order))values.push(effect('昔时之歌·昔时的回响',{ExtraDmgBase:healingDamage.flatFor(e,targetIds)}));
   const health=currentRotation.healthAt(e);
   const x=context(r,builds[r],at,values,statState.buffs[r]),cacheKey=key(builds[r])+'/'+JSON.stringify([x.character,x.weapon.params,activeSetConfig(x.artifact_config,builds[r]),values,statState.buffs[r],e.index,e.category,e.nativeElement,e.furinaC6,x.skill.config]);
   let d=caches[r].get(cacheKey);
   if(!d){d=readDamage(x,r,e);caches[r].set(cacheKey,d);}
   if(e.statSnapshot){
    // A skill snapshots its caster's stats; target resistance/defense and
    // character damage modifiers still use the actual impact's state.
    const target=readDamage(context(r,builds[r],e,values,state.buffs[r]),r,e);
    d={...d,...Object.fromEntries(['def_minus','def_penetration','res_minus'].map(k=>[k,target[k]]))};
   }
    const multiplier=characters.instances[r].multiplier?.(e)??1;
   const talentPart=value=>scaleTalentPart(m,e,value);
   const talentFields=new Set(['技能倍率',...(e.talentRatioFields||[])]),talent=Object.entries(d.atk_ratio).filter(([name])=>talentFields.has(name)).reduce((n,[,v])=>m.add(n,v),0);
   let atkRatio=talentPart(sum(d.atk_ratio)),additive=0;
   if(characters.rules[r].separateAtkRatio||e.ratio!==undefined){
    // Published damage analysis separates the talent ratio from per-hit ATK additions.
    atkRatio=m.mul(e.ratio===undefined?talentPart(talent):e.ratio,multiplier);
    additive=m.mul(sum(d.atk),m.sub(sum(d.atk_ratio),talent));
   }
   const echoGate=has(r,'EchoesOfAnOffering'),echoesProbability=runtimeEquipment.echoes.has(eventKey(e))&&(typeof echoGate==='object'||echoGate)?m.choose(echoGate,runtimeEquipment.echoes.get(eventKey(e)),0):undefined,echoesRatio=m.mul(.7,echoesProbability??0);
   const hpExtra=m.add(e.hpRatioBonus??0,m.mul(d.hp_ratio['技能倍率']??0,m.sub(characters.instances[r].hpRatioMultiplier?.(e)??1,1))),hpRatio=m.add(sum(d.hp_ratio),hpExtra);
   const scaled=m.add(m.add(m.add(m.mul(sum(d.atk),atkRatio),talentPart(m.mul(sum(d.hp),hpRatio))),talentPart(m.mul(sum(d.def),sum(d.def_ratio)))),talentPart(m.mul(sum(d.em),sum(d.em_ratio))));
   const base=m.add(m.add(m.add(m.mul(scaled,m.add(1,sum(d.independent_damage_multiplier))),additive),m.mul(sum(d.atk),echoesRatio)),sum(d.extra_damage));
   const level=profiles[r].character.level,def=numeric.defense(level,enemy.level,sum(d.def_minus),sum(d.def_penetration));
   const res0=m.sub(enemy[element.toLowerCase()+'_res'],sum(d.res_minus)),res=numeric.resistance(res0);
   if(['RoyalLongsword','RoyalSpear','RoyalGrimoire'].includes(profiles[r].weapon.name)){
    d={...d,critical:{...d.critical}};delete d.critical['宗室被动等效'];
     const baseCritical=sum(d.critical),step=royalHit(royalBefore,baseCritical,profiles[r].weapon.refine,m);
     if(collect)royal[r]=step.state.map((value,i)=>m.choose(e.enabled??1,value,royalBefore[i]));
    d.critical['宗室·逐击概率']=m.sub(step.critical,m.min(1,m.max(0,baseCritical)));
   }
   if(equipmentWeakpoint(profiles[r],e)){d={...d,critical:{...d.critical,'命中弱点':m.sub(1,m.min(1,m.max(0,sum(d.critical))))}};}
   const cd=sum(d.critical_damage),cr=m.min(1,m.max(0,sum(d.critical)));
   const damage=numeric.damage(base,sum(d.bonus),def,res,m.mul(targets,e.enabled??1),cr,cd);
    if(trace&&collect){
     const detail=execution.query?d:describeTeamBuffSources(x,d);
    // Describe the scored hit, not the unsplit native skill or hypothetical reactions.
    const split=values=>Object.fromEntries(Object.entries(values).map(([name,value])=>[name,talentPart(value)]));
    const adjusted=characters.rules[r].separateAtkRatio||e.ratio!==undefined;
    const analysis={team_hit:true,target_count:targets,element,is_heal:false,is_shield:false,normal:{...damage},
     ...Object.fromEntries(['atk','hp','def','em','extra_damage','independent_damage_multiplier','critical','critical_damage','bonus','def_minus','def_penetration','res_minus'].map(k=>[k,{...detail[k]}])),
     atk_ratio:adjusted?{'技能倍率':m.div(atkRatio,multiplier),...(multiplier===1?{}:{[characters.rules[r].ratioLabel]:m.mul(m.div(atkRatio,multiplier),multiplier-1)})}:split(d.atk_ratio),
     atk_additive_ratio:{...(adjusted?Object.fromEntries(Object.entries(d.atk_ratio).filter(([name])=>!talentFields.has(name))):{}),...(echoesProbability===undefined?{}:{[execution.query?'来歆余响4':`来歆余响4（70% × ${Number((echoesProbability*100).toFixed(2))}%）`]:echoesRatio})},
     hp_ratio:split({...d.hp_ratio,...(hpExtra===0?{}:{[characters.rules[r].hpRatioLabel]:hpExtra})}),def_ratio:split(d.def_ratio),em_ratio:split(d.em_ratio)};
    row={...e,...damage,analysis,fanfare:health.fanfare,furina_overflow:health.overflow,hp_ratios:health.ratios,echoes_probability:echoesProbability,atk:sum(d.atk),hp:sum(d.hp),em:sum(d.em),crit:cr,crit_damage:cd,bonus:sum(d.bonus),flat:sum(d.extra_damage),def,res};
   }
    return observe?outcomes.contact(e,targetIds[0],cr,damage):damage;
    }
    let selected=resolveDamage(selectedTargets,true),actual=actualTargets.length===selectedTargets.length?selected:resolveDamage(actualTargets,false);
    if(equipmentObservesCritical(profiles[e.role],e)){
     outcomes.begin(e);
     const contacts=actualTargets.map(target=>resolveDamage([target],false,true));
     const total=filter=>contacts.filter(filter).reduce((value,contact)=>m.add(value,contact.damage),0);
     selected={...selected,expectation:total(contact=>selectedTargets.includes(contact.targetId))};actual={...actual,expectation:total(()=>true)};
     if(row){row.expectation=selected.expectation;row.analysis.normal.expectation=selected.expectation;row.contacts=contacts;}
    }
    return results.add(e,selected,actual,row);
  }
  function scoreEquipment(e){
   let row;
   const r=e.role,at=e.snapshot||e,s=equipmentState(builds,at),extra=attackBuffs(r,at,s.panels);
   if(!e.noCrit)extra.push(...characters.damageBuffs(r,{time:at.time,rootOrder:at.rootOrder,order:at.order,element:'Physical',onField:activeRole(at.time,at.rootOrder)===r},s.panels));
   const p=source(r,builds[r],at,extra,s.buffs[r]);
   const base=e.fixed??m.mul(sum(p[e.stat]),e.ratio),bonus=e.fixed===undefined?sum(p.bonus_physical):0;
   const targetState=equipmentState(builds,e),targetInput=context(r,builds[r],e,[],targetState.buffs[r]);
   const reduction=teamDpsBuffComposition(targetInput,['DefMinus','DefPenetration','ResMinusBase','ResMinusPhysical'],m);
   const level=profiles[r].character.level,def=e.ignoreDefense?1:numeric.defense(level,enemy.level,sum(reduction.DefMinus),sum(reduction.DefPenetration));
   const res0=m.sub(m.sub(enemy.physical_res,sum(reduction.ResMinusBase)),sum(reduction.ResMinusPhysical)),res=numeric.resistance(res0);
   const cr=e.noCrit?0:e.forceCritical?1:m.min(1,m.max(0,sum(p.critical))),cd=e.noCrit?0:sum(p.critical_damage),probability=e.enabled??1,targetCount=scoredTargets(e,settings).length,n=m.mul(m.mul(m.mul(m.mul(m.mul(base,m.add(1,bonus)),def),res),probability),targetCount);
   const damage={non_critical:n,critical:m.mul(n,m.add(1,cd)),expectation:m.mul(n,m.add(1,m.mul(cr,cd)))};
   if(trace&&targetCount){
    const detail=execution.query?p:describeTeamBuffSources(context(r,builds[r],at,extra,s.buffs[r]),p);
    const analysis={team_hit:true,event_probability:probability,target_count:targetCount,ignore_defense:!!e.ignoreDefense,element:'Physical',normal:{...damage},is_heal:false,is_shield:false,
     atk:{...detail.atk},hp:{...detail.hp},def:{...detail.def},em:{...p.elemental_mastery},atk_ratio:e.stat==='atk'?{[e.label]:e.ratio}:{},hp_ratio:e.stat==='hp'?{[e.label]:e.ratio}:{},def_ratio:{},em_ratio:{},atk_additive_ratio:{},independent_damage_multiplier:{},
     extra_damage:e.fixed===undefined?{}:{[e.label]:e.fixed},bonus:e.fixed===undefined?{...p.bonus_physical}:{},critical:e.noCrit||e.forceCritical?{'追加攻击暴击规则':cr}:{...p.critical},critical_damage:e.noCrit?{'追加攻击暴击规则':0}:{...p.critical_damage},def_minus:reduction.DefMinus,def_penetration:reduction.DefPenetration,res_minus:Object.fromEntries([...new Set([...Object.keys(reduction.ResMinusBase),...Object.keys(reduction.ResMinusPhysical)])].map(k=>[k,(reduction.ResMinusBase[k]||0)+(reduction.ResMinusPhysical[k]||0)]))};
    row={...e,...damage,analysis,category:'equipment',part:0,onField:activeRole(e.time,e.rootOrder)===r,atk:sum(p.atk),hp:sum(p.hp),crit:cr,crit_damage:cd,bonus,flat:e.fixed||0,def,res};
   }
   const actualTargets=hitTargets(e,settings).length;
   if(actualTargets===targetCount)return results.add(e,damage,damage,row);
   const actual=m.mul(m.mul(m.mul(m.mul(m.mul(base,m.add(1,bonus)),def),res),probability),actualTargets);
   return results.add(e,damage,{non_critical:actual,critical:m.mul(actual,m.add(1,cd)),expectation:m.mul(actual,m.add(1,m.mul(cr,cd)))},row);
  }
  const healthState=createPortableHealth(profiles,builds,candidateRotation,{panelAt,healAt,criticalHitAt:outcomes.anyCritical,refresh,...execution,random:choices.draw});
  combat?.bind(healthState.rotation);
  const resolved=resolveCombatTimeline(effectPlan.schedule,healthState,effectState,{
   ...(combat?{math:m,horizon:rotation.duration,minimumDuration:rotation.combatDurationFloor,prepareEvent:combat.prepare}:{}),
   beforeHit(event){runtimeEquipment.beforeHit(event);healingDamage.beforeHit(event);},
   hit:e=>e.category==='equipment'?scoreEquipment(e):scoreSkill(e),
    afterEvent(event,enqueue){healingDamage.afterEvent(event,enqueue);combat?.after(event,enqueue);runtimeEquipment?.afterEvent(event,enqueue);if(capturedEvents)capturedEvents.push(event);else execution.captureCombatEvent?.(event);},
  });
  const conditioned=procContext.observed?.size?conditionProcClocks(runtimeEquipment.clocks,procContext.observed,m):{probability:1};
  procContext.probability=m.mul(conditioned.probability,choices.weight);results.finish(conditioned.marginals);
  if(capturedEvents)for(const event of capturedEvents){const reported=results.report(event);if(reported)execution.captureCombatEvent(reported);}
  refresh(resolved);execution.captureRotation?.(resolved);
  rows.sort(compareEvents);
  return {...totals,total_damage:totals.expectation,dps:m.div(totals.expectation,resolved.duration),duration:resolved.duration,character_damage:byRole,profiles,panels:builds.map((b,r)=>constraintPanel(r,builds)),...(trace?{hits:rows,heals:resolved.heals,bonds:resolved.bonds,health:resolved.health,resources:resolved.resources,effects:effectState.changes,enemy}:{}),fanfare:resolved.health.reduce((v,h)=>m.max(v,h.fanfare),0),furina_overflow:resolved.health.reduce((v,h)=>m.max(v,h.overflow),0)};
 }
 return {evaluate,constraints,profiles,events};
}
