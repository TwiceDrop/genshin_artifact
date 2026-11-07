import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stellarWeaponInput,stellarWeaponTeams,stellarWeaponEvaluator} from './helpers/team-stellar-equipment-fixture.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {stellarEquipmentEffect,STELLAR_WEAPON_NEUTRAL} from '../beta-data/equipment-stellar-rules.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createCombatHistory} from '../beta-data/team-engine/combat-history.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
const names=['Emberwell','EchoesOfTheHeart','SongOfTheVigil','NewBough','WintersHeavyHeart'],row=(time,enabled=1)=>({time,rootOrder:0,order:0,enabled});
const context=(m,cast,star,radiance)=>({math:m,history:createCombatHistory(m),rotation:{reactionAt:()=>({radiance})},elements:['Cryo','Cryo','Electro','Cryo'],casts:[row(0,cast)],hits:[row(1),row(1.1),row(2),row(3)],reactions:[{...row(1,star),reaction:'StellarConduct'},{...row(2),reaction:'Frozen'}]});
const point=time=>({time,rootOrder:Infinity,damageModel:'reaction.stellarConduct'});

test('five stellar weapon effects preserve independent candidate gates, exact expiry and mode replacement',()=>{
 const run=(m,c,s,r,t=3.5)=>names.flatMap(name=>Object.values(stellarEquipmentEffect(weapon(name),point(t),context(m,c,s,r)).values));
 const b=createNumericProgram(),m=createNativeGraphCompiler(b,{funcs:{},table:[]}).math,p=b.finish(run(m,b.input(0),b.input(1),b.input(2)));
 for(const c of [0,1])for(const s of [0,1])for(const r of [0,1]){
  const expected=[.16,0,.16*s,0,60,.16*s,.2*s,0,0,(r?.06:.04)*3*c,r?0:60*c,r?.24*c:0,r?0:.048,r?80:72,r?.24:0];
  run(scalarMath,c,s,r).forEach((v,i)=>near(v,expected[i]));executeNumericProgram(p,[c,s,r]).forEach((v,i)=>near(v,expected[i]));
 }
 const expired=run(scalarMath,1,1,1,14);assert.deepEqual(expired.slice(0,12),Array(12).fill(0));
 for(const time of [6.999,7,8,9]){const v=stellarEquipmentEffect(weapon('NewBough'),point(time),context(scalarMath,1,1,0)).values;near(v.ATKPercentage,.04*({6.999:3,7:2,8:1,9:0}[time]));}
});

test('shared passives match existing native weapon formulas without double application',()=>{
 const input=stellarWeaponInput(),roleOf={Emberwell:0,EchoesOfTheHeart:2,SongOfTheVigil:1,NewBough:0,WintersHeavyHeart:2};
 for(const name of names)for(const radiance of [false,true]){
  const profiles=structuredClone(input.single_interfaces),role=roleOf[name];profiles[role].weapon=weapon(name);profiles.forEach(p=>p.artifacts=[]);
  const rotation=compileActionAxis(input.team_dps.axis,profiles),ctx=context(scalarMath,1,1,radiance),fact={...row(1),role,kind:'reaction',reaction:'StellarConduct',elements:['Cryo','Electro']};
  const rules=createEquipmentAxisRules(profiles,{...rotation,roots:[{...row(0),role,kind:'cast',action:'skill'}],events:ctx.hits.map(h=>({...h,role,kind:'hit'})),reactionFacts:[fact],reactionAt:()=>({radiance})},input.team_dps);
  const expected=structuredClone(profiles[role]);expected.weapon.params[name]={...expected.weapon.params[name],reaction_active:true,stellar_active:true,reaction_rate:1,stellar_rate:1,rate:1,stacks:3,radiance,cryo_count:3,electro_count:1};
  const actual=rules.prepare(structuredClone(profiles[role]),role,point(3.5));actual.buffs=rules.baseBuffs(profiles.map(()=>[]),role,point(3.5));
  const a=api.CommonInterface.get_attribute(actual),b=api.CommonInterface.get_attribute(expected);for(const key of ['atk','elemental_mastery','critical','critical_damage'])near(sum(a[key]),sum(b[key]));
  const ad=api.CalculatorInterface.get_damage_analysis(actual,null),bd=api.CalculatorInterface.get_damage_analysis(expected,null);near(sum(ad.direct_stellarconduct_compose),sum(bd.direct_stellarconduct_compose));
 }
});

test('real conditional radiance and reaction weapons agree across native, compiled A/B/A and member order',async()=>{
 for(const mode of ['radiance','reaction']){
  const input=stellarWeaponInput(mode),teams=stellarWeaponTeams(input),native=teams.map((t,i)=>stellarWeaponEvaluator(api,{...input,testElectro:i===1?0:1}).evaluate(t,true));
  const label=mode==='radiance'?'新枝':'引火之源',has=h=>Object.keys(h.analysis.atk).some(k=>k.includes(label)&&h.analysis.atk[k]>0);assert.ok(native[0].hits.some(has));
  if(mode==='radiance'){const late=native[0].hits.find(h=>h.eventId.startsWith('late/'));assert.ok(late);assert.ok(Object.entries(late.analysis.em).filter(([k])=>k.includes('新枝')).every(([,v])=>v===0));}
  near(native[0].expectation,native[2].expectation);compareEventValues(nativeEventTrace(native[0]),nativeEventTrace(native[2]));
  const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(stellarWeaponEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,stellarWeaponEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
 }
});
