import {collectReactionParameters,reactionResistance} from './reaction-parameter-rules.mjs';
const finite=(x,name,min=0)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min)throw Error('星超导参数无效：'+name);return x;};
// One owner's skill hit, not a transformative reaction or party composition.
export function calculateDirectStellarConduct(input){
 const allowed=['owner','scalingStat','skillMultiplier','baseMultiplier','baseBonus','reactionBonus','independentMultiplier','flatBonus','elevation','resistanceMultiplier','resistanceBeforeBuffs','buffs','element'];
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('星超导参数含未知字段');
 const {owner}=input;
 if(!owner||Object.keys(owner).some(k=>!['id','em','critRate','critDamage','recipientOnField'].includes(k))||typeof owner.id!=='string'||!owner.id.trim())throw Error('星超导伤害所有者无效');
 if(!['Cryo','Electro'].includes(input.element))throw Error('星超导必须明确冰或雷伤害');
 const em=finite(owner.em,'精通'),cr=finite(owner.critRate,'暴击率'),cd=finite(owner.critDamage,'暴击伤害');
 if(cr>1)throw Error('星超导暴击率不能超过1');
 const values=collectReactionParameters(input.buffs,{character:{name:owner.id},team_effects:{recipient_on_field:owner.recipientOnField}});
 const coefficient=finite(finite(input.baseMultiplier,'极星系数')+(values.StellarConductBaseMultiplier||0),'最终极星系数');
 const main=finite(input.scalingStat,'面板')*finite(input.skillMultiplier,'技能倍率')*coefficient
  *(1+finite(input.baseBonus===undefined?0:input.baseBonus,'基础提升',-1)+(values.StellarConductBaseBonus||0))
  *(1+6*em/(em+2000)+finite(input.reactionBonus===undefined?0:input.reactionBonus,'星反应增伤',-1)+(values.EnhanceStellarSuperconduct||0))
  *finite(input.independentMultiplier===undefined?1:input.independentMultiplier,'星专属独立倍率');
 const n=(main+finite(input.flatBonus===undefined?0:input.flatBonus,'定额'))*reactionResistance(input.resistanceMultiplier,input.resistanceBeforeBuffs,(values.ResMinusBase||0)+(values['ResMinus'+input.element]||0))*(1+finite(input.elevation===undefined?0:input.elevation,'擢升',-1));
 const c=finite(n*(1+cd),'暴击结果'),e=finite(n*(1+cr*cd),'期望结果');
 return {kind:'direct-stellarconduct',element:input.element,coefficient,owner:{...owner},non_critical:n,critical:c,expectation:e,n,c,e,is_heal:false,is_shield:false};
}
