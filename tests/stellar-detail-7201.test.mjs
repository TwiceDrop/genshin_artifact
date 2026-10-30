import assert from 'node:assert/strict';import test from 'node:test';
import {api,vesna,named} from '../beta-tools/runtime-7106.mjs';import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';import {input} from '../beta-tools/preview-7201-fixtures.mjs';
import {stellarDetail,stellarDetailState,stellarDetailResult} from '../src/algorithms/stellar-detail.mjs';
const enemy={level:95,electro_res:.25,cryo_res:.4,anemo_res:.3,pyro_res:.1,hydro_res:.1,geo_res:.1,dendro_res:.1,physical_res:.1};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function check(x,key){x.enemy=enemy;delete x.target_function;const r=api.CalculatorInterface.get_damage_analysis(x,null),state=stellarDetailState(stellarDetail(r,key,x.character.name)),detail=stellarDetailResult(state,enemy);for(const f of ['non_critical','critical','expectation'])near(detail[f],r[key][f]);return {r,state,detail};}
test('扩展星伤明细来源与原计算一致，编辑倍率和暴击会重算',()=>{
 const m=input();m.character.constellation=6;m.weapon={name:'StarsealedEdict',level:90,ascend:false,refine:1,params:{StarsealedEdict:{skill_active:true,stacks:3,radiance:true}}};m.buffs=[named('ValeriyDirective',{atk:2000,talent_level:10,momentum:40,radiance:true,ascended:true,active:true,recipient_on_field:true})];
 const {state,detail}=check(m,'direct_stellarconduct');assert.ok(state.reaction_critical_damage.some(x=>x.name.includes('秘星典谕')));state.ratio[0].value*=2;assert.ok(stellarDetailResult(state,enemy).expectation>detail.expectation);for(const x of state.critical)x.checked=false;for(const x of state.reaction_critical)x.checked=false;near(stellarDetailResult(state,enemy).expectation,stellarDetailResult(state,enemy).non_critical);
 const v=structuredClone(vesna);v.character.constellation=6;v.weapon=weapon('WhitelakeFrostfeather');v.weapon.params.WhitelakeFrostfeather={stacks:3,rate:1};v.buffs=[named('QiqiTalent2StellarConduct'),named('VesnaTalent1',{atk:1500,coverage:1}),named('VodyanitsaC2',{hp:50000,constellation:6,e_level:10,on_field:true,ordinary_mode:false}),named('QiqiC6StellarConduct',{atk:2000}),named('VesnaSupport',{flat:0,base:.1,bonus:.2,crit_damage:.4,elevation:.25,anemo_res:.1})];const result=check(v,'direct_stellarswirl');assert.ok(result.state.ratio.length);assert.ok(result.state.flat.some(x=>x.value>0&&x.name.includes('七七')));assert.ok(result.state.reaction_critical_damage.some(x=>x.name.includes('沃雅妮莎')));
});
test('发布内核星伤：攻击/精通、通用擢升、独立倍率、定额及减抗一致',()=>{
 for(const [name,index,mode,key]of [['Qiqi',19,1,'direct_stellarconduct'],['Odette',19,2,'direct_stellarswirl'],['Odette',12,1,'direct_stellarconduct'],['YumemizukiMizuki',14,1,'direct_stellarswirl'],['Sandrone',18,2,'direct_stellarswirl']]){
  const x=fixture(name);x.character.constellation=6;x.character.params[name]={...x.character.params[name],radiance_mode:mode};x.skill.index=index;
  if(name==='Odette')x.buffs=[named('ElevateStellarGlimmerReaction',{p:25})];
  if(name==='Sandrone')x.buffs=[named('QiqiC6StellarConduct',{atk:2000})];
  const {state,detail}=check(x,key);for(const c of state.reaction_critical_damage)c.checked=false;assert.ok(stellarDetailResult(state,enemy).critical<=detail.critical);
 }
});
