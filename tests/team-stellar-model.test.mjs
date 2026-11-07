import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createPortableNativeQuery} from '../beta-data/team-dps-native-query.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {STELLAR_DAMAGE_FIELDS} from '../beta-data/team-engine/native-damage-fields.mjs';
import {createTeamNumericRules} from '../beta-data/team-dps-numeric-rules.mjs';
import {describeCompiledTeamSources} from '../beta-data/team-dps-source-detail.mjs';
import {modelInput,modelEvaluator,installEffects} from './helpers/team-stellar-model-definition.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';
import {effect} from '../beta-data/team-engine/rule-utils.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
// Fixture imports initialize the ordinary kernel first. Load the graph runtime
// last, and use its real native interfaces for both scalar and compiled reads.
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url)));
const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const sum=x=>Object.values(x??{}).reduce((a,b)=>a+b,0),near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);

test('stellar arithmetic places fixed damage after independent bonus and before elevation, with a numeric candidate gate',()=>{
 const b=createNumericProgram(),args={base:1200,coefficient:1.5,baseBonus:.2,em:500,bonus:.4,independent:.3,flat:700,elevation:.25,resistance:.9,targets:2,critical:.6,criticalDamage:1.8};
 const program=b.finish(Object.values(createTeamNumericRules(b.math).stellarConduct({...args,em:b.input(0),targets:b.math.mul(2,b.input(1))})));
 for(const [em,gate]of [[0,1],[500,1],[1000,0],[500,1]]){
  const n=((1200*1.5*1.2*(1+6*em/(2000+em)+.4)*1.3)+700)*.9*1.25*2*gate;
  const expected=[n,n*2.8,n*(1+.6*1.8)];
  executeNumericProgram(program,[em,gate]).forEach((v,i)=>near(v,expected[i]));
 }
});

test('real native stellar projection preserves talent and named sources while recomputing candidate EM and excluding category crit',()=>{
 // Only a native formula declaration is installed here, not a simulated Qiqi
 // package; full character integration has its own lifecycle acceptance tests.
 const old=characterPackages.Qiqi;
 characterPackages.Qiqi={id:'Qiqi',nativeBackend:'legacy',nativeDamage:{19:{category:'burst',element:'Cryo'}}};
 try{
  const x=fixture('Qiqi');x.artifacts=[];x.skill.index=19;x.enemy=normalizeEnemy({level:100});
  x.buffs=[effect('测试星伤',{CriticalBase:.2,CriticalDamageBase:.3,CriticalElementalBurst:.7,CriticalDamageElementalBurst:4,BonusBase:3,StellarConductCritRate:.15,StellarConductCritDamage:.4,EnhanceStellarSuperconduct:.4,StellarConductBaseBonus:.2,StellarConductFlat:700,StellarConductElevation:.25})];
  const b=createNumericProgram(),query=createPortableNativeQuery({...resources,api,builder:b,sets:[],stats:(_r,k)=>k==='ElementalMastery'?b.input(0):k==='ATKFixed'?b.input(1):0,setCount:()=>0,sourceDetails:true});
  const d=query.query(x,0,{index:19,damageModel:'reaction.stellarConduct'},true),detail=describeCompiledTeamSources(d),fields=['atk','em','critical','critical_damage',...STELLAR_DAMAGE_FIELDS];
  const totals=fields.map(k=>Object.values(d[k]).reduce((a,v)=>query.math.add(a,v),0)),named=fields.map(k=>Object.values(detail[k]).reduce((a,v)=>query.math.add(a,v),0)),program=b.finish([...totals,...named]);
  for(const values of [[0,0],[500,200],[1000,400],[0,0]]){
   const input=structuredClone(x);input.buffs.push(effect('候选词条',{ElementalMastery:values[0],ATKFixed:values[1]}));
   const damage=api.CalculatorInterface.get_damage_analysis(input,null),panel=api.CommonInterface.get_attribute(input);damage.critical=panel.critical;damage.critical_damage=panel.critical_damage;
   const result=executeNumericProgram(program,values);
   fields.forEach((k,i)=>{near(result[i],sum(damage[k]),k);near(result[i+fields.length],result[i],k+' sources');});
   near(result[2],.25);near(result[3],.8);assert.ok(result[fields.indexOf('direct_stellarconduct_ratio')]>0);
  }
 }finally{if(old)characterPackages.Qiqi=old;else delete characterPackages.Qiqi;}
});

test('shared evaluator scores direct stellar contacts, snapshots and finite actual targets with reusable candidate programs',async()=>{
 const restore=installEffects();
 try{
  for(const scope of ['all','single']){
   const input=modelInput(scope),a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);
   b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[0][0].sub_stats=[['ATKFixed',200],['ElementalMastery',500]];
   const teams=[a,b,a],ev=modelEvaluator(api,input),native=teams.map(team=>ev.evaluate(team,true));
   for(const [i,result]of native.entries()){
    const hits=result.hits.filter(h=>h.damageModel==='reaction.stellarConduct'),em=i===1?500:0,atk=sum(api.CommonInterface.get_attribute({...input.single_interfaces[0],artifacts:teams[i][0]}).atk);
    assert.equal(hits.length,scope==='all'?6:2);
    for(const h of hits){
     // Escoffier's four Hydro/Cryo party contributes 55% resistance reduction;
     // the later test buff adds 20% live reduction even to a stat snapshot.
     const second=h.eventId.startsWith('star-2'),flat=second?(h.targetIds[0]===2?150:50):150,res=second?1.325:1.225;
     const n=(atk*2*1.5*1.2*(1+6*em/(2000+em)+.4)+flat)*res;
     near(h.atk,atk);near(h.em,em);near(h.non_critical,n);near(h.expectation,n*(1+.4*1.2));
    }
    assert.deepEqual(result.effects.filter(e=>e.effectId==='test.stellar.pool'&&e.kind==='consume').map(e=>e.used),[3,1]);
   }
   const artifacts=[...a.flat(),...b.flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,modelEvaluator,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
   try{
    const ids=teams.map(t=>t.map(build=>build.map(a=>a.id))),outputs=(await computation.score(ids,{detail:true})).results;
    outputs.forEach((result,i)=>{near(result.expectation,native[i].expectation);compareEventValues(result.eventTrace,nativeEventTrace(native[i]));});
    assert.deepEqual(outputs[0],outputs[2]);
   }finally{computation.dispose();}
  }
 }finally{restore();}
});
