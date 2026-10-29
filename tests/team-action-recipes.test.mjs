import test from 'node:test';import assert from 'node:assert/strict';
import {defineActionRecipes} from '../beta-data/team-engine/action-recipes.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';
import {recipeInput} from './helpers/team-action-recipes.mjs';
import {Worker} from 'node:worker_threads';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import fs from 'node:fs';
import {nativeDamageProjection} from '../beta-data/team-engine/native-projection.mjs';
import {nativeBackends} from '../beta-data/team-engine/native-bindings.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('one declaration supplies catalog metadata and static action variants without candidate stats',()=>{
 const metadata={id:'skill.hold',label:'合成延迟技能',endOffsetMs:500,parameters:[{key:'delayMs',min:0,max:500}]},calls=[];
 const recipes=defineActionRecipes([{...metadata,events:context=>{assert.deepEqual(Object.keys(context),['character','params','actionId']);assert.equal(context.actionId,'skill.hold');return [{kind:'hit',delay:context.params.delayMs/1000,index:8,category:'skill',parts:context.character.constellation?2:1,phase:25}];}}]);
 assert.deepEqual(recipes.actions,[metadata]);const cast={id:'cast',action:'skill',actionId:'skill.hold',params:{delayMs:250}};
 recipes.expand({profile:{character:{name:'Synthetic',constellation:1},artifacts:[{unexpected:true}]},actions:[cast],hit:(...args)=>calls.push(args)});
 assert.deepEqual(calls,[[cast,{index:8,category:'skill',parts:2,label:metadata.label},.25,'skill.hold',25]]);
 assert.throws(()=>recipes.expand({profile:{character:{name:'Synthetic'}},actions:[{action:'unknown'}]}),/角色动作未声明/);
});

test('recipes reuse actual recast, tail, active-recipient and multi-event identity semantics',()=>{
 const x=effectInput();x.single_interfaces.forEach(p=>p.character.constellation=0);
 x.team_dps.axis.timeline=[action('a','Escoffier','skill',0),{id:'switch',kind:'switch',actor:'Skirk',timeMs:600},action('b','Escoffier','skill',1000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:2000}];
 const declaration=defineActionRecipes([{id:'skill',label:'合成',events:[
  {kind:'window',key:'synthetic',duration:3,values:{resource:2}},
  {kind:'hit',key:'initial',delay:.25,index:8,category:'skill',parts:2},
  {kind:'hit',key:'tick',repeat:{start:.5,interval:.5,duration:3},index:8,category:'skill',parts:1},
  {kind:'heal',key:'team',delay:.75,recipients:'team'},
  {kind:'heal',key:'front',delay:.75,recipients:'active',phase:12},
 ]}]),saved=characterPackages.Escoffier.expand;
 try{
  characterPackages.Escoffier.expand=context=>{declaration.expand(context);for(const a of context.actions)a.completionTime=a.time;};
  const r=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps);
  assert.deepEqual(r.events.filter(e=>e.eventId.startsWith('a/tick')).map(e=>e.time),[.5]);
  assert.deepEqual(r.events.filter(e=>e.eventId.startsWith('b/tick')).map(e=>e.time),[1.5,2]);
  assert.deepEqual(r.events.filter(e=>e.eventId==='a/initial').map(e=>[e.time,e.part]),[[.25,0],[.25,1]]);
  assert.deepEqual(r.heals.map(e=>[e.eventId,e.time,e.recipients]),[['a/team',.75,[0,1,2,3]],['a/front',.75,[0]],['b/team',1.75,[0,1,2,3]],['b/front',1.75,[2]]]);
  assert.equal(new Set(r.heals.map(e=>e.eventId)).size,r.heals.length);assert.equal(r.windows.synthetic[0].resource,2);
  x.team_dps.axis.endHit='exclude';assert.deepEqual(compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps).events.filter(e=>e.eventId.startsWith('b/tick')).map(e=>e.time),[1.5]);
 }finally{characterPackages.Escoffier.expand=saved;}
});

test('character-owned declarations retain talent healing and C2 summon duration',()=>{
 for(const [level,constellation,heals]of [[20,0,1],[90,0,10],[90,4,16]]){
  const x=recipeInput();x.single_interfaces[2].character.level=level;x.single_interfaces[2].character.constellation=constellation;
  x.team_dps.axis.timeline=[action('q','Escoffier','burst',0),{id:'tail',kind:'switch',actor:'Skirk',timeMs:18000}];
  const r=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps);assert.equal(r.heals.filter(e=>e.role===2).length,heals);
 }
 for(const [constellation,times]of [[0,[3,6,9,12,15]],[2,[3,6,9,12,15,18,21,24]]]){
  const x=recipeInput();x.single_interfaces[3].character.constellation=constellation;
  x.team_dps.axis.timeline=[action('e','Vodyanitsa','skill',0),{id:'tail',kind:'switch',actor:'Skirk',timeMs:26000}];
  const r=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps);assert.deepEqual(r.events.filter(e=>e.eventId.startsWith('e/horn')).map(e=>e.time),times);
 }
});

test('declarative actions and combat plugins share compiled scoring and preserve all 24 role orders',async()=>{
 for(const name of ['ordinary','constellation','random']){
  const x=recipeInput(name),builds=x.single_interfaces.map(p=>p.artifacts),ev=createTeamDpsEvaluator(api,x),native=ev.evaluate(builds,true),compiled=(await nodeTeamDps(x,builds.flat(),{mode:'evaluate'})).results[0];
  for(const key of ['expectation','critical','non_critical','fanfare','duration'])near(compiled[key],native[key]);compareEventValues(compiled.eventTrace,nativeEventTrace(native));
  if(name==='constellation')assert.equal(native.hits.filter(e=>e.eventId.endsWith('/escoffier.c6')).length,6);
  const changed=structuredClone(builds);changed[2].forEach(a=>{a.id+=900000;a.sub_stats.push(['ATKPercentage',.2]);});changed[3].forEach(a=>{a.id+=900000;a.sub_stats.push(['HPPercentage',.2]);});assert.notEqual(ev.evaluate(changed).expectation,native.expectation);near(ev.evaluate(builds).expectation,native.expectation);
  if(name!=='ordinary')continue;
  function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
  for(const order of permutations([0,1,2,3])){const y=structuredClone(x);y.single_interfaces=order.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_ids=order.map(i=>x.team_dps.initial_ids[i]);y.team_dps.initial_hp=order.map(i=>x.team_dps.initial_hp[i]);near(createTeamDpsEvaluator(api,y).evaluate(order.map(i=>builds[i])).expectation,native.expectation);}
 }
});

test('a test-only ordinary character needs one package and one registration in fresh scalar and compiled runtimes',async()=>{
 const input=effectInput();input.single_interfaces.forEach(p=>p.character.constellation=0);
 const profile=fixture('Kaeya');profile.artifacts=input.single_interfaces[3].artifacts;input.single_interfaces[3]=profile;
 input.team_dps.axis.members[3]={slot:'Kaeya',character:'Kaeya'};input.team_dps.axis.initialActiveSlot='Kaeya';input.team_dps.axis.timeline=[action('n','Kaeya','normal.1',1000)];
 const execute=graph=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./helpers/team-recipe-registration-worker.mjs',import.meta.url),{workerData:{graph,input}});let result;
  worker.on('message',message=>{result=message;});worker.on('error',reject);worker.on('exit',code=>{if(code||!result)reject(Error('Registration worker exited '+code));else resolve(result);});
 });
 const native=await execute(false),compiled=await execute(true);
 assert.equal(native.registered[0].id,'normal.1');assert.deepEqual(compiled.registered,native.registered);
 for(let i=0;i<2;i++){assert.ok(native.results[i].expectation>0);near(compiled.results[i].expectation,native.results[i].expectation);compareEventValues(compiled.results[i].eventTrace,native.results[i].eventTrace);}assert.ok(native.results[1].expectation>native.results[0].expectation);
 assert.equal(characterPackages.Kaeya,undefined);
});

test('character-owned damage types reproduce every calibrated projection on both native backends',()=>{
 const projections=JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/projections.json',import.meta.url))),slots=JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/extension-slots.json',import.meta.url)));let count=0;
 for(const name of ['Escoffier','Vodyanitsa']){const character=characterPackages[name];for(const entry of projections.filter(p=>p.character===name)){assert.deepEqual(nativeDamageProjection(character.nativeDamage[entry.index],nativeBackends[character.nativeBackend],slots),entry.fields,name+'/'+entry.index);count++;}}
 assert.equal(count,23);
 assert.throws(()=>nativeDamageProjection({category:'unknown',element:'Cryo'},nativeBackends.legacy,slots),/类型或元素/);
});
