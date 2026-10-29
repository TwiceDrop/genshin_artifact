import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {normalizeTeamProfiles} from '../beta-data/team-engine/registry.mjs';
import {createEscoffierRuntime} from '../beta-data/team-engine/characters/escoffier-runtime.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {escoffierSkillInput,escoffierSkillTeams} from './helpers/team-escoffier-skill.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const compile=x=>compileActionAxis(x.team_dps.axis,normalizeTeamProfiles(x.single_interfaces),x.team_dps);
const active=rotation=>rotation.events.filter(e=>e.enabled??1);

test('Escoffier has one initial hit, one Arkhe and 21 measured Parfait impacts; tail and in-flight recast are explicit',()=>{
 const x=escoffierSkillInput(),rotation=compile(x),events=active(rotation);
 assert.equal(events.length,23);assert.deepEqual(events.map(e=>e.index),[7,7,...Array(21).fill(8)]);
 near(events[0].time,23/60);near(events[1].time,83/60);near(events[1].ratio,.6384);
 events.slice(2).forEach((e,i)=>near(e.time,(153+Math.ceil(58.5*i))/60));
 const changed=escoffierSkillInput('recast'),recast=compile(changed);
 // Shot at 148f survives a recast at 150f and lands at 153f; later old shots stop.
 assert.deepEqual(active(recast).filter(e=>e.eventId.startsWith('e/parfait/')).map(e=>e.time),[2.55]);
 assert.equal(Number(recast.events.find(e=>e.eventId==='e2/arkhe').enabled),0);assert.equal(Number(recast.events.find(e=>e.eventId==='e3/arkhe').enabled),1);
 for(const endHit of ['include','exclude']){const y=structuredClone(x);y.team_dps.axis.endHit=endHit;y.team_dps.axis.timeline.at(-1).timeMs=2550;assert.equal(active(compile(y)).filter(e=>e.index===8).length,endHit==='include'?1:0);}
});

test('Arkhe cooldown follows actual enabled impacts in scalar and numeric state, including its exact boundary',()=>{
 function evaluate(m,gate){const plugin=createEscoffierRuntime({role:2,profile:{character:{constellation:0}},math:m}),events=[{time:1,enabled:gate},{time:2,enabled:1},{time:11,enabled:1}].map(e=>({...e,escoArkhe:true}));events.forEach(e=>plugin.prepareHit(e));return events.map(e=>e.enabled);}
 const b=createNumericProgram(),program=b.finish(evaluate(b.math,b.input(0)));
 for(const gate of [0,1]){const expected=gate?[1,0,1]:[0,1,0];assert.deepEqual(evaluate(scalarMath,gate).map(Number),expected);assert.deepEqual(executeNumericProgram(program,[gate]),expected);}
});

test('initial E grants shred only after damage; Arkhe and projectiles neither recurse into C6 nor spend other-member C2',()=>{
 const solo=escoffierSkillInput(),first=createTeamDpsEvaluator(api,solo).evaluate(solo.single_interfaces.map(p=>p.artifacts),true);
 assert.equal(first.hits[0].analysis.res_minus['爱可菲·灵感浸入调味'],undefined);assert.equal(first.hits[1].analysis.res_minus['爱可菲·灵感浸入调味'],.55);
 const x=escoffierSkillInput('team'),builds=x.single_interfaces.map(p=>p.artifacts),run=scope=>{const input=structuredClone(x);input.team_dps.damage_scope=scope;return createTeamDpsEvaluator(api,input).evaluate(builds,true);},all=run('all'),single=run('single');
 assert.equal(all.hits.filter(e=>e.eventId.endsWith('/escoffier.c6')).length,6);
 const used=all.effects.filter(e=>e.effectId==='escoffier.c2'&&e.kind==='consume');assert.deepEqual(used.map(e=>e.used),[3,2]);assert.ok(used.every(e=>e.eventId.startsWith('n')));
 assert.deepEqual(all.effects.filter(e=>e.kind==='consume'),single.effects.filter(e=>e.kind==='consume'));
});

test('Escoffier timings, all talent levels and actual Worker calculations agree, with candidate rollback and actor permutations',async()=>{
 for(const mode of ['solo','recast','team']){
  const x=escoffierSkillInput(mode),teams=escoffierSkillTeams(x),evaluator=createTeamDpsEvaluator(api,x),native=teams.map(team=>evaluator.evaluate(team,true));
  assert.ok(native[1].expectation>native[0].expectation);near(evaluator.evaluate(teams[0]).expectation,native[0].expectation);
  const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));
  assert.equal(preview.roles[2].hits.filter(h=>h.label==='流涌之刃').length,native[0].hits.filter(h=>h.escoArkhe&&(h.enabled??1)).length);
  for(const hit of native[0].hits.filter(e=>e.escoArkhe&&(e.enabled??1))){const shown=preview.roles[2].hits.find(e=>e.eventId===hit.eventId);near(hit.analysis.atk_ratio['技能倍率'],.6384);near(shown.base.atk,.6384);}
  for(const [i,team]of teams.entries()){
   const input=structuredClone(x);input.team_dps.initial_ids=team.map(build=>build.map(a=>a.id));
   const result=(await nodeTeamDps(input,teams.flat(2),{mode:'evaluate'})).results[0];
   for(const key of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])near(result[key],native[i][key]);compareEventValues(result.eventTrace,nativeEventTrace(native[i]));
  }
  function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
  for(const order of permutations([0,1,2,3])){const y=structuredClone(x);y.single_interfaces=order.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_ids=order.map(i=>x.team_dps.initial_ids[i]);y.team_dps.initial_hp=order.map(i=>x.team_dps.initial_hp[i]);near(createTeamDpsEvaluator(api,y).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);}
 }
 const ratios=[.336,.3612,.3864,.42,.4452,.4704,.504,.5376,.5712,.6048,.6384,.672,.714,.756,.798];
 for(let level=0;level<15;level++){const x=escoffierSkillInput();x.single_interfaces[2].character.skill2=level;const rotation=compile(x),hit=rotation.events.find(e=>e.escoArkhe);near(hit.ratio,ratios[Math.min(level+1,14)]);}
});
