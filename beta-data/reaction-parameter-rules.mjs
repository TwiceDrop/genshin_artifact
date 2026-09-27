import {REMAINING_CHARACTER_RULES,REMAINING_CHARACTER_NAMES} from './remaining-character-rules.mjs';
import {LUNAR_EQUIPMENT_NAMES,prepareLunarEquipmentBuffs} from './lunar-equipment-rules.mjs';
import {normalizeBuffParameters} from './buff-rule-registry.mjs';
import {LUNAR_CHARACTER_RULES,LUNAR_CHARACTER_NAMES,LUNAR_CHARACTER_ATTRIBUTES} from './lunar-character-rules.mjs';
// Eight scoped reaction parameters and two non-stacking resonances. Native values are additive deltas.
const numeric=(p,key,fallback,min=-100000)=>{
 const value=p[key]===undefined?fallback:p[key];
 if(typeof value!=='number'||!Number.isFinite(value)||value<min)throw Error('反应参数无效：'+key);
 return value;
};
export function moonOmenBonus(p){
 const element=p.element===undefined?'Pyro':p.element;
 const coefficient={Pyro:.00009,Electro:.00009,Cryo:.00009,Hydro:.000006,Geo:.0001,Anemo:.000225,Dendro:.000225}[element];
 if(coefficient===undefined)throw Error('月兆来源必须为七种元素之一，不能选物理');
 return Math.min(.36,numeric(p,'value',0,0)*coefficient);
}
export function polestarField(p){
 const stacks=numeric(p,'stacks',0,0);
 if(!Number.isInteger(stacks)||stacks>12)throw Error('极星辉域记录次数须为0～12的整数');
 const coefficient=stacks===0?1:1.4+.05*stacks;
 return {coefficient,bonus:stacks===0?.2:.28+.01*stacks,physicalShred:.4};
}
export const REACTION_PARAMETER_RULES=Object.freeze({
 ResonanceMoonOmen:p=>({EnhanceMoonReaction:moonOmenBonus(p)}),
 ResonancePolestarField:p=>{const field=polestarField(p);return {BonusCryo:field.bonus,BonusElectro:field.bonus,ResMinusPhysical:field.physicalShred,StellarConductBaseMultiplier:field.coefficient-1};},
 ElevateMoonelectro:p=>({ElevateMoonelectro:numeric(p,'p',0,-100)/100}),
 ElevateMoonbloom:p=>({ElevateMoonbloom:numeric(p,'p',0,-100)/100}),
 ElevateMoonCrystallize:p=>({ElevateMoonCrystallize:numeric(p,'p',0,-100)/100}),
 CriticalMoonReaction:p=>({CriticalMoonReaction:numeric(p,'p',0)/100}),
 CriticalDamageMoonReaction:p=>({CriticalDamageMoonReaction:numeric(p,'p',0,-100)/100}),
 MoonReactionDamageMultiplier:p=>({MoonReactionDamageMultiplier:numeric(p,'p',100,0)/100-1}),
 StellarConductBaseMultiplier:p=>({StellarConductBaseMultiplier:numeric(p,'value',0)}),
 StellarSwirlReactionCryoBaseMultiplier:p=>({StellarSwirlReactionCryoBaseMultiplier:numeric(p,'value',0)}),
});
export const REACTION_PARAMETER_NAMES=Object.freeze(Object.keys(REACTION_PARAMETER_RULES));
export const REACTION_BUFF_NAMES=Object.freeze([...REACTION_PARAMETER_NAMES,...LUNAR_CHARACTER_NAMES,...LUNAR_EQUIPMENT_NAMES,...REMAINING_CHARACTER_NAMES]);
const names=new Set(REACTION_BUFF_NAMES);
const attributes=new Set([...REACTION_PARAMETER_NAMES,'EnhanceMoonReaction','ResMinusBase','BonusCryo','BonusElectro','ResMinusPhysical',...LUNAR_CHARACTER_ATTRIBUTES,'EnhanceBurning','NahidaReactionCritRate','EnhanceStellarSuperconduct','StellarConductBaseBonus','StellarConductEnabled','StellarSwirlEnabled','StellarSwirlBaseBonus','StellarSwirlBonus','StellarSwirlFlat','StellarSwirlCritRate','StellarSwirlCritDamage','StellarSwirlElevation',...['Pyro','Cryo','Electro','Hydro','Dendro','Anemo','Geo'].map(e=>'ResMinus'+e)]);
export function collectReactionParameters(buffs=[],input={}){
 if(!Array.isArray(buffs))throw Error('反应 BUFF 列表无效');
 const values={},seen=new Set();
 for(const buff of prepareLunarEquipmentBuffs(buffs,input)){
  if(!buff||typeof buff!=='object')throw Error('反应 BUFF 条目无效');
  if(buff.lock===true)continue;
  if(buff.name==='ExtensionEffect'){
   if(names.has(buff.source_buff)){if(seen.has(buff.source_buff))continue;seen.add(buff.source_buff);}
   // Compiled effects already have named-source deduplication applied.
   for(const [key,value]of Object.entries(buff.config?.ExtensionEffect?.values||{}))if(attributes.has(key)){
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('反应原生属性无效：'+key);
    values[key]=(values[key]||0)+value;
   }
   continue;
  }
  if(!names.has(buff.name))continue;
  const raw=buff.config==='NoConfig'||buff.config===undefined?{}:buff.config?.[buff.name];
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('反应 BUFF 配置无效：'+buff.name);
  if(raw.active===false||seen.has(buff.name))continue;
  seen.add(buff.name);
  for(const [key,value]of Object.entries((REMAINING_CHARACTER_RULES[buff.name]||LUNAR_CHARACTER_RULES[buff.name]||REACTION_PARAMETER_RULES[buff.name])(normalizeBuffParameters(buff.name,raw),input)))if(attributes.has(key))values[key]=(values[key]||0)+value;
 }
 for(const value of Object.values(values))if(!Number.isFinite(value))throw Error('反应属性合计超出范围');
 return values;
}
export function lunarParameters(kind,buffs=[],{ownerId,recipientOnField,direct=true}={}){
 const suffix={'lunar-electro':'Moonelectro','lunar-bloom':'Moonbloom','lunar-crystallize':'MoonCrystallize'}[kind];
 if(!suffix)throw Error('未知月曜类型');
 if(recipientOnField!==undefined&&typeof recipientOnField!=='boolean')throw Error('反应受益者前后台状态无效');
 const values=collectReactionParameters(buffs,{character:{name:ownerId},team_effects:recipientOnField===undefined?{}:{recipient_on_field:recipientOnField}});
 const element={'lunar-electro':'Electro','lunar-bloom':'Dendro','lunar-crystallize':'Geo'}[kind];
 return {elevation:values['Elevate'+suffix]||0,
  critRate:(values.CriticalMoonReaction||0)+(kind==='lunar-bloom'?(values.CriticalMoonbloom||0):0),
  critDamage:(values.CriticalDamageMoonReaction||0)+(kind==='lunar-bloom'?(values.CriticalDamageMoonbloom||0):0)+(values['CriticalDamage'+element]||0),
  reactionBonus:(values.EnhanceMoonReaction||0)+(values['Enhance'+suffix]||0),baseBonus:values['Enhance'+suffix+'Base']||0,
  flatBonus:(values['ExtraDmg'+suffix]||0)+(kind==='lunar-crystallize'&&direct?(values.ExtraDmgDirectMoonCrystallize||0):0),
  resMinus:(values.ResMinusBase||0)+(values['ResMinus'+element]||0),multiplier:1+(values.MoonReactionDamageMultiplier||0),
  enabled:(values['Lunar'+{'lunar-electro':'Electro','lunar-bloom':'Bloom','lunar-crystallize':'Crystallize'}[kind]+'Enabled']||0)>0};
}
export function reactionResistance(resistanceMultiplier,resistanceBeforeBuffs,shred=0){
 if(resistanceBeforeBuffs===undefined){if(typeof resistanceMultiplier!=='number'||!Number.isFinite(resistanceMultiplier)||resistanceMultiplier<0)throw Error('最终抗性倍率无效');return resistanceMultiplier;}
 if(resistanceMultiplier!==undefined)throw Error('最终抗性倍率与BUFF前抗性不能同时填写');
 if(typeof resistanceBeforeBuffs!=='number'||!Number.isFinite(resistanceBeforeBuffs))throw Error('BUFF前抗性无效');
 const r=resistanceBeforeBuffs-shred;return r<0?1-r/2:r<.75?1-r:1/(4*r+1);
}
// The outer input BUFFs belong to one beneficiary, never to every contributor.
export function bindReactionBuffs(context,input,{team=false}={}){
 const {buffRecipientId,...out}=structuredClone(context);
 const own=input.character?.name;
 const id=buffRecipientId===undefined?own:buffRecipientId;
 const beneficiary=team?out.participants?.find(p=>p.id===id):out.owner;
 const recipientInput={...input,character:{...input.character,name:id},team_effects:{...input.team_effects,...(beneficiary?.recipientOnField===undefined?{}:{recipient_on_field:beneficiary.recipientOnField})}};
 const added=prepareLunarEquipmentBuffs(input.buffs||[],recipientInput).filter(b=>names.has(b.name)||(b.name==='ExtensionEffect'&&Object.keys(b.config?.ExtensionEffect?.values||{}).some(k=>attributes.has(k)))).map(b=>{
  const rule=REMAINING_CHARACTER_RULES[b.name]||LUNAR_CHARACTER_RULES[b.name];
  if(!rule)return b;
  const raw=b.config==='NoConfig'||b.config===undefined?{}:b.config?.[b.name];
  if(b.lock||raw?.active===false)return {...b,lock:true};
  const values=rule(normalizeBuffParameters(b.name,raw),recipientInput);
  return {...b,name:'ExtensionEffect',source_buff:b.name,config:{ExtensionEffect:{label:b.name,values}}};
 });
 if(buffRecipientId!==undefined&&(typeof id!=='string'||!id))throw Error('反应 BUFF 受益者 ID 无效');
 if(team){
  if(buffRecipientId!==undefined&&!out.participants?.some(p=>p.id===id))throw Error('反应 BUFF 受益者不在参与者中');
  out.participants=out.participants?.map(p=>p.id===id?{...p,buffs:[...(p.buffs||[]),...added]}:p);
 }else{
  if(buffRecipientId!==undefined&&out.owner?.id!==id)throw Error('反应 BUFF 受益者必须是伤害所有者');
  if(out.owner?.id===id)out.buffs=[...(out.buffs||[]),...added];
 }
 return out;
}
