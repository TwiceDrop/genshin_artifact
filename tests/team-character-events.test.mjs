import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {eventKey} from '../beta-data/team-engine/event-order.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';
import {characterEventInput} from './helpers/team-character-events.mjs';
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps);
const evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(p=>[x,...p])):[[]];
const reordered=(x,p)=>{const y=structuredClone(x);y.single_interfaces=p.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=p.map(i=>x.team_dps.axis.members[i]);for(const key of ['weapon_conditions','initial_hp'])if(x.team_dps[key])y.team_dps[key]=p.map(i=>x.team_dps[key][i]);return y;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('queued child hits reach earlier subscribers, after owner preparation, in all 24 party orders',()=>{
 const names=['Skirk','Furina','Escoffier','Vodyanitsa'],saved=names.map(n=>({n,expand:characterPackages[n].expand,createTimeline:characterPackages[n].createTimeline}));
 try{
  for(const n of names){characterPackages[n].expand=()=>{};characterPackages[n].createTimeline=undefined;}
  characterPackages.Skirk.expand=({actions,hit})=>{for(const a of actions)hit(a,{category:'normal',index:0,label:'seed'},0,'seed');};
  characterPackages.Skirk.createTimeline=()=>({prepareHit(e){e.element='Cryo';}});
  characterPackages.Furina.createTimeline=({role,enqueue})=>({prepareHit(e){e.furinaC6=true;e.element='Hydro';},onHit(e){if(e.label==='seed'){assert.equal(e.element,'Cryo');enqueue({kind:'hit',role,time:e.time,rootOrder:e.rootOrder+.01,eventId:'child',parentEventId:eventKey(e),category:'normal',index:0,label:'child'});}}});
  characterPackages.Escoffier.createTimeline=({role,enqueue})=>({onHit(e){if(e.label==='child'){assert.equal(e.furinaC6,true);assert.equal(e.element,'Hydro');enqueue({kind:'hit',role,time:e.time,rootOrder:e.rootOrder+.01,eventId:'grandchild',parentEventId:eventKey(e),category:'skill',index:8,label:'grandchild'});}}});
  const x=effectInput();x.team_dps.axis.timeline=[action('root','Skirk','normal.1',1000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:2000}];
  let baseline;
  for(const p of permutations([0,1,2,3])){const y=reordered(x,p),r=compile(y),canonical=r.events.map(e=>[y.single_interfaces[e.role].character.name,e.eventId,e.parentEventId,e.time,e.element,e.order]);assert.deepEqual(r.events.map(e=>e.label),['seed','child','grandchild']);if(baseline)assert.deepEqual(canonical,baseline);else baseline=canonical;}
 }finally{for(const {n,expand,createTimeline}of saved)Object.assign(characterPackages[n],{expand,createTimeline});}
});

test('real C6 cooperative hits, infusion, health and Omen preserve every hit across all 24 party orders',()=>{
 const x=characterEventInput('mona-c6-events'),baseline=evaluate(x);
 assert.ok(baseline.hits.some(h=>h.eventId.endsWith('/escoffier.c6')));assert.ok(baseline.heals.some(h=>h.healing==='furina_c6'));
 for(const p of permutations([0,1,2,3])){
  const y=reordered(x,p),out=evaluate(y);near(out.expectation,baseline.expectation);
  assert.equal(out.hits.length,baseline.hits.length);assert.equal(out.heals.length,baseline.heals.length);
  out.hits.forEach((h,i)=>{const b=baseline.hits[i];assert.deepEqual([h.eventId,h.part,h.time,h.element,y.single_interfaces[h.role].character.name],[b.eventId,b.part,b.time,b.element,x.single_interfaces[b.role].character.name]);near(h.expectation,b.expectation);});
 }
});

test('Mona auto bubble sees a queued hit, and C6 clock restarts after a genuine Omen gap',()=>{
 const x=characterEventInput('mona-c6-events');x.team_dps.axis.timeline=[action('q','Mona','burst',0),{id:'tail',kind:'switch',actor:'Mona',timeMs:3000}];
 const old=characterPackages.Furina.createTimeline;
 try{characterPackages.Furina.createTimeline=({role,enqueue})=>({onEvent(e){if(e.id==='q')enqueue({kind:'hit',role,time:1.25,rootOrder:20,eventId:'generated',category:'skill',index:9});}});near(compile(x).events.find(e=>e.monaBubble).time,1.25+1/60);}
 finally{characterPackages.Furina.createTimeline=old;}
 x.team_dps.axis.timeline=[{...action('q','Mona','burst',0),params:{bubbleDelayMs:100}},{id:'out',kind:'switch',actor:'Skirk',timeMs:200},action('q2','Mona','burst',5200),action('ca','Mona','charged',6100),action('ca2','Mona','charged',6300)];
 const r=compile(x);assert.deepEqual(r.events.filter(e=>e.category==='charged').map(e=>e.monaC6Stacks),[0,1]);
});

test('C6 heal timers precede same-time commands and do not change when a later attack is appended',()=>{
 const x=characterEventInput();x.team_dps.axis.timeline=[action('e','Furina','skill',0),action('n','Furina','normal.1',1000),action('p','Furina','plunge',2000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:6000}];
 const r=compile(x),first=r.heals.find(e=>e.healing==='furina_c6');assert.equal(first.time,2);assert.equal(first.rootOrder,-Infinity);
 const out=evaluate(x);const heal=out.health.find(e=>e.healing?.healing==='furina_c6'&&e.time===2);assert.ok(heal);assert.equal(heal.rootOrder,-Infinity);
 x.team_dps.axis.timeline.splice(3,0,action('later','Furina','normal.2',5500));
 const changed=compile(x).heals.filter(e=>e.healing==='furina_c6'&&e.time<=3);
 assert.deepEqual(changed,r.heals.filter(e=>e.healing==='furina_c6'&&e.time<=3));
});

test('Escoffier C6 has no pre-cast trigger and refills its exhausted pool on recast',()=>{
 const x=effectInput();x.single_interfaces[2].character.constellation=6;
 x.team_dps.axis.timeline=[action('before','Skirk','normal.1',0),action('e','Escoffier','skill',0),...Array.from({length:7},(_,i)=>action('n'+i,'Skirk','normal.1',500+i*500)),action('e2','Escoffier','skill',4000),action('after','Skirk','normal.1',4000)];
 assert.deepEqual(compile(x).events.filter(e=>e.eventId.endsWith('/escoffier.c6')).map(e=>e.eventId),[...Array.from({length:6},(_,i)=>'n'+i+'/normal.1/escoffier.c6'),'after/normal.1/escoffier.c6']);
});
