import {LAUMA_SKILL_RES_MINUS,LAUMA_BURST_BLOOM_FLAT,LAUMA_BURST_LUNAR_BLOOM_FLAT} from './lauma-formula-data.mjs';
// One configured hit. Enabling a named BUFF declares its source unlock/trigger;
// explicit state switches and remaining stacks still control eligibility.
const num=(p,k,d,min=0,max=100000,integer=false)=>{const v=p[k]===undefined?d:p[k];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error('月曜来源参数无效：'+k);return v;};
const flag=(p,k,d=true)=>{const v=p[k]===undefined?d:p[k];if(typeof v!=='boolean')throw Error('月曜来源开关无效：'+k);return v;};
const onField=(p,input)=>flag({v:input?.team_effects?.recipient_on_field??input?.team_effects?.on_field??input?.character?.params?.[input?.character?.name]?.on_field??p.recipient_on_field},'v',true);
const full=p=>flag(p,'full_moon',true);
const all=(prefix,v)=>Object.fromEntries(['Moonelectro','Moonbloom','MoonCrystallize'].map(k=>[prefix+k,v]));
const enabled=(kind,value)=>({['Enhance'+kind+'Base']:value,['Lunar'+({Moonelectro:'Electro',Moonbloom:'Bloom',MoonCrystallize:'Crystallize'}[kind])+'Enabled']:1});
const atkBase=p=>enabled('Moonelectro',Math.min(num(p,'atk',2000)*.00007,.14));
const emBase=p=>enabled('Moonbloom',Math.min(num(p,'em',800)*.000175,.14));
const defBase=p=>enabled('MoonCrystallize',Math.min(num(p,'def',2000)*.00007,.14));
export const COLUMBINA_Q_BONUS=Object.freeze([.13,.16,.19,.22,.25,.28,.31,.34,.37,.40,.43,.46,.49,.52,.55]);
export const ILLUGA_GEO_FLAT=Object.freeze([.336,.3612,.3864,.42,.4452,.4704,.504,.5376,.5712,.6048,.6384,.672,.714,.756,.798]);
export const ILLUGA_LUNAR_FLAT=Object.freeze([2.2592,2.4286,2.5981,2.824,2.9934,3.1629,3.3888,3.6147,3.8406,4.0666,4.2925,4.5184,4.8008,5.0832,5.3656]);
export function linneaCatalogHit(p,input){
 const c6=flag(p,'c6',false),n=num(p,'stacks_available',18,0,18,true),mode=num(p,'hit_mode',0,0,1,true);
 if(mode===1&&input?.character?.name!=='Linnea')throw Error('百万吨重锤定额只属于莉奈娅自身直伤');
 const unit=c6?2:1,uses=Math.min(Math.floor(n/unit),mode===1?num(p,'nuke_stacks',5,1,5,true):1);
 return {consumed:uses*unit,flat:num(p,'def',2000)*uses*unit*(mode===1?1.5:.75)*(c6?1.5:1),directOnly:mode===1};
}
export const LUNAR_CHARACTER_RULES=Object.freeze({
 AinoC6:(p,input)=>{if(!onField(p,input))return {};const v=.15+(flag(p,'full_moon',false)?.20:0);return {EnhanceElectroCharged:v,EnhanceBloom:v,...all('Enhance',v)};},
 IneffaMoonelectroRelay:atkBase,
 FlinsTalent1:atkBase,
 // Catalogue entry is the team-facing full-moon effect, not Flins's own +35%.
 FlinsC6:p=>full(p)?{ElevateMoonelectro:.10}:{},
 LaumaTalent1:emBase,
 LaumaTalent2:p=>{const mode=num(p,'mode',2,0,2,true);return mode===1?{BloomFamilyCritRate:.15,BloomFamilyCritDamage:1}:mode===2?{CriticalMoonbloom:.10,CriticalDamageMoonbloom:.20}:{};},
 LaumaSkillResMinus:p=>{if(!flag(p,'debuff_active'))return {};const v=LAUMA_SKILL_RES_MINUS[num(p,'skill_level',10,1,15,true)-1];return {ResMinusHydro:v,ResMinusDendro:v};},
 LaumaBurst:p=>{const level=num(p,'skill_level',10,1,15,true)-1,em=num(p,'em',800),c2=num(p,'constellation',0,0,6,true)>=2,stacks=num(p,'stacks_available',1,0,36,true);
  return {BloomFamilyFlat:stacks>0?em*(LAUMA_BURST_BLOOM_FLAT[level]+(c2?5:0)):0,ExtraDmgMoonbloom:stacks>0?em*(LAUMA_BURST_LUNAR_BLOOM_FLAT[level]+(c2?4:0)):0,EnhanceMoonbloom:c2&&flag(p,'full_moon',false)?.4:0};},
 LaumaC6:p=>full(p)?{ElevateMoonbloom:.25}:{},
 NeferTalent1:emBase,
 ZibaiTalent1:defBase,
 ZibaiC2:p=>flag(p,'lunar_phase_active')?{EnhanceMoonCrystallize:.30}:{},
 LinneaTalent1:defBase,
 LinneaC1:(p,input)=>{const hit=linneaCatalogHit(p,input);return {[hit.directOnly?'ExtraDmgDirectMoonCrystallize':'ExtraDmgMoonCrystallize']:hit.flat};},
 // 25% to Linnea AND the active character. On-field Linnea receives both.
 LinneaC4:(p,input)=>{const mode=num(p,'mode',1,0,2,true);if(!mode)return {};const self=input?.character?.name==='Linnea';return self?{DEFPercentage:mode===2?.50:.25}:onField(p,input)?{DEFPercentage:.25}:{};},
 LinneaC6:p=>full(p)?{ElevateMoonCrystallize:.25}:{},
 IllugaQ:(p,input)=>{if(!onField(p,input)||num(p,'stacks_available',1,0,36,true)===0)return {};const em=num(p,'em',2000),l=num(p,'skill_level',10,1,15,true)-1,n=num(p,'team_hydro_geo_count',1,0,3,true);return {ExtraDmgGeo:em*(ILLUGA_GEO_FLAT[l]+[0,.07,.14,.24][n]),ExtraDmgDirectMoonCrystallize:em*(ILLUGA_LUNAR_FLAT[l]+[0,.48,.96,1.6][n])};},
 ColumbinaP1:p=>{const v=Math.min(num(p,'hp',35000)*.000002,.07);return {...enabled('Moonelectro',v),...enabled('Moonbloom',v),...enabled('MoonCrystallize',v)};},
 // Active character in the domain enables the teamwide buff, including off-field owners.
 ColumbinaQ:p=>flag(p,'domain_active')?{EnhanceMoonReaction:COLUMBINA_Q_BONUS[num(p,'level',10,1,15,true)-1]}:{},
 ColumbinaC2:(p,input)=>{if(!flag(p,'lunar_brilliance_active'))return {};const values=input?.character?.name==='Columbina'?{HPPercentage:.40}:{};const mode=num(p,'type_index',0,0,3,true),hp=num(p,'hp',30000,0,200000);if(full(p)&&onField(p,input)&&mode)values[['','ATKFixed','ElementalMastery','DEFFixed'][mode]]=hp*[0,.01,.0035,.01][mode];return values;},
 // Each unlocked constellation adds its listed elevation. C2 and C6 don't replace C1.
 ColumbinaConstellation:p=>all('Elevate',[0,.015,.085,.100,.115,.130,.200][num(p,'constellation',0,0,6,true)]),
 ColumbinaC6:p=>{if(!flag(p,'domain_active'))return {};const list=p.elements===undefined?['Hydro']:p.elements;if(!Array.isArray(list)||list.some(e=>!['Hydro','Electro','Dendro','Geo'].includes(e)))throw Error('少女六命仅接受月反应涉及的水、雷、草、岩元素');return Object.fromEntries([...new Set(list)].map(e=>['CriticalDamage'+e,.8]));},
});
export const LUNAR_CHARACTER_NAMES=Object.freeze(Object.keys(LUNAR_CHARACTER_RULES));
export const LUNAR_CHARACTER_ATTRIBUTES=Object.freeze(['EnhanceMoonelectroBase','EnhanceMoonbloomBase','EnhanceMoonCrystallizeBase','EnhanceMoonelectro','EnhanceMoonbloom','EnhanceMoonCrystallize','EnhanceMoonReaction','EnhanceBloom','EnhanceHyperbloom','EnhanceBurgeon','CriticalMoonbloom','CriticalDamageMoonbloom','ExtraDmgMoonbloom','ExtraDmgMoonCrystallize','ExtraDmgDirectMoonCrystallize','BloomFamilyFlat','BloomFamilyCritRate','BloomFamilyCritDamage','LunarElectroEnabled','LunarBloomEnabled','LunarCrystallizeEnabled','ResMinusHydro','ResMinusDendro','CriticalDamageHydro','CriticalDamageElectro','CriticalDamageDendro','CriticalDamageGeo']);
