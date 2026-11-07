import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {vesnaInput,vesnaFullInput,action as a,switchTo as sw} from './helpers/team-vesna-fixture.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createPortableNativeQuery} from '../beta-data/team-dps-native-query.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {contributionEffectEvent} from '../beta-data/team-engine/reaction-events.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=n=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+n+'.json',import.meta.url)));
const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const sum=x=>Object.values(x??{}).reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);

test('1 native formulas and candidate A/B/A: physical third attack, ordinary/spirit sword, Faruzan collapse',()=>{
 for(const [role,index,star]of [[0,2,false],[0,13,false],[0,13,true],[3,10,false]]){
  const input=vesnaInput(),x=structuredClone(input.single_interfaces[role]);x.enemy=input.team_dps.enemy;x.skill={index,config:role===3?{Faruzan:{talent2_ratio:0}}:'NoConfig'};
  const binding=characterPackages[x.character.name];binding.normalize(x);
  if(role===0)Object.assign(x.character.params.Vesna,{stance:false,radiance:star,disciplinary_stacks:2,anemo_cryo_count:3,other_count:1});
  x.buffs=[{name:'ExtensionEffect',config:{ExtensionEffect:{label:'probe',values:star?{StellarSwirlFlat:650,StellarSwirlBonus:.3,StellarSwirlCritDamage:.4,StellarSwirlIndependentBaseMultiplier:.2}:{ExtraDmgBase:200}}}}];
  const A=x.artifacts,B=structuredClone(A);B[0].sub_stats.push(['ATKFixed',1000],['ElementalMastery',170]);
  const names=['HPFixed','ATKFixed','ATKPercentage','HPPercentage','ElementalMastery','CriticalRate','CriticalDamage'],builder=createNumericProgram();
  const query=createPortableNativeQuery({...resources,api,builder,sets:[],setCount:()=>0,stats:(_r,name)=>names.includes(name)?builder.input(names.indexOf(name)):0});
  const event={index,element:index<10?'Physical':'Anemo',...(star?{damageModel:'direct.stellarSwirl'}:{})},d=query.query(x,role,event,true),keys=['atk','em','atk_ratio','extra_damage','bonus','critical','critical_damage','direct_stellarswirl_ratio','direct_stellarswirl_compose','direct_stellarswirl_base_compose','direct_stellarswirl_extra_fixed','critical_stellarswirl','critical_damage_stellarswirl','elevate_stellarswirl_compose','stellar_glimmer_reaction_damage_multiplier'];
  const program=builder.finish(keys.map(k=>Object.values(d[k]??{}).reduce((n,v)=>query.math.add(n,v),0)));
  const scores=[];
  for(const artifacts of [A,B,A]){
   const row=names.map(name=>artifacts.reduce((n,g)=>n+[g.main_stat,...g.sub_stats].filter(([key])=>key===name).reduce((n,[,v])=>n+v,0),0)),p=Object.fromEntries(keys.map((k,i)=>[k,executeNumericProgram(program,row)[i]]));
   const cr=Math.min(1,Math.max(0,p.critical+(star?p.critical_stellarswirl:0))),cd=p.critical_damage+(star?p.critical_damage_stellarswirl:0);
   const expected=star?(p.atk*p.direct_stellarswirl_ratio*(1+p.direct_stellarswirl_base_compose)*(1+p.direct_stellarswirl_compose)*(1+p.stellar_glimmer_reaction_damage_multiplier)+p.direct_stellarswirl_extra_fixed)*(1+p.elevate_stellarswirl_compose)*.9*(1+cr*cd):(p.atk*p.atk_ratio+p.extra_damage)*(1+p.bonus)*(190/390)*.9*(1+cr*cd);
   const native=api.CalculatorInterface.get_damage_analysis({...x,artifacts});near(expected,(star?native.direct_stellarswirl:native.normal).expectation);scores.push(expected);
  }
  assert.equal(scores[0],scores[2]);assert.ok(scores[1]>scores[0]);
 }
});

test('2 character lifecycles: essence, independent discipline, expiry, C6 transpose and Faruzan cooldown',()=>{
 const rows=[a('e',0,'skill',0),a('e1',0,'skill',.7),a('e2',0,'skill',1.3),a('q',0,'burst',2),a('e3',0,'skill',4.2),a('n1',0,'normal.1',5.6),a('n2',0,'normal.2',6),a('n3',0,'normal.3',6.5),a('ca',0,'charged',7.2),a('e4',0,'skill',8.6),sw('off',2,10),a('ice',2,'skill',10),a('new',0,'skill',11),sw('end',0,27)];
 const x=vesnaInput(rows,[0,0,0,0]),r=run(x);
 assert.equal(r.hits.filter(h=>h.role===0&&h.index===16).length,6);
 assert.deepEqual(r.resources.filter(h=>h.reason==='windborne').map(h=>h.after),[1,0,0,0]);
 assert.ok(r.resources.some(h=>h.reason==='exit'&&h.time===26&&h.after===0));
 const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));assert.ok(preview.roles[0].effective.atk>0);
 const high=vesnaInput([a('e',0,'skill',0),a('e1',0,'skill',.7),a('e2',0,'skill',1.3),a('e3',0,'skill',2),a('n',0,'normal.1',3.4),sw('end',0,5)],[6,0,0,0]),h=run(high);
 assert.equal(h.hits.filter(e=>e.role===0&&e.index===18).length,1);assert.equal(h.hits.filter(e=>e.role===0&&e.index===19).length,1);
 assert.equal(h.hits.filter(e=>e.role===0&&e.index===16).length,3);near(h.resources.find(e=>e.reason==='windborne'&&e.time===2).after,0);
 const f=vesnaInput([a('q',3,'burst',0),a('n1',0,'normal.1',1.5),a('n2',0,'normal.1',3),a('n3',0,'normal.1',4),a('q2',3,'burst',4.3),a('n4',0,'normal.1',5.5),sw('end',0,7)],[0,0,0,6]),fr=run(f);
 const hits=fr.hits.filter(e=>e.role===3&&e.index===10);assert.ok(hits.length>=2);for(let i=1;i<hits.length;i++)assert.ok(hits[i].time-hits[i-1].time>=3-1e-10);
});

test('3 wandering conversion/expiry and shared finite uses across ordinary/stellar damage and contributors',()=>{
 const x=vesnaInput([a('ice',2,'skill',0),a('wind',3,'skill',.5),a('vody',1,'skill',1),a('wind2',3,'skill',3.2),sw('end',0,17)],[0,0,0,0]);let rotation;
 createTeamDpsEvaluator(api,x,{captureRotation:r=>{rotation=r;}}).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
 const state=t=>rotation.reactionAt({time:t,rootOrder:Infinity});
 assert.equal(state(.9).wanderingActive,0);assert.equal(state(1.1).wanderingActive,1);assert.equal(state(8).wanderingActive,1);assert.equal(state(9).wanderingActive,0);
 assert.equal(Number(state(15).swirlRadiance),1);assert.equal(Number(state(16).swirlRadiance),0);assert.equal(Number(state(5).wanderingAnemoShred),1);assert.equal(Number(state(11).wanderingAnemoShred),0);
 const definitions=characterPackages.Vodyanitsa.effects({...x.single_interfaces[1],role:1}).filter(d=>d.uses);
 const rot={model:'actions',activeRole:()=>0,reactionAt:e=>({wanderingActive:Number(e.time>=1&&e.time<10)})},settings={enemy_count:2,damage_scope:'all'};
 const sources=definitions.map(d=>({definition:d,role:1,actorId:'vody',key:d.id})),plan={sources,rotation:rot,settings,schedule:[]};
 const effects=createEffectState(plan,{math:scalarMath,enabled:()=>1,read:()=>50000,trace:true}),resolver=createEffectResolver(plan,effects,scalarMath);
 const event=(id,role,time,extra={})=>({kind:'hit',role,time,rootOrder:0,order:time,step:0,eventId:id,targetIds:[0,1],enabled:1,...extra});
 effects.publish({...event('grant',1,0),kind:'cast',action:'skill'});
 const ordinary=event('ordinary',2,.5,{element:'Cryo',category:'skill'});effects.publish(ordinary);
 near(sum(resolver.resolve('damage',2,ordinary,()=>50000,[0]).flatMap(b=>Object.values(b.config.ExtensionEffect.values))),1400);
 const reaction=event('star',0,2,{element:'Anemo',category:'reaction',hitTriggers:false,damageModel:'reaction.stellarSwirl',contributors:[{role:3,actorId:'c',enabled:1},{role:0,actorId:'a',enabled:1},{role:2,actorId:'b',enabled:1},{role:1,actorId:'d',enabled:0}]});
 effects.publish(reaction);
 const contribution=contributionEffectEvent(reaction,reaction.contributors[2],scalarMath);
 near(sum(resolver.resolve('damage',2,{...reaction,role:2,targetIds:[1],effectEvent:contribution},()=>60000,[1]).flatMap(b=>Object.values(b.config.ExtensionEffect.values))),5200);
 near(sum(resolver.resolve('damage',2,{...reaction,time:.5,role:2,targetIds:[1],effectEvent:contribution},(_role,_dependency,e)=>e.time===2?60000:40000,[1]).flatMap(b=>Object.values(b.config.ExtensionEffect.values))),5200);
 assert.equal(effects.changes.filter(e=>e.kind==='consume'&&e.effectId.endsWith('back')).reduce((n,e)=>n+e.used,0),6);
 for(const t of [3,4])effects.publish({...reaction,eventId:'star'+t,time:t,order:t});
 assert.equal(effects.changes.filter(e=>e.kind==='consume'&&e.effectId.endsWith('back')).reduce((n,e)=>n+e.used,0),10);
 const unboosted=event('after',2,11,{element:'Cryo',category:'skill'});effects.publish(unboosted);assert.equal(resolver.resolve('damage',2,unboosted,()=>50000).length,0);
 // A second cast resets both pools; ordinary Hydro/Cryo resumes after the window.
 effects.publish({...event('grant2',1,11.1),kind:'cast',action:'skill'});
 const after=event('after2',0,11.2,{element:'Hydro',category:'normal'});effects.publish(after);
 near(sum(resolver.resolve('damage',0,after,()=>50000,[0]).flatMap(b=>Object.values(b.config.ExtensionEffect.values))),1400);
});

test('4 full 19s / 20.5s rotations: equipment, candidate changes and every detailed event',async()=>{
 const reports=[];
 for(const burst of [false,true]){
  const x=vesnaFullInput(burst),A=x.single_interfaces.map(p=>p.artifacts),B=structuredClone(A);
  B[0][0].id+=1000;B[0][0].sub_stats.push(['ATKFixed',250]);B[1][0].id+=1000;B[1][0].sub_stats.push(['HPFixed',6000]);
  B[3].slice(0,4).forEach((g,i)=>{g.id+=1000;g.set_name='Empty';});
  const inventory=[...A.flat(),...B.flat().filter(g=>g.id>=1000)],started=performance.now(),model=compileTeamDpsExpression(api,x,inventory,resources,undefined,{trace:true}),compileMs=performance.now()-started,cpu=createTeamDpsComputation(model,inventory);
  try{
   const scores=[];
   for(const builds of [A,B,A]){
    const native=createTeamDpsEvaluator(api,x).evaluate(builds,true),compiled=(await cpu.score([builds.map(b=>b.map(g=>g.id))],{detail:true})).results[0];
    fs.writeFileSync(new URL('../../.work/team-vesna-7203/full-axis-last-details.json',import.meta.url),JSON.stringify({native,compiled},null,2));
    near(compiled.expectation,native.expectation);near(compiled.duration,burst?20.5:19);assert.ok(native.character_damage.every(r=>r.expectation>0));assert.ok(native.heals.length>0);
    compareEventValues(compiled.eventTrace,nativeEventTrace(native));scores.push(compiled.expectation);
    if(builds===A&&scores.length===1){
     assert.ok(native.hits.some(h=>h.damageKind==='stellarSwirl'&&h.flat>0));
     assert.ok(native.effects.some(e=>e.effectId==='artifact.tenacity.4'&&e.kind==='activate'));
     const v=native.hits.filter(h=>h.role===0);assert.ok(v.some(h=>sum(h.analysis.critical)>sum(v[0].analysis.critical)));
     assert.ok(v.some(h=>(h.analysis.direct_stellarswirl_compose?.['炉火融炼之心4·星扩散']??0)===.5));
     assert.ok(v.some(h=>(h.analysis.direct_stellarswirl_compose?.['蝶变·叛弃之风']??0)>.35));
     assert.ok(v.some(h=>(h.analysis.atk?.HymnOfTheMaelstrom??0)>0));
     if(!burst)assert.equal(v.filter(h=>h.index===15).length,3);
     fs.writeFileSync(new URL('../examples/team-dps/'+x.team_dps.axis.id+'.json',import.meta.url),JSON.stringify(x.team_dps.axis,null,2));
     fs.writeFileSync(new URL('../../.work/team-vesna-7203/'+x.team_dps.axis.id+'-input.json',import.meta.url),JSON.stringify(x,null,2));
    }
   }
   assert.equal(scores[0],scores[2]);assert.notEqual(scores[0],scores[1]);reports.push({axis:x.team_dps.axis.id,scores,compileMs,nodes:model.program.nodes.length});
  }finally{cpu.dispose();}
 }
 fs.writeFileSync(new URL('../../.work/team-vesna-7203/full-axes.json',import.meta.url),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
});
