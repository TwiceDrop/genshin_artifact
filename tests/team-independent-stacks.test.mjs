import test from 'node:test';import assert from 'node:assert/strict';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {equipmentEffects} from '../beta-data/team-engine/equipment-effects.mjs';
import {afterEvent} from '../beta-data/team-engine/event-order.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
import {independentStackInput} from './helpers/team-independent-stacks.mjs';
const definition=equipmentEffects.find(d=>d.id==='artifact.long_nights_oath.4');
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hit=(time,order,category='plunge',extra={})=>({kind:'hit',eventId:'hit/'+order,time,rootOrder:order,order:0,role:0,element:'Physical',category,...extra});
const plan=()=>({sources:[{definition,role:0,actorId:'Escoffier',key:definition.id+'/Escoffier'}],schedule:[],settings:{enemy_count:3},rotation:{model:'actions',activeRole:()=>0}});
const sequence=[[0,'skill'],[.5,'skill'],[.5,'charged'],[1,'plunge'],[1.5,'plunge'],[2,'skill'],[3,'charged'],[8,'plunge']];
const queries=[0,.5,1,1.5,2,3,6,6.5,7,8,9,14];
function run(m,inputs){
 const p=plan(),state=createEffectState(p,{math:m,enabled:()=>inputs[0],events:[]}),r=createEffectResolver(p,state,m);
 sequence.forEach(([time,category],i)=>state.publish(hit(time,i,category,{enabled:inputs[i+1]})));
 return queries.map(time=>r.resolve('base',0,hit(time,99)).reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.BonusPlungingAttack),0));
}
function oracle(inputs){
 // Independent event ledger: retain all accepted grants and only cap the
 // number alive at the queried time. It does not use the production slots.
 const rows=[],ready={};sequence.forEach(([time,category],i)=>{if(inputs[0]&&inputs[i+1]&&time>=(ready[category]??-Infinity)){rows.push({time,gain:category==='plunge'?1:2});ready[category]=time+1;}});
 return queries.map(t=>Math.min(5,rows.filter(r=>r.time<=t&&t<r.time+6).reduce((n,r)=>n+r.gain,0))*.15);
}
test('independent stacks match a separate ledger for all 512 equipment/event gate combinations',()=>{
 const b=createNumericProgram(),program=b.finish(run(b.math,Array.from({length:9},(_,i)=>b.input(i))));
 for(let mask=0;mask<512;mask++){const inputs=Array.from({length:9},(_,i)=>(mask>>i)&1),expected=oracle(inputs);run(scalarMath,inputs).forEach((v,i)=>near(v,expected[i]));executeNumericProgram(program,inputs).forEach((v,i)=>near(v,expected[i]));}
});
test('separate trigger cooldowns and independent expiry preserve same-time order and bounded slots',()=>{
 const p=plan(),s=createEffectState(p,{math:scalarMath,enabled:()=>1,events:[],trace:true});
 const e=hit(0,0,'skill'),c=hit(0,1,'charged'),pl=hit(0,2),blocked=hit(.5,3,'skill'),refresh=hit(2,4,'skill');
 for(const event of [e,c,pl,blocked,refresh])s.publish(event);
 assert.equal(s.at(p.sources[0],e).stacks,0);assert.equal(s.at(p.sources[0],c).stacks,2);assert.equal(s.at(p.sources[0],pl).stacks,4);
 assert.deepEqual(s.changes.map(e=>e.stacks),[2,4,5,5]);
 assert.deepEqual(s.changes.at(-1).stackExpiries,[6,6,6,8,8]);
 assert.equal(s.at(p.sources[0],hit(6,99)).stacks,2);assert.equal(s.at(p.sources[0],hit(8,99)).stacks,0);
 for(let i=10;i<100;i++)s.publish(hit(i,i,'skill'));
 assert.ok(s.changes.every(e=>e.stackExpiries.length===5));assert.equal(s.at(p.sources[0],afterEvent(c)).stacks,4);
});
test('independent stack metadata requires explicit overflow and positive static grant sizes',()=>{
 const x=independentStackInput(),rot=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),original=definition.stacks;
 try{for(const patch of [{overflow:'discard'},{refresh:'unknown'},{gain:0},{gain:1.5}]){definition.stacks={...original,...patch};assert.throws(()=>compileEffectPlan(x.single_interfaces,rot,x.team_dps),/叠层生命周期/);}}
 finally{definition.stacks=original;}
 assert.ok(compileEffectPlan(x.single_interfaces,rot,x.team_dps).sources.some(s=>s.definition===definition));
});
test('real Long Night damage, expiry trace, candidate isolation and 24 role permutations agree',async()=>{
 const x=independentStackInput(),builds=x.single_interfaces.map(p=>p.artifacts),ev=createTeamDpsEvaluator(api,x),native=ev.evaluate(builds,true);
 const compiled=(await nodeTeamDps(x,builds.flat(),{mode:'evaluate'})).results[0];
 for(const metric of ['expectation','critical','non_critical'])near(compiled[metric],native[metric]);compareEventValues(compiled.eventTrace,nativeEventTrace(native));
 assert.ok(native.effects.some(e=>e.effectId===definition.id&&new Set(e.stackExpiries.filter(t=>t>e.time)).size>1));
 const ledger=[];let plunges=0;for(const h of native.hits){if(h.role!==2)continue;const alive=ledger.filter(r=>r.time<h.time||r.time===h.time&&r.rootOrder<h.rootOrder).filter(r=>h.time<r.time+6);if(h.category==='plunge'){plunges++;near(h.analysis.bonus['长夜之誓4']??0,Math.min(5,alive.reduce((n,r)=>n+r.gain,0))*.15);}if(['plunge','charged','skill'].includes(h.category)&&!ledger.some(r=>r.category===h.category&&h.time<r.time+1))ledger.push({...h,gain:h.category==='plunge'?1:2});}assert.equal(plunges,5);
 const other=structuredClone(builds);other[2].slice(2).forEach(a=>{a.id+=900000;a.set_name='Adventurer';});assert.notEqual(ev.evaluate(other).expectation,native.expectation);near(ev.evaluate(builds).expectation,native.expectation);
 function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
 for(const order of permutations([0,1,2,3])){const y=structuredClone(x);y.single_interfaces=order.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_ids=order.map(i=>x.team_dps.initial_ids[i]);y.team_dps.initial_hp=order.map(i=>x.team_dps.initial_hp[i]);near(createTeamDpsEvaluator(api,y).evaluate(order.map(i=>builds[i])).expectation,native.expectation);}
});
