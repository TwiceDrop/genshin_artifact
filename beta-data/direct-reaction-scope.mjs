import {dslTokens} from './dsl-tokens.mjs';

// Public calculations accept character-owned direct hits and ordinary reactions.
// The archived native kernel is private to adapters; its hypothetical reaction
// fields must not leak through calculation, DSL, or optimization interfaces.
export const REMOVED_REACTION_KEYS=Object.freeze([
 'moonfall','moonelectro','mooncrystallize','stellarconduct','stellarswirl_anemo','stellarswirl_cryo',
]);
const removed=new Set(REMOVED_REACTION_KEYS);
const contexts=['stellar_swirl_context','lunar_crystallize_context','lunar_electro_context'];
const retiredBuff='StellarSwirlReactionCryoBaseMultiplier';
const removedError=name=>Error('独立星／月反应计算已移除：'+name+'。请改用角色技能直接造成的伤害；旧反应配置不能用于配装。');
export function assertDirectReactionDsl(source){
 if(typeof source!=='string')return;
 const tokens=dslTokens(source),damageBindings=new Set();
 for(let i=0;i<tokens.length-1;i++)if(tokens[i].value==='dmg')damageBindings.add(tokens[i+1].value);
 // Track aliases of damage objects, including parenthesized assignments.
 for(let pass=0;pass<tokens.length;pass++){
  let changed=false;
  for(let i=1;i<tokens.length-1;i++)if(tokens[i].value==='='&&tokens[i-1].type==='id'){
   let j=i+1;while(tokens[j]?.value==='(')j++;
   if(damageBindings.has(tokens[j]?.value)&&!damageBindings.has(tokens[i-1].value)){damageBindings.add(tokens[i-1].value);changed=true;}
  }
  if(!changed)break;
 }
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],previous=tokens[i-1];
  if(previous?.value==='.'&&removed.has(t.value))throw removedError(t.value);
  // Bracket access may otherwise bypass the scope check through a computed key.
  // Static field names and numeric array indices remain valid.
  if(t.value==='['&&(previous?.type==='id'||[']',')'].includes(previous?.value))){
   const key=tokens[i+1],close=tokens[i+2];
   if((damageBindings.has(previous?.value)||previous?.value===')')&&(!key||close?.value!==']'||!['string','number'].includes(key.type)))
    throw Error('DSL 属性索引请使用固定字段名称或数字；伤害类型建议写成 hit.normal.e 或 hit.direct_stellarswirl.e。');
   if(key?.type==='string'&&close?.value===']'&&removed.has(JSON.parse(key.value)))throw removedError(JSON.parse(key.value));
  }
 }
}
const ineffaSource='dmg discharge = Ineffa.VilkitaDischarge\ndmg talent = Ineffa.TalentOverclocking\nresult = discharge.normal.e + talent.direct_moonelectro.e';
function prepare(input){
 if(!input||typeof input!=='object'||ArrayBuffer.isView(input)||input instanceof ArrayBuffer)return input;
 if(Array.isArray(input))return input.map(prepare);
 for(const key of contexts)if(input[key]!=null)throw removedError(key);
 if(input.name===retiredBuff||input.source_buff===retiredBuff)throw removedError(retiredBuff);
 if(input.values&&(retiredBuff in input.values||'StellarSwirlReactionAnemoFlat' in input.values))throw removedError('反应星扩散专用属性');
 if(input.use_dsl===true)assertDirectReactionDsl(input.dsl_source);
 if(input.name==='YumemizukiMizukiStellarSwirl'&&!input.use_dsl&&[2,3].includes(input.params?.YumemizukiMizukiStellarSwirl?.mode))throw removedError('瑞希反应星扩散配装目标');
 const out={};
 for(const [key,value]of Object.entries(input))out[key]=['artifacts','sub_stats','main_stat'].includes(key)?value:prepare(value);
 if(input.name==='IneffaDefault'&&!input.use_dsl)return {...out,params:'NoConfig',use_dsl:true,dsl_source:ineffaSource};
 return out;
}
export function stripRemovedReactions(result){
 if(!result||typeof result!=='object')return result;
 const out={...result};
 for(const key of REMOVED_REACTION_KEYS)delete out[key];
 for(const key of Object.keys(out))if(key.startsWith('stellarswirl_reaction_'))delete out[key];
 for(const key of ['moonfall_compose','moonelectro_compose','mooncrystallize_compose','stellar_swirl_team_model','stellarswirl_reaction_cryo_base_multiplier','stellarswirl_vortex_coefficient'])delete out[key];
 if(out.reaction_availability)out.reaction_availability=Object.fromEntries(Object.entries(out.reaction_availability).filter(([key])=>!removed.has(key)));
 for(const key of ['reaction_model','lunar_model'])if(removed.has(out[key]?.result_key))delete out[key];
 return out;
}
const ordinaryKeys=['swirl_cryo','swirl_hydro','swirl_pyro','swirl_electro','overload','electro_charged','shatter','superconduct','bloom','hyperbloom','burgeon','burning','crystallize'];
class OrdinaryTransformativeDamage {
 constructor(native){for(const key of ordinaryKeys)this[key]=native[key];native.free?.();}
 // Existing callers can release the result; all native values were copied above.
 free(){}
}
export function withDirectReactionScope(api){
 return Object.fromEntries(Object.entries(api).map(([name,Class])=>[name,name==='TransformativeDamage'?OrdinaryTransformativeDamage:new Proxy(Class,{get(target,method){
  const fn=Reflect.get(target,method);if(typeof fn!=='function')return fn;
  return (...args)=>{
   if(name==='DSLInterface'&&method==='run')assertDirectReactionDsl(args[0]);
   const result=fn(...args.map(prepare));
   if(name==='CalculatorInterface'&&method==='get_damage_analysis')return stripRemovedReactions(result);
   if(name==='CalculatorInterface'&&method==='get_transformative_damage')return new OrdinaryTransformativeDamage(result);
   return result;
  };
 }})]));
}
