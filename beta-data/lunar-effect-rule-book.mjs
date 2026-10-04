import {R,E,P,I,V,op,mul,add,sub,min,eq,and,or,not,choose,at,includes,floor,elements,recipient} from './rule-dsl.mjs';
import {LAUMA_SKILL_RES_MINUS,LAUMA_BURST_BLOOM_FLAT,LAUMA_BURST_LUNAR_BLOOM_FLAT} from './lauma-formula-data.mjs';
const onField=op('coalesce',I('team_effects.recipient_on_field'),I('team_effects.on_field'),I('recipient_on_field'),P('recipient_on_field'),true);
const full=P('full_moon',true), all=(prefix,value)=>['Moonelectro','Moonbloom','MoonCrystallize'].map(k=>E(prefix+k,value));
const base=(kind,stat,defaultValue,coefficient)=>R([E('Enhance'+kind+'Base',min(mul(P(stat,defaultValue),coefficient),.14)),E('Lunar'+{Moonelectro:'Electro',Moonbloom:'Bloom',MoonCrystallize:'Crystallize'}[kind]+'Enabled',1)]);
const q=[.13,.16,.19,.22,.25,.28,.31,.34,.37,.40,.43,.46,.49,.52,.55];
const geo=[.336,.3612,.3864,.42,.4452,.4704,.504,.5376,.5712,.6048,.6384,.672,.714,.756,.798];
const lunar=[2.2592,2.4286,2.5981,2.824,2.9934,3.1629,3.3888,3.6147,3.8406,4.0666,4.2925,4.5184,4.8008,5.0832,5.3656];
export const LUNAR_EFFECT_RULE_BOOK={
 AinoC6:R([E('EnhanceElectroCharged',V('value')),E('EnhanceBloom',V('value')),...all('Enhance',V('value'))],{when:onField,variables:{value:add(.15,choose(P('full_moon',false),.2,0))}}),
 IneffaMoonelectroRelay:base('Moonelectro','atk',2000,.00007),FlinsTalent1:base('Moonelectro','atk',2000,.00007),FlinsC6:R([E('ElevateMoonelectro',.1)],{when:full}),
 LaumaTalent1:base('Moonbloom','em',800,.000175),NeferTalent1:base('Moonbloom','em',800,.000175),ZibaiTalent1:base('MoonCrystallize','def',2000,.00007),LinneaTalent1:base('MoonCrystallize','def',2000,.00007),
 LaumaTalent2:R([E('BloomFamilyCritRate',.15,eq(P('mode',2),1)),E('BloomFamilyCritDamage',1,eq(P('mode',2),1)),E('CriticalMoonbloom',.1,eq(P('mode',2),2)),E('CriticalDamageMoonbloom',.2,eq(P('mode',2),2))]),
 LaumaSkillResMinus:R(['ResMinusHydro','ResMinusDendro'].map(a=>E(a,at(LAUMA_SKILL_RES_MINUS,sub(P('skill_level',10),1)))),{when:P('debuff_active',true)}),
 LaumaBurst:R([E('BloomFamilyFlat',choose(V('active'),mul(P('em',800),add(at(LAUMA_BURST_BLOOM_FLAT,V('level')),choose(V('c2'),5,0))),0)),E('ExtraDmgMoonbloom',choose(V('active'),mul(P('em',800),add(at(LAUMA_BURST_LUNAR_BLOOM_FLAT,V('level')),choose(V('c2'),4,0))),0)),E('EnhanceMoonbloom',choose(and(V('c2'),P('full_moon',false)),.4,0))],{variables:{active:op('gte',P('stacks_available',1),1),level:sub(P('skill_level',10),1),c2:op('gte',P('constellation',0),2)}}),
 LaumaC6:R([E('ElevateMoonbloom',.25)],{when:full}),ZibaiC2:R([E('EnhanceMoonCrystallize',.3)],{when:P('lunar_phase_active',true)}),
 LinneaC1:R([E(choose(eq(P('hit_mode',0),1),'ExtraDmgDirectMoonCrystallize','ExtraDmgMoonCrystallize'),mul(P('def',2000),V('uses'),V('unit'),choose(eq(P('hit_mode',0),1),1.5,.75),choose(P('c6',false),1.5,1)))],{variables:{unit:choose(P('c6',false),2,1),uses:min(floor(op('div',P('stacks_available',18),V('unit'))),choose(eq(P('hit_mode',0),1),P('nuke_stacks',5),1))},assertions:[{when:or(not(eq(P('hit_mode',0),1)),eq(recipient,'Linnea')),message:'百万吨重锤定额只属于莉奈娅自身直伤'}]}),
 LinneaC4:R([E('DEFPercentage',choose(eq(recipient,'Linnea'),choose(eq(P('mode',1),2),.5,.25),.25))],{when:and(not(eq(P('mode',1),0)),or(eq(recipient,'Linnea'),onField))}),LinneaC6:R([E('ElevateMoonCrystallize',.25)],{when:full}),
 IllugaQ:R([E('ExtraDmgGeo',mul(P('em',2000),add(at(geo,V('level')),at([0,.07,.14,.24],P('team_hydro_geo_count',1))))),E('ExtraDmgDirectMoonCrystallize',mul(P('em',2000),add(at(lunar,V('level')),at([0,.48,.96,1.6],P('team_hydro_geo_count',1)))))],{variables:{level:sub(P('skill_level',10),1)},when:and(onField,op('gte',P('stacks_available',1),1))}),
 ColumbinaP1:R(['Moonelectro','Moonbloom','MoonCrystallize'].flatMap(k=>[E('Enhance'+k+'Base',min(mul(P('hp',35000),.000002),.07)),E('Lunar'+{Moonelectro:'Electro',Moonbloom:'Bloom',MoonCrystallize:'Crystallize'}[k]+'Enabled',1)])),
 ColumbinaQ:R([E('EnhanceMoonReaction',at(q,sub(P('level',10),1)))],{when:P('domain_active',true)}),
 ColumbinaC2:R([E('HPPercentage',.4,eq(recipient,'Columbina')),...[['ATKFixed',.01],['ElementalMastery',.0035],['DEFFixed',.01]].map(([a,v],i)=>E(a,mul(P('hp',30000),v),and(full,onField,eq(P('type_index',0),i+1))))],{when:P('lunar_brilliance_active',true)}),
 ColumbinaConstellation:R(all('Elevate',at([0,.015,.085,.100,.115,.130,.200],P('constellation',0)))),
 ColumbinaC6:R(['Hydro','Electro','Dendro','Geo'].map(e=>E('CriticalDamage'+e,.8,includes(P('elements',['Hydro']),e))),{when:P('domain_active',true),assertions:elements.filter(e=>!['Hydro','Electro','Dendro','Geo'].includes(e)).map(e=>({when:not(includes(P('elements',['Hydro']),e)),message:'少女六命仅接受水、雷、草、岩'}))}),
};
