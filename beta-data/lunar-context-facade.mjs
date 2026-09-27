import {calculateSingleHit} from './single-hit-damage.mjs';
import {calculateBloomFamilyDamage} from './bloom-damage.mjs';
import {bindReactionBuffs} from './reaction-parameter-rules.mjs';
import {calculateDirectStellarConduct} from './direct-stellar-conduct.mjs';
import {calculateLunarCrystallizeTeam,calculateDirectLunarDamage,calculateLunarElectroTeam} from './lunar-damage.mjs';
const nativeRole=name=>['Vodyanitsa','Vesna'].includes(name);
export const hasLunarContext=input=>!!(input?.lunar_crystallize_context||input?.lunar_electro_context||input?.direct_lunar_context||input?.ordinary_bloom_context);
function inspectInputs(args){
 const contexts=[],seen=new WeakSet();
 const walk=x=>{
  if(!x||typeof x!=='object'||ArrayBuffer.isView(x)||x instanceof ArrayBuffer||seen.has(x))return;
  seen.add(x);
  if(x.single_hit_context||hasLunarContext(x)||x.stellar_swirl_context||x.direct_stellar_context)contexts.push(x);
  if(x.character&&Array.isArray(x.buffs))for(const buff of x.buffs){
   if(!['IndependentDamageMultiplier','StellarSwirlDamageMultiplier'].includes(buff.name))continue;
   const p=buff.config?.[buff.name]||{};
   if(p.active===false)continue;
   if(buff.name==='IndependentDamageMultiplier'&&p.scope!==undefined&&p.scope!==0&&p.scope!=='ordinary')throw Error('普通独立伤害倍率仅适用于普通伤害；直接星扩散请使用专属倍率。');
   if(buff.name==='StellarSwirlDamageMultiplier'&&!nativeRole(x.character.name))throw Error('旧角色原内核尚未接入直接星扩散专属倍率。');
  }
  for(const value of Object.values(x))walk(value);
 };
 args.forEach(walk);
 return contexts;
}

// Explicit reaction panels are single-hit inputs. They must never be held fixed
// while a caller changes candidate artifacts to claim optimization or gain curves.
export function withLunarDamageContexts(base){
 return Object.fromEntries(Object.entries(base).map(([name,Class])=>[name,name==='TransformativeDamage'?Class:new Proxy(Class||{}, {get(target,method){
  const fn=Reflect.get(target,method);
  if(typeof fn!=='function')return fn;
  return (...args)=>{
   const contexts=inspectInputs(args);
   if(!contexts.length)return fn(...args);
   if(name!=='CalculatorInterface'||method!=='get_damage_analysis'||contexts.length!==1||contexts[0]!==args[0])throw Error('手填星／月反应面板仅支持单次伤害计算，不能用于配装、词条收益、DSL或队伍优化。');
   const input=args[0];
   if(input.single_hit_context){if(hasLunarContext(input)||input.direct_stellar_context||input.stellar_swirl_context)throw Error('单次面板不能与其他反应上下文同时提供');return {single_hit:calculateSingleHit({...input.single_hit_context,character:input.character,buffs:input.buffs}),reaction_model:{input_mode:'explicit-single-hit-panels',formula_version:'7.1.07'}};}
   if(!hasLunarContext(input)&&!input.direct_stellar_context)return fn(...args);
   const contextKeys=['lunar_crystallize_context','lunar_electro_context','direct_lunar_context','direct_stellar_context','ordinary_bloom_context'];
   if(contextKeys.filter(k=>input[k]).length>1)throw Error('请分别计算不同反应类型，不能合并为同一段伤害。');
   const {lunar_crystallize_context,lunar_electro_context,direct_lunar_context,direct_stellar_context,ordinary_bloom_context,...ordinary}=input;
   let key,calculated;
   if(ordinary_bloom_context){key=ordinary_bloom_context.kind;calculated=calculateBloomFamilyDamage(bindReactionBuffs(ordinary_bloom_context,input));}
   else if(lunar_crystallize_context){key='mooncrystallize';calculated=calculateLunarCrystallizeTeam(bindReactionBuffs(lunar_crystallize_context,input,{team:true}));}
   else if(lunar_electro_context){key='moonelectro';calculated=calculateLunarElectroTeam(bindReactionBuffs(lunar_electro_context,input,{team:true}));}
   else if(direct_stellar_context){key='direct_stellarconduct';calculated=calculateDirectStellarConduct(bindReactionBuffs(direct_stellar_context,input));}
   else {key={'lunar-crystallize':'direct_mooncrystallize','lunar-bloom':'direct_moonbloom','lunar-electro':'direct_moonelectro'}[direct_lunar_context.kind];calculated=calculateDirectLunarDamage(bindReactionBuffs(direct_lunar_context,input));}
   const result=fn(ordinary,...args.slice(1));
   result[key]=calculated;
   result.reaction_availability={...(result.reaction_availability||{}),[key]:{status:'calibrated',scope:'explicit-single-hit-panels'}};
   result.reaction_model={input_mode:'explicit-single-hit-panels',formula_version:'7.1-scoped-reaction-parameters',result_key:key,
    ...(calculated.three_hit_expectation===undefined?{}:{three_hit_expectation:calculated.three_hit_expectation}),
    ...(calculated.owner?{owner:calculated.owner.id}:{})};
   if(!direct_stellar_context&&!ordinary_bloom_context)result.lunar_model=result.reaction_model;
   return result;
  };
 }})]));
}
