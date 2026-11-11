import test from 'node:test';
import assert from 'node:assert/strict';
import {api,original,vody,vesna,read,named,sum} from '../../beta-tools/runtime.mjs';
import {deriveTeamBuffs} from '../../beta-data/hybrid-team-optimizer.mjs';
const clone=structuredClone;
const near=(actual,expected,label='')=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(1e-6,Math.abs(expected)*1e-9),`${label}: ${actual} != ${expected}`);
const weapon=(name='DullBlade')=>({name,level:1,ascend:false,refine:1,params:'NoConfig'});
const old={...clone(vody),character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:weapon(),skill:{index:0,config:'NoConfig'},buffs:[]};
const damage=(x,engine=api)=>engine.CalculatorInterface.get_damage_analysis(x,null);
const panel=(x,engine=api)=>engine.CommonInterface.get_attribute(x);

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
