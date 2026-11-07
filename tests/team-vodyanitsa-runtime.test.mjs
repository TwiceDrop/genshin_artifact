import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {vodyInput,vodyTeams,vodyAction,gatedVodyEvaluator} from './helpers/team-vodyanitsa-fixture.mjs';
import {vodyanitsa} from '../beta-data/team-engine/characters/vodyanitsa.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {afterEvent,eventBefore} from '../beta-data/team-engine/event-order.mjs';
import {scalarMath as m} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const event=(id,time,extra={})=>({eventId:id,time,rootOrder:0,order:0,role:0,kind:'hit',index:8,element:'Hydro',category:'skill',...extra});
test('Vodyanitsa declares shared normal/skill ICD, free charged/impact and 2U burst; collision has no aura',()=>{
 const input=vodyInput();input.team_dps.enemy_count=1;input.team_dps.axis.timeline=[vodyAction('e',0,'skill',0),...Array.from({length:7},(_,i)=>vodyAction('n'+i,0,'normal.'+(i%4+1),100+i*100)),vodyAction('ca',0,'charged',900),vodyAction('pc',0,'plunge.collision',1100),vodyAction('pl',0,'plunge.low',1300),vodyAction('ph',0,'plunge',1500),vodyAction('q',0,'burst',1700),{id:'end',actor:'member1',kind:'switch',timeMs:7000}];
 const plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),runtime=createElementalRuntime({actorIds:plan.slots,enqueue:()=>{},emitReaction:()=>{throw Error('Hydro-only replay');}});
 for(const h of plan.events){runtime.prepare(h);runtime.after(h);}
 const normals=new Set(plan.events.filter(e=>e.category==='normal').map(e=>e.eventId));
 assert.deepEqual(runtime.applications.filter(e=>normals.has(e.eventId)).map(e=>Number(e.enabled)),[1,0,0,1,0,0,1]);
 assert.equal(plan.events.find(e=>e.index===5).application,undefined);assert.equal(plan.events.find(e=>e.index===11).application.gauge,2);
 const skill=new Set(plan.events.filter(e=>[8,9].includes(e.index)).map(e=>e.eventId));assert.deepEqual(runtime.applications.filter(e=>skill.has(e.eventId)).map(e=>Number(e.enabled)),[1,1,1]);
});
test('enemy-scoped resistance refreshes only struck targets; C2 is post-horn, element/front scoped and expires at five seconds',()=>{
 for(const cons of [2,6]){
  const input=vodyInput();input.single_interfaces[0].character.constellation=cons;
  const rotation={slots:['v','y','e','f'],roots:[],events:[],model:'actions',activeRole:()=>2},plan=compileEffectPlan(input.single_interfaces,rotation,input.team_dps);plan.sources=plan.sources.filter(s=>s.definition.id.startsWith('vodyanitsa.')&&!s.definition.id.includes('.a4.'));
  const state=createEffectState(plan,{math:m,enabled:()=>1,events:[]}),resolver=createEffectResolver(plan,state,m);
  const values=(e,target)=>Object.assign({},...resolver.resolve('damage',e.role,e,()=>0,[target]).map(b=>b.config.ExtensionEffect.values));
  const first=event('first',0,{targetIds:[0]}),horn=event('horn',3,{index:9,targetIds:[1]}),refresh=event('refresh',5,{index:8,targetIds:[0]}),disabled=event('disabled',7,{index:9,targetIds:[1],enabled:0});
  [first,horn,refresh,disabled].forEach(e=>state.publish(e));
  assert.equal(values(first,0).ResMinusBase,undefined);near(values(afterEvent(first),0).ResMinusBase,.3);assert.equal(values(afterEvent(first),1).ResMinusBase,undefined);
  assert.equal(values(horn,1).CriticalDamageBase,undefined);
  near(values(event('cryo',3.1,{role:2,element:'Cryo'}),1).CriticalDamageBase,.5);
  assert.equal(values(event('electro',3.1,{role:2,element:'Electro'}),1).CriticalDamageBase,undefined);
  assert.equal(values(event('back',3.1,{role:3}),1).CriticalDamageBase,cons===6?.5:undefined);
  assert.equal(values(event('expiry',8,{role:2}),1).CriticalDamageBase,undefined);
  near(values(event('t0',9,{role:2}),0).ResMinusBase,.3);assert.equal(values(event('t1',9,{role:2}),1).ResMinusBase,undefined);assert.equal(values(event('t0end',11,{role:2}),0).ResMinusBase,undefined);
 }
});
test('C4 counts only qualifying Song heals, preserves pre-heal HP and independent expiries across recasts and numeric candidates',()=>{
 const builder=createNumericProgram(),profiles=vodyInput().single_interfaces,heals=[event('h0',0,{kind:'heal',recipients:[1],hpRatiosBefore:[1,.39,1,1]}),event('h1',1,{kind:'heal',recipients:[1],hpRatiosBefore:[1,.4,1,1]}),event('h2',2,{kind:'heal',recipients:[1],hpRatiosBefore:[1,.6,1,1],enabled:builder.input(0)}),event('h3',3,{kind:'heal',recipients:[1],hpRatiosBefore:[1,.6,1,1],healing:'black_sword'})];
 const rotation=()=>({heals,healthAt:()=>({ratios:[1,.4,1,1]})}),rule=vodyanitsa.create({role:0,profiles,rotation,math:builder.math});
 const outputs=[.5,1,1.1,2.1,6.5,7,8].map(time=>{const p=structuredClone(profiles[0]);vodyanitsa.normalize(p);rule.prepare(p,event('read',time));return p.character.params.Vodyanitsa.c4_stacks;});
 const program=builder.finish(outputs);assert.deepEqual(executeNumericProgram(program,[1]),[0,0,1,2,2,1,0]);assert.deepEqual(executeNumericProgram(program,[0]),[0,0,1,1,1,0,0]);
 const scalar=vodyanitsa.create({role:0,profiles,rotation,math:m});assert.equal(scalar.recipientHealing({},1,100),100);
 const low=vodyanitsa.create({role:0,profiles,rotation:()=>({heals,healthAt:()=>({ratios:[1,.39,1,1]})}),math:m});assert.equal(low.recipientHealing({},1,100),150);assert.equal(low.recipientHealing({healing:'black_sword'},1,100),100);
});
test('real Vodyanitsa mixed team recomputes health/conversion, freeze/EC and target debuffs for A/B/A and party permutations',async()=>{
 const input=vodyInput(),teams=vodyTeams(input),rotations=[],native=teams.map((t,i)=>gatedVodyEvaluator(api,{...input,testHorns:i===1?0:1},{captureRotation:r=>rotations.push(r)}).evaluate(t,true));
 assert.ok(rotations[0].reactionFacts.some(e=>e.reactionType==='Frozen'));assert.ok(native[0].hits.some(h=>h.damageModel==='reaction.electroCharged'));
 for(const result of native){
  const heals=result.heals.filter(h=>h.role===0&&!h.healing),base=result.health[0].maxHP[0];assert.ok(heals.some(h=>h.hpRatiosBefore[h.recipients[0]]<.4));
  for(const row of result.health.filter(h=>h.healing&&h.role===0&&!h.healing.healing)){
   const stacks=Math.min(3,heals.filter(h=>h.time<=row.time&&row.time<h.time+6&&h.hpRatiosBefore[h.recipients[0]]>=.4).length);near(row.maxHP[0],base+14818*.2*stacks);
  }
  for(const hit of result.hits){const conversion=hit.analysis.atk['沃雅妮莎·一命'];if(conversion!==undefined){const stacks=Math.min(3,heals.filter(h=>eventBefore(h,hit)&&hit.time<h.time+6&&h.hpRatiosBefore[h.recipients[0]]>=.4).length);near(conversion,.008*(base+14818*.2*stacks));}}
  const horn=result.hits.filter(h=>h.role===0&&h.index===9);if(horn.length)assert.ok(horn.every(h=>h.targetIds[0]===1));
 }
 assert.notEqual(native[0].fanfare,native[1].fanfare);
 const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);permuted.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
 // The fixture identifies the source by actor identity, just as production does.
 near(gatedVodyEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedVodyEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
});
