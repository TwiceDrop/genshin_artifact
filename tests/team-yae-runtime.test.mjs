import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {yaeInput,yaeTeams,yaeAction as a,yaeEnd as end,installYaePrimer,gatedYaeEvaluator} from './helpers/team-yae-fixture.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {normalizeTeamProfiles,createCharacterRules} from '../beta-data/team-engine/registry.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(x,y)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<1e-10*Math.max(1,Math.abs(y)),`${x} != ${y}`),sum=x=>Object.values(x??{}).reduce((a,b)=>a+b,0);
const rotation=x=>compileActionAxis(x.team_dps.axis,normalizeTeamProfiles(x.single_interfaces),x.team_dps),run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
test('independent Sakura clocks, replacement, C2 rank, expiry and bounded Q/E endings match candidate execution',()=>{
 const rows=[a('e1',0,'skill',0),a('e2',0,'skill',.95),a('e3',0,'skill',1.9),end(27)],r=rotation(yaeInput(0,rows)),hits=r.events.filter(e=>e.yaeSakura);
 assert.equal(hits.length,24);assert.deepEqual(hits.slice(0,3).map(e=>e.index),[8,9,9]);hits.slice(0,3).forEach((e,i)=>near(e.time,121/60+i*.95));
 const c2=rotation(yaeInput(2,rows));assert.deepEqual(c2.events.filter(e=>e.yaeSakura).slice(0,3).map(e=>e.index),[9,10,10]);
 const replaced=rotation(yaeInput(0,[...rows.slice(0,3),a('e4',0,'skill',4),end(10)]));assert.ok(!replaced.events.some(e=>e.yaeSakura==='e1'&&e.time>4.6));assert.ok(replaced.events.some(e=>e.yaeSakura==='e2'&&e.time>4.6));assert.equal(replaced.events.filter(e=>e.index===13).length,1);
 for(let n=0;n<=3;n++){
  const x=yaeInput(0,[...Array.from({length:n},(_,i)=>a('e'+i,0,'skill',i)),a('q',0,'burst',4)]),preview=rotation(x),actual=run(x);
  const duration=4+(n?154/60+(n-1)*.4:100/60);near(preview.duration,duration);near(actual.duration,duration);assert.equal(actual.hits.filter(e=>e.role===0&&e.category==='burst').length,n+1);
  x.team_dps.axis.endHit='exclude';assert.equal(run(x).hits.filter(e=>e.role===0&&e.category==='burst').length,n);
 }
 near(rotation(yaeInput(0,[a('e',0,'skill',0)])).duration,34/60);
 near(run(yaeInput(0,[a('e1',0,'skill',0),a('e2',0,'skill',1),a('e3',0,'skill',2),a('e4',0,'skill',4)])).duration,4+98/60);
});
test('reaction-owned enhancement, single-target star, EM conversion and additive 80% use independent equations',()=>{
 const restore=installYaePrimer();
 try{
  const x=yaeInput(6,[a('e1',0,'skill',0),a('e2',0,'skill',.95),a('e3',0,'skill',1.9),a('primer1',3,'normal.1',2.1),a('primer2',3,'normal.1',4.1),end(10)]);x.single_interfaces[0].weapon=weapon('ApprenticesNotes');
  const result=run(x),normal=result.hits.find(h=>h.yaeSakura&&!h.yaeEnhanced),enhanced=result.hits.filter(h=>h.yaeSakura&&h.yaeEnhanced),stars=result.hits.filter(h=>h.role===0&&h.index===16);
  near(normal.atk,525);near(normal.em,120);near(normal.non_critical,525*1.7064*1.18*190/270*.9);
  near(enhanced[0].flat,525*.8);near(enhanced[0].non_critical,525*(2.133+.8)*1.7*190/270*.9);
  near(stars[0].non_critical,525*2*(1+6*200/2200)*.9);near(stars[0].crit_damage,2.5);assert.ok(stars.every(h=>h.targetIds.length===1&&h.application===null));
  for(let i=1;i<enhanced.length;i++)assert.ok(enhanced[i].time-enhanced[i-1].time>=2.5-1e-10);
  const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character)),shown=preview.roles[0].hits.find(h=>h.modifiers.some(m=>m.label==='八重神子·祓所之讬宣'));near(shown.base.atk,2.133);near(shown.effective.atk,2.933);
  const plan=rotation(x),rules=createCharacterRules(normalizeTeamProfiles(x.single_interfaces),()=>plan,scalarMath,x.team_dps),buff=(r,time)=>rules.instances[0].attackBuffs(r,{time,rootOrder:Infinity}).reduce((n,b)=>n+(b.config.ExtensionEffect.values.ElementalMastery??0),0);
  near(buff(0,.7),90);near(buff(0,1.7),120);near(buff(0,2.7),200);near(buff(3,2.7),200);near(buff(1,2.7),0);near(buff(0,40),0);
 }finally{restore();}
});
test('live candidate EM and buff clocks reuse one native program with matching source traces and party permutations',async()=>{
 const restore=installYaePrimer();
 try{
  const input=yaeInput(),teams=yaeTeams(input),native=teams.map((t,i)=>gatedYaeEvaluator(api,{...input,testPrimerEnabled:i===1?0:1}).evaluate(t,true));
  assert.ok(native[0].hits.some(e=>e.role===0&&e.index===16));assert.equal(native[1].hits.some(e=>e.role===0&&e.index===16),false);
  assert.ok(native[0].hits.some(e=>e.role===0&&e.index===14));assert.ok(native[1].hits.some(e=>e.role===0&&e.index===13));
  for(const result of native)for(const hit of result.hits.filter(h=>h.yaeSakura))near(hit.analysis.bonus['八重神子天赋「启蜇之祝词」'],hit.em*.0015);
  const order=[3,0,2,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(createTeamDpsEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedYaeEvaluator,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
  try{
   const outputs=(await computation.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;
   outputs.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(outputs[0],outputs[2]);
  }finally{computation.dispose();}
 }finally{restore();}
});
test('Kagura stacks refresh together for 24 seconds and its star bonus is scoped and applied once',()=>{
 const x=yaeInput(0,[a('e1',0,'skill',0),a('e2',0,'skill',1),a('e3',0,'skill',2),end(27)]),p=normalizeTeamProfiles(x.single_interfaces),r=rotation(x),rules=createEquipmentAxisRules(p,r,x.team_dps),builds=p.map(p=>p.artifacts);
 for(const [time,count]of [[.1,1],[1.1,2],[2.1,3],[18,3],[25.999,3],[26,0]]){
  const event={time,rootOrder:Infinity,order:999,damageModel:'reaction.stellarConduct'},copy=structuredClone(p[0]);rules.prepare(copy,0,event);assert.equal(copy.weapon.params.KagurasVerity.stack,count);
  const bonus=rules.baseBuffs(builds,0,event).reduce((n,b)=>n+(b.config.ExtensionEffect.values.EnhanceStellarSuperconduct??0),0);near(bonus,count*.12);
  assert.equal(rules.baseBuffs(builds,0,{...event,damageModel:'native.skill'}).some(b=>b.config.ExtensionEffect.values.EnhanceStellarSuperconduct),false);
 }
});
