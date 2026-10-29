import test from 'node:test';import assert from 'node:assert/strict';
import {teamEventRows,TEAM_DPS_RESULT_VERSION,canRestoreTeamDpsResult,packTeamDpsResult,unpackTeamDpsResult,createTeamDpsResultPacker,teamDamageAnalysis,teamProbabilityText} from '../beta-data/team-dps-result-view.mjs';
test('damage contributions apply absolute state mass exactly once',()=>{
 const trace={events:[{id:'hit/0',channel:'hits',probability:.25,states:[{probability:.1,value:{time:1,role:0,label:'hit',expectation:10,critical:20,non_critical:5}},{probability:.15,value:{time:2,role:0,label:'hit',expectation:30,critical:40,non_critical:15}}]}]},row=teamEventRows(trace)[0];
 assert.equal(row.contributions.expectation,5.5);assert.equal(row.contributions.critical,8);assert.equal(row.from,1);assert.equal(row.to,2);assert.equal(row.event,trace.events[0]);
});
test('joint health and fanfare states remain intact, without averaged paths',()=>{
 const states=[{probability:.3,value:{time:1,hp:[80],maxHP:[100],ratios:[.8],fanfare:100}},{probability:.7,value:{time:1,hp:[100],maxHP:[100],ratios:[1],fanfare:150}}],event={id:'health/1',channel:'health',states,probability:1},row=teamEventRows({events:[event]})[0];
 assert.equal(row.contributions,null);assert.equal(row.event.states,states);assert.deepEqual(row.event.states.map(s=>s.value.fanfare),[100,150]);
});
test('saved result values survive JSON storage including IEEE sentinels and signed zero',()=>{
 const original={values:[NaN,Infinity,-Infinity,-0,0,Number.MIN_VALUE,.1+.2],eventTrace:{events:[]}};
 const packed=packTeamDpsResult(original),restored=unpackTeamDpsResult(JSON.parse(JSON.stringify(packed)));assert.deepEqual(restored,original);assert.ok(Object.is(original.values[3],-0));assert.deepEqual(unpackTeamDpsResult(packTeamDpsResult(null)),null);
});
test('action and legacy axes both reject results from earlier numerical contracts',()=>{
 for(const format of ['mona-action-axis','mona-team-dps']){
  const engineRulesVersion='mona-team-engine/24';
  const axis={format,id:'synthetic',revision:1},saved={axis,engineRulesVersion,resultVersion:TEAM_DPS_RESULT_VERSION,fields:{budget:17}};
  assert.equal(canRestoreTeamDpsResult(saved,axis,engineRulesVersion),true);assert.equal(canRestoreTeamDpsResult({...saved,resultVersion:undefined},axis,engineRulesVersion),false);assert.equal(canRestoreTeamDpsResult(saved,{...axis,revision:2},engineRulesVersion),false);assert.equal(canRestoreTeamDpsResult(saved,axis,'different'),false);assert.equal(canRestoreTeamDpsResult({...saved,engineRulesVersion:null},axis,engineRulesVersion),false);assert.deepEqual(saved.fields,{budget:17});
 }
});
test('immutable snapshots share packed results without sharing mutable metadata',()=>{
 const pack=createTeamDpsResultPacker(),shared={uses:Infinity},result={baseline:shared,results:[shared]},first=pack(result),later=pack(result);
 assert.equal(first,later);assert.equal(first.baseline,first.results[0]);assert.notEqual(first.baseline,shared);
 assert.deepEqual(unpackTeamDpsResult(JSON.parse(JSON.stringify(first))),result);
 const next=pack({...result,results:[{uses:1}]});assert.notEqual(next,first);assert.deepEqual(unpackTeamDpsResult(first),result);
 assert.deepEqual(packTeamDpsResult({optional:undefined,items:[undefined,-0]}),{items:[null,{$teamNumber:'-0'}]});
});
test('damage analysis labels aggregate fields without inventing source attribution',()=>{
 const analysis={atk:{compiled:1000,'已分项':200},normal:{expectation:300},label:'hit'},view=teamDamageAnalysis(analysis);
 assert.deepEqual(view,{atk:{'未分项合计':1000,'已分项':200},normal:{expectation:300},label:'hit'});assert.equal(analysis.atk.compiled,1000);assert.equal(view.normal,analysis.normal);
});
test('positive probabilities below display precision are not shown as impossible',()=>{
 for(const p of [1e-40,.000005,.00005])assert.notEqual(teamProbabilityText(p),'0%');assert.equal(teamProbabilityText(0),'0%');assert.equal(teamProbabilityText(1),'100%');assert.equal(teamProbabilityText(.25),'25%');
});
