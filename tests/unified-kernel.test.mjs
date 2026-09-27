import test from 'node:test';
import assert from 'node:assert/strict';
import {api,original,vody,vesna,read,named,sum} from '../beta-tools/runtime-7106.mjs';
import {deriveTeamBuffs} from '../beta-data/hybrid-team-optimizer.mjs';
const clone=structuredClone;
const near=(actual,expected,label='')=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(1e-6,Math.abs(expected)*1e-9),`${label}: ${actual} != ${expected}`);
const weapon=(name='DullBlade')=>({name,level:1,ascend:false,refine:1,params:'NoConfig'});
const old={...clone(vody),character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:weapon(),skill:{index:0,config:'NoConfig'},buffs:[]};
const damage=(x,engine=api)=>engine.CalculatorInterface.get_damage_analysis(x,null);
const panel=(x,engine=api)=>engine.CommonInterface.get_attribute(x);

test('1 欧洛伦三层按基础攻击转换，同名去重及后台条件',()=>{
 const buff=named('OroronC6',{stack:3});
 const native={...clone(vody),weapon:weapon('ApprenticesNotes'),skill:{index:0,config:'NoConfig'},buffs:[named('ATKFixed',{value:1000})]};
 const baseline=sum(panel(native).atk);
 near(sum(panel({...native,buffs:[...native.buffs,buff,buff]}).atk)-baseline,(108+23)*.3,'native base ATK');
 const published={...clone(old),buffs:[named('ATKFixed',{value:1000})]};
 const before=sum(panel(published,original).atk);
 const naked=sum(panel(old,original).atk);
 near(sum(panel({...published,buffs:[...published.buffs,buff]},original).atk)-before,naked*.3,'published base ATK');
 near(sum(panel({...native,buffs:[...native.buffs,buff],team_effects:{on_field:false}}).atk),baseline,'off field');
 assert.throws(()=>panel({...native,buffs:[named('OroronC6',{stack:4})]}),/参数|无效/);
});

test('2 莱依拉定额与尘光七谕后台半额进入正确普通伤害乘区',()=>{
 const buffs=[named('LaylaC4',{hp:30000,rate:.5}),named('AngelosHeptades',{refine:1,atk:2700,secret_arts_offfield:true,recipient_is_magus:true})];
 const native={...clone(vody),weapon:weapon('ApprenticesNotes'),skill:{index:0,config:'NoConfig'},team_effects:{on_field:false},buffs:[]};
 const plain=damage(native),result=damage({...native,buffs});
 near(sum(result.extra_damage),750,'flat normal damage');
 near(result.normal.non_critical,(plain.normal.non_critical+750*.5*.9)*1.13,'off-field half bonus');
 const published=damage({...clone(old),buffs},original),oldPlain=damage(old,original);
 near(published.normal.non_critical,(oldPlain.normal.non_critical+750*.5*.9)*1.13,'published comparison');
 const ineligible=clone(buffs);ineligible[1].config.AngelosHeptades.recipient_is_magus=false;
 near(damage({...native,buffs:ineligible}).normal.non_critical,plain.normal.non_critical+750*.5*.9,'magus restriction');
});

test('3 瑞希 E/C1/C6：普通扩散定额顺序及独立星扩散暴击公式',()=>{
 const buffs=[named('ElementalMastery',{value:250}),named('YumemizukiMizukiE',{em:1000,skill_level:10}),named('YumemizukiMizukiC1',{em:1000}),named('YumemizukiMizukiC6')];
 const native={...clone(vody),weapon:weapon('ApprenticesNotes'),buffs};
 const expected=(1446.8535*.6*(1+16*250/(2000+250)+4.5)+11000)*.9*1.3;
 near(api.CalculatorInterface.get_transformative_damage(native).swirl_pyro,expected,'ordinary native');
 near(original.CalculatorInterface.get_transformative_damage({...clone(old),buffs}).swirl_pyro,expected,'ordinary published');
 const direct={...clone(vesna),weapon:weapon(),buffs},p=panel(direct),r=damage(direct);
 const atk=sum(p.atk),em=sum(p.elemental_mastery),cr=Math.min(1,sum(p.critical)+.1),cd=sum(p.critical_damage)+.2;
 const raw=atk*4.7376*1.6*(1+Math.min(atk*.00007,.14))*(1+6*em/(2000+em)+.45)*.9;
 near(r.direct_stellarswirl.non_critical,raw,'C1 does not increase direct stellar');
 near(r.direct_stellarswirl.expectation,raw*(1+cr*cd),'stellar CRIT');
 near(sum(r.critical_stellarswirl),.1,'display CRIT');
});

test('4 真语秘匣部分覆盖与原内核手工等价输入一致，未知重叠保留限制',()=>{
 const x={...clone(old),character:{...clone(old.character),name:'Lisa'},weapon:{name:'ReliquaryOfTruth',level:90,ascend:false,refine:1,params:{ReliquaryOfTruth:{skill_active:true,skill_rate:.5,lunar_bloom_hit:true,lunar_rate:1}}}};
 const manual={...clone(x),weapon:{...clone(x.weapon),params:{ReliquaryOfTruth:{false_secret_active:false,true_moon_active:false}}},buffs:[named('ElementalMastery',{value:60}),named('CriticalDamage',{p:30})]};
 const actual=damage(x),reference=damage(manual,original);
 near(actual.normal.expectation,reference.normal.expectation,'published weapon compensation');
 near(sum(actual.em),sum(reference.em),'EM');
 near(sum(actual.critical_damage),sum(reference.critical_damage),'CD');
 assert.equal(actual.weapon_precision.characterCore,'published');
 const ambiguous=clone(x);ambiguous.weapon.params.ReliquaryOfTruth.lunar_rate=.5;
 assert.throws(()=>damage(ambiguous),/重叠/);
 assert.throws(()=>api.CommonInterface.get_artifacts_rank_by_character(x.character,x.weapon,{name:'CommonNormalAttack',params:'NoConfig'},[]),/实际单人配装/);
});

test('5 奥黛塔自动来源与新共享 BUFF 组合的伤害和单人配装一致',()=>{
 const source={character:{name:'Odette',level:90,ascend:false,constellation:6,skill1:9,skill2:9,skill3:12,params:{Odette:{radiance_mode:2,marvelous_splendor_stacks:0,snow_swan_dream:false,solo_dance_double:false}}},weapon:weapon(),buffs:[named('ATKFixed',{value:2000})],team_effects:{support_triggers:{odetteRadianceMode:2,odetteStacks:6,odetteBlessing:true,odetteSplendor:true,odetteDouble:true,odetteDream:true}}};
 const automatic=deriveTeamBuffs(api,[vesna,source],[[],[]],0);
 assert.equal(automatic.length,6);
 const gear=read('beta-data/skirk-fixture.json').input.artifacts.map((a,i)=>({...a,id:i+1,set_name:'GladiatorsFinale'}));
 const x={...clone(vesna),artifacts:gear,buffs:[...automatic,named('OroronC6',{stack:3}),named('IneffaTalent3',{atk:3000}),named('JahodaC6'),named('YumemizukiMizukiE',{em:1000,skill_level:10}),named('YumemizukiMizukiC6')],target_function:{name:'VesnaDefault',params:'NoConfig'},algorithm:'Naive',constraint:null,filter:null};
 const p=panel(x),atk=sum(p.atk),em=sum(p.elemental_mastery),crit=Math.min(1,sum(p.critical)+.1),cd=sum(p.critical_damage)+.2;
 const expected=atk*4.7376*1.6*(1+Math.min(atk*.00007,.14)+.14)*(1+6*em/(2000+em)+.36+.9+.31+.45)*1.25*1.05*(1+crit*cd);
 near(damage(x).direct_stellarswirl.expectation,expected,'independent team formula');
 near(api.OptimizeSingleWasm.optimize(x,gear)[0].value,expected,'optimizer same formula');
});
