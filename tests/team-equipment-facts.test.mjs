import test from 'node:test';import assert from 'node:assert/strict';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {equipmentEnergy,equipmentPickups,huskStacks} from '../beta-data/equipment-combat-facts.mjs';
import {factOutputs,factEvent as e,factRotation,factProfiles} from './helpers/team-equipment-facts.mjs';
const numbers=rows=>rows.map(Number);
test('disabled skill neither spends energy nor occupies cooldown; zero energy emits no loss and cast boundary is causal',()=>{
 const p=factProfiles();p[1].weapon.name='KatsuragikiriNagamasa';const cast=e('q',3,1,{kind:'cast',action:'burst'}),hit=e('skill',1,1,{category:'skill',enabled:0});
 const r=factRotation([cast],[hit,e('next',2,1,{category:'skill'}),e('late',12,1,{category:'skill'})]),energy=equipmentEnergy(p,r);
 assert.equal(energy.at(1,{time:1.5,rootOrder:Infinity}).current,60);assert.equal(energy.at(1,{time:2.5,rootOrder:Infinity}).current,57);
 assert.equal(energy.at(1,cast).current,57);assert.equal(energy.at(1,{...cast,rootOrder:cast.rootOrder+.02}).current,0);
 assert.deepEqual(energy.histories[1].rows.map(h=>h.amount),[3,57]);
});
test('leaf generation, pickup and expiration are gated independently and one leaf cannot be consumed twice',()=>{
 const p=factProfiles();p[2].weapon.name='SapwoodBlade';
 const pickups=equipmentPickups(p,factRotation([e('first',1,0,{kind:'pickup',item:'leaf',source:'c',enabled:0}),e('take',2,1,{kind:'pickup',item:'leaf',source:'c'}),e('again',3,0,{kind:'pickup',item:'leaf',source:'c'}),e('expired',30,0,{kind:'pickup',item:'leaf',source:'c'})]),[e('react',0,2,{reaction:'Bloom'}),e('react2',20,2,{reaction:'Bloom'})]);
 assert.deepEqual(pickups.leaves.map(h=>h.eventId),['take']);assert.equal(pickups.leaves[0].role,1);
});
test('first Geo hit gains Husk immediately, physical hit cannot, and passive gain does not spend the hit cooldown',()=>{
 const p=factProfiles(),r=factRotation([], [e('first',0,1,{category:'skill',element:'Geo',onField:true}),e('physical',.15,1,{category:'normal',element:'Physical',onField:true}),e('second',.3,1,{category:'skill',element:'Geo',onField:true})],1);
 assert.equal(huskStacks(p,r,1,{time:.1,rootOrder:Infinity}),1);assert.equal(huskStacks(p,r,1,{time:.2,rootOrder:Infinity}),1);assert.equal(huskStacks(p,r,1,{time:.31,rootOrder:Infinity}),2);assert.equal(huskStacks(p,r,1,{time:6.3,rootOrder:Infinity}),1);
 const swap=factRotation([e('in',3,1,{kind:'switch'})],[e('hit',3,1,{category:'skill',element:'Geo',onField:true,rootOrder:301})]);
 assert.equal(huskStacks(p,swap,1,{time:3.01,rootOrder:Infinity}),2);
});
test('all eight condition patterns match independently removed facts in scalar and compiled energy/pickup/aim/decay state',()=>{
 const b=createNumericProgram(),m=createNativeGraphCompiler(b,{funcs:{},table:[]}).math,program=b.finish(factOutputs(m,[0,1,2].map(i=>b.input(i))).outputs);
 for(let mask=0;mask<8;mask++){
  const gates=[0,1,2].map(i=>(mask>>i)&1),expected=numbers(factOutputs(scalarMath,gates,{remove:true}).outputs);
  assert.deepEqual(numbers(factOutputs(scalarMath,gates).outputs),expected);assert.deepEqual(executeNumericProgram(program,gates),expected);
 }
 assert.equal(factOutputs(scalarMath,[0,1,1]).energy[0],60);assert.equal(factOutputs(scalarMath,[1,1,1]).energy[0],57);
});
test('energy and pickup ownership are invariant in all 24 party orders without mutating facts',()=>{
 const p=factProfiles();p[1].weapon.name='KatsuragikiriNagamasa';p[2].weapon.name='SapwoodBlade';
 const roots=[e('pickup',1,0,{kind:'pickup',item:'leaf',source:'c'}),e('swap',2,1,{kind:'switch'}),e('q',3,1,{kind:'cast',action:'burst'})],hits=[e('disabled',.2,1,{category:'skill',element:'Geo',enabled:0}),e('geo',.5,1,{category:'skill',element:'Geo'})],reactions=[e('leaf',0,2,{reaction:'Bloom'})];
 const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(p=>[x,...p])):[[]];let baseline;
 for(const permutation of permutations([0,1,2,3])){
  const map=r=>permutation.indexOf(r),profiles=permutation.map(i=>p[i]),remap=h=>({...h,role:map(h.role)}),r=factRotation(roots.map(remap),hits.map(remap),map(0));r.slots=permutation.map(i=>['a','b','c','d'][i]);
  const rs=reactions.map(remap),saved=JSON.stringify([profiles,r.roots,r.events,rs]),energy=equipmentEnergy(profiles,r),pickups=equipmentPickups(profiles,r,rs);
  const canonical={energy:[1,4].map(time=>energy.at(map(1),{time,rootOrder:Infinity})),leaves:pickups.leaves.map(h=>[h.eventId,profiles[h.role].character.name,profiles[h.source].character.name]),crystals:pickups.crystals.map(h=>[h.eventId,profiles[h.role].character.name,profiles[h.source].character.name])};
  if(baseline)assert.deepEqual(canonical,baseline);else baseline=canonical;assert.equal(JSON.stringify([profiles,r.roots,r.events,rs]),saved);
 }
});
