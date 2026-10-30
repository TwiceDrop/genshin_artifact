import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {actionTime} from '../beta-data/team-engine/rule-utils.mjs';
import {SANDRONE_TIMING} from '../beta-data/team-engine/characters/sandrone.mjs';
import {sandrone} from '../beta-data/team-engine/characters/sandrone.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';

const names=['Odette','Alyosha','Qiqi','Mona'];
const profiles=cons=>names.map((name,i)=>({character:{name,level:90,ascend:false,skill1:9,skill2:9,skill3:9,constellation:cons?.[i]??0},weapon:{name:''}}));
const action=(role,skill,time)=>({kind:'action',actor:'member'+(role+1),action:skill,timeMs:time*1000});
const change=(role,time)=>({kind:'switch',actor:'member'+(role+1),timeMs:time*1000});
function run(rows,cons,settings={}){
 const axis=createActionAxis('synthetic-team3',names);axis.timeline=rows.map((a,i)=>({...a,id:'a'+i}));
 return compileActionAxis(axis,profiles(cons),settings);
}

test('Alyosha Q retains every A/B damage hit; C2 extends lifetime; recast cancels a pending old bite',()=>{
 const c0=run([action(1,'burst',0),change(3,22)]);
 assert.equal(c0.events.filter(h=>h.alyoshaField).length,7);
 assert.equal(c0.events.filter(h=>h.alyoshaDog).length,7);
 assert.equal(c0.events.at(-1).time,actionTime((79+6*118+39)/60));
 const c2=run([action(1,'burst',0),change(3,22)],[0,2]);
 assert.equal(c2.events.filter(h=>h.alyoshaField).length,10);
 assert.equal(c2.events.filter(h=>h.alyoshaDog).length,10);
 const recast=run([action(1,'burst',0),action(1,'burst',1.5),change(3,22)]);
 assert.equal(recast.events.length,15);
 assert.ok(!recast.events.some(h=>h.alyoshaDog&&h.time===actionTime(118/60)));
 assert.equal(c0.duration,22);
});

function sand(rows,cons=0,settings={}){
 const axis=createActionAxis('synthetic-sandrone',['Sandrone','Alyosha','Qiqi','Odette']);axis.timeline=rows.map((a,i)=>({...a,id:'s'+i}));
 const p=profiles().map((p,i)=>({...p,character:{...p.character,name:axis.members[i].character,constellation:i===0?cons:0}}));
 return compileActionAxis(axis,p,settings);
}
test('Sandrone power state derives three/six rays; C6 fires four separate extras; finite tail extends the axis',()=>{
 const c0=sand([action(0,'charged',0)]),c1=sand([action(0,'charged',0)],1),c6=sand([action(0,'charged',0)],6);
 assert.deepEqual(c0.events.filter(h=>h.sandroneRay).map(h=>h.time),[1.5,2.5,3.5]);
 assert.deepEqual(c1.events.filter(h=>h.sandroneRay).map(h=>h.time),[1.5,2.5,3.5,4.5,5.5,6.5]);
 assert.deepEqual(c6.events.filter(h=>h.index===16).map(h=>h.time),[3.7,4.7,5.7,6.7]);
 // The final ordinary sweep at 6 5/6 s is later than the last C6 ray at 6.7.
 assert.equal(c6.duration,actionTime(6+5/6));assert.equal(SANDRONE_TIMING.skillInitialCooling,40);
 assert.deepEqual(c6.events.filter(h=>h.sandroneRay).map(h=>h.sandroneRayStacks),[1,2,3,3,3,3]);
 const interrupted=sand([action(0,'charged',0),change(1,3.6)],6);
 const delayed=interrupted.events.find(h=>h.index===16),rule=sandrone.create({role:0,profiles:[{character:{constellation:6}}],rotation:()=>interrupted,math:scalarMath});
 assert.equal(delayed.time,3.7);assert.equal(delayed.onField,false);
 assert.equal(rule.attackBuffs(0,delayed)[0].config.ExtensionEffect.values.EnhanceStellarSuperconduct,0);
});
test('Sandrone E cools over time, early cancellation preserves power, and Q consumes internally generated tactics',()=>{
 const prefix=[action(1,'burst',0),action(3,'skill',.5),action(0,'charged',1)];
 const normal=sand([...prefix,action(0,'skill',5),action(0,'burst',5.7)]);
 const early=sand([...prefix,action(0,'skill',5),action(0,'burst',5)]);
 const beam=normal.events.find(h=>h.role===0&&h.index===14),short=early.events.find(h=>h.role===0&&h.index===14);
 assert.equal(beam.sandroneTactics,10);assert.ok(short.sandroneTactics<beam.sandroneTactics);
 assert.equal(normal.events.find(h=>h.role===0&&h.index===11).sandroneOvercharge,true);
 const twice=sand([...prefix,action(0,'skill',5),action(0,'burst',5.7),action(0,'burst',6)]);
 assert.equal(twice.events.filter(h=>h.role===0&&h.index===14)[1].sandroneTactics,0);
 const cutoff=sand([action(0,'charged',0),change(1,2)]);
 assert.equal(cutoff.events.filter(h=>h.sandroneRay).length,1);
 assert.ok(cutoff.events.every(h=>h.time<=2));
});
test('Odette N5 and charged each use their own single native coefficient; finite C4 follow-up survives terminal coda',()=>{
 const attacks=run([action(0,'normal.5',0),action(0,'charged',1)]);
 assert.deepEqual(attacks.events.map(h=>h.index),[5,6]);
 const tail=run([action(0,'skill',0),action(0,'skill',1)],[4]);
 assert.ok(Math.abs(tail.duration-(1+67/60))<1e-10);
 assert.equal(tail.events.at(-1).index,24);
});

test('Qiqi rings keep damage without attachment; coordinated attacks require the actual on-fielder',()=>{
 const rot=run([action(2,'skill',0),change(3,.6),action(2,'normal.1',2),action(0,'normal.1',2.1),change(3,2.2),change(3,16)]);
 assert.equal(rot.events.filter(h=>h.qiqiRing).length,9);
 const coords=rot.events.filter(h=>h.noCoordinate);
 assert.deepEqual(coords.map(h=>h.time),[.55,actionTime(2.1+1/60)]);
 assert.ok(coords.every(h=>h.role===2));
 assert.ok(rot.events.some(h=>h.qiqiRing&&!h.applicationTargets.length));
 assert.equal(rot.heals.filter(h=>h.healing==='qiqi.periodic').length,4);
 assert.ok(rot.heals.every(h=>typeof h.healing==='string'));
 assert.equal(rot.activeRole(4),3);
});

test('Odette second E is a separate command; ordinary and star dance damage coexist after the coda',()=>{
 const single=run([action(0,'skill',0),change(3,8)]);
 assert.equal(single.events.filter(h=>h.index===10).length,1);
 assert.equal(single.events.filter(h=>h.odetteFinal).length,0);
 const second=run([action(1,'skill',0),action(0,'skill',.5),action(0,'skill',1.2),change(3,2.4),change(3,5)]);
 assert.equal(second.events.filter(h=>h.index===11).length,3);
 assert.equal(second.events.filter(h=>h.odetteFinal).length,1);
 const dance=second.events.find(h=>h.odetteDance===0);
 assert.equal(dance.time,3.1);
 const star=second.events.find(h=>h.label==='翎舞·星超导');
 assert.equal(star.time,dance.time);
 assert.equal(star.damageKind,'stellarConduct');
 assert.equal(star.applicationTargets.length,0);
 assert.equal(second.activeRole(star.time),3);
});

test('terminal Odette Q splits native total into three slashes and one finale; summons cannot extend it',()=>{
 const rot=run([action(0,'burst',1)]);
 assert.equal(rot.duration,3.4);
 const slashes=rot.events.filter(h=>h.index===20);
 assert.equal(slashes.length,3);assert.ok(slashes.every(h=>h.parts===3));
 assert.equal(rot.events.filter(h=>h.index===21).length,1);
 assert.equal(rot.events.filter(h=>h.odetteDance!==undefined).length,0);
 assert.equal(run([action(0,'skill',1)]).duration,actionTime(1+23/60));
});

test('Qiqi burst locks radiance at cast; C6 is four targets shared only by other on-field star attacks',()=>{
 const rows=[action(1,'skill',0),action(0,'skill',.5),action(2,'burst',1),action(0,'skill',2),change(3,4),change(3,7)];
 const rot=run(rows,[0,0,6],{enemy_count:3});
 assert.equal(rot.events.filter(h=>h.index===19&&h.role===2).length,1);
 const empowered=rot.events.filter(h=>h.qiqiFlatTargets?.length);
 assert.deepEqual(empowered.map(h=>h.qiqiFlatTargets.length),[3,1]);
 assert.equal(empowered[0].role,0);
 assert.ok(rot.events.filter(h=>h.role===0&&!h.onField).every(h=>!h.qiqiFlatTargets?.length));
 const cold=run([action(2,'burst',0),action(1,'skill',.1),action(0,'skill',.5),change(3,3)]);
 assert.equal(cold.events.filter(h=>h.role===2&&h.index===19).length,0);
});
