import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mityaInput,action as a,end} from './helpers/team-mitya-fixture.mjs';
import {createMityaRuntime} from '../beta-data/team-engine/characters/mitya-runtime.mjs';
import {createValeriyRuntime} from '../beta-data/team-engine/characters/valeriy-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createIceElectroReactions} from '../beta-data/team-engine/ice-electro-reactions.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0),run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const output=new URL('../../.work/mitya-valeriy-release-20261104/',import.meta.url);
fs.mkdirSync(output,{recursive:true});
const root=(time,kind,action,extra={})=>({time,kind,action:action==='skill.hold'?'skill':action,actionId:action,role:0,rootOrder:0,id:action+'/'+time,...extra});
function simulate(factory,roots,{constellation=0,until=12}={}){
 const scheduler=createEventScheduler(roots),hits=[],resources=[],completions=new Map();let active=0;
 const runtime=factory({role:0,profile:{character:{level:90,constellation,skill1:9,skill2:9,skill3:9}},enqueue:scheduler.enqueue,resources,activeRole:()=>active,reactions:{refreshField(){},at:()=>({radiance:false})},complete:(e,t)=>completions.set(e.id,t)});
 for(const e of scheduler.events()){
  if(e.time>until)break;if(e.kind==='switch')active=e.role;
  runtime.beforeEvent?.(e);if(e.kind==='hit'){if(e.enabled??1)hits.push(e);runtime.onHit?.(e);}else runtime.onEvent?.(e);
 }
 return {runtime,hits,resources,completions};
}

test('2: release native formulas, signature, buffs and the real single-character optimizer',()=>{
 const x=mityaInput().single_interfaces[0];x.character.params.Mitya={core_mode:2,beacons:4,crit_stacks:0,on_field:true,polestar:false,field_hits:0};
 const damage=(p,index)=>api.CalculatorInterface.get_damage_analysis({...p,skill:{index,config:'NoConfig'}},null);
 const ordinary=ratio=>448*ratio*.5*.9*(1+.05*.884);
 near(damage(x,0).normal.expectation,ordinary(1.058371));
 near(damage(x,14).normal.expectation,(448*6.0048+100*12.0096)*.5*.9*(1+.05*.884));
 const star=(em,ratio,cd=.884,elevation=1)=>em*ratio*(1+Math.min(.14,em*.00028))*(1+6*em/(2000+em))*.9*(1+.05*cd)*elevation;
 near(damage(x,8).direct_stellarconduct.expectation,star(100,4.032));
 const c6=structuredClone(x);c6.character.constellation=6;near(damage(c6,8).direct_stellarconduct.expectation,star(334,4.032,1.284,1.2));
 c6.character.params.Mitya.core_mode=1;c6.character.params.Mitya.beacons=5;
 near(damage(c6,15).direct_stellarconduct.expectation,star(373,3*1.15,1.284,1.2));
 const sig=structuredClone(x);sig.weapon={name:'StarsealedEdict',level:90,ascend:false,refine:1,params:{StarsealedEdict:{skill_active:true,stacks:3,radiance:true}}};
 near(sum(api.CommonInterface.get_attribute(sig).elemental_mastery),220);near(damage(sig,8).direct_stellarconduct.expectation,star(220,4.032,2.366));
 const buff={name:'ValeriyDirective',config:{ValeriyDirective:{atk:2000,talent_level:10,ascended:true,momentum:40,radiance:true,recipient_on_field:true,active:true}}};
 const supported=structuredClone(x);supported.buffs=[buff];near(damage(supported,8).direct_stellarconduct.expectation-star(100,4.032),2000*(1.31328+.009*40)*.9*(1+.05*.884));
 supported.character.params.Mitya.on_field=false;near(damage(supported,8).direct_stellarconduct.expectation,star(100,4.032));
 const v=mityaInput().single_interfaces[1];v.character.constellation=6;Object.assign(v.character.params.Valeriy,{directive:false,c2_active:false,c6_active:false,shield_overflow:20});
 near(damage(v,4).normal.expectation,545.6*4.1256*2*.5*.9*1.025);
 near(damage(v,9).normal.expectation,545.6*(3.760128+1.6)+2881.4229);
 const legal=structuredClone(x);legal.artifacts.forEach((g,i)=>{g.set_name='GladiatorsFinale';g.main_stat=[['HPFixed','ATKFixed','HPPercentage','HPPercentage','CriticalRate'][i],0];});
 const alt={...structuredClone(legal.artifacts[2]),id:999,sub_stats:[['ElementalMastery',200]]},inventory=[...legal.artifacts,alt];
 const result=api.OptimizeSingleWasm.optimize({...legal,algorithm:'AStar'},inventory);near(result[0].value,star(300,4.032));assert.equal(result[0].sand,999);
 const dsl=api.DSLInterface.run('dmg hit = Mitya.GradientStellar\nprint(hit.direct_stellarconduct.e)',x,x.artifacts);assert.equal(dsl.is_error,false);near(Number(dsl.output.trim().replace(/^MONA: /,'')),star(100,4.032));
});

test('3: Mitya generation boundary, recast cooldown, channel cancellation and attachment',()=>{
 const reactions=[root(0,'reaction',undefined,{reactionType:'StellarConduct',role:1}),root(3,'reaction',undefined,{reactionType:'StellarConduct',role:1})];
 const generated=simulate(createMityaRuntime,reactions,{until:6});assert.deepEqual(generated.resources.filter(r=>r.enabled&&r.reason==='gain').map(r=>r.time),[1.5,3,4.5,6]);
 const mode=simulate(createMityaRuntime,[root(0,'cast','skill.hold'),root(.6,'cast','skill'),root(1.5,'cast','skill')],{constellation:1,until:2});
 assert.equal(mode.hits.filter(e=>[9,10].includes(e.index)).length,1);assert.equal(mode.runtime.stateAt({time:2,rootOrder:Infinity}).mode,1);
 assert.equal(mode.resources.filter(r=>r.enabled&&r.reason==='gain').length,1);
 const start=[root(0,'cast','skill.hold'),root(.6,'action','charged',{params:{holdMs:5000}})];
 for(const interrupt of [[root(2.2,'action','normal.1')],[root(2.2,'switch',undefined,{role:1,from:0}),root(2.4,'switch',undefined,{role:0,from:1})]]){
  const stopped=simulate(createMityaRuntime,[...start,...interrupt],{constellation:1,until:6});
  assert.deepEqual(stopped.hits.filter(h=>h.mityaKind==='gradient').map(h=>h.time),[1.1]);near(stopped.completions.get('charged/0.6'),2.2);
 }
 const channel=simulate(createMityaRuntime,[...start,root(2.3,'action','charged',{params:{holdMs:1500}})],{constellation:1,until:4});
 const initials=channel.hits.filter(h=>h.index===7);assert.ok(initials.length);for(const h of initials)assert.deepEqual(h.application,{gauge:1,group:'mitya.gradient',hits:3,interval:2.5});
 assert.ok(channel.hits.filter(h=>h.mityaKind==='gradient').every(h=>h.application===null));
 const c6=mityaInput(undefined,[a('e',0,'skill.hold',0),a('ca',0,'charged',1,{holdMs:1000}),a('stop',0,'normal.1',1.6),end(1.8)]);c6.single_interfaces[0].character.constellation=6;
 const result=run(c6);assert.equal(result.trace_outcomes.length,2);near(result.trace_outcomes.reduce((n,b)=>n+b.probability*b.output.resources.filter(r=>r.reason==='gradient'&&r.enabled).reduce((n,r)=>n+r.after,0),0),.34);
 const cold=mityaInput(undefined,[a('ice',2,'skill',0),a('trigger',0,'normal.1',1),a('before-beacon',0,'normal.1',1.2),a('after-beacon',0,'normal.1',2.6),end(4)]),field=run(cold);
 near(field.hits.find(h=>h.role===0&&h.time===1.2).bonus,0);near(field.hits.find(h=>h.role===0&&h.time===2.6).bonus,.2);
 const ordinary=structuredClone(cold);ordinary.single_interfaces[0]=mityaInput().single_interfaces[3];ordinary.team_dps.axis.members[0].character='YaeMiko';
 near(run(ordinary).hits.find(h=>h.role===0&&h.eventId.includes('before-beacon')).bonus,.2);
});

test('4: Valeriy special ICD, actual multi-target uses, live attack and C2/C6 scope',()=>{
 const simulated=simulate(createValeriyRuntime,[root(0,'cast','burst')],{until:13}),barrage=simulated.hits.filter(h=>h.index===11),aura=createIceElectroReactions();
 assert.equal(barrage.length,12);const attached=barrage.filter(h=>aura.apply(h).applied.length).map(h=>h.time);assert.deepEqual(attached,[1.1,3.1,5.1,7.1,9.1,11.1]);
 const x=mityaInput(undefined,[a('e',1,'skill',0),a('ca',1,'charged',1),...Array.from({length:6},(_,i)=>a('n'+i,0,'normal.1',2+i)),a('expired',0,'normal.1',20),end(21)]);x.team_dps.enemy_count=3;
 const result=run(x),hits=result.hits.filter(h=>h.role===0&&h.category==='normal');assert.equal(hits.length,21);
 hits.slice(0,15).forEach(h=>near(h.flat,545.6*(.43776+.003*40)));hits.slice(15).forEach(h=>near(h.flat,0));
 const buffed=structuredClone(x);buffed.single_interfaces[1].character.constellation=6;buffed.single_interfaces[1].artifacts[0].sub_stats=[['ATKFixed',200]];
 const high=run(buffed);near(high.resources.find(r=>r.resource==='valeriy.momentum'&&r.reason==='gain').after,130);
 const first=high.hits.find(h=>h.role===0);near(first.flat,745.6*(.43776+.003*130));near(first.crit,.15);near(first.em,200);
 const last=high.hits.find(h=>h.role===0&&h.time===20);near(last.em,100);near(last.crit,.05);
});

test('5: full C6 axis native/compiled A-B-A event values and the actual CPU Worker',async()=>{
 const x=mityaInput();x.team_dps.axis=JSON.parse(fs.readFileSync(new URL('../examples/team-dps/mitya-c6-full-actions-18_3s.json',import.meta.url)));
 for(const role of [0,1]){const c=x.single_interfaces[role].character;c.constellation=6;c.skill1+=3;c.skill2+=3;}
 x.single_interfaces[3].character.constellation=1;
 x.single_interfaces.forEach((p,role)=>{p.artifacts[0].sub_stats=[['ElementalMastery',role===0?400:100],['ATKFixed',150],['CriticalRate',.2],['CriticalDamage',.4]];});
 x.team_dps.axis.rulesVersion='mona-team-engine/58';
 // Interrupt one long channel with Q; a later switch-back must not resurrect it.
 x.team_dps.axis.timeline.find(r=>r.id==='mitya-ca1').params.holdMs=6000;
 const first=x.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);second.flat().forEach(g=>g.id+=10000);second[0][0].sub_stats.push(['ElementalMastery',200]);
 const teams=[first,second,first],inventory=[...first.flat(),...second.flat()],read=n=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+n+'.json',import.meta.url)));
 const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
 const native=[first,second].map(t=>createTeamDpsEvaluator(api,x).evaluate(t,true));
 assert.ok(native[0].character_damage.every(r=>r.expectation>0));
 const model=compileTeamDpsExpression(api,x,inventory,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,inventory);
 try{
  const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(g=>g.id))),{detail:true})).results;
  for(const i of [0,1,2]){const reference=native[i===1?1:0];near(results[i].expectation,reference.expectation);compareEventValues(results[i].eventTrace,nativeEventTrace(reference));}
  assert.deepEqual(results[0],results[2]);
  x.team_dps.initial_ids=first.map(b=>b.map(g=>g.id));
  const worker=(await nodeTeamDps(x,first.flat(),{mode:'evaluate'})).results[0];near(worker.expectation,native[0].expectation);compareEventValues(worker.eventTrace,results[0].eventTrace);
  const report={passed:true,seconds:native[0].duration,damage:native.map(r=>r.expectation),workerDamage:worker.expectation,nodes:model.program.nodes.length,branches:native.map(r=>r.trace_outcomes.length),eventRows:results.map(r=>r.eventTrace.events.length)};
  fs.writeFileSync(new URL('runtime-validation.json',output),JSON.stringify(report,null,2));console.log(report);
 }finally{cpu.dispose();}
});
