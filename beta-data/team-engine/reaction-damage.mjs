import {STELLAR_DAMAGE_FIELDS} from './native-damage-fields.mjs';
import {numericSum,scaleTalentPart} from './rule-utils.mjs';
import {transformativeReactions} from './transformative-reactions.mjs';
export {STELLAR_DAMAGE_FIELDS};

export const transformativeModels=Object.values(transformativeReactions).map(reaction=>({id:reaction.id,evaluate(e,{math:m,numeric,enemy,trace,nativeReactionAt,reactionLevelBase,resolveContacts}){
 const sum=numericSum(m),base=reactionLevelBase(e.role);
 return resolveContacts(e,(ids,_advance,diagnose)=>{
  const native=nativeReactionAt(e,ids),d=native.damage,em=sum(d.em),bonus=sum(d[reaction.bonus]),res=numeric.resistance(m.sub(enemy[reaction.element.toLowerCase()+'_res'],sum(d.res_minus)));
  const damage=numeric.transformative(reaction.coefficient,base,em,bonus,res,m.mul(ids.length,e.enabled??1));let row;
  if(trace&&diagnose){
   const detail=native.describe(d),normal={...damage};
   row={...e,...damage,damageKind:reaction.kind,atk:sum(d.atk),hp:sum(d.hp),em,crit:0,crit_damage:0,bonus,flat:0,def:1,res,
    fanfare:native.health.fanfare,furina_overflow:native.health.overflow,hp_ratios:native.health.ratios,
    analysis:{team_hit:true,damage_kind:reaction.kind,ignore_defense:true,target_count:ids.length,element:reaction.element,is_heal:false,is_shield:false,
     atk:detail.atk,hp:detail.hp,def:detail.def,em:detail.em,res_minus:detail.res_minus,[reaction.bonus]:detail[reaction.bonus],
     atk_ratio:{},hp_ratio:{},def_ratio:{},em_ratio:{},atk_additive_ratio:{},extra_damage:{},independent_damage_multiplier:{},bonus:{},critical:{},critical_damage:{},def_minus:{},def_penetration:{},
     reaction_level_base:base,reaction_coefficient:reaction.coefficient,reaction_bonus:bonus,[reaction.native]:normal,normal}};
  }
  return {damage,critical:0,row};
 },{critical:false});
}}));
export const superconductModel=transformativeModels.find(model=>model.id==='reaction.superconduct');

// Direct stellar damage is independent of skill category. Its lifecycle,
// snapshots, finite effects and critical observations use the same services as
// native skill damage. The field coefficient is supplied by the reaction state
// at impact; it is not inferred from party elements here.
export const stellarConductModel={id:'reaction.stellarConduct',evaluate(e,context){
 const {math:m,numeric,enemy,trace,nativeDamageAt,createCriticalResolver,resolveContacts}=context;
 const sum=numericSum(m),criticalFor=createCriticalResolver(e);
 return resolveContacts(e,(ids,advance,diagnose)=>{
  const native=nativeDamageAt(e,ids),resolved=criticalFor(native.damage,advance,sum(native.damage.critical_stellarconduct)),d=resolved.damage;
  const em=sum(d.em),ratio=scaleTalentPart(m,e,e.stellarRatio??sum(d.direct_stellarconduct_ratio)),coefficient=e.stellarCoefficient??1;
  const cr=resolved.critical,cd=m.add(sum(d.critical_damage),sum(d.critical_damage_stellarconduct));
  const flat=sum(d.direct_stellarconduct_extra_fixed),bonus=m.sub(sum(d.direct_stellarconduct_compose),m.div(m.mul(6,em),m.add(2000,em)));
  const res=numeric.resistance(m.sub(enemy[e.element.toLowerCase()+'_res'],sum(d.res_minus)));
  const damage=numeric.stellarConduct({base:m.mul(e.stellarIndependent??1,m.add(m.mul(e.stellarScaling==='em'?em:sum(d.atk),ratio),sum(d.direct_stellarconduct_extra_damage))),coefficient,
   baseBonus:sum(d.direct_stellarconduct_base_compose),em,bonus,independent:sum(d.stellar_glimmer_reaction_damage_multiplier),flat,
   elevation:m.add(sum(d.elevate_stellarconduct_compose),sum(d.elevate_stellar_glimmer_reaction_compose)),resistance:res,
   targets:m.mul(ids.length,e.enabled??1),critical:cr,criticalDamage:cd});
  let row;
  if(trace&&diagnose){
   const detail=native.describe(d),normal={...damage},analysis={team_hit:true,damage_kind:'stellarConduct',ignore_defense:true,target_count:ids.length,element:e.element,is_heal:false,is_shield:false,
    ...Object.fromEntries(['atk','hp','def','em','res_minus',...STELLAR_DAMAGE_FIELDS].map(k=>[k,{...detail[k]}])),
    atk_ratio:{},hp_ratio:{},def_ratio:{},em_ratio:{},atk_additive_ratio:{},extra_damage:{},independent_damage_multiplier:{},bonus:{},def_minus:{},def_penetration:{},
    critical:{...detail.critical},critical_damage:{...detail.critical_damage},direct_stellarconduct_base_multiplier:coefficient,
    direct_stellarconduct_ratio:e.stellarRatio===undefined?Object.fromEntries(Object.entries(detail.direct_stellarconduct_ratio).map(([k,v])=>[k,scaleTalentPart(m,e,v)])):{'事件倍率':ratio},
    direct_stellarconduct:normal,normal};
   row={...e,...damage,damageKind:'stellarConduct',analysis,atk:sum(d.atk),hp:sum(d.hp),em,crit:cr,crit_damage:cd,bonus,flat,def:1,res,
    fanfare:native.health.fanfare,furina_overflow:native.health.overflow,hp_ratios:native.health.ratios};
  }
  return {damage,critical:cr,row};
 });
}};

// Both direct stellar families use the existing numerical rule. Their native
// fields and field multiplier differ; natural swirl uses its own contributor model.
export const directStellarSwirlModel={id:'direct.stellarSwirl',evaluate(e,context){
 const rename=name=>name.replaceAll('stellarconduct','stellarswirl');
 const adapt=d=>({...d,...Object.fromEntries(STELLAR_DAMAGE_FIELDS.map(name=>[name,d[rename(name)]]))});
 const result=stellarConductModel.evaluate({...e,stellarCoefficient:1},{...context,nativeDamageAt(event,ids){const n=context.nativeDamageAt(event,ids);return {...n,damage:adapt(n.damage),describe:d=>adapt(n.describe(d))};}});
 for(const row of Array.isArray(result.row)?result.row:result.row?[result.row]:[]){row.damageKind='stellarSwirl';row.analysis=Object.fromEntries(Object.entries(row.analysis).map(([name,value])=>[rename(name),value]));row.analysis.damage_kind='stellarSwirl';}
 return result;
}};
