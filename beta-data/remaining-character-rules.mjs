// 7.1.07: explicit single-hit source state, not a combat timeline.
const n=(p,k,d,min=0,max=100000,int=false)=>{const v=p[k]===undefined?d:p[k];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v)))throw Error('角色BUFF参数无效：'+k);return v;};
const b=(p,k,d=true)=>{const v=p[k]===undefined?d:p[k];if(typeof v!=='boolean')throw Error('角色BUFF开关无效：'+k);return v;};
const field=(p,i)=>b({v:i?.team_effects?.recipient_on_field??p.recipient_on_field},'v');
const traveler=i=>/^(Aether|Lumine)(Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)$/.test(i?.character?.name||'');
const cryoTraveler=i=>['AetherCryo','LumineCryo'].includes(i?.character?.name);
export const ALYOSHA_PRECISION=Object.freeze([.1166,.1272,.1378,.1484,.159,.1696,.1802,.1908,.2014,.212,.2247,.2374,.2502,.2629,.2756]);
const durinElement=(p,shred)=>{const index=n(p,'reaction_element',0,0,6,true),e=['','Dendro','Electro','Anemo','Geo','Hydro','Cryo'][index];if(!e)throw Error('杜林BUFF须明确本次反应的另一元素');if(shred&&['Hydro','Cryo'].includes(e))throw Error('杜林白焰减抗不由蒸发或融化触发');return e;};
export const REMAINING_CHARACTER_RULES=Object.freeze({
 CynoC2StellarConduct:p=>b(p,'effect_active')?{EnhanceStellarSuperconduct:.1*n(p,'stack',5,0,5)}:{},
 KleeC1:(p,i)=>i?.character?.name==='Klee'&&b(p,'hexerei_secret_rite')&&b(p,'effect_active')?{ATKPercentage:.6}:{},
 TravelerElements:(p,i)=>{if(!traveler(i))return {};const out={};for(const[k,a,v]of [['anemo','CriticalBase',.1],['geo','DEFPercentage',.2],['electro','Recharge',.2],['dendro','ElementalMastery',60],['hydro','HPPercentage',.2],['pyro','ATKPercentage',.2],['cryo','CriticalDamageBase',.2]])if(b(p,k))out[a]=v;return out;},
 TravelerEnhancedAttribute:(p,i)=>traveler(i)?{ATKBase:(b(p,'first')?3:0)+(b(p,'second')?7:0),HPBase:b(p,'second')?50:0,ElementalMastery:b(p,'second')?15:0}:{},
 AetherCryoTalent1:p=>{const mode=n(p,'radiance_mode',1,0,2,true),v=Math.min(n(p,'atk',2000)*.000035,.07);return mode===1?{StellarConductBaseBonus:v,StellarConductEnabled:1}:mode===2?{StellarSwirlBaseBonus:v,StellarSwirlEnabled:1}:{};},
 AetherCryoC6:(p,i)=>{if(cryoTraveler(i)||!b(p,'effect_active'))return {};const v=.05*n(p,'cold_glow_consumed',8,0,8,true);return {EnhanceStellarSuperconduct:v,StellarSwirlBonus:v};},
 YaeMikoC1:p=>b(p,'stellar_conduct')&&b(p,'effect_active')?{BonusElectro:.5,EnhanceStellarSuperconduct:.5}:{},
 NahidaC2:p=>b(p,'marked')?{NahidaReactionCritRate:.2,CriticalMoonbloom:.1,CriticalDamageMoonbloom:.2,DefMinus:b(p,'def_minus')?.3:0}:{},
 DurinTalent2:p=>{if(!b(p,'effect_active')||!b(p,'white_flame'))return {};const e=durinElement(p,true),v=b(p,'hexerei_secret_rite',false)?.35:.2;return {ResMinusPyro:v,['ResMinus'+e]:v};},
 DurinC2:p=>{if(!b(p,'effect_active'))return {};return {BonusPyro:.5,['Bonus'+durinElement(p,false)]:.5};},
 IfaTalent2:p=>{const points=n(p,'rescue_essentials',0,0,200);return b(p,'effect_active')?{EnhanceSwirlBase:.015*points,EnhanceElectroCharged:.015*points,EnhanceMoonelectro:.002*points}:{};},
 AlyoshaHunterPrecision:(p,i)=>{const c6=b(p,'c6',false),stacks=Math.min(n(p,'stacks',2,0,2,true),c6?2:1),level=n(p,'skill_level',10,1,15,true);if(!field(p,i)||!b(p,'effect_active'))return {};return {ATKPercentage:ALYOSHA_PRECISION[level-1]*stacks,ElementalMastery:c6&&stacks===2?100:0,EnhanceStellarSuperconduct:b(p,'stellar_conduct')?.2*stacks:0};},
});
export const REMAINING_CHARACTER_NAMES=Object.freeze(Object.keys(REMAINING_CHARACTER_RULES));
