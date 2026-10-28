import {normalizeEnemy} from './enemy-interface.mjs';
import {normalizeBonusInput} from './interface-contracts.mjs';
import {compileTeamDpsAxis} from './team-dps-rotation.mjs';
import {createEquipmentAxisRules,AUTO_EQUIPMENT_BUFFS} from './equipment-axis-rules.mjs';
import {equipmentDamageEvents} from './equipment-damage-events.mjs';
import {resolvePortableHealth as resolveEquipmentHealing} from './team-dps-portable-health.mjs';
import {teamDpsBuffComposition,royalHit} from './team-dps-public-stats.mjs';
import {equipmentWeakpoint} from './equipment-combat-facts.mjs';
import {WIDSITH_THEMES,widsithTriggers} from './team-dps-weapon-options.mjs';
import {scalarMath,createTeamNumericRules} from './team-dps-numeric-rules.mjs';
import {normalizeTeamProfiles,createCharacterRules} from './team-engine/registry.mjs';
import {equipmentHealingBase,equipmentRecipientHealing} from './team-engine/equipment-healing.mjs';
import {describeTeamBuffSources} from './team-dps-source-detail.mjs';
import {compileActionAxis} from './team-engine/timeline.mjs';
export const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const effect=(label,values)=>({name:'ExtensionEffect',config:{ExtensionEffect:{label,values}}});
export function createTeamDpsEvaluator(api,input,execution={}){
 execution={...execution,compileRotation:execution.compileRotation||(input.team_dps.axis.format==='mona-action-axis'?compileActionAxis:compileTeamDpsAxis)};
 const m=execution.math||scalarMath;
 const rotation=(execution.compileRotation||compileTeamDpsAxis)(input.team_dps.axis,input.single_interfaces,input.team_dps);
 let plans=[{themes:{},labels:[]}];
 for(let r=0;r<input.single_interfaces.length;r++)if(input.single_interfaces[r].weapon.name==='TheWidsith'){
  const mode=input.team_dps.widsith_mode?.[r]??'average';
  const themes=mode==='average'?WIDSITH_THEMES.slice(1):WIDSITH_THEMES.filter(([key])=>key===mode);
  for(const trigger of widsithTriggers(rotation,r))plans=plans.flatMap(p=>themes.map(([theme,label])=>({themes:{...p.themes,[r]:[...(p.themes[r]||[]),theme]},labels:[...p.labels,`${Number(trigger.time.toFixed(2))}秒 ${label}`]})));
 }
 const evaluators=plans.map(p=>createFixedTeamDpsEvaluator(api,{...input,team_dps:{...input.team_dps,widsith_themes:p.themes}},execution));
 if(evaluators.length===1)return evaluators[0];
 const average=values=>m.div(values.reduce((a,b)=>m.add(a,b),0),values.length);
 const panel=values=>Object.fromEntries(Object.keys(values[0]).map(key=>[key,Object.fromEntries([...new Set(values.flatMap(p=>Object.keys(p[key])))].map(source=>[source,average(values.map(p=>p[key][source]||0))]))]));
 const damage=values=>Object.fromEntries(['expectation','critical','non_critical'].map(k=>[k,average(values.map(v=>v[k]))]));
 return {profiles:evaluators[0].profiles,events:evaluators[0].events,
  constraints:(role,builds)=>panel(evaluators.map(e=>e.constraints(role,builds))),
  evaluate(builds,trace=false){
   const outputs=evaluators.map(e=>e.evaluate(builds,trace)),out={...outputs[0],...damage(outputs)};
   out.total_damage=out.expectation;out.dps=m.div(out.expectation,out.duration);
   out.character_damage=out.character_damage.map((_,r)=>damage(outputs.map(o=>o.character_damage[r])));
   out.panels=out.panels.map((_,r)=>panel(outputs.map(o=>o.panels[r])));
    out.fanfare=average(outputs.map(o=>o.fanfare));out.furina_overflow=average(outputs.map(o=>o.furina_overflow));
    if(trace)out.health_branches=outputs.map((o,j)=>({label:plans[j].labels.join(' / '),probability:1/plans.length,health:o.health}));
   if(trace)out.hits=out.hits.map((h,i)=>({...h,...damage(outputs.map(o=>o.hits[i])),branches:outputs.map((o,j)=>({label:plans[j].labels.join(' / '),probability:1/plans.length,analysis:o.hits[i].analysis,fanfare:o.hits[i].fanfare,furina_overflow:o.hits[i].furina_overflow}))}));
   return out;
  }};
}
function createFixedTeamDpsEvaluator(api,input,execution){
 const m=execution.math||scalarMath,numeric=createTeamNumericRules(m),sum=x=>Object.values(x||{}).reduce((a,b)=>m.add(a,b),0);
 const profiles=normalizeTeamProfiles(input.single_interfaces),settings=input.team_dps;
 const rotation=(execution.compileRotation||compileTeamDpsAxis)(settings.axis,profiles,settings);
 let currentRotation=rotation,equipment=createEquipmentAxisRules(profiles,rotation,settings,execution);
 const refresh=next=>{currentRotation=next;equipment=createEquipmentAxisRules(profiles,next,settings,execution);};
 const readPanel=(x,r,e)=>execution.query?execution.query(x,r,e,false):api.CommonInterface.get_attribute(x);
 const readDamage=(x,r,e)=>execution.query?execution.query(x,r,e,true):api.CalculatorInterface.get_damage_analysis(x,e.nativeElement??null);
 const {events,activeRole,covered}=rotation;
 const enemy=normalizeEnemy(settings.enemy);
 const characters=createCharacterRules(profiles,()=>currentRotation,m,settings);
 const caches=profiles.map(()=>new Map()),sourceCaches=profiles.map(()=>new Map());
 const key=b=>b.map(a=>a.id).join(',');
 const activeSetConfig=(config,build)=>execution.query?config:Object.fromEntries([...new Set(build.map(a=>a.set_name))].map(n=>{const k='config_'+n.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase();return [k,config[k]];}));
  function context(role,build,e,extra=[],equipmentBuffs=[]){
  const p=structuredClone(profiles[role]),name=p.character.name,t=e.time,on=e.onField;
  characters.prepare(p,role,e);
  equipment.prepare(p,role,e);
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
  const base=profiles.map((_,r)=>equipment.baseBuffs(builds,r,e));
   const panels=profiles.map((_,r)=>source(r,builds[r],e,[],base[r]));
   const panelsAt=at=>profiles.map((_,r)=>source(r,builds[r],at,[],equipment.baseBuffs(builds,r,at)));
  const buffs=base.map((b,r)=>[...b,...equipment.derivedBuffs(builds,r,e,panels,panelsAt)]);
  return {panels,buffs};
 }
 function constraints(role,builds){
   const e={time:0,rootOrder:-1,order:-1},s=equipmentState(builds,e),p=source(role,builds[role],e,[],s.buffs[role]);
  return {...p,recharge:{...p.recharge,...equipment.convertedRecharge(role,s.panels)}};
 }
 const attackBuffs=(role,e,panels)=>characters.attackBuffs(role,e,panels);
 function evaluate(builds,trace=false){
  refresh({...rotation,heals:[],bonds:[]});
  const rows=[],totals={expectation:0,critical:0,non_critical:0},byRole=profiles.map(()=>({expectation:0,critical:0,non_critical:0}));
  const panelAt=(r,h)=>{const s=equipmentState(builds,h);return source(r,builds[r],h,attackBuffs(r,h,s.panels),s.buffs[r]);};
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
  const criticalAt=h=>{
    const s=equipmentState(builds,h),r=h.role,extra=attackBuffs(r,h,s.panels);extra.push(...characters.criticalBuffs(h));
   return m.min(1,m.max(0,sum(readDamage(context(r,builds[r],h,extra,s.buffs[r]),r,h).critical)));
  };
  const resolved=resolveEquipmentHealing(profiles,builds,rotation,{panelAt,healAt,criticalAt,refresh,...execution});refresh(resolved);
  execution.captureRotation?.(resolved);
  const equipmentEvents=equipmentDamageEvents(profiles,builds,resolved,h=>sum(h.rawAmounts),settings,execution);
  const royal=profiles.map(()=>[1,0,0,0,0,0]),targets=settings.damage_scope==='all'?(settings.enemy_count??1):1;
  for(const e of events){
   const {time:t,role:r}=e,element=characters.hitElement(r,e);
   const state=equipmentState(builds,e),at=e.statSnapshot?{...e,...e.statSnapshot}:e,statState=e.statSnapshot?equipmentState(builds,at):state,values=attackBuffs(r,at,statState.panels);
   const sourceAt=role=>source(role,builds[role],e,attackBuffs(role,e,state.panels),state.buffs[role]);
   values.push(...characters.damageBuffs(r,{...e,element},state.panels,sourceAt));
   if(equipmentEvents.flat.has(e.order))values.push(effect('昔时之歌·昔时的回响',{ExtraDmgBase:equipmentEvents.flat.get(e.order)}));
   const health=currentRotation.healthAt(e);
   const x=context(r,builds[r],at,values,statState.buffs[r]),cacheKey=key(builds[r])+'/'+JSON.stringify([x.character.params,x.weapon.params,activeSetConfig(x.artifact_config,builds[r]),values,statState.buffs[r],e.index,e.category,e.nativeElement,e.furinaC6,x.skill.config]);
   let d=caches[r].get(cacheKey);
   if(!d){d=readDamage(x,r,e);caches[r].set(cacheKey,d);}
   if(e.statSnapshot){
    // A skill snapshots its caster's stats; target resistance/defense and
    // character damage modifiers still use the actual impact's state.
    const target=readDamage(context(r,builds[r],e,values,state.buffs[r]),r,e);
    d={...d,...Object.fromEntries(['def_minus','def_penetration','res_minus'].map(k=>[k,target[k]]))};
   }
    const parts=e.parts||1,multiplier=characters.instances[r].multiplier?.(e)??1;
   const talentFields=new Set(['技能倍率',...(e.talentRatioFields||[])]),talent=Object.entries(d.atk_ratio).filter(([name])=>talentFields.has(name)).reduce((n,[,v])=>m.add(n,v),0);
   let atkRatio=m.div(sum(d.atk_ratio),parts),additive=0;
   if(characters.rules[r].separateAtkRatio||e.ratio!==undefined){
    // Published damage analysis separates the talent ratio from per-hit ATK additions.
    atkRatio=m.mul(e.ratio===undefined?m.div(talent,parts):e.ratio,multiplier);
    additive=m.mul(sum(d.atk),m.sub(sum(d.atk_ratio),talent));
   }
   const echoesProbability=equipmentEvents.echoes.get(e.order),echoesRatio=m.mul(.7,echoesProbability??0);
   const hpExtra=m.add(e.hpRatioBonus??0,m.mul(d.hp_ratio['技能倍率']??0,m.sub(characters.instances[r].hpRatioMultiplier?.(e)??1,1))),hpRatio=m.add(sum(d.hp_ratio),hpExtra);
   const scaled=m.add(m.add(m.add(m.mul(sum(d.atk),atkRatio),m.div(m.mul(sum(d.hp),hpRatio),parts)),m.div(m.mul(sum(d.def),sum(d.def_ratio)),parts)),m.div(m.mul(sum(d.em),sum(d.em_ratio)),parts));
   const base=m.add(m.add(m.add(m.mul(scaled,m.add(1,sum(d.independent_damage_multiplier))),additive),m.mul(sum(d.atk),echoesRatio)),sum(d.extra_damage));
   const level=profiles[r].character.level,def=numeric.defense(level,enemy.level,sum(d.def_minus),sum(d.def_penetration));
   const res0=m.sub(enemy[element.toLowerCase()+'_res'],sum(d.res_minus)),res=numeric.resistance(res0);
   if(['RoyalLongsword','RoyalSpear','RoyalGrimoire'].includes(profiles[r].weapon.name)){
    d={...d,critical:{...d.critical}};delete d.critical['宗室被动等效'];
    const baseCritical=sum(d.critical),step=royalHit(royal[r],baseCritical,profiles[r].weapon.refine,m);royal[r]=step.state;
    d.critical['宗室·逐击概率']=m.sub(step.critical,m.min(1,m.max(0,baseCritical)));
   }
   if(equipmentWeakpoint(profiles[r],e)){d={...d,critical:{...d.critical,'命中弱点':m.sub(1,m.min(1,m.max(0,sum(d.critical))))}};}
   const cd=sum(d.critical_damage),cr=m.min(1,m.max(0,sum(d.critical)));
   const damage=numeric.damage(base,sum(d.bonus),def,res,targets,cr,cd);
   for(const k of Object.keys(totals)){totals[k]=m.add(totals[k],damage[k]);byRole[r][k]=m.add(byRole[r][k],damage[k]);}
   if(trace){
     const detail=execution.query?d:describeTeamBuffSources(x,d);
    // Describe the scored hit, not the unsplit native skill or hypothetical reactions.
    const split=values=>Object.fromEntries(Object.entries(values).map(([name,value])=>[name,m.div(value,parts)]));
    const adjusted=characters.rules[r].separateAtkRatio||e.ratio!==undefined;
    const analysis={team_hit:true,target_count:targets,element,is_heal:false,is_shield:false,normal:{...damage},
     ...Object.fromEntries(['atk','hp','def','em','extra_damage','independent_damage_multiplier','critical','critical_damage','bonus','def_minus','def_penetration','res_minus'].map(k=>[k,{...detail[k]}])),
     atk_ratio:adjusted?{'技能倍率':m.div(atkRatio,multiplier),...(multiplier===1?{}:{[characters.rules[r].ratioLabel]:m.mul(m.div(atkRatio,multiplier),multiplier-1)})}:split(d.atk_ratio),
     atk_additive_ratio:{...(adjusted?Object.fromEntries(Object.entries(d.atk_ratio).filter(([name])=>!talentFields.has(name))):{}),...(echoesProbability===undefined?{}:{[execution.query?'来歆余响4':`来歆余响4（70% × ${Number((echoesProbability*100).toFixed(2))}%）`]:echoesRatio})},
     hp_ratio:split({...d.hp_ratio,...(hpExtra===0?{}:{[characters.rules[r].hpRatioLabel]:hpExtra})}),def_ratio:split(d.def_ratio),em_ratio:split(d.em_ratio)};
    rows.push({...e,...damage,analysis,fanfare:health.fanfare,furina_overflow:health.overflow,hp_ratios:health.ratios,echoes_probability:echoesProbability,atk:sum(d.atk),hp:sum(d.hp),em:sum(d.em),crit:cr,crit_damage:cd,bonus:sum(d.bonus),flat:sum(d.extra_damage),def,res});
   }
  }
  for(const e of equipmentEvents.procs){
   const r=e.role,at=e.snapshot||e,s=equipmentState(builds,at),extra=attackBuffs(r,at,s.panels);
   if(!e.noCrit)extra.push(...characters.damageBuffs(r,{time:at.time,rootOrder:at.rootOrder,order:at.order,element:'Physical',onField:activeRole(at.time,at.rootOrder)===r},s.panels));
   const p=source(r,builds[r],at,extra,s.buffs[r]);
   const base=e.fixed??m.mul(sum(p[e.stat]),e.ratio),bonus=e.fixed===undefined?sum(p.bonus_physical):0;
   const targetState=equipmentState(builds,e),targetInput=context(r,builds[r],e,[],targetState.buffs[r]);
   const reduction=teamDpsBuffComposition(targetInput,['DefMinus','DefPenetration','ResMinusBase','ResMinusPhysical'],m);
   const level=profiles[r].character.level,def=e.ignoreDefense?1:numeric.defense(level,enemy.level,sum(reduction.DefMinus),sum(reduction.DefPenetration));
   const res0=m.sub(m.sub(enemy.physical_res,sum(reduction.ResMinusBase)),sum(reduction.ResMinusPhysical)),res=numeric.resistance(res0);
   const cr=e.noCrit?0:e.forceCritical?1:m.min(1,m.max(0,sum(p.critical))),cd=e.noCrit?0:sum(p.critical_damage),probability=e.probability??1,targetCount=e.targetCount??targets,n=m.mul(m.mul(m.mul(m.mul(m.mul(base,m.add(1,bonus)),def),res),probability),targetCount);
   const damage={non_critical:n,critical:m.mul(n,m.add(1,cd)),expectation:m.mul(n,m.add(1,m.mul(cr,cd)))};
   for(const k of Object.keys(totals)){totals[k]=m.add(totals[k],damage[k]);byRole[r][k]=m.add(byRole[r][k],damage[k]);}
   if(trace){
    const detail=execution.query?p:describeTeamBuffSources(context(r,builds[r],at,extra,s.buffs[r]),p);
    const analysis={team_hit:true,event_probability:probability,target_count:targetCount,ignore_defense:!!e.ignoreDefense,element:'Physical',normal:{...damage},is_heal:false,is_shield:false,
     atk:{...detail.atk},hp:{...detail.hp},def:{...detail.def},em:{...p.elemental_mastery},atk_ratio:e.stat==='atk'?{[e.label]:e.ratio}:{},hp_ratio:e.stat==='hp'?{[e.label]:e.ratio}:{},def_ratio:{},em_ratio:{},atk_additive_ratio:{},independent_damage_multiplier:{},
     extra_damage:e.fixed===undefined?{}:{[e.label]:e.fixed},bonus:e.fixed===undefined?{...p.bonus_physical}:{},critical:e.noCrit||e.forceCritical?{'追加攻击暴击规则':cr}:{...p.critical},critical_damage:{...p.critical_damage},def_minus:reduction.DefMinus,def_penetration:reduction.DefPenetration,res_minus:Object.fromEntries([...new Set([...Object.keys(reduction.ResMinusBase),...Object.keys(reduction.ResMinusPhysical)])].map(k=>[k,(reduction.ResMinusBase[k]||0)+(reduction.ResMinusPhysical[k]||0)]))};
    rows.push({...e,...damage,analysis,category:'equipment',part:0,onField:activeRole(e.time,e.rootOrder)===r,atk:sum(p.atk),hp:sum(p.hp),crit:cr,crit_damage:cd,bonus,flat:e.fixed||0,def,res});
   }
  }
  rows.sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||a.order-b.order);
  return {...totals,total_damage:totals.expectation,dps:m.div(totals.expectation,rotation.duration),duration:rotation.duration,character_damage:byRole,profiles,panels:builds.map((b,r)=>constraints(r,builds)),...(trace?{hits:rows,heals:resolved.heals,bonds:resolved.bonds,health:resolved.health,resources:rotation.resources,enemy}:{}),fanfare:resolved.health.reduce((v,h)=>m.max(v,h.fanfare),0),furina_overflow:resolved.health.reduce((v,h)=>m.max(v,h.overflow),0)};
 }
 return {evaluate,constraints,profiles,events};
}
