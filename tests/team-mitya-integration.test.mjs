import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mityaInput,action as a,end} from './helpers/team-mitya-fixture.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {MITYA_RATIOS} from '../beta-data/team-engine/characters/mitya-runtime.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=n=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+n+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);

test('direct Stellar Swirl retains the caster graph on a cold level lookup',async()=>{
 const x=mityaInput(['Sandrone','Sucrose','Odette','Qiqi'],[a('s-e',0,'skill',0),a('wind',1,'skill',.5),a('o-e1',2,'skill',2),a('o-e2',2,'skill',2.6),a('ca',0,'charged',3.7),{...end(6.5),actor:'member4'}]);
 x.single_interfaces[0].character.constellation=4;x.single_interfaces[2].character.constellation=4;
 const artifacts=x.single_interfaces.flatMap(p=>p.artifacts),model=compileTeamDpsExpression(api,x,artifacts,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{
  const native=run(x),result=(await cpu.score([x.single_interfaces.map(p=>p.artifacts.map(g=>g.id))],{detail:true})).results[0];
  near(result.expectation,native.expectation);compareEventValues(result.eventTrace,nativeEventTrace(native));
  near(native.hits.find(h=>h.role===0&&h.index===18).crit,.392);
  near(native.hits.find(h=>h.role===0&&h.index===18).res,1.05);
 }finally{cpu.dispose();}
});

test('Mitya core modes, beacon expiry/overflow, true consumption and C6 refunds',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../beta-data/mitya-v4.json',import.meta.url)));
 for(const [key,t,p]of [['gradient',0,9],['overflow',1,3],['detonation',1,4],['steady',1,2]])assert.deepEqual(MITYA_RATIOS[key],data.talents[t].levels.map(l=>l.parameters[p]));
 const x=mityaInput(),r=run(x),stars=r.hits.filter(h=>h.mityaKind==='gradient');assert.equal(stars.length,3);
 const expected=100*4.032*(1.028+519.85*.00007)*(1+6*100/2100)*.9*(1+.2*.884);
 stars.forEach(h=>near(h.expectation,expected));
 assert.deepEqual(r.resources.filter(h=>h.resource==='mitya.beacons'&&h.reason==='gradient').map(h=>h.after),[2,1,0]);
 const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));assert.equal(preview.roles[0].hits.filter(h=>h.damageModel==='reaction.stellarConduct').length,3);near(preview.roles[0].hits.find(h=>h.damageModel==='reaction.stellarConduct').base.em,4.032);
 const steady=mityaInput(undefined,[a('e',0,'skill',0),a('ice',2,'skill',.4),a('q',0,'burst',2),end(9)]),s=run(steady);
 assert.ok(s.hits.some(h=>h.index===11));assert.ok(s.hits.some(h=>h.mityaKind==='overflow'));assert.ok(!s.hits.some(h=>h.mityaKind==='gradient'));
 const stale=mityaInput(undefined,[a('e',0,'skill.hold',0),a('q',0,'burst',1),a('ca',0,'charged',14),end(18)]);assert.equal(run(stale).hits.filter(h=>h.mityaKind==='gradient').length,0);
 const c6=mityaInput(undefined,[a('e',0,'skill.hold',0),a('ca',0,'charged',1,{holdMs:1000}),a('stop',0,'normal.1',1.6),end(1.8)]);c6.single_interfaces[0].character.constellation=6;const c=run(c6);
 near(c.trace_outcomes.reduce((n,b)=>n+b.probability*b.output.resources.filter(h=>h.resource==='mitya.beacons'&&h.reason==='gradient').reduce((n,h)=>n+h.after,0),0),.34);
 assert.ok(c.trace_outcomes?.length===2);
});

test('Valeriy spends fifteen real target uses, snapshots spent momentum and keeps source attack live',()=>{
 const x=mityaInput(undefined,[a('e',1,'skill',0),a('ca',1,'charged',1),...Array.from({length:6},(_,i)=>a('n'+i,0,'normal.1',2+i)),end(9)]);x.team_dps.enemy_count=3;
 const r=run(x),hits=r.hits.filter(h=>h.role===0&&h.category==='normal');assert.equal(hits.length,18);
 hits.slice(0,15).forEach(h=>near(h.flat,545.6*(.43776+.003*40)));hits.slice(15).forEach(h=>near(h.flat,0));
 const single=structuredClone(x);single.team_dps.damage_scope='single';const t=run(single);near(t.expectation,r.expectation/3);
 const buffed=structuredClone(x);buffed.single_interfaces[1].artifacts[0].sub_stats=[['ATKFixed',200]];near(run(buffed).hits.find(h=>h.role===0).flat,(545.6+200)*(.43776+.003*40));
 x.single_interfaces[1].character.constellation=6;const c6=run(x);near(c6.resources.find(h=>h.resource==='valeriy.momentum'&&h.reason==='gain').after,130);
 assert.ok(c6.hits.filter(h=>h.role===0).some(h=>h.crit>.05));
});

test('Sucrose real Swirl, element-matched A1, candidate A4 snapshot and VV expiry',()=>{
 const x=mityaInput(['Mitya','Sucrose','Odette','YaeMiko'],[a('seed',0,'normal.1',0),a('wind',1,'skill',.5),a('read',0,'normal.1',2),a('expired',0,'normal.1',12),end(13)]);
 x.single_interfaces[1].artifacts.forEach(g=>g.set_name='ViridescentVenerer');x.single_interfaces[1].artifacts[0].sub_stats=[['ElementalMastery',200]];
 const r=run(x),read=r.hits.find(h=>h.time===2),expired=r.hits.find(h=>h.time===12),swirl=r.hits.find(h=>h.damageKind==='swirl');near(read.em,190);near(expired.em,100);near(read.res,1.15);near(expired.res,.9);
 near(swirl.non_critical,.6*1446.8535*(1+16*200/2200+.6)*1.15);
 const q=mityaInput(['Mitya','Sucrose','Odette','YaeMiko'],[a('seed',0,'normal.1',0),a('q',1,'burst',.2),end(9)]);q.single_interfaces[1].character.constellation=2;const qr=run(q);assert.equal(qr.hits.filter(h=>h.role===1&&h.index===9).length,4);assert.equal(qr.hits.filter(h=>h.role===1&&h.index===12).length,4);
});

test('Stellar Swirl records actual Cryo contributors and a delayed vortex; exact crit rank expectation',()=>{
 const x=mityaInput(['Mitya','Sucrose','Odette','YaeMiko'],[a('ice',2,'skill',0),a('wind',1,'skill',.5),end(5)]),r=run(x),hits=r.hits.filter(h=>h.damageKind==='stellarSwirl');
 assert.deepEqual([...new Set(hits.map(h=>h.role))].sort(),[1,2]);assert.equal(hits.filter(h=>h.element==='Anemo').length,2);assert.equal(hits.filter(h=>h.element==='Cryo').length,2);near(hits.find(h=>h.element==='Cryo').time,1.2+181/60);
 // Sum of independently weighted contributions must equal the actual total.
 near(r.character_damage.reduce((n,v)=>n+v.expectation,0),r.expectation);
 const rows=hits.filter(h=>h.element==='Anemo'),base=1446.8535*.75*.9*(1+519.85*.00007);
 // Odette: 60% personal splendor. Sucrose: no transferred splendor yet.
 const n=[base,base*1.6],cr=[.05,.05],cd=[.5,.884];let expected=0;
 for(let bits=0;bits<4;bits++){const p=cr.reduce((p,v,i)=>p*((bits>>i)&1?v:1-v),1),v=n.map((v,i)=>v*(1+(((bits>>i)&1)?cd[i]:0))).sort((a,b)=>b-a);expected+=p*(v[0]*.6+v[1]*.3);}
 near(rows.reduce((n,h)=>n+h.expectation,0),expected);
 const furnace=structuredClone(x);furnace.single_interfaces[1].artifacts.forEach(g=>g.set_name='HeartOfTheFurnace');
 const boosted=run(furnace).hits.filter(h=>h.damageKind==='stellarSwirl');
 // The triggering initial hit has already snapshotted; the later vortex sees
 // the granted set bonus at its own resolution time.
 near(boosted.find(h=>h.role===1&&h.element==='Anemo').bonus,0);
 for(const role of [1,2])near(boosted.find(h=>h.role===role&&h.element==='Cryo').bonus,hits.find(h=>h.role===role&&h.element==='Cryo').bonus+.5);
});

test('three requested parties reuse one candidate graph each and are invariant under party permutation',async()=>{
 const inputs=[
  mityaInput(undefined,[a('y1',3,'skill',0),a('y2',3,'skill',.95),a('y3',3,'skill',1.9),a('o1',2,'skill',2.1),a('o2',2,'skill',2.7),a('v-e',1,'skill',4),a('v-q',1,'burst',5.5),a('v-ca',1,'charged',7.5),a('m-e',0,'skill.hold',8.5),a('m-ca',0,'charged',9),a('m-q',0,'burst',12.6),a('m-ca2',0,'charged',13.7),end(18.3)]),
  mityaInput(['Mitya','Sucrose','Odette','YaeMiko'],[a('y1',3,'skill',0),a('y2',3,'skill',.95),a('y3',3,'skill',1.9),a('s-e',1,'skill',1.9),a('o1',2,'skill',3.1),a('o2',2,'skill',3.8),a('m-e',0,'skill.hold',5.7),a('m-ca',0,'charged',6.2),a('m-ca2',0,'charged',10.7,{holdMs:2000}),a('s-e2',1,'skill',11.5),a('m-q',0,'burst',13),a('m-ca3',0,'charged',14.6),end(18.2)]),
  mityaInput(['Mitya','Sandrone','Odette','Qiqi'],[a('m-e',0,'skill',0),a('o1',2,'skill',.6),a('o2',2,'skill',1.1),a('qiqi-e',3,'skill',2.3),a('ca1',1,'charged',4.4),a('s-e',1,'skill',8.6),a('s-q',1,'burst',9.7),a('ca2',1,'charged',11.4),a('s-e2',1,'skill',15.6),a('ca3',1,'charged',16.1),end(20.9)]),
 ];
 for(const [caseId,x]of inputs.entries()){
  const first=x.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);second.flat().forEach(g=>g.id+=10000);second[0][0].sub_stats=[['ElementalMastery',200],['ATKFixed',100]];
  const teams=[first,second,first],native=teams.map(t=>createTeamDpsEvaluator(api,x).evaluate(t,true));assert.ok(native[0].character_damage.every(r=>r.expectation>0));
  const order=[3,1,0,2],p=structuredClone(x);p.single_interfaces=order.map(i=>x.single_interfaces[i]);p.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);near(run(p).expectation,native[0].expectation);
  const artifacts=[...first.flat(),...second.flat()],model=compileTeamDpsExpression(api,x,artifacts,resources,undefined,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
  try{const results=(await computation.score(teams.map(t=>t.map(b=>b.map(g=>g.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);console.log('three-party',caseId,'nodes',model.program.nodes.length,'damage',results[0].expectation);}finally{computation.dispose();}
 }
});
