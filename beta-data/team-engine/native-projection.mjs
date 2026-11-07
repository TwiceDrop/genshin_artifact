import {LEGACY_EFFECT_SLOTS} from '../legacy-effect-slots.mjs';
import {nativeBackends} from './native-bindings.mjs';
import {isStellarConduct,isStellarSwirl} from './native-damage-fields.mjs';
import {transformativeReaction} from './transformative-reactions.mjs';
const categories={normal:['NormalAttack',1],charged:['ChargedAttack',2],plunge:['PlungingAttack',3],skill:['ElementalSkill',4],burst:['ElementalBurst',5],other:[null,0]};
const elements={Electro:6,Pyro:7,Hydro:8,Cryo:9,Anemo:10,Geo:11,Dendro:12,Physical:13};
// A selector reads the concrete variant prepared by the owning character.
// Candidate-dependent numeric values belong in math expressions, not this key.
export function createNativeDamageProjector(extensionSlots){
 const cache=new Map();
 return (character,input,event)=>{
  const declaration=character.nativeDamage?.[event.index];
  if(!declaration)throw Error('角色未声明原生公式类型：'+character.id+'/'+event.index);
  const selected=typeof declaration==='function'?declaration({input,event}):declaration;
  const reaction=transformativeReaction(event);
  const shape={...selected,element:reaction?.element??(isStellarSwirl(event)?event.nativeElement??selected.element:selected.infusable===false?selected.element:event.nativeElement??selected.element),...(isStellarConduct(event)?{kind:'stellarConduct'}:isStellarSwirl(event)?{kind:'stellarSwirl'}:reaction?{kind:'transformative',bonus:reaction.bonus,effect:reaction.effect,effects:reaction.effects}:{})},key=JSON.stringify([character.nativeBackend,shape]);
  if(!cache.has(key))cache.set(key,nativeDamageProjection(shape,nativeBackends[character.nativeBackend],extensionSlots));
  return cache.get(key);
 };
}
// Calibrated ABI layouts are backend data. Characters only name the native
// formula's damage type/element; this does not infer mechanics from hit labels.
export function nativeDamageProjection(shape,{extension,slot,stellarConduct,stellarSwirl,effectSlots},extensionSlots){
 const slots=extension?{...extensionSlots,...effectSlots}:LEGACY_EFFECT_SLOTS;
 const panel={atk:[6,27,28,29].map(slot),hp:[23,24,25].map(slot),def:[31,32,33].map(slot),em:[4,5].map(slot)};
 if(shape.kind==='healing')return {...panel,healing_bonus:[slots.HealingBonus]};
 if(shape.kind==='transformative')return {...panel,[shape.bonus]:(shape.effects??[shape.effect]).map(name=>slots[name]),res_minus:[slots.ResMinusBase,slots['ResMinus'+shape.element]]};
 if(shape.kind==='stellarConduct'){
  if(!stellarConduct)throw Error('当前原生后端未提供星超导字段布局');
  return {...panel,...stellarConduct,critical:[slot(37)],critical_damage:[slot(52)],res_minus:[slots.ResMinusBase,slots['ResMinus'+shape.element]]};
 }
 if(shape.kind==='stellarSwirl')return {...panel,...stellarSwirl,...(extension?{
  critical_stellarswirl:[...stellarSwirl.critical_stellarswirl,slots['Critical'+shape.element]],
  critical_damage_stellarswirl:[...stellarSwirl.critical_damage_stellarswirl,slots['CriticalDamage'+shape.element]],
 }:{}),critical:[slot(37)],critical_damage:[slot(52)],res_minus:[slots.ResMinusBase,slots['ResMinus'+shape.element]]};
 const category=categories[shape.category],element=elements[shape.element];
 if(!category||element===undefined)throw Error('原生伤害类型或元素未声明');
 const [suffix,categoryOffset]=category,elementName=shape.element;
 const typed=name=>suffix?[slots[name+suffix]]:[];
 const ratio=(name,base)=>extension?[slots[name+'Base'],...typed(name),slots[name+elementName]]:[base,...(categoryOffset?[base+categoryOffset]:[]),base+element];
 return {...panel,
  atk_ratio:ratio('ATKRatio',176),hp_ratio:ratio('HPRatio',148),def_ratio:ratio('DEFRatio',162),
  extra_damage:[slots.ExtraDmgBase,...typed('ExtraDmg'),...(shape.plungeImpact?[slots.ExtraDmgPlungingAttackLowHigh]:[]),slots['ExtraDmg'+elementName]],
  bonus:[slots.BonusBase,...typed('Bonus'),...(extension&&shape.plungeImpact?[slots.BonusPlungingImpact]:[]),slots['Bonus'+elementName],...(shape.category==='normal'&&elementName!=='Physical'?[slots.BonusNormalAndElemental]:[])],
  critical:[slots.CriticalBase,slots.CriticalAttacking,...typed('Critical'),slots['Critical'+elementName]],
  critical_damage:[slots.CriticalDamageBase,...typed('CriticalDamage'),slots['CriticalDamage'+elementName]],
  ...(!extension?{independent_damage_multiplier:[146]}:{}),
  def_minus:[slots.DefMinus],def_penetration:[slots.DefPenetration],res_minus:[slots.ResMinusBase,slots['ResMinus'+elementName]],
 };
}
