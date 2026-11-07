import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {attachTeamSources,describeCompiledTeamSources} from '../beta-data/team-dps-source-detail.mjs';
import {teamDamageAnalysis,canRestoreTeamDpsResult,TEAM_DPS_RESULT_VERSION} from '../beta-data/team-dps-result-view.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {effectInput} from './helpers/team-effect-refactor.mjs';
import {escoffierSkillInput,escoffierSkillTeams} from './helpers/team-escoffier-skill.mjs';
import {snapshotReviewInput,procReviewInput,royalReviewInput} from './helpers/team-review-fixes.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`),sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
const hits=result=>result.eventTrace.events.filter(e=>e.channel==='hits').flatMap(e=>e.states.map(s=>s.value));
async function check(input,teams=input.single_interfaces.map(p=>p.artifacts),artifacts=teams.flat()){
 const x=structuredClone(input);x.team_dps.initial_ids=teams.map(b=>b.map(a=>a.id));
 const result=(await nodeTeamDps(x,artifacts,{mode:'evaluate'})).results[0],native=createTeamDpsEvaluator(api,x).evaluate(teams,true);
 for(const field of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])near(result[field],native[field]);
 compareEventValues(result.eventTrace,nativeEventTrace(native));
 for(const hit of hits(result)){
  for(const [field,parts]of Object.entries(hit.analysis))if(parts&&typeof parts==='object')assert.equal(Object.hasOwn(parts,'compiled'),false,hit.label+'/'+field);
  for(const [field,total]of [['atk','atk'],['hp','hp'],['bonus','bonus'],['extra_damage','flat']])if(hit[total]!==undefined)near(sum(hit.analysis[field]),hit[total]);
 }
 return result;
}

test('source metadata survives copies and critical overlays without changing aggregate arithmetic',()=>{
 let reads=0;const critical=attachTeamSources({compiled:.2,'宗室被动等效':.1},()=>{reads++;return {'初始值':.05,'圣遗物词条':.15,'宗室被动等效':.1};});
 assert.equal(reads,0);near(sum(critical),.3);const changed={...critical,'宗室·当前叠层':.12};delete changed['宗室被动等效'];
 assert.deepEqual(describeCompiledTeamSources({critical:changed}),{critical:{'初始值':.05,'圣遗物词条':.15,'宗室·当前叠层':.12}});assert.equal(reads,1);near(sum(changed),.32);
 const normal={expectation:0},view=teamDamageAnalysis({atk:{'角色基础攻击':100,'未激活':0},normal});assert.deepEqual(view.atk,{'角色基础攻击':100});assert.equal(view.normal,normal);
 const axis={id:'axis'},saved={axis,engineRulesVersion:'rules',resultVersion:'team-dps-result/1',fields:{budget:9}};assert.equal(canRestoreTeamDpsResult(saved,axis,'rules'),false);assert.equal(canRestoreTeamDpsResult({...saved,resultVersion:TEAM_DPS_RESULT_VERSION},axis,'rules'),true);assert.equal(saved.fields.budget,9);
});

test('Worker details separate base, artifact, Tenacity, live HP conversion and limited flat damage across A/B/A candidates',async()=>{
 const input=effectInput(),teams=escoffierSkillTeams(input),artifacts=teams.flat(2),out=[];
 for(const i of [0,1,0])out.push(await check(input,teams[i],artifacts));assert.deepEqual(out[0],out[2]);
 for(const result of out){const hit=hits(result).find(h=>h.role===0&&h.category==='normal');assert.ok(hit);
  for(const label of ['角色基础攻击','武器基础攻击','圣遗物词条','圣遗物百分比词条','千岩','沃雅妮莎'])assert.ok(Object.keys(hit.analysis.atk).some(k=>k.includes(label)),label);
  const tenacity=Object.keys(hit.analysis.atk).find(k=>k.includes('千岩')),conversion=Object.keys(hit.analysis.atk).find(k=>k.includes('沃雅妮莎'));
  near(hit.analysis.atk[tenacity],.2*(hit.analysis.atk['角色基础攻击']+hit.analysis.atk['武器基础攻击']));
  near(hit.analysis.atk[conversion],.008*hits(result).find(h=>h.role===3).hp);
  assert.ok(Object.keys(hit.analysis.extra_damage).some(k=>k.includes('爱可菲')));
  assert.ok(hits(result).some(h=>h.analysis.res_minus&&Object.keys(h.analysis.res_minus).some(k=>k.includes('爱可菲'))));
 }
 const a=hits(out[0]).find(h=>h.role===0&&h.category==='normal'),b=hits(out[1]).find(h=>h.role===0&&h.category==='normal'),key=Object.keys(a.analysis.atk).find(k=>k.includes('沃雅妮莎'));
 assert.ok(b.analysis.atk[key]>a.analysis.atk[key]);
});

test('dynamic Fanfare, Salon count and HP talent sources follow each event state',async()=>{
 const input=escoffierSkillInput('team'),teams=escoffierSkillTeams(input);
 for(const team of teams){const result=await check(input,team,teams.flat(2)),salon=hits(result).filter(h=>h.role===1&&[10,11,12].includes(h.index));assert.ok(salon.length>0);
  for(const hit of salon){assert.ok(Object.hasOwn(hit.analysis.hp_ratio,'「沙龙成员」加成'));near(hit.analysis.bonus['天赋「无人听的自白」'],Math.min(.28,.007*Math.floor(hit.hp/1000)));}
  const fanfare=hits(result).flatMap(h=>Object.entries(h.analysis.bonus).filter(([k])=>k.includes('万众狂欢')).map(([,v])=>v));assert.ok(new Set(fanfare).size>1);
 }
});

test('snapshot, equipment proc and Royal critical histories retain named components and original values',async()=>{
 for(const input of [snapshotReviewInput(),procReviewInput(),royalReviewInput()])await check(input);
});
