import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import * as stellar from '../src/algorithms/stellar-detail.mjs';
import {damageReactionOptions,defaultDamageReaction} from '../src/algorithms/reaction-labels.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {normalizeTeamProfiles} from '../beta-data/team-engine/registry.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createHitResults} from '../beta-data/team-dps-hit-results.mjs';
import {compileEventTrace,decodeEventTrace} from '../beta-data/team-dps-event-trace.mjs';
import {teamEventRows,packTeamDpsResult,unpackTeamDpsResult} from '../beta-data/team-dps-result-view.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {snapshotReviewInput,royalReviewInput,procReviewInput} from './helpers/team-review-fixes.mjs';
const sum=x=>Object.values(x).reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const values=(trace,channel,time)=>trace.events.filter(e=>e.channel===channel).flatMap(e=>e.states).filter(s=>s.value.time===time);
function detailResult(analysis,enemy,character){
 const code=fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysis.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =');
 const env={...stellar,damageReactionOptions,defaultDamageReaction,DamageAnalysisUtil:{},StellarDamageDetail:{},LEVEL_MULTIPLIER:[],console};vm.createContext(env);vm.runInContext(code,env);
 const state={...env.component.data(),enemyConfig:enemy,characterLevel:character.level,characterName:character.name};for(const [k,fn]of Object.entries(env.component.methods))state[k]=fn.bind(state);for(const [k,fn]of Object.entries(env.component.computed))Object.defineProperty(state,k,{get:()=>fn.call(state)});state.setValue(analysis);return state.selectedActualResult;
}

test('F1 equipment queries with one contact identity retain time/root position in either read order',()=>{
 const x=snapshotReviewInput(),profiles=normalizeTeamProfiles(x.single_interfaces),rotation=compileActionAxis(x.team_dps.axis,profiles,x.team_dps),hit=rotation.events[0];
 for(const order of [[0,1,0],[1,0,1]]){
  const rules=createEquipmentAxisRules(profiles,rotation,{...x.team_dps,widsith_themes:{3:['t1_rate']}}),queries=[{...hit,eventKey:'same-contact'},{...hit,...hit.statSnapshot,eventKey:'same-contact'}];
  for(const i of order){const p=structuredClone(profiles[3]);rules.prepare(p,3,queries[i]);assert.equal(p.weapon.params.TheWidsith.t1_rate,i);}
 }
 const rules=createEquipmentAxisRules(profiles,rotation,{...x.team_dps,widsith_themes:{3:['t1_rate']}});
 for(const [rootOrder,expected]of [[1,1],[-1,0],[1,1]]){const p=structuredClone(profiles[3]);rules.prepare(p,3,{...hit,eventKey:'same-tick',time:0,rootOrder});assert.equal(p.weapon.params.TheWidsith.t1_rate,expected);}
});

test('F1 Mona E retains Widsith cast stats across expiry in scalar and Worker scoring',async()=>{
 const early=snapshotReviewInput(2000),late=snapshotReviewInput(9000),a=run(early),b=run(late);
 assert.equal(a.hits.length,5);assert.equal(b.hits.length,5);near(a.expectation,b.expectation);
 a.hits.forEach((hit,i)=>{near(hit.atk,b.hits[i].atk);near(hit.expectation,b.hits[i].expectation);});
 for(const [x,native]of [[early,a],[late,b]]){const result=(await nodeTeamDps(x,x.single_interfaces.flatMap(p=>p.artifacts),{mode:'evaluate'})).results[0];near(result.expectation,native.expectation);compareEventValues(result.eventTrace,nativeEventTrace(native));}
});

test('F2 Royal hit outcome, current C4 rate and next attack retain their joint state',async()=>{
 const x=royalReviewInput(),native=run(x),trace=nativeEventTrace(native),heals=values(trace,'heals',1),base=Math.min(...heals.map(s=>s.value.rawAmounts[0]));
 near(heals.reduce((p,s)=>p+(s.value.rawAmounts[0]>base*1.5?s.probability:0),0),.242*.242+.758*.322);
 for(const branch of native.trace_outcomes){const hits=branch.output.hits,q=hits.find(h=>h.eventId==='q/burst'),next=hits.find(h=>h.eventId==='n/normal.1');assert.equal(q.contacts.length,1);near(next.crit,q.contacts[0].critical?.242:.322);}
 const result=(await nodeTeamDps(x,[],{mode:'evaluate'})).results[0];near(result.expectation,native.expectation);compareEventValues(result.eventTrace,trace);
 // Two actual targets advance the same weapon state regardless of which
 // targets are selected for scoring. Enumerate their critical rolls directly.
 let paths=[{p:1,stacks:0}];for(let i=0;i<2;i++)paths=paths.flatMap(s=>{const p=.242+s.stacks*.08;return [{p:s.p*p,stacks:0},{p:s.p*(1-p),stacks:Math.min(5,s.stacks+1)}];});
 const expected=paths.reduce((n,s)=>n+s.p*(.242+s.stacks*.08),0);
 for(const damage_scope of ['single','all']){const y=royalReviewInput();Object.assign(y.team_dps,{enemy_count:2,damage_scope});const out=run(y),heals=values(nativeEventTrace(out),'heals',1),minimum=Math.min(...heals.map(s=>s.value.rawAmounts[0]));near(heals.reduce((n,s)=>n+(s.value.rawAmounts[0]>minimum*1.5?s.probability:0),0),expected);}
});

test('F2 eight C4 heals match an independent correlated oracle with seven-use cap, HP clipping and fanfare',async()=>{
 const x=royalReviewInput(true),result=(await nodeTeamDps(x,[],{mode:'evaluate'})).results[0],max=result.panels.map(p=>sum(p.hp)),atk=sum(result.panels[2].atk);
 const q=atk*3.0966+2372.95,hp=max.map(v=>Math.min(v,.1*v+q)),f=Math.min(300,hp.reduce((n,v,i)=>n+(v/max[i]-.1)*100,0));
 let paths=[{p:.242,rate:.242,used:0,hp:hp[0],f},{p:.758,rate:.322,used:0,hp:hp[0],f}],eighthDouble=0;
 for(let i=1;i<=8;i++){
  const next=[];
  for(const path of paths)for(const won of [0,1]){
   const chance=path.used<7?path.rate:0,p=path.p*(won?chance:1-chance);if(!p)continue;
   const raw=atk*1.3824*(1+path.f*.0001)*(1+won),after=Math.min(max[0],path.hp+raw),f=Math.min(300,path.f+(after-path.hp)/max[0]*100);
   next.push({p,rate:path.rate,used:path.used+won,hp:after,f,raw});if(i===8&&won)eighthDouble+=p;
  }paths=next;
  const actual=values(result.eventTrace,'heals',i),expectedRaw=paths.reduce((n,p)=>n+p.p*p.raw,0);near(actual.reduce((n,s)=>n+s.probability*s.value.rawAmounts[0],0),expectedRaw);
 }
 near(eighthDouble,.242*.242*(1-.242**7)+.758*.322*(1-.322**7));
 assert.ok(Math.abs(eighthDouble-.30264*(1-.30264**7))>1e-5,'a mean-rate replacement must not pass');
 const health=values(result.eventTrace,'health',8);
 near(health.reduce((n,s)=>n+s.probability*s.value.hp[0],0),paths.reduce((n,p)=>n+p.p*p.hp,0));
 near(health.reduce((n,s)=>n+s.probability*s.value.fanfare,0),paths.reduce((n,p)=>n+p.p*p.f,0));
 // Match joint HP/fanfare mass, not just their separate averages.
 const groups=[];for(const p of paths){let group=groups.find(g=>Math.abs(g.hp-p.hp)<1e-8&&Math.abs(g.f-p.f)<1e-10);if(!group){group={hp:p.hp,f:p.f,p:0};groups.push(group);}group.p+=p.p;}
 for(const g of groups)near(health.filter(s=>Math.abs(s.value.hp[0]-g.hp)<1e-8&&Math.abs(s.value.fanfare-g.f)<1e-10).reduce((n,s)=>n+s.probability,0),g.p);
});

test('F3 unobserved proc trace uses occurrence probability and conditional damage without changing contribution',async()=>{
 const x=procReviewInput(),native=run(x),trace=nativeEventTrace(native),proc=native.hits.find(h=>h.category==='equipment');
 const event=trace.events.find(e=>e.channel==='hits'&&e.states[0].value.category==='equipment');assert.equal(event.probability,.5);assert.equal(event.states[0].probability,.5);near(event.states[0].value.expectation,proc.expectation*2);
 const conditional=event.states[0].value,shown=detailResult(conditional.analysis,native.enemy,native.profiles[conditional.role].character);for(const key of ['expectation','critical','non_critical'])near(shown[key],conditional[key]);
 const rows=teamEventRows(trace);near(rows.filter(row=>row.contributions).reduce((n,row)=>n+row.contributions.expectation,0),native.expectation);
 assert.deepEqual(unpackTeamDpsResult(JSON.parse(JSON.stringify(packTeamDpsResult(trace)))),trace);
 const compiled=(await nodeTeamDps(x,[],{mode:'evaluate'})).results[0];near(compiled.expectation,native.expectation);compareEventValues(compiled.eventTrace,trace);
});

test('F3 posterior probability is applied once inside an explicit outer branch; zero/disabled events stay absent',()=>{
 for(const p of [0,.5,1])for(const enabled of [0,1]){
  const result=createHitResults(scalarMath,1,{defer:true}),event={eventId:'proc',trialKey:'trial',kind:'hit',role:0,time:1,rootOrder:0,probability:.25,enabled},damage={expectation:100*enabled,critical:200*enabled,non_critical:50*enabled},row={...event,analysis:{normal:{...damage}}};
  result.add(event,damage,damage,row);result.finish(new Map([['trial',p]]));
  const plan=compileEventTrace({trace_outcomes:[{probability:.75,label:'branch',output:{hits:result.rows}}]},scalarMath),trace=decodeEventTrace(plan,plan.groups.map(g=>g.mass.constant?[{values:[],probability:g.mass.constant}]:[]));
  const rows=teamEventRows(trace);near(rows.reduce((n,r)=>n+r.contributions.expectation,0),.75*p*100*enabled);
  assert.equal(trace.events.length,p&&enabled?1:0);if(p&&enabled){near(trace.events[0].probability,.75*p);near(trace.events[0].states[0].value.expectation,100);}
 }
});
