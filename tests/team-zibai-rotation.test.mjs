import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {api} from '../beta-tools/runtime-team-dps-graph.mjs';
import {changeTeamConstellation} from '../beta-data/team-dps-character-rules.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {parseTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';

const axisText=fs.readFileSync(new URL('../examples/team-dps/zibai-lunar-crystallize.json',import.meta.url),'utf8');
function input(cons=[0,0,0,6],axis=parseTeamDpsConfiguration(axisText)){
 const profiles=axis.members.map(({character},r)=>{
  const p=fixture(character);changeTeamConstellation(p.character,cons[r]);
  p.artifacts=p.artifacts.map((a,i)=>({...a,id:100*r+i+1,set_name:'Empty'}));return p;
 });
 return {single_interfaces:profiles,team_dps:{axis,enemy_count:1,damage_scope:'all',enemy:normalizeEnemy({level:100})}};
}
const score=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const near=(v,expected)=>assert.ok(Number.isFinite(v)&&Math.abs(v-expected)<1e-8*Math.max(1,Math.abs(expected)),v+' != '+expected);
const sum=x=>Object.values(x??{}).reduce((a,b)=>a+b,0);

test('the imported cycle keeps companion clocks, field switches and the conditional final stride',()=>{
 for(const [z,c,duration] of [[0,0,20],[1,0,20.5],[2,2,20.5]]){
  const x=input([z,c,0,6]),preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));
  assert.equal(preview.duration,duration);
  const hits=(r,label)=>preview.roles[r].hits.filter(h=>h.label===label).map(h=>h.time);
  assert.deepEqual(hits(2,'露米·加力重锤'),[1.5,6.8,12.1,17.4]);
  assert.deepEqual(hits(2,'露米·捶捶乱打'),[3,3.3,5.5,5.8,8.5,8.8,11,11.3,14,14.3,16.5,16.8,19,19.3]);
  assert.deepEqual(hits(1,'引力涟漪'),duration===20?[2.4,4.4,6.4,8.4,10.4,12.4,14.4,16.4,18.4]:[2.4,4.4,6.4,8.4,10.4,12.4,14.4,16.4,18.4,20.4]);
  assert.deepEqual(hits(1,'引力干涉·月结晶'),c===2?[4.4,8.4,12.4,16.4,20.4]:[6.4,12.4,18.4]);
  const impact=preview.roles[0].hits.filter(h=>h.damageModel==='direct.lunarCrystallize');
  assert.deepEqual(impact.map(h=>h.time),z?[7,9,9.5,12.2,12.7,16.4,16.9,19.6,20.1]:[8.5,9,11.7,12.2,15.9,16.4,19.1,19.6]);
 }
});

test('native scoring accounts for four owners, the harmony and the two flat damage scopes',()=>{
 const x=input(),out=score(x);
 assert.ok(out.character_damage.every(row=>row.expectation>0));near(out.dps,out.expectation/20);
 const stride=out.hits.find(h=>h.index===15&&h.role===0);
 const d=stride.analysis,def=sum(d.def),flat=def*.6+sum(d.direct_mooncrystallize_extra_fixed);
 near(sum(d.direct_mooncrystallize_ratio),2.5374);
 near(stride.flat,flat);assert.ok(flat>def*.6);
 const base=1.6*def*2.5374*(1+sum(d.mooncrystallize_base_compose))*(1+sum(d.direct_mooncrystallize_compose)+.40);
 near(stride.non_critical,(base+flat)*1.10);
 const harmony=out.hits.filter(h=>h.damageModel==='reaction.lunarCrystallize');
 assert.ok(harmony.length>=3);assert.ok(harmony.every(h=>h.flat===0));
 assert.ok(out.hits.some(h=>h.role===3&&h.index===11));
 const generic=input();
 generic.single_interfaces[0].buffs.push({name:'ExtensionEffect',config:{ExtensionEffect:{label:'定额测试',values:{ExtraDmgMoonCrystallize:100}}}});
 const boosted=score(generic);
 near(boosted.hits.find(h=>h.index===15&&h.role===0).flat,stride.flat+100);
 assert.ok(boosted.hits.some(h=>h.damageModel==='reaction.lunarCrystallize'&&h.role===0&&h.flat>=100));
 const c1=score(input([1,0,0,6]));
 assert.equal(c1.duration,20.5);near(c1.dps,c1.expectation/20.5);
 const strides=c1.hits.filter(h=>h.role===0&&h.index===15);
 near(strides[0].analysis.direct_mooncrystallize_compose['一命：初次灵驹飞踏'],2.2);
 assert.ok(strides.slice(1).every(h=>!h.analysis.direct_mooncrystallize_compose['一命：初次灵驹飞踏']));
});

function custom(names,events,cons){
 const axis=createActionAxis('custom',names);
 axis.timeline=events.map(([r,ms,action],i)=>({id:'row'+i,actor:axis.members[r].slot,timeMs:ms,kind:action?'action':'switch',...(action?{action}:{})}));
 return input(cons,axis);
}

test('cold starts follow actual contacts, resources, healing and party membership',()=>{
 const mixed=custom(['Furina','Linnea','Zibai','Illuga'],[[1,1000,'skill'],[1,1400,'burst'],[2,2000,'normal.1'],[2,2500,'skill'],[2,2550,'stride'],[2,9300,'normal.1'],[2,10400,'stride'],[3,11000,'skill'],[2,12000,'normal.1'],[0,15000]],[0,0,0,0]);
 const scored=score(mixed),hits=scored.hits;
 assert.ok(hits.some(h=>h.role===1&&h.index===8&&h.time>3));
 assert.ok(!hits.some(h=>h.role===1&&h.index===9));
 assert.deepEqual(hits.filter(h=>h.role===2&&h.index===15).map(h=>h.eventId.split('/')[0]),['row6']);
 assert.deepEqual(hits.filter(h=>h.role===2&&h.category==='normal').map(h=>h.element),['Physical','Geo','Physical']);
 assert.ok(!hits.some(h=>h.damageModel==='reaction.lunarCrystallize'));
 assert.ok(scored.heals.some(h=>h.healing==='linnea.initial'&&h.time===3&&h.rawAmounts.every(n=>n>0)));
 const hydro=custom(['Columbina','Mona','Furina','Vodyanitsa'],[[0,0,'skill'],[0,500,'burst'],[0,8000,'normal.1'],[0,14000]],[6,0,0,0]);
 const water=score(hydro);assert.ok(water.hits.some(h=>h.role===0&&h.index===9));assert.ok(!water.hits.some(h=>h.damageModel?.includes('lunarCrystallize')));
 const original=score(input()),swapped=input();
 const permutation=[2,0,3,1];swapped.single_interfaces=permutation.map(i=>swapped.single_interfaces[i]);
 swapped.team_dps.axis.members=permutation.map(i=>swapped.team_dps.axis.members[i]);
 const other=score(swapped);near(other.dps,original.dps);
 permutation.forEach((old,r)=>near(other.character_damage[r].expectation,original.character_damage[old].expectation));
 const clocks=custom(['Illuga','Columbina','Linnea','Zibai'],[[1,0,'skill'],[1,3100,'skill'],[0,5000,'skill'],[1,7000]], [0,0,0,0]);
 assert.deepEqual(score(clocks).hits.filter(h=>h.role===1&&h.index===9).map(h=>h.time),[2.4,4.4,6.4]);
 const warm=input([6,6,6,6]),out=score(warm);
 assert.ok(out.hits.some(h=>h.damageModel==='reaction.lunarCrystallize'&&h.flat>0));
 assert.ok(out.hits.some(h=>h.role===1&&h.index===12&&h.flat>0));
 const noConverter=custom(['Illuga','Mona','Furina','Qiqi'],[[1,0,'burst'],[1,100,'normal.1'],[0,1000,'skill'],[0,3000]],[0,0,0,0]);
 const facts=compileActionAxis(noConverter.team_dps.axis,noConverter.single_interfaces).reactionFacts;assert.ok(facts.some(h=>h.reactionType==='Crystallize'&&h.enabled));assert.ok(!facts.some(h=>h.reactionType==='LunarCrystallize'));
});

test('compiled CPU rescoring changes the source DEF and EM for every candidate',async()=>{
 const referenceTeam=input(),high=input([6,6,6,6]);
 for(const [role,name] of ['LightbearingMoonshard','NocturnesCurtainCall','GoldenFrostboundOath','ProspectorsShovel'].entries())Object.assign(high.single_interfaces[role].weapon,{name,params:{[name]:{}}});
 for(const [r,set] of ['RealmMirrorNight','AubadeOfMorningstarAndMoon','SpinMoonSerenade'].entries())for(const piece of high.single_interfaces[r].artifacts.slice(0,4))piece.set_name=set;
 const mixed=custom(['Vodyanitsa','Illuga','Linnea','Zibai'],[[0,0,'burst'],[1,200,'skill'],[2,1000,'skill'],[0,1500,'skill'],[1,1900,'burst'],[2,3000,'burst'],[0,5000,'burst'],[1,5600,'skill'],[3,6500,'skill'],[3,7000,'stride'],[3,12000]],[0,6,2,1]);
 const harmony=score(mixed).hits.filter(h=>h.damageModel==='reaction.lunarCrystallize'&&h.role===0);
 assert.ok(harmony.length>0&&harmony.every(h=>sum(h.analysis.mooncrystallize_base_compose)>0&&h.bonus>0));
 assert.ok(harmony.some(h=>sum(h.analysis.enhance_moon_reaction_compose)>0));
 for(const x of [referenceTeam,high,mixed]){
 const a=x.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);
 for(const [role,stat,value] of [[2,'DEFFixed',400],[3,'ElementalMastery',240]]){
  b[role][0].id+=1000;b[role][0].sub_stats.push([stat,value]);
 }
 const inventory=[...a.flat(),b[2][0],b[3][0]],read=n=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+n+'.json',import.meta.url)));
 const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
 const program=compileTeamDpsExpression(api,x,inventory,resources),cpu=createTeamDpsComputation(program,inventory);
 try{
  const evaluator=createTeamDpsEvaluator(api,x),scores=[];
  for(const builds of [a,b,a]){
   const reference=evaluator.evaluate(builds),compiled=(await cpu.score([builds.map(row=>row.map(item=>item.id))])).results[0];
   near(compiled.duration,reference.duration);
   for(let i=0;i<4;i++)near(compiled.character_damage[i].expectation,reference.character_damage[i].expectation);
   near(compiled.dps,reference.dps);scores.push(compiled.dps);
  }
  assert.ok(scores[1]>scores[0]);assert.equal(scores[0],scores[2]);
 }finally{cpu.dispose?.();}
 }
});
