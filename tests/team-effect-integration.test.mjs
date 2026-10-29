import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {TEAM_ACTION_CATALOG,validateActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {TEAM_CONSTELLATION_TALENTS} from '../beta-data/team-dps-character-rules.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const evaluate=input=>createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true);
const permutations=items=>items.length?items.flatMap((x,i)=>permutations(items.filter((_,j)=>j!==i)).map(p=>[x,...p])):[[]];

test('character catalog, parameters and constellation metadata have one package owner',()=>{
 for(const p of Object.values(characterPackages)){
  assert.equal(TEAM_ACTION_CATALOG[p.id],p.actions);
  assert.equal(TEAM_CONSTELLATION_TALENTS[p.id],p.constellationTalents);
 }
 const input=effectInput();validateActionAxis(input.team_dps.axis);
 input.team_dps.axis.timeline[0].params={absorbedRifts:2};
 assert.throws(()=>validateActionAxis(input.team_dps.axis),/裂隙/);
});

test('static action/effect structure compiles once even when a weapon expands probability branches',()=>{
 const input=effectInput();input.single_interfaces[3].weapon={name:'TheWidsith',level:90,ascend:false,refine:1,params:'NoConfig'};
 input.team_dps.axis.timeline.push(action('return','Vodyanitsa','normal.1',2500));
 let compiled=0;
 const evaluator=createTeamDpsEvaluator(api,input,{compileRotation:(...args)=>{compiled++;return compileActionAxis(...args);}});
 const out=evaluator.evaluate(input.single_interfaces.map(p=>p.artifacts),true);
 assert.equal(compiled,1);assert.ok(out.health_branches.length>=3);
 assert.equal(out.profiles[0].character.skill2,input.single_interfaces[0].character.skill2+1);
});

test('native evaluation composes Tenacity → source attack → C2, with candidate HP conversion and immutable scoring reads',()=>{
 const input=effectInput(),builds=input.single_interfaces.map(p=>p.artifacts),evaluator=createTeamDpsEvaluator(api,input),out=evaluator.evaluate(builds,true);
 const hit=out.hits.find(h=>h.eventId==='n1/normal.1'),second=out.hits.find(h=>h.eventId==='n2/normal.2');
 const hp=sum(out.hits.find(h=>h.role===3).analysis.hp);
 const panel=api.CommonInterface.get_attribute({...out.profiles[2],artifacts:builds[2]});
 const base=panel.atk['角色基础攻击']+panel.atk['武器基础攻击'];
 const expected=(sum(panel.atk)+base*.2+hp*.008)*2.4;
 near(hit.analysis.extra_damage['爱可菲·二命·冷盘'],expected);
 near(second.analysis.extra_damage['爱可菲·二命·冷盘'],expected*2/3);
 const spent=out.effects.filter(e=>e.effectId==='escoffier.c2'&&e.kind==='consume');
 assert.deepEqual(spent.map(e=>e.used),[3,2]);
 const stronger=structuredClone(builds);for(const a of stronger[3]){a.id+=900000;a.sub_stats.push(['HPPercentage',.3]);}
 const next=evaluator.evaluate(stronger,true).hits.find(h=>h.eventId==='n1/normal.1');
 assert.ok(next.analysis.extra_damage['爱可菲·二命·冷盘']>hit.analysis.extra_damage['爱可菲·二命·冷盘']);
 assert.equal(evaluator.evaluate(builds).expectation,out.expectation);
 assert.deepEqual(evaluator.evaluate(builds,true).effects,out.effects);
});

test('a later same-time E cannot grant earlier hits C2; C1 lasts five seconds after the final Song heal',()=>{
 const input=effectInput();input.team_dps.axis.timeline=[action('s-e','Skirk','skill',0),action('before','Skirk','normal.1',1000),action('e-e','Escoffier','skill',1000),action('end','Skirk','skill',2000)];
 let out=evaluate(input),hit=out.hits.find(h=>h.eventId==='before/normal.1');
 assert.equal(hit.analysis.extra_damage['爱可菲·二命·冷盘'],undefined);
 input.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('s-e','Skirk','skill',17000),action('tail','Skirk','normal.1',18000),action('expiry','Skirk','normal.1',20000)];
 out=evaluate(input);
 assert.ok(out.hits.find(h=>h.eventId==='tail/normal.1').analysis.atk['沃雅妮莎·一命']>0);
 assert.equal(out.hits.find(h=>h.eventId==='expiry/normal.1').analysis.atk['沃雅妮莎·一命'],undefined);
});

test('all 24 party slot orders preserve generated hits and native scoring with cross-character effects',()=>{
 const input=effectInput(),baseline=evaluate(input),canon=out=>out.hits.map(h=>[h.eventId,h.part,h.time,out.profiles[h.role].character.name,h.expectation]);
 for(const p of permutations([0,1,2,3])){
  const changed=structuredClone(input);changed.single_interfaces=p.map(i=>input.single_interfaces[i]);
  changed.team_dps.axis.members=p.map(i=>input.team_dps.axis.members[i]);
  changed.team_dps.weapon_conditions=p.map(i=>input.team_dps.weapon_conditions[i]);
  const out=evaluate(changed);near(out.expectation,baseline.expectation);
  const a=canon(out),b=canon(baseline);assert.deepEqual(a.map(h=>h.slice(0,4)),b.map(h=>h.slice(0,4)));a.forEach((h,i)=>near(h[4],b[i][4]));
 }
 assert.ok(compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps).events.length>0);
});
