import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createCombatHistory} from '../beta-data/team-engine/combat-history.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {historyInput,historyAxis,historyCases,historyTeams} from './helpers/team-equipment-history.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('numeric history equals independent removal for all 64 contact patterns and exact expiry/cooldown boundaries',()=>{
 const times=[0,0,.299999,.3,6,6.3],builder=createNumericProgram(),m=createNativeGraphCompiler(builder,{funcs:{},table:[]}).math;
 const run=(math,gates)=>{const history=createCombatHistory(math),rows=times.map((time,i)=>({time,rootOrder:i,order:i,eventId:'h'+i,enabled:gates[i]}));
  return [0,.3,.300001,6,6.3,6.300001,12.3].flatMap(time=>{const e={time,rootOrder:Infinity};return [history.count(rows,e,6,4,.3),history.refreshed(rows,e,6,4,.3),history.any(rows,h=>history.within(h,e,6)),...rows.map(row=>history.latest(rows,e).filter(h=>h.eventId===row.eventId).reduce((v,h)=>math.add(v,h.enabled??1),0))];});};
 const program=builder.finish(run(m,times.map((_,i)=>builder.input(i))));
 for(let mask=0;mask<64;mask++){
  const gates=times.map((_,i)=>(mask>>i)&1),actual=executeNumericProgram(program,gates),expected=[];
  for(const time of [0,.3,.300001,6,6.3,6.300001,12.3]){
   const rows=times.map((t,i)=>({time:t,i})).filter(h=>gates[h.i]&&h.time<=time);let last=-Infinity,value=0;const accepted=[];
   for(const h of rows)if(h.time-last>=.3-1e-9){value=h.time-last>=6?1:Math.min(4,value+1);last=h.time;accepted.push(h);}
   expected.push(Math.min(4,accepted.filter(h=>time<h.time+6).length),time<last+6?value:0,Number(rows.some(h=>time<h.time+6)),...times.map((_,i)=>Number(rows.at(-1)?.i===i)));
  }
  assert.deepEqual(actual,expected);assert.deepEqual(run(scalarMath,gates),expected);
 }
});
test('mutually exclusive formula contacts spend one cooldown slot and zero disabled contacts',()=>{
 const b=createNumericProgram(),m=createNativeGraphCompiler(b,{funcs:{},table:[]}).math,g=b.input(0),h=createCombatHistory(m),rows=[{time:0,rootOrder:0,eventId:'hydro',contactId:'hit',enabled:g},{time:0,rootOrder:0,eventId:'physical',contactId:'hit',enabled:m.choose(g,0,1)},{time:.1,rootOrder:1,enabled:0},{time:.3,rootOrder:2}];
 const p=b.finish([h.count(rows,{time:.31,rootOrder:Infinity},6,4,.3),h.refreshed(rows,{time:.31,rootOrder:Infinity},6,4,.3)]);
 assert.deepEqual(executeNumericProgram(p,[0]),[2,2]);assert.deepEqual(executeNumericProgram(p,[1]),[2,2]);
});
test('14 real equipment adapters treat a disabled contact exactly like its absence',()=>{
 for(const name of historyCases){
  const input=historyInput(name),team=historyTeams(input)[1],run=remove=>createTeamDpsEvaluator(api,input,{compileRotation:historyAxis(name,0,{remove})}).evaluate(team,true),a=run(false),b=run(true);
  near(a.expectation,b.expectation);assert.equal(a.hits.length,b.hits.length,name);
  a.hits.forEach((h,i)=>{assert.equal(h.eventId,b.hits[i].eventId,name);near(h.expectation,b.hits[i].expectation);});
 }
});
test('history state is isolated across candidates and all 24 party orders',()=>{
 const input=historyInput('PrototypeRancour'),teams=historyTeams(input),ev=createTeamDpsEvaluator(api,input),a=ev.evaluate(teams[0],true);ev.evaluate(teams[1]);assert.deepEqual(ev.evaluate(teams[0],true),a);
 const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(p=>[x,...p])):[[]];
 for(const p of permutations([0,1,2,3])){
  const x=structuredClone(input);x.single_interfaces=p.map(i=>input.single_interfaces[i]);x.team_dps.axis.members=p.map(i=>input.team_dps.axis.members[i]);for(const key of ['initial_hp','weapon_conditions'])if(input.team_dps[key])x.team_dps[key]=p.map(i=>input.team_dps[key][i]);
  const b=createTeamDpsEvaluator(api,x).evaluate(p.map(i=>teams[0][i]),true);near(b.expectation,a.expectation);b.hits.forEach((h,i)=>{assert.equal(h.eventId,a.hits[i].eventId);near(h.expectation,a.hits[i].expectation);});
 }
});
