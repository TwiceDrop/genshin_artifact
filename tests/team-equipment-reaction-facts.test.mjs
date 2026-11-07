import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {reactionEquipmentInput,reactionEquipmentTeams} from './helpers/team-equipment-reaction-fixture.mjs';
import {createEquipmentAxisRules,cinderElements} from '../beta-data/equipment-axis-rules.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const part=(h,field,label)=>Object.entries(h.analysis[field]).filter(([k])=>k.includes(label)).reduce((s,[,v])=>s+v,0);

test('reaction equipment consumes owned facts after triggering hit, refreshes only enabled facts and expires exactly',()=>{
 const input=reactionEquipmentInput(),profiles=input.single_interfaces,rotation=compileActionAxis(input.team_dps.axis,profiles),builds=profiles.map(p=>p.artifacts);
 const run=(m,g)=>{
  const fact=(reaction,time,role=0,enabled=1,elements=['Cryo','Electro'])=>({kind:'reaction',eventId:reaction+'/'+time+'/'+role,reaction,reactionType:reaction,elements,time,role,rootOrder:0,order:1,enabled});
  const facts=[fact('StellarConduct',1),fact('Frozen',4,0,1,['Cryo','Hydro']),fact('StellarConduct',6,1),fact('StellarConduct',10,0,g),{...fact('Shatter',11),reactionTriggers:false}];
  const rules=createEquipmentAxisRules(profiles,{...rotation,events:[],roots:[],reactionFacts:facts,activeRole:()=>0},input.team_dps,{math:m});
  const rate=(time,order=2)=>rules.prepare(structuredClone(profiles[0]),0,{time,rootOrder:0,order}).weapon.params.DarkIronSword.rate;
  const bonus=(time,el,order=2)=>rules.baseBuffs(builds,2,{time,rootOrder:0,order}).filter(b=>b.config.ExtensionEffect.label==='烬城勇者绘卷4').reduce((s,b)=>m.add(s,b.config.ExtensionEffect.values['Bonus'+el]??0),0);
  const background=createEquipmentAxisRules(profiles,{...rotation,events:[],roots:[],reactionFacts:facts,activeRole:()=>1},input.team_dps,{math:m});
  const back=background.prepare(structuredClone(profiles[0]),0,{time:11,rootOrder:0,order:2}).weapon.params.DarkIronSword.rate;
  return [rate(1,0),rate(1),rate(12.999),rate(13),rate(22),bonus(1,'Cryo',0),bonus(1,'Cryo'),bonus(1,'Electro'),bonus(1,'Hydro'),bonus(20,'Cryo'),bonus(21,'Cryo'),bonus(25,'Cryo'),bonus(19,'Hydro'),back];
 };
 const builder=createNumericProgram(),m=createNativeGraphCompiler(builder,{funcs:{},table:[]}).math,program=builder.finish(run(m,builder.input(0)));
 for(const g of [1,0,1]){const expected=[0,1,1,g,0,0,.12,.12,0,.12,g*.12,0,0,0];assert.deepEqual(run(scalarMath,g),expected);assert.deepEqual(executeNumericProgram(program,[g]),expected);}
 assert.equal(cinderElements({elements:['Cryo','Electro']},'Hydro',false),null);
 assert.deepEqual(cinderElements({elements:['Cryo','Electro']},'Cryo',true),{elements:['Cryo','Electro'],first:.12,second:.28});
 // Neither Frozen nor a teammate's reaction refreshes the sword's own 12-second window.
});

test('real mixed team gives Dark Iron ATK and non-stacking Cinder elemental damage, with compiled candidate parity',async()=>{
 const input=reactionEquipmentInput(),teams=reactionEquipmentTeams(input),evaluator=createTeamDpsEvaluator(api,input),native=teams.map(t=>evaluator.evaluate(t,true));
 const skirk=native[0].hits.filter(h=>h.role===0&&!h.reactionDamage),active=skirk.filter(h=>part(h,'atk','暗铁剑')>0);assert.ok(active.length>0);
 for(const h of active)near(part(h,'atk','暗铁剑'),.2*(359+401));
 const cinder=native[0].hits.filter(h=>part(h,'bonus','烬城')>0);assert.ok(cinder.length>0);for(const h of cinder)near(part(h,'bonus','烬城'),.12);
 assert.ok(native[1].hits.every(h=>part(h,'bonus','烬城')===0));
 assert.deepEqual(native[0],native[2]);
 const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(createTeamDpsEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
});
