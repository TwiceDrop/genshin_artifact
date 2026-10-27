import {collectReactionParameters,reactionResistance} from './reaction-parameter-rules.mjs';
const number=(x,k,min=0)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min)throw Error('绽放参数无效：'+k);return x;};
// Ordinary cores remain transformative damage, even when Lunar Bloom is enabled.
export function calculateBloomFamilyDamage(input){
 const {kind,owner,levelBase,buffs=[],reactionBonus=0,flatBonus=0,resistanceMultiplier,resistanceBeforeBuffs}=input;
 if(!['bloom','hyperbloom','burgeon','burning'].includes(kind)||!owner?.id)throw Error('须明确普通绽放类型和实际触发者');
 if(owner.recipientOnField!==undefined&&typeof owner.recipientOnField!=='boolean')throw Error('反应受益者前后台状态无效');
 const values=collectReactionParameters(buffs,{character:{name:owner.id},team_effects:owner.recipientOnField===undefined?{}:{recipient_on_field:owner.recipientOnField}});
 const em=number(owner.em,'触发者精通'),level=number(levelBase,'触发者等级基础值');
 const bonus=number(reactionBonus,'反应增伤',-1)+(values['Enhance'+{bloom:'Bloom',hyperbloom:'Hyperbloom',burgeon:'Burgeon',burning:'Burning'}[kind]]||0);
 const flat=number(flatBonus,'定额')+(kind==='burning'?0:(values.BloomFamilyFlat||0));
 const r=reactionResistance(resistanceMultiplier,resistanceBeforeBuffs,(values.ResMinusBase||0)+(values[kind==='burning'?'ResMinusPyro':'ResMinusDendro']||0));
 const nahida=values.NahidaReactionCritRate||0;
 const cr=Math.max(0,Math.min(1,nahida+(kind==='burning'?0:(values.BloomFamilyCritRate||0)))),cd=Math.max(nahida>0?1:0,kind==='burning'?0:(values.BloomFamilyCritDamage||0));
 const n=(level*(kind==='burning'?.25:kind==='bloom'?2:3)*(1+16*em/(em+2000)+bonus)+flat)*r;
 const c=number(n*(1+cd),'暴击伤害'),e=number(n*(1+cr*cd),'期望');
 return {kind,owner:{id:owner.id,em},non_critical:n,critical:c,expectation:e,n,c,e,fixed_crit_rate:cr,fixed_crit_damage:cd,is_heal:false,is_shield:false};
}
