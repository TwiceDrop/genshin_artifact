import test from 'node:test';
import assert from 'node:assert/strict';
import {api,original,vody,vesna,read,named,sum} from '../beta-tools/runtime-7106.mjs';
import {prepareExtensionBuffs} from '../beta-data/extension-buffs.mjs';
import {deriveTeamBuffs} from '../beta-data/hybrid-team-optimizer.mjs';
import {createTeamContextSource,deriveSingleTeamContext} from '../src/algorithms/single-team-context.mjs';
import {expandedWeaponCatalog} from '../beta-data/expanded-weapons.mjs';
const clone=structuredClone;
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<Math.max(1e-6,Math.abs(b)*1e-9),a+' != '+b);
const damage=x=>api.CalculatorInterface.get_damage_analysis(x,null);
test('2 旧 BUFF 配置及已补充的角色、武器、套装效果进入原生计算',()=>{
 const buffs=[named('AlbedoC4',{rate_plunging:1,rate_impact:.5}),named('KleeC6',{is_self:true}),named('MonaC1',{off_field:true})];
 const x={...clone(vody),buffs,skill:{index:6,config:'NoConfig'}};
 near(damage(x).normal.non_critical/damage({...x,buffs:[]}).normal.non_critical,1.45);
 near(sum(api.CommonInterface.get_attribute(x).bonus_pyro),.5);
 assert.ok(Number.isFinite(damage({...clone(vesna),buffs}).direct_stellarswirl.expectation));
 const extra=prepareExtensionBuffs({...clone(vody),buffs:[
 named('DionaC6StellarConduct',{}),named('EscoffierTalent3',{hydro_cryo_count:3}),named('EscoffierC1',{}),named('EscoffierC2',{atk:3000,rate:.5}),
 named('AThousandFloatingDreams',{refine:1}),named('WanderingEvenstar',{refine:1,em:900}),
 named('ScrollOfTheHeroOfCinderCity4',{elements:['Hydro'],rate1:1,rate2:1}),named('SongOfDaysPast4',{regeneration:15000,rate:1})]});
 const values=Object.assign({},...extra.buffs.map(b=>b.config?.ExtensionEffect?.values));
 near(values.ResMinusHydro,.55);near(values.CriticalDamageCryo,.6);near(values.ExtraDmgCryo,3600);
 near(values.ElementalMastery,40);near(values.ATKFromSecondaryConversion,64.8);near(values.BonusHydro,.4);near(values.ExtraDmgBase,1200);
 assert.ok(Number.isFinite(damage(extra).normal.expectation));
});
test('4 两名辅助共用圣遗物时必须阻断关联',()=>{
 const presets={hydro:{character:vody.character,weapon:vody.weapon,buffs:[],artifactIds:[1,2,3,4,5]},
 wind:{character:vesna.character,weapon:vesna.weapon,buffs:[],artifactIds:[1,2,3,4,5]}};
 const contexts=Object.entries(presets).map(([n,p])=>createTeamContextSource(n,p));
 const stub={CommonInterface:{get_attribute:()=>({hp:{base:60000},atk:{base:2000}})}};
 const result=deriveSingleTeamContext(stub,{character:{name:'Skirk'},buffs:[],artifacts:[]},contexts,presets,id=>({id}),x=>x);
 assert.equal(result.sources.length,1);assert.match(result.issues.join(' '),/其他队友.*同一件圣遗物/);
});
