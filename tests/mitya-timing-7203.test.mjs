import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mityaInput,action as a,end} from './helpers/team-mitya-fixture.mjs';
import {createMityaRuntime} from '../beta-data/team-engine/characters/mitya-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const read=n=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+n+'.json',import.meta.url)));
const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const output=new URL('../../.work/mitya-timing-20261107/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const root=(time,kind,action,extra={})=>({time,kind,action:action==='skill.hold'?'skill':action,actionId:action,role:0,rootOrder:time*100,id:action+'/'+time,...extra});
function simulate(roots,constellation=1,until=28){
 const queue=createEventScheduler(roots),hits=[],resources=[],completions=new Map();let active=0;
 const runtime=createMityaRuntime({role:0,profile:{character:{level:90,constellation,skill1:9,skill2:9}},enqueue:queue.enqueue,resources,activeRole:()=>active,reactions:{refreshField(){}},complete:(e,t)=>completions.set(e.id,t)});
 for(const e of queue.events()){if(e.time>until)break;if(e.kind==='switch')active=e.role;runtime.beforeEvent(e);if(e.kind==='hit'){if(e.enabled??1)hits.push(e);}else runtime.onEvent(e);}
 return {runtime,hits,resources,completions};
}

test('frame-counted hold E, Q and overload opening match the scoring and preview clocks',()=>{
 const x=mityaInput(undefined,[a('e',0,'skill.hold',7.8),a('ca',0,'charged',9,{holdMs:1000}),a('q',0,'burst',11),end(14)]);x.single_interfaces[0].character.constellation=1;
 const native=run(x),preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));
 for(const [index,time]of [[10,8.5],[7,9.5],[8,9.5],[14,13.2]]){
  const hit=native.hits.find(h=>h.role===0&&h.index===index);near(hit.time,time);
  near(preview.roles[0].hits.find(h=>h.eventId===hit.eventId).time,time);
 }
 const raw=simulate([root(7.8,'cast','skill.hold'),root(11,'cast','burst')]);near(raw.completions.get('skill.hold/7.8'),8.5);near(raw.completions.get('burst/11'),13.2);
 const ordinary=simulate([root(0,'action','charged',{params:{holdMs:1000}})],0,2);near(ordinary.hits.find(h=>h.index===3).time,1);
 const tap=simulate([root(0,'cast','skill')],0,1);near(tap.hits.find(h=>h.index===9).time,.3);
});

test('new clocks keep Q resources after impact, core lifetime, interruption and C6 causality',()=>{
 const q=mityaInput(undefined,[a('e',0,'skill.hold',0),a('q',0,'burst',1),a('ca',0,'charged',3.3,{holdMs:1000}),end(4.4)]),qr=run(q);
 near(qr.hits.find(h=>h.index===14).time,3.2);near(qr.hits.find(h=>h.index===14).crit,.05);
 near(qr.resources.find(r=>r.reason==='gain'&&r.enabled).time,3.2);near(qr.hits.find(h=>h.index===7).crit,.2);
 const expiry=simulate([root(0,'cast','skill.hold')],0,26);assert.equal(expiry.runtime.stateAt({time:25.699,rootOrder:Infinity}).mode,2);assert.equal(expiry.runtime.stateAt({time:25.7,rootOrder:Infinity}).mode,0);
 const start=[root(0,'cast','skill.hold'),root(1,'cast','burst'),root(4,'action','charged',{params:{holdMs:4000}})];
 for(const stop of [[root(5.1,'action','normal.1')],[root(5.1,'switch',undefined,{from:0,role:1}),root(5.2,'switch',undefined,{from:1,role:0})]]){
  const r=simulate([...start,...stop],1,9);assert.deepEqual(r.hits.filter(h=>h.mityaKind==='gradient').map(h=>h.time),[4.5,4.95]);near(r.completions.get('charged/4'),5.1);
 }
 const cancelled=simulate([root(0,'cast','skill.hold'),root(1,'cast','burst'),root(4,'action','charged',{params:{holdMs:4000}}),root(4.4,'switch',undefined,{from:0,role:1})],1,9);
 assert.equal(cancelled.hits.filter(h=>h.mityaKind==='gradient').length,0);
 const c6=mityaInput(undefined,[a('e',0,'skill.hold',0),a('ca',0,'charged',1,{holdMs:1000}),a('stop',0,'normal.1',1.6),end(1.8)]);c6.single_interfaces[0].character.constellation=6;
 const result=run(c6);assert.equal(result.trace_outcomes.length,2);
 for(const b of result.trace_outcomes){const opening=b.output.hits.find(h=>h.index===7);near(opening.time,1.5);near(opening.crit,.1);}
});

function referenceInput(team){
 // Keep actual commands only. Supporting actors use the existing model;
 // these are cold-start checks, not the document's inherited steady state.
 const rows=team===1?[
  a('y1',2,'skill',0),a('y2',2,'skill',.95),a('y3',2,'skill',1.9),a('o1',1,'skill',2.1),a('o2',1,'skill',2.7),
  a('v-e',3,'skill',4.5),a('v-q',3,'burst',5.2),a('v-ca',3,'charged',6.5),
  a('m-e',0,'skill.hold',7.8),a('m-ca1',0,'charged',9,{holdMs:2000}),a('m-q',0,'burst',11),a('m-ca2',0,'charged',13.5,{holdMs:2000}),
  a('m-n1',0,'normal.1',15.7),a('o-q',1,'burst',16.4),a('m-n2',0,'normal.2',20),a('m-ca3',0,'charged',20.3,{holdMs:2000}),end(22.5),
 ]:[
  a('o1',1,'skill',.1),a('o2',1,'skill',.7),a('v-e',3,'skill',2.5),a('v-q',3,'burst',3.2),a('v-ca',3,'charged',4.5),a('s-e1',2,'skill',5.3),
  a('m-e',0,'skill.hold',6.8),a('m-ca1',0,'charged',8,{holdMs:2000}),a('m-q',0,'burst',10),a('m-ca2',0,'charged',12.5,{holdMs:2000}),
  a('m-n1',0,'normal.1',14.7),a('s-e2',2,'skill',15.3),a('o-q',1,'burst',16.4),a('m-ca3',0,'charged',19.8,{holdMs:2000}),end(22),
 ];
 return mityaInput(['Mitya','Odette',team===1?'YaeMiko':'Sucrose','Valeriy'],rows);
}

test('both supplied party structures retain full native/compiled A-B-A agreement',async()=>{
 const reports=[];
 for(const team of [1,2]){
  const x=referenceInput(team),first=x.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);second.flat().forEach(g=>g.id+=1000);second[0][0].sub_stats=[['ElementalMastery',200]];
  const reference=[first,second].map(t=>createTeamDpsEvaluator(api,x).evaluate(t,true));assert.ok(reference[0].character_damage.every(r=>r.expectation>0));
  const offset=team===1?1:0;
  near(reference[0].hits.find(h=>h.role===0&&h.index===10).time,7.5+offset);near(reference[0].hits.find(h=>h.role===0&&h.index===14).time,12.2+offset);
  assert.deepEqual(reference[0].hits.filter(h=>h.role===0&&h.index===7).map(h=>h.time),team===1?[9.5,14,20.8]:[8.5,13,20.3]);
  const inventory=[...first.flat(),...second.flat()],model=compileTeamDpsExpression(api,x,inventory,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,inventory);
  try{
   const scored=(await cpu.score([first,second,first].map(t=>t.map(g=>g.map(a=>a.id))),{detail:true})).results;
   for(const i of [0,1,2]){near(scored[i].expectation,reference[i===1?1:0].expectation);compareEventValues(scored[i].eventTrace,nativeEventTrace(reference[i===1?1:0]));}assert.deepEqual(scored[0],scored[2]);
   reports.push({team,seconds:reference[0].duration,damage:reference.map(r=>r.expectation),nodes:model.program.nodes.length,events:scored[0].eventTrace.events.length,passed:true});
  }finally{cpu.dispose();}
 }
 fs.writeFileSync(new URL('two-parties.json',output),JSON.stringify(reports,null,2));console.log(reports);
});

test('C6 short rotation preserves probability-linked fifth consumption in the actual CPU Worker',async()=>{
 const x=mityaInput(undefined,[a('e',0,'skill.hold',0),a('q',0,'burst',.8),a('ca1',0,'charged',3.1,{holdMs:1000}),a('ca2',0,'charged',4.2,{holdMs:1500}),end(5.8)]);
 x.single_interfaces[0].character.constellation=6;
 const native=run(x),builds=x.single_interfaces.map(p=>p.artifacts);let uses=0,c4=0,probability=0;
 for(const b of native.trace_outcomes){probability+=b.probability;uses+=b.probability*b.output.resources.filter(r=>r.enabled&&r.reason==='gradient').length;c4+=b.probability*b.output.hits.filter(h=>h.mityaKind==='c4').length;}
 near(probability,1);near(uses,4+1-.66**4);near(c4,1-.66**4);
 x.team_dps.initial_ids=builds.map(g=>g.map(a=>a.id));const worker=(await nodeTeamDps(x,builds.flat(),{mode:'evaluate'})).results[0];near(worker.expectation,native.expectation);compareEventValues(worker.eventTrace,nativeEventTrace(native));
 const report={passed:true,seconds:native.duration,branches:native.trace_outcomes.length,expectedUses:uses,expectedC4:c4,nativeDamage:native.expectation,workerDamage:worker.expectation};
 fs.writeFileSync(new URL('c6-worker.json',output),JSON.stringify(report,null,2));console.log(report);
});
