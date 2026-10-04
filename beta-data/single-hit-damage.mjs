import {EXTENSION_BUFF_REGISTRY} from './extension-buffs.mjs';
import {prepareLunarEquipmentBuffs} from './lunar-equipment-rules.mjs';
import {normalizeBuffParameters} from './buff-rule-registry.mjs';
import {NATIVE_EFFECT_ATTRIBUTES} from './buff-rule-schema.mjs';
import {reactionResistance} from './reaction-parameter-rules.mjs';
import {calculateDirectLunarDamage} from './lunar-damage.mjs';
import {calculateDirectStellarConduct} from './direct-stellar-conduct.mjs';
import {calculateBloomFamilyDamage} from './bloom-damage.mjs';
const num=(v,k,min=0)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min)throw Error('单次面板参数无效：'+k);return v;};
const native=new Set(NATIVE_EFFECT_ATTRIBUTES),repeatable=new Set(['CustomElementalBonus','EnhanceMoonReaction','EnhanceStellarGlimmerReaction','ElevateStellarGlimmerReaction']);
// No character talent or weapon effects are injected automatically into this explicit panel.
export function singleHitBuffs(buffs,character,recipientOnField){
 const context={character,team_effects:{recipient_on_field:recipientOnField}};
 const compiled=[],seen=new Set();
 for(const b of prepareLunarEquipmentBuffs(buffs||[],context)){
  const name=b.source_buff||b.name;if(b.lock||b.config?.[b.name]?.active===false)continue;
  if(!repeatable.has(name)&&seen.has(name))continue;seen.add(name);
  if(b.name==='ExtensionEffect'){compiled.push(b);continue;}
  const adapted=EXTENSION_BUFF_REGISTRY.compile(b,context);if(adapted){compiled.push(...adapted);continue;}
  // Basic published numeric fields can be expressed without invoking an old role's talents.
  if(native.has(name)){
   const p=normalizeBuffParameters(name,b.config==='NoConfig'?{}:b.config?.[name]);
   const value=p.p!==undefined?p.p/100:p.value;
   if(typeof value==='number'&&Number.isFinite(value)){compiled.push({name:'ExtensionEffect',source_buff:name,config:{ExtensionEffect:{values:{[name]:value}}}});continue;}
  }
  throw Error('手动面板尚无此BUFF配方：'+name+'；请先计入提供的面板并移除此条，或使用角色原有计算入口');
 }
 const values={};for(const b of compiled)for(const[k,v]of Object.entries(b.config?.ExtensionEffect?.values||{})){num(v,k,-1e9);values[k]=(values[k]||0)+v;}
 return {compiled,values};
}
export function calculateSingleHit(input){
 const {kind='ordinary',character,panel,buffs=[],element='Pyro',skillType='ElementalSkill',scaling='ATK',panelMode='final'}=input;
 if(!character?.name||!panel||!['final','before-buffs'].includes(panelMode))throw Error('须提供主C身份、面板及面板口径');
 if(!['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro','Physical'].includes(element)||!['NormalAttack','ChargedAttack','PlungingAttack','ElementalSkill','ElementalBurst'].includes(skillType))throw Error('伤害元素或技能类别无效');
 if(!['ATK','HP','DEF','ElementalMastery'].includes(scaling))throw Error('缩放属性无效');
 if(input.recipientOnField!==undefined&&typeof input.recipientOnField!=='boolean')throw Error('主C前后台状态无效');
 const {compiled,values:v}=singleHitBuffs(buffs,character,input.recipientOnField),before=panelMode==='before-buffs';
 const read=k=>v[k]||0;
 const stat=()=>{let total=num(panel[scaling],scaling);if(!before)return total;if(scaling==='ElementalMastery')return total+read('ElementalMastery')+read('ElementalMasteryExtra');const db=read(scaling+'Base'),dp=read(scaling+'Percentage');if(db||dp){const base=num(panel[scaling+'Base'],scaling+'Base'),percent=num(panel[scaling+'Percentage'],scaling+'Percentage',-1);total+=db*(1+percent)+(base+db)*dp;}return total+read(scaling+'Fixed')+(scaling==='ATK'?read('ATKFromSecondaryConversion'):0);};
 const em=num(panel.em??0,'EM')+(before?read('ElementalMastery')+read('ElementalMasteryExtra'):0);
 const cr=Math.min(1,num(panel.critRate??0,'暴击率')+(before?read('CriticalBase')+read('Critical'+element)+read('Critical'+skillType):0));
 const cd=num(panel.critDamage??0,'暴伤')+(before?read('CriticalDamageBase')+read('CriticalDamage'+element)+read('CriticalDamage'+skillType):0);
 const owner={id:character.name,em,critRate:cr,critDamage:cd,recipientOnField:input.recipientOnField};
 // In before-buffs mode elemental crit already entered the panel above.
 const reactionBuffs=compiled.map(b=>{const values={...b.config.ExtensionEffect.values};delete values['CriticalDamage'+element];return {...b,config:{ExtensionEffect:{...b.config.ExtensionEffect,values}}};});
 const res={resistanceBeforeBuffs:num(input.resistanceBeforeBuffs??.1,'BUFF前抗性',-100)};
 const common={buffs:reactionBuffs,...res};
 if(['bloom','hyperbloom','burgeon','burning'].includes(kind))return calculateBloomFamilyDamage({kind,owner,levelBase:input.levelBase,reactionBonus:input.reactionBonus??0,flatBonus:input.flatBonus??0,...common});
 const scaled=stat(),mult=num(input.skillMultiplier??1,'技能倍率'),flat=num(input.flatBonus??0,'定额');
 if(kind.startsWith('lunar-'))return calculateDirectLunarDamage({kind,owner,scalingStat:scaled,skillMultiplier:mult,flatBonus:flat,baseBonus:input.baseBonus??0,lunarBonus:input.reactionBonus??0,elevation:input.elevation??0,...common});
 if(kind==='stellar-conduct')return calculateDirectStellarConduct({owner,element,scalingStat:scaled,skillMultiplier:mult,baseMultiplier:input.baseMultiplier??1,baseBonus:input.baseBonus??0,reactionBonus:input.reactionBonus??0,elevation:input.elevation??0,flatBonus:flat,...common});
 let n;
 if(kind==='stellar-swirl'){
  if(element!=='Anemo')throw Error('直接星扩散为风伤，冰风涡请使用多人反应入口');
  const main=scaled*mult*(1+num(input.baseBonus??0,'基础提升')+read('StellarSwirlBaseBonus'))*(1+6*em/(em+2000)+num(input.reactionBonus??0,'反应增伤')+read('StellarSwirlBonus'))*(1+read('StellarSwirlIndependentBaseMultiplier'));
  const rate=Math.min(1,cr+read('StellarSwirlCritRate')),damage=cd+read('StellarSwirlCritDamage');
  n=(main+flat+read('StellarSwirlFlat'))*reactionResistance(undefined,res.resistanceBeforeBuffs,read('ResMinusBase')+read('ResMinusAnemo'))*(1+num(input.elevation??0,'擢升')+read('StellarSwirlElevation'));
  return result(n,rate,damage,{kind,scalingStat:scaled,em});
 }
 if(kind!=='ordinary')throw Error('未知单次伤害类型');
 const bonus=num(panel.damageBonus??0,'普通伤害加成',-1)+(before?read('BonusBase')+read('Bonus'+element)+read('Bonus'+skillType):0);
 const additive=flat+read('ExtraDmgBase')+read('ExtraDmg'+element)+read('ExtraDmg'+skillType);
 const al=num(input.characterLevel??90,'主C等级'),el=num(input.enemyLevel??90,'敌人等级');
 const def=Math.min(.9,num(input.defMinus??0,'减防')+read('DefMinus')),pen=Math.min(1,read('DefPenetration'));
 const defense=(al+100)/((al+100)+(el+100)*(1-def)*(1-pen));
 n=(scaled*mult*(1+read('IndependentBaseMultiplier'))+additive)*(1+bonus)*defense*reactionResistance(undefined,res.resistanceBeforeBuffs,read('ResMinusBase')+read('ResMinus'+element));
 return result(n,cr,cd,{kind,scalingStat:scaled,em,defenseMultiplier:defense});
}
function result(n,cr,cd,extra){num(n,'伤害结果');return {...extra,non_critical:n,critical:n*(1+cd),expectation:n*(1+cr*cd),is_heal:false,is_shield:false};}
