import {BUFF_RULE_SCHEMA,NATIVE_EFFECT_ATTRIBUTES} from './buff-rule-schema.mjs';

const ELEMENTS=['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro','Physical'];
const nativeAttributes=new Set(NATIVE_EFFECT_ATTRIBUTES);
const stellarAttributes={flat:'StellarSwirlFlat',base:'StellarSwirlBaseBonus',bonus:'StellarSwirlBonus',crit_rate:'StellarSwirlCritRate',crit_damage:'StellarSwirlCritDamage',elevation:'StellarSwirlElevation',anemo_res:'ResMinusAnemo'};
const numeric=new Set(['float','floatInput','floatPercentageInput','int','intInput','option']);
const copy=x=>Array.isArray(x)?[...x]:x;

export function normalizeBuffParameters(name,raw={}){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw Error('BUFF 配置无效：'+name);
 // The former scope selector is no longer a valid way to grant reaction
 // multipliers. Reject such saved inputs instead of silently changing damage.
 if(name==='IndependentDamageMultiplier'&&raw.scope!==undefined){
  if(raw.scope!==0&&raw.scope!=='ordinary'){
   throw Error('普通独立伤害倍率不支持 scope 切换；旧星扩散/双范围配置请改用单独的「星扩散伤害倍率」BUFF');
  }
  raw={...raw,scope:0};
 }
 const schema=BUFF_RULE_SCHEMA[name],out={...raw};
 for(const field of schema?.fields||[]){
  const value=raw[field.name]===undefined?copy(field.default):raw[field.name];
  const fail=()=>{throw Error((schema.label||name)+'：参数 '+field.name+' 无效');};
  if(numeric.has(field.type)){
   if(typeof value!=='number'||!Number.isFinite(value))fail();
   if(['int','intInput','option'].includes(field.type)&&!Number.isInteger(value))fail();
   if(field.min!==undefined&&value<field.min||field.max!==undefined&&value>field.max)fail();
   if(field.type==='option'&&(value<0||value>=field.optionCount))fail();
  }else if(field.type==='bool'){
   if(typeof value!=='boolean')fail();
  }else if(field.type==='element4'||field.type==='element8'){
   if(!(field.type==='element4'?ELEMENTS.slice(0,4):ELEMENTS).includes(value))fail();
  }else if(field.type==='element8multi'){
   if(!Array.isArray(value)||value.some(x=>!ELEMENTS.includes(x)))fail();
  }else fail();
  out[field.name]=copy(value);
 }
 return out;
}

export function createBuffRuleRegistry(definitions){
 const rules=Object.freeze({...definitions});
 return Object.freeze({
  names:Object.freeze(Object.keys(rules)),
  has:name=>Object.hasOwn(rules,name),
  compile(buff,input){
   if(!Object.hasOwn(rules,buff.name))return null;
   if(buff.lock===true)return [];
   const raw=buff.config==='NoConfig'||buff.config==null?{}:buff.config?.[buff.name]??{};
   if(raw.active===false)return [];
   const p=normalizeBuffParameters(buff.name,raw);
   const effects=rules[buff.name](p,input)||{};
   const {star={},...values}=effects;
   for(const [key,value]of Object.entries(star)){
    if(!stellarAttributes[key])throw Error('未知星扩散效果：'+key);
    values[stellarAttributes[key]]=(values[stellarAttributes[key]]||0)+value;
   }
   for(const [key,value]of Object.entries(values)){
    if(!nativeAttributes.has(key)||typeof value!=='number'||!Number.isFinite(value))throw Error('BUFF 效果无效：'+buff.name+' / '+key);
   }
   if(!Object.keys(values).length)return [];
   const label=BUFF_RULE_SCHEMA[buff.name]?.label||buff.name;
   return [{...buff,name:'ExtensionEffect',source_buff:buff.name,config:{ExtensionEffect:{label:'BUFF: '+label,values}}}];
  }
 });
}
