import test from 'node:test';import assert from 'node:assert/strict';
import {actionInput} from './helpers/team-action-configuration.mjs';import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';import {actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';import {builds} from '../beta-tools/team-dps-full-audit.mjs';import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';import {saveTeamDpsLibrary,loadTeamDpsLibrary} from '../beta-data/team-dps-library.mjs';
const a=(id,actor,action,timeMs,extra={})=>({id,kind:'action',actor,action,timeMs,...extra});
const input=timeline=>{const x=actionInput();x.single_interfaces.forEach(p=>p.character.constellation=0);x.team_dps.axis.timeline=timeline;return x;};
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('ordered same-time state, first buff availability and finite refresh',()=>{
 const x=input([a('e','carry','skill',0),a('q','carry','burst',500),a('n','carry','normal.1',1000),a('leave','hydro','normal.1',1000),a('hold','carry','skill.hold',1000)]),r=compile(x),n=r.events.find(h=>h.eventId==='n/normal.1');
 assert.equal(n.sevenPhase,true);assert.equal(n.qBonus,true);assert.equal(r.covered('skirkC2',1,350),false);
 const first=compile(input([a('n','support','normal.1',1000),a('e','support','skill',1000)]));assert.deepEqual(first.events.map(h=>h.vodyTargets),[1,1]);
 const refill=compile(input([a('e','support','skill',0),...Array.from({length:24},(_,i)=>a('n'+i,'support','normal.1',1000)),a('e2','support','skill',1000),a('after','support','normal.1',1000)]));assert.equal(refill.events.find(h=>h.eventId==='after/normal.1').vodyTargets,1);
});
test('same canonical terminal time and condition-filtered duration',()=>{
 const x=input([{...a('e','carry','skill',0),when:{constellationAtLeast:6}},a('q','carry','burst',2000)]);x.team_dps.axis.endHit='exclude';const r=compile(x);assert.equal(r.events.length,5);near(r.duration,2+158/60);near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces)/1000,r.duration);
 x.single_interfaces[0].character.constellation=6;assert.equal(compile(x).events.filter(h=>h.skirkBurst).length,0);near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces),2000);
});
test('ordinary attack native element and independent pre-impact health',()=>{
 const x=input([a('n','carry','normal.1',1000)]),results=[];for(const stat of ['HPPercentage','CryoBonus','PhysicalBonus']){x.single_interfaces[0].artifacts[3].main_stat=[stat,.466];results.push(evaluate(x).expectation);}near(results[0],results[1]);assert.ok(results[2]>results[0]);
 const short=input([a('e','hydro','skill',0),a('q','hydro','burst',0),a('n','carry','normal.1',1600)]),out=evaluate(short);near(out.hits.find(h=>h.eventId==='n/normal.1').fanfare,30.4);
 short.team_dps.axis.timeline.push(a('e2','hydro','skill',1600));near(evaluate(short).hits.find(h=>h.eventId==='n/normal.1').fanfare,30.4);
});
test('library write/read sequencing persists across callers and allows retry',async()=>{
 const data=new Map();let release,started,first=true;const begin=new Promise(r=>started=r),gate=new Promise(r=>release=r),backend={setItem:async(k,v)=>{if(first){first=false;started();await gate;}data.set(k,v);},getItem:async k=>data.get(k)};
 const old=saveTeamDpsLibrary(backend,7001,{title:'old'});await begin;let loaded=false;const read=loadTeamDpsLibrary(backend,7001).then(x=>{loaded=true;return x;});await Promise.resolve();assert.equal(loaded,false);
 const next=saveTeamDpsLibrary(backend,7001,{title:'new'});release();await Promise.all([old,next,read]);assert.equal((await loadTeamDpsLibrary(backend,7001)).title,'new');
 let fail=true;backend.setItem=async(k,v)=>{if(fail){fail=false;throw Error('synthetic failure');}data.set(k,v);};await assert.rejects(saveTeamDpsLibrary(backend,7001,{title:'failed'}),/synthetic failure/);await saveTeamDpsLibrary(backend,7001,{title:'retry'});assert.equal((await loadTeamDpsLibrary(backend,7001)).title,'retry');
});
