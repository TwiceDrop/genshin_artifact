import {normalizeEnemy} from './enemy-interface.mjs';
import sets from '../src/assets/_gen_artifact.js';
const defaults=Object.fromEntries(Object.values(sets).filter(s=>(s.config2?.length||s.config4?.length)).map(s=>[
 'config_'+s.name2.replace(/([A-Z])/g,'_$1').replace(/^_/,'').toLowerCase(),
 Object.fromEntries([...(s.config2||[]),...(s.config4||[])].map(p=>[p.name,p.default]))
]));
export function normalizeBonusInput(input){
 const supplied=input.artifacts_config??input.artifact_config;
 if(supplied==null)return {...input,artifacts_config:null,artifact_config:null};
 const config={...defaults};
 for(const [key,value]of Object.entries(supplied))if(value!=null)config[key]={...(defaults[key]||{}),...value};
 // Native stat gains call this field artifacts_config; reference calculations
 // use artifact_config. Both must describe the same set activation state.
 return {...input,artifacts_config:config,artifact_config:config};
}
function normalizeInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return input;
 if(input.single_interfaces)return {...input,single_interfaces:input.single_interfaces.map(normalizeInput)};
 if(input.character&&Array.isArray(input.buffs))input={...input,buffs:input.buffs.filter(buff=>buff.lock!==true&&buff.config?.[buff.name]?.active!==false)};
 if(input.character&&input.enemy!=null)input={...input,enemy:normalizeEnemy(input.enemy)};
 if(!input.character||input.artifact_config==null)return input;
 return {...input,artifact_config:normalizeBonusInput({artifact_config:input.artifact_config}).artifact_config};
}
export function withInterfaceContracts(api){
 return Object.fromEntries(Object.entries(api).map(([name,Class])=>[name,name==='TransformativeDamage'?Class:new Proxy(Class,{get(target,method){
  const fn=Reflect.get(target,method);if(typeof fn!=='function')return fn;
  return (...args)=>{
   if(name==='BonusPerStat'&&method==='bonus_per_stat'){
    const result=fn(normalizeBonusInput(normalizeInput(args[0])));
    if(Object.values(result).some(values=>Array.isArray(values)&&values.some(value=>!Number.isFinite(value))))
     throw Error('当前目标的基准值为零或收益不是有限数，无法计算百分比收益；请调整目标或角色状态后重试。');
    return result;
   }
   try{return fn(...args.map(normalizeInput))}catch(error){
    if(name==='CommonInterface'&&method==='get_artifacts_rank_by_character'&&error?.message==='unreachable')throw Error('此目标的静态评分未实现，请使用实际单人配装');
    throw error;
   }
  };
 }})]));
}
