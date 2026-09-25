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
test('1 奥黛塔六项效果：来源条件、独立直接星扩散公式及配装一致',()=>{
 const source={character:{name:'Odette',level:90,ascend:false,constellation:6,skill1:9,skill2:9,skill3:12,
 params:{Odette:{radiance_mode:2,marvelous_splendor_stacks:0,snow_swan_dream:false,solo_dance_double:false}}},
 weapon:{name:'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'},buffs:[named('ATKFixed',{value:2000})],
 team_effects:{support_triggers:{odetteRadianceMode:2,odetteStacks:6,odetteBlessing:true,odetteSplendor:true,odetteDouble:true,odetteDream:true}}};
 const effects=deriveTeamBuffs(api,[vesna,source],[[],[]],0);
 assert.equal(effects.length,6);
 const x={...clone(vesna),buffs:effects},base=api.CommonInterface.get_attribute(vesna),panel=api.CommonInterface.get_attribute(x);
 near(sum(panel.atk)-sum(base.atk),1028*.42);
 const atk=sum(panel.atk),em=sum(panel.elemental_mastery),crit=sum(panel.critical),cd=sum(panel.critical_damage);
 const expected=atk*4.7376*1.6*(1+Math.min(atk*.00007,.14)+.14)*(1+6*em/(2000+em)+.36+.9+.31)*1.25*1.05*(1+crit*cd);
 near(damage(x).direct_stellarswirl.expectation,expected);
 const off=clone(source);off.team_effects.support_triggers={};
 assert.deepEqual(deriveTeamBuffs(api,[vesna,off],[[],[]],0),[]);
 const low=clone(source);low.character.constellation=0;low.team_effects.support_triggers.odetteStacks=4;
 assert.equal(deriveTeamBuffs(api,[vesna,low],[[],[]],0).length,2);
 const gear=read('beta-data/skirk-fixture.json').input.artifacts.map((a,i)=>({...a,id:i+1,set_name:'GladiatorsFinale'}));
 const target={...x,artifacts:gear,target_function:{name:'VesnaDefault',params:'NoConfig'},algorithm:'Naive',constraint:null,filter:null};
 const optimized=api.OptimizeSingleWasm.optimize(target,gear);
 near(optimized[0].value,damage(target).direct_stellarswirl.expectation);
 assert.ok(Number.isFinite(damage({...clone(vody),buffs:effects}).normal.expectation));
});
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
test('3 沃雅妮莎 A4 在后台失效，前台仍保留普通伤害加值',()=>{
 const x=clone(read('beta-data/skirk-fixture.json').input);x.buffs=[];
 const p={hp:65000,constellation:0,e_level:10,ordinary_mode:true,on_field:false};
 near(damage({...x,buffs:[named('VodyanitsaA4',p)]}).normal.expectation,damage(x).normal.expectation);
 assert.ok(damage({...x,buffs:[named('VodyanitsaA4',{...p,on_field:true})]}).normal.expectation>damage(x).normal.expectation);
 const own=clone(vody);own.buffs=[named('HPFixed',{value:40000})];own.character.params.Vodyanitsa.on_field=false;
 const before=damage(own).normal.expectation;own.character.params.Vodyanitsa.song_active=true;
 near(damage(own).normal.expectation,before);
});
test('4 两名辅助共用圣遗物时必须阻断关联',()=>{
 const presets={hydro:{character:vody.character,weapon:vody.weapon,buffs:[],artifactIds:[1,2,3,4,5]},
 wind:{character:vesna.character,weapon:vesna.weapon,buffs:[],artifactIds:[1,2,3,4,5]}};
 const contexts=Object.entries(presets).map(([n,p])=>createTeamContextSource(n,p));
 const stub={CommonInterface:{get_attribute:()=>({hp:{base:60000},atk:{base:2000}})}};
 const result=deriveSingleTeamContext(stub,{character:{name:'Skirk'},buffs:[],artifacts:[]},contexts,presets,id=>({id}),x=>x);
 assert.equal(result.sources.length,1);assert.match(result.issues.join(' '),/其他队友.*同一件圣遗物/);
});
test('5 90级新增武器沿用旧角色内核，未校准等级仍明确阻断',()=>{
 const data=read('beta-data/weapons-expanded-release-71.json');
 const weaponMeta=read('src/assets/_gen_weapon.js');
 for(const w of expandedWeaponCatalog){
  const config=Object.fromEntries((weaponMeta[w.name].configs||[]).map(p=>[p.name,p.default]));
  const x={...clone(vody),character:{name:w.type==='Sword'?'Kaeya':'Lisa',level:90,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:'NoConfig'},
  skill:{index:0,config:'NoConfig'},weapon:{name:w.name,level:90,ascend:false,refine:1,params:Object.keys(config).length?{[w.name]:config}:'NoConfig'}};
  const panel=api.CommonInterface.get_attribute(x);
  assert.equal(panel.weapon_precision.characterCore,'published',w.name);
  assert.ok(Number.isFinite(sum(panel.atk)),w.name);
  const d=damage(x);assert.ok(Number.isFinite(d.normal.expectation),w.name);
 }
 const low={...clone(read('beta-data/skirk-fixture.json').input),weapon:{name:'PrizedIsshinBlade',level:80,ascend:false,refine:1,params:'NoConfig'},buffs:[]};
 assert.throws(()=>api.CommonInterface.get_attribute(low),/1～89/);
});
