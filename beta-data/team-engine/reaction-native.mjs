import {normalizeEnemy} from '../enemy-interface.mjs';
import {teamDpsBuffComposition} from '../team-dps-public-stats.mjs';
const tables=new WeakMap(),sum=record=>Object.values(record??{}).reduce((n,v)=>n+v,0);

// Read the running kernel's level table through Bloom's unchanged 2x factor.
// These probes contain no candidate data and are cached per API and level.
export function reactionLevelBase(api,level){
 let levels=tables.get(api);if(!levels){levels=new Map();tables.set(api,levels);}
 if(!levels.has(level)){
  const input={character:{name:'Qiqi',level,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:{Qiqi:{stellar_conduct_state:false}}},weapon:{name:'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'},skill:{index:12,config:'NoConfig'},artifacts:[],artifact_config:{},buffs:[],enemy:normalizeEnemy({level:90,dendro_res:0})};
  levels.set(level,api.CalculatorInterface.get_transformative_damage(input).bloom/2);
 }
 return levels.get(level);
}

// The scalar API exposes transformative totals, not the enhancement attribute.
// Recover that attribute using the backend's calibrated native coefficient;
// the shared damage model applies the current reaction coefficient. This retains
// native weapon/set bonuses as well as explicit event-scoped effects.
export function nativeTransformativeBonus(api,input,damage,resistance,coefficient,reaction){
 const em=sum(damage.em),base=reactionLevelBase(api,input.character.level);
 const total=api.CalculatorInterface.get_transformative_damage(input)[reaction.native]/(coefficient*base*resistance)-1-16*em/(2000+em);
 const named=teamDpsBuffComposition(input,[reaction.effect])[reaction.effect];
 const remaining=total-sum(named);
 return remaining===0?named:{...named,'原生反应增益':remaining};
}
