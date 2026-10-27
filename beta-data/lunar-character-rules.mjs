import {evaluateEffectRule} from './effect-rule-engine.mjs';
import {CHARACTER_EFFECT_RULES} from './character-effect-rules.mjs';
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
export const LUNAR_CHARACTER_RULES=Object.freeze(Object.fromEntries(["AinoC6", "IneffaMoonelectroRelay", "FlinsTalent1", "FlinsC6", "LaumaTalent1", "LaumaTalent2", "LaumaSkillResMinus", "LaumaBurst", "LaumaC6", "NeferTalent1", "ZibaiTalent1", "ZibaiC2", "LinneaTalent1", "LinneaC1", "LinneaC4", "LinneaC6", "IllugaQ", "ColumbinaP1", "ColumbinaQ", "ColumbinaC2", "ColumbinaConstellation", "ColumbinaC6"].map(name=>[name,(parameters,input)=>evaluateEffectRule(CHARACTER_EFFECT_RULES[name],parameters,input)])));
export const LUNAR_CHARACTER_NAMES=Object.freeze(Object.keys(LUNAR_CHARACTER_RULES));
export const LUNAR_CHARACTER_ATTRIBUTES=Object.freeze(['EnhanceMoonelectroBase','EnhanceMoonbloomBase','EnhanceMoonCrystallizeBase','EnhanceMoonelectro','EnhanceMoonbloom','EnhanceMoonCrystallize','EnhanceMoonReaction','EnhanceBloom','EnhanceHyperbloom','EnhanceBurgeon','CriticalMoonbloom','CriticalDamageMoonbloom','ExtraDmgMoonbloom','ExtraDmgMoonCrystallize','ExtraDmgDirectMoonCrystallize','BloomFamilyFlat','BloomFamilyCritRate','BloomFamilyCritDamage','LunarElectroEnabled','LunarBloomEnabled','LunarCrystallizeEnabled','ResMinusHydro','ResMinusDendro','CriticalDamageHydro','CriticalDamageElectro','CriticalDamageDendro','CriticalDamageGeo']);
