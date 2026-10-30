import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {sample,builds,gear} from '../beta-tools/team-dps-full-audit.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {createActionTeamEvaluator,compileActionAxis} from '../beta-data/team-engine/index.mjs';

export function actionInput(){const x=sample();x.team_dps.axis=JSON.parse(fs.readFileSync('examples/team-dps/skirk-actions-prototype.json','utf8'));return x;}
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);

test('action engine: module-owned schedules, repeated casts and finite constellation attacks',()=>{
 const input=actionInput(),profiles=input.single_interfaces,axis=input.team_dps.axis,base=compileActionAxis(axis,profiles,input.team_dps);
 assert.equal(axis.coverage,undefined);assert.ok(axis.timeline.every(e=>['action','switch'].includes(e.kind)));
 assert.deepEqual(profiles.map((_,r)=>base.events.filter(e=>e.role===r).length),[33,26,19,5]);
 assert.deepEqual([11,10,12].map(index=>base.events.filter(e=>e.role===1&&e.index===index).length),[13,7,4]);
 const one=structuredClone(input);one.team_dps.axis.timeline=one.team_dps.axis.timeline.filter(e=>e.actor==='hydro'&&e.action==='skill');
 const salon=createActionTeamEvaluator(api,one).evaluate(builds(one),true);
 assert.equal(salon.hits.length,25);assert.ok(salon.hits.some(h=>h.time===20.4));assert.ok(salon.health.some(h=>h.ratios.every(v=>v<1)));
 const moved=structuredClone(axis);moved.durationMs+=1000;moved.timeline.forEach(e=>e.timeMs+=1000);
 const shifted=compileActionAxis(moved,profiles,input.team_dps);
 assert.equal(shifted.events.length,base.events.length);base.events.forEach((e,i)=>{near(shifted.events[i].time,e.time+1,'shift');assert.equal(shifted.events[i].index,e.index);});
 const repeated=structuredClone(axis);repeated.timeline.push({id:'second-salon',kind:'action',actor:'hydro',action:'skill',timeMs:10000});
 const again=compileActionAxis(repeated,profiles,input.team_dps);
 assert.equal(again.events.filter(e=>e.role===1&&e.index===9).length,2);
 assert.ok(!again.events.some(e=>e.eventId.startsWith('event-4/salon')&&e.time>=10));
 const secondQ=structuredClone(axis);secondQ.timeline.push({id:'second-heal',kind:'action',actor:'healer',action:'burst',timeMs:10000});
 const rehab=compileActionAxis(secondQ,profiles,input.team_dps);assert.equal(rehab.heals.filter(h=>h.role===2&&h.time===10.5).length,0);assert.ok(rehab.heals.some(h=>h.role===2&&h.time===11));
 for(const p of profiles)p.character.constellation=6;
 const c6=compileActionAxis(axis,profiles,input.team_dps);
 assert.equal(c6.events.filter(e=>e.c6).length,15);
 assert.equal(c6.events.filter(e=>e.eventId.endsWith('/escoffier.c6')).length,6);
 assert.equal(c6.events.filter(e=>e.label==='一命·追加重击').length,5);
 for(const key of ['team-dps-evaluator.mjs','team-dps-portable-health.mjs','team-engine/timeline.mjs'])assert.doesNotMatch(fs.readFileSync('beta-data/'+key,'utf8'),/Skirk|Furina|Escoffier|Vodyanitsa/);
});

test('action engine: character IDs survive reordered slots; candidate HP and equipment remain live',()=>{
 const input=actionInput();input.single_interfaces.forEach(p=>p.character.constellation=6);input.team_dps.initial_hp=[.8,.6,.7,.9];
 input.single_interfaces[3].weapon=weapon('ThrillingTalesOfDragonSlayers');
 input.single_interfaces[2].artifacts=gear(2,'OceanHuedClam');input.single_interfaces[3].artifacts=gear(3,'TenacityOfTheMillelith');
 const team=builds(input),out=createActionTeamEvaluator(api,input).evaluate(team,true),perm=[3,0,2,1],reordered=structuredClone(input);
 reordered.single_interfaces=perm.map(r=>input.single_interfaces[r]);reordered.team_dps.axis.members=perm.map(r=>input.team_dps.axis.members[r]);reordered.team_dps.initial_hp=perm.map(r=>input.team_dps.initial_hp[r]);reordered.team_dps.weapon_conditions=perm.map(r=>input.team_dps.weapon_conditions[r]);
 const changed=createActionTeamEvaluator(api,reordered).evaluate(perm.map(r=>team[r]),true);
 for(const k of ['expectation','critical','non_critical','fanfare','furina_overflow'])near(changed[k],out[k],'reorder/'+k);
 perm.forEach((r,j)=>near(changed.character_damage[j].expectation,out.character_damage[r].expectation,'role'));
 const e=createActionTeamEvaluator(api,input),higher=structuredClone(team);higher[3].forEach(a=>{a.id+=900000;a.sub_stats.push(['HPPercentage',.5]);});
 const stronger=e.evaluate(higher,true);assert.ok(stronger.character_damage[0].expectation>out.character_damage[0].expectation);
 near(e.evaluate(team).expectation,out.expectation,'cache reset');
 const hit=out.hits.find(h=>h.role===0&&h.time===8.5);
 assert.ok(hit.analysis.atk['讨龙英杰谭']>0);assert.ok(hit.analysis.atk['千岩牢固4']>0);
 assert.ok(out.hits.some(h=>h.category==='equipment'));
 fs.writeFileSync('.build-target/team-engine-feasibility-20261028/V2-actions.json',JSON.stringify({actions:input.team_dps.axis.timeline.length,hits:out.hits.length,health:out.health.length,expectation:out.expectation,reordered:changed.expectation,higherSupportHP:stronger.expectation},null,2));
});
