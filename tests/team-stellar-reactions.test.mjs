import test from 'node:test';
import assert from 'node:assert/strict';
import {createIceElectroReactions,elementalApplication as application,STELLAR_CONDUCT_COEFFICIENTS} from '../beta-data/team-engine/ice-electro-reactions.mjs';
import {teamNumericRules as numeric} from '../beta-data/team-dps-numeric-rules.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const hit=(time,role,element,app=application(),rootOrder=20,targetIds)=>({time,role,element,application:app,rootOrder,eventId:`${role}/${time}/${rootOrder}`,targetIds});

test('1U/2U aura tax, original decay, same-element refresh and no excess trigger aura',()=>{
 const r=createIceElectroReactions();r.apply(hit(0,0,'Cryo',application(2)));
 close(r.view().targets[0].Cryo,1.6);
 const first=r.apply(hit(0,1,'Electro'));
 close(first.after.targets[0].Cryo,.6);assert.equal(first.after.targets[0].Electro,0);assert.equal(first.triggered[0].role,1);
 r.apply(hit(1,1,'Electro'));assert.equal(r.view().targets[0].Cryo,0);assert.equal(r.view().targets[0].Electro,0);
 r.apply(hit(2,1,'Electro'));close(r.view().targets[0].Electro,.8);r.advance(11.5);close(r.view().targets[0].Electro,0);
 const s=createIceElectroReactions();s.apply(hit(0,0,'Cryo'));s.apply(hit(1,1,'Cryo',application(2)));s.advance(2);close(s.view().targets[0].Cryo,1.6-.8/9.5);
});
test('ICD groups share hits across skills and do not restart timer on hit-rule application',()=>{
 const r=createIceElectroReactions(),shared=application(1,'same',3,2.5);
 const actual=[0,.1,.2,.3,2.4,2.5].map(t=>r.apply(hit(t,0,'Cryo',shared)).applied.length);
 assert.deepEqual(actual,[1,0,0,1,0,1]);
 const q=createIceElectroReactions(),qiqi=application(1,'qiqi-e',2,2);
 assert.deepEqual([0,.1,.2,.3,2].map(t=>q.apply(hit(t,0,'Cryo',qiqi)).applied.length),[1,0,1,0,1]);
 assert.equal(q.apply(hit(2,1,'Cryo',qiqi)).applied.length,1);
});
test('field creation excluded; source .1s record gate, next-window count and exact 4s boundary',()=>{
 const r=createIceElectroReactions({stellarEnabled:true});r.apply(hit(0,0,'Electro'));r.apply(hit(1,1,'Cryo'));
 assert.equal(r.view().field.pending,0);assert.equal(r.view().coefficient,1);
 r.apply(hit(2,2,'Cryo'));r.apply(hit(2.05,2,'Cryo'));r.apply(hit(2.05,3,'Cryo'));r.apply(hit(2.1,2,'Cryo'));
 assert.equal(r.view().field.pending,3);assert.equal(r.view().coefficient,1);
 const boundary=r.apply(hit(5,0,'Electro'));
 assert.equal(boundary.before.coefficient,1.55);assert.equal(boundary.after.field.pending,1);
 assert.equal(r.at({time:4.99,rootOrder:Infinity}).coefficient,1);assert.equal(r.at({time:5,rootOrder:Infinity}).coefficient,1.55);
});
test('field lifetime refresh keeps its clock; buffs expire separately and zero-U deals no application',()=>{
 const r=createIceElectroReactions({stellarEnabled:true});r.apply(hit(0,0,'Electro'));r.apply(hit(1,1,'Cryo'));
 r.apply(hit(2,1,'Cryo'));r.apply(hit(3,0,'Electro'));assert.equal(r.view().field.next,5);assert.equal(r.view().field.until,9);
 r.advance(5);assert.equal(r.view().count,2);
 const noApply=r.apply(hit(5.1,1,'Cryo',application(0)));assert.equal(noApply.applied.length,0);assert.equal(r.view().field.pending,0);
 r.advance(9);assert.equal(r.view().field,null);assert.equal(r.view().radiance,false);
 const s=createIceElectroReactions({stellarEnabled:true});s.apply(hit(0,0,'Electro'));s.apply(hit(1,1,'Cryo'));s.advance(7);assert.equal(s.view().field,null);assert.equal(s.view().radiance,true);s.advance(9);assert.equal(s.view().radiance,false);
});
test('multi-target field count deduplicates; ordinary reaction AoE retains 2/.5s limit',()=>{
 const r=createIceElectroReactions({stellarEnabled:true,targetCount:3});r.apply(hit(0,0,'Electro'));const creation=r.apply(hit(1,1,'Cryo'));
 assert.equal(creation.triggered.length,3);assert.equal(creation.damage.length,0);assert.equal(r.view().field.pending,0);
 r.apply(hit(2,1,'Cryo'));assert.equal(r.view().field.pending,1);
 const s=createIceElectroReactions({targetCount:3});s.apply(hit(0,0,'Cryo'));const result=s.apply(hit(1,1,'Electro'));
 assert.equal(result.damage.length,2);assert.deepEqual(result.damage.flatMap(e=>e.targetIds),[0,1,2,0,1,2]);
 assert.equal(result.damage[0].role,1);assert.equal(result.after.targets[0].physicalResMinus,.4);
 s.advance(13);assert.equal(s.view().targets[0].superconduct,false);
});
test('independent damage expectations: modern superconduct and all thirteen SSC coefficients',()=>{
 close(numeric.superconduct(1446.8535,0,0,.9,1).expectation,1953.252225);
 close(numeric.superconduct(1446.8535,500,.8,.9,2).expectation,1446.8535*1.5*(1+3.2+.8)*.9*2);
 const p={base:2000*1.615,baseBonus:.28,em:500,bonus:.5,independent:.3,flat:12000,elevation:.2,resistance:.9,targets:1,critical:.5,criticalDamage:1};
 for(let i=0;i<13;i++){
  const coefficient=i===0?1:1.4+.05*i,result=numeric.stellarConduct({...p,coefficient:STELLAR_CONDUCT_COEFFICIENTS[i]});
  const expected=(2000*1.615*coefficient*1.28*2.7*1.3+12000)*.9*1.2;
  close(result.non_critical,expected);close(result.expectation,expected*1.5);
 }
});
