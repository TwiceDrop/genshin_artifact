import {createTeamNumericRules} from '../team-dps-numeric-rules.mjs';
import {normalizeEnemy} from '../enemy-interface.mjs';
import {numericSum} from './rule-utils.mjs';

export const STELLAR_DAMAGE_FIELDS=[
 'direct_stellarconduct_ratio','direct_stellarconduct_compose','direct_stellarconduct_base_compose',
 'direct_stellarconduct_extra_damage','direct_stellarconduct_extra_fixed',
 'critical_stellarconduct','critical_damage_stellarconduct','elevate_stellarconduct_compose',
 'elevate_stellar_glimmer_reaction_compose','stellar_glimmer_reaction_damage_multiplier',
];

// A reaction is a damage type, independent of the skill/attack which caused it.
// Neither branch reads ordinary DMG Bonus or the enemy's defense multiplier.
export function createReactionDamageRules(api,math){
 const m=math,numeric=createTeamNumericRules(m),sum=numericSum(m),levels=new Map();
 function levelBase(level){
  if(!levels.has(level)){
   // Read the running kernel's level table through Bloom's stable 2x factor.
   // Superconduct itself still uses the obsolete 0.5x factor in this kernel.
   const x={character:{name:'Qiqi',level,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:{Qiqi:{stellar_conduct_state:false}}},weapon:{name:'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'},skill:{index:12,config:'NoConfig'},artifacts:[],artifact_config:{},buffs:[],enemy:normalizeEnemy({level:90,dendro_res:0})};
   levels.set(level,api.CalculatorInterface.get_transformative_damage(x).bloom/2);
  }
  return levels.get(level);
 }
 return {score(event,d,{level,enemy,rotation,targets,superconductBonus=0}){
  if(!['stellarConduct','superconduct'].includes(event.damageKind))return null;
  const res=numeric.resistance(m.sub(enemy[event.element.toLowerCase()+'_res'],sum(d.res_minus))),em=sum(d.em);
  const analysis={team_hit:true,damage_kind:event.damageKind,ignore_defense:true,target_count:targets,element:event.element,is_heal:false,is_shield:false,
   atk:d.atk,hp:d.hp,def:d.def,em:d.em,atk_ratio:{},hp_ratio:{},def_ratio:{},em_ratio:{},atk_additive_ratio:{},extra_damage:{},independent_damage_multiplier:{},bonus:{},def_minus:{},def_penetration:{},res_minus:d.res_minus};
  let damage,cr=0,cd=0,flat=0,bonus=superconductBonus;
  if(event.damageKind==='superconduct'){
   const base=levelBase(level);
   damage=numeric.superconduct(base,em,superconductBonus,res,targets);
   Object.assign(analysis,{reaction_level_base:base,reaction_coefficient:1.5,reaction_bonus:superconductBonus,critical:{},critical_damage:{}});
  }else{
   const coefficient=rotation.combatAt(event).reaction.coefficient,ratio=m.div(sum(d.direct_stellarconduct_ratio),event.parts||1);
   cr=m.min(1,m.max(0,m.add(sum(d.critical),sum(d.critical_stellarconduct))));cd=m.add(sum(d.critical_damage),sum(d.critical_damage_stellarconduct));
   flat=sum(d.direct_stellarconduct_extra_fixed);
   // Native compose already contains EM; keep EM visible in the damage trace
   // while supplying it exactly once to the shared CPU/GPU arithmetic.
   bonus=m.sub(sum(d.direct_stellarconduct_compose),m.div(m.mul(6,em),m.add(2000,em)));
   damage=numeric.stellarConduct({base:m.add(m.mul(sum(d.atk),ratio),sum(d.direct_stellarconduct_extra_damage)),coefficient,baseBonus:sum(d.direct_stellarconduct_base_compose),em,bonus,
    independent:sum(d.stellar_glimmer_reaction_damage_multiplier),flat,elevation:m.add(sum(d.elevate_stellarconduct_compose),sum(d.elevate_stellar_glimmer_reaction_compose)),resistance:res,targets,critical:cr,criticalDamage:cd});
   Object.assign(analysis,Object.fromEntries(STELLAR_DAMAGE_FIELDS.map(k=>[k,d[k]??{}])),{direct_stellarconduct_base_multiplier:coefficient,
    direct_stellarconduct_ratio:Object.fromEntries(Object.entries(d.direct_stellarconduct_ratio).map(([k,v])=>[k,m.div(v,event.parts||1)])),critical:d.critical,critical_damage:d.critical_damage,direct_stellarconduct:damage});
  }
  analysis.normal=damage;
  return {damage,analysis,stats:{atk:sum(d.atk),hp:sum(d.hp),em,crit:cr,crit_damage:cd,bonus,flat,def:1,res}};
 }};
}
