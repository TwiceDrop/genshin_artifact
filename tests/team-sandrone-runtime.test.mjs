import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {sandroneInput,sandroneTeams,gatedSandroneEvaluator,terminalSandroneInput,sandroneAction as a,sandroneEnd as end} from './helpers/team-sandrone-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),run=input=>createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true);
test('Sandrone C0/C1 thermal limits, C6 launched tails, cancellation and native Q parts keep the same preview and candidate clock',()=>{
 for(const [cons,rays,duration]of [[0,3,3.5],[1,6,6+5/6],[6,6,6+5/6]]){
  const input=sandroneInput(cons,[a('ca',0,'charged',0)]),preview=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),out=run(input);near(preview.duration,duration);near(out.duration,duration);assert.equal(out.hits.filter(e=>e.sandroneRay).length,rays);assert.equal(preview.events.filter(e=>e.sandroneRay).length,rays);
  if(cons===6)assert.deepEqual(out.hits.filter(e=>e.index===16).map(e=>e.time),[3.7,4.7,5.7,6.7]);
 }
 const interrupted=sandroneInput(6,[a('ca',0,'charged',0),{id:'away',kind:'switch',actor:'member2',timeMs:3600}]),out=run(interrupted);near(out.duration,3.7);assert.equal(out.hits.at(-1).index,16);assert.equal(out.hits.at(-1).onField,false);
 interrupted.team_dps.axis.endHit='exclude';assert.ok(!run(interrupted).hits.some(e=>e.time===3.7));
 const clipped=run(terminalSandroneInput());near(clipped.duration,4.8);assert.ok(clipped.hits.every(e=>e.time<=4.8));assert.equal(clipped.hits.filter(e=>e.yaeSakura).length,1);
 const burst=sandroneInput(0,[a('q',0,'burst',0)]),preview=createSkillMultiplierPreview(api,burst.team_dps.axis,burst.single_interfaces.map(p=>p.character));assert.equal(preview.roles[0].hits.length,4);preview.roles[0].hits.slice(0,3).forEach(e=>near(e.base.atk,4.7637/3));
});
test('E overcharge and Q tactics use pre-cast heat, actual cooling and consumption; interrupted cooling cannot manufacture ten stacks',()=>{
 const prefix=[a('seed',2,'burst',0),a('oe',1,'skill',.5),a('ca',0,'charged',1)],full=sandroneInput(0,[...prefix,a('e',0,'skill',5),a('q',0,'burst',5.7),a('q2',0,'burst',6),end(9)]),short=sandroneInput(0,[...prefix,a('e',0,'skill',5),a('q',0,'burst',5),end(8)]);
 const aOut=run(full),bOut=run(short);assert.equal(aOut.hits.find(e=>e.role===0&&e.index===11).sandroneOvercharge,true);
 const beams=aOut.hits.filter(e=>e.role===0&&e.index===14);assert.deepEqual(beams.map(e=>e.sandroneTactics),[10,0]);assert.ok(bOut.hits.find(e=>e.role===0&&e.index===14).sandroneTactics<10);
 assert.ok(aOut.resources.every(e=>e.resource!=='sandrone.power'||e.after>=0&&e.after<=100));
});
test('Sandrone star rays preserve native EM conversion, two source blessings, C1 scope and C2 crit with an independent oracle',()=>{
 const input=sandroneInput(0,[a('seed',2,'burst',0),a('oe',1,'skill',.5),a('ca',0,'charged',1),end(5)]),first=run(input).hits.find(e=>e.sandroneRay),atk=342.03+185,other=334.85+185,em=atk*.08;
 near(first.non_critical,atk*1.615*(1+(atk+other)*.00007)*(1+.15+6*em/(2000+em))*.9);
 input.single_interfaces[0].character.constellation=2;const rays=run(input).hits.filter(e=>e.sandroneRay);assert.deepEqual(rays.slice(0,3).map(e=>e.crit_damage),[1.1,1.3,1.5]);near(rays[0].non_critical,atk*1.615*(1+(atk+other)*.00007)*(1+.15+.3+6*em/(2000+em))*.9);
});
test('stellar/ordinary candidate branches, overcharge and tactics parameter bindings share one CPU program and stable party identities',async()=>{
 for(const input of [sandroneInput(),terminalSandroneInput()]){
 const teams=sandroneTeams(input),native=teams.map((team,i)=>gatedSandroneEvaluator(api,{...input,testSeedEnabled:i===1?0:1}).evaluate(team,true));if(input.team_dps.axis.timeline.some(e=>e.id==='seed')){assert.ok(native[0].hits.some(e=>e.role===0&&e.damageModel==='reaction.stellarConduct'));assert.ok(!native[1].hits.some(e=>e.role===0&&e.damageModel==='reaction.stellarConduct'));}
 const order=[3,1,0,2],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);permuted.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);near(run(permuted).expectation,run(input).expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedSandroneEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const rows=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;rows.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(rows[0],rows[2]);}finally{cpu.dispose();}
 }
});
