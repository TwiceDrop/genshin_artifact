import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import weapons from '../src/assets/_gen_weapon.js';
import {weapon,fixture} from '../beta-tools/interface-audit-7108.mjs';
import {sandroneInput,sandroneAction,sandroneEnd} from './helpers/team-sandrone-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createEquipmentAxisRules,AUTO_WEAPON_FIELDS} from '../beta-data/equipment-axis-rules.mjs';
import {createRuntimeEquipmentEvents} from '../beta-data/equipment-damage-events.mjs';
import {createCombatHistory} from '../beta-data/team-engine/combat-history.mjs';
import {stellarEquipmentEffect} from '../beta-data/equipment-stellar-rules.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression,createTeamDpsScoreModel} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {packTeamDpsResult} from '../beta-data/team-dps-result-view.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const row=(time,extra={})=>({time,rootOrder:time*100,order:0,role:0,enabled:1,...extra});
const point=(time,extra={})=>row(time,{rootOrder:Infinity,onField:true,...extra});
function scenario(name,{math=scalarMath,gate=1,heals=[],events,roots,reactions=[]}={}){
 const input=sandroneInput(0,[]),profiles=input.single_interfaces;profiles[0].weapon=weapon(name);
 const rotation={...compileActionAxis(input.team_dps.axis,profiles,input.team_dps),
  roots:roots??[row(0,{kind:'cast',action:'skill'})],events:events??[row(1,{kind:'hit',category:'normal',element:'Physical',onField:true,enabled:gate})],
  heals,hpEvents:[],reactionFacts:reactions,activeRole:()=>0,lastCast:()=>0,entered:()=>0,
  healthAt:()=>({ratios:[.5,1,1,1]}),reactionAt:()=>({radiance:gate,targets:[{Hydro:gate,Electro:0,cryoAffected:gate,frozen:0}]})};
 const rules=createEquipmentAxisRules(profiles,rotation,input.team_dps,{math});
 return {input,profiles,rotation,rules,state:e=>rules.prepare(structuredClone(profiles[0]),0,e).weapon.params[name]};
}

test('current catalog conditions use existing hit, region, healing and reaction facts with exact boundaries',()=>{
 const catalog=Object.values(weapons).filter(w=>w.type!=='Bow');assert.equal(catalog.length,206);
 assert.deepEqual(catalog.filter(w=>w.configs?.length&&!AUTO_WEAPON_FIELDS[w.name]).map(w=>w.name),[]);
 const cases={TheUnforged:{stack:1,shield_rate:0},Whiteblind:{stack:1},SkyriderGreatsword:{stack:1},TheBell:{rate:0},LithicBlade:{liyue_count:1},LithicSpear:{liyue_count:1},FerrousShadow:{rate:1},Quartz:{rate:0},EarthShaker:{rate:0},ATeaspoonOfTranscendence:{atk_active:true,transcend_stacks:0},SongOfBrokenPines:{rate:0},MasterKey:{enable:false,moon_state:0},GestOfTheMightyWolf:{stack:3,ritual_active:false},AThousandBlazingSuns:{rate1:1,rate2:0}};
 for(const [name,expected]of Object.entries(cases)){
  const actual=scenario(name).state(point(2));for(const [k,v]of Object.entries(expected))assert.equal(actual[k],v,name+'.'+k);
 }
 const h=row(1,{kind:'heal',healingAmount:100,healedRecipients:[{role:0,enabled:1}]});
 near(scenario('TidalShadow',{heals:[h]}).state(point(1)).rate,1);near(scenario('TidalShadow',{heals:[h]}).state(point(9)).rate,0);
 const same=row(1,{kind:'heal',step:1,healingAmount:100,healedRecipients:[0]});
 near(scenario('TidalShadow',{heals:[same]}).state(row(1)).rate,0);near(scenario('TidalShadow',{heals:[same]}).state(row(1,{step:2})).rate,1);
 const marks=[1,2,3].map(time=>({...h,time}));near(scenario('PortablePowerSaw',{heals:marks,roots:[row(4,{kind:'cast',action:'skill'})]}).state(point(5)).stack,3);
 const events=[row(1,{kind:'hit',category:'skill',element:'Electro',onField:true})];
 near(scenario('BeaconOfTheReedSea',{events}).state(point(2)).rate_atk,.5);near(scenario('BeaconOfTheReedSea',{events}).state(point(9)).rate_atk,0);
 near(scenario('MailedFlower',{events}).state(point(2)).rate,1);near(scenario('FangOfTheMountainKing',{events}).state(point(2)).stack,1);
 const reactions=[row(1,{kind:'reaction',reaction:'ElectroCharged',elements:['Electro','Hydro']})];
 near(scenario('FlameForgedInsight',{reactions}).state(point(2)).uptime,1);near(scenario('FlameForgedInsight',{reactions}).state(point(16)).uptime,0);
 const sunEvents=[1,2,3,4].map(time=>row(time,{kind:'hit',category:'normal',element:'Electro',onField:true}));
 near(scenario('AThousandBlazingSuns',{events:sunEvents}).state(point(11.999)).rate1,1);near(scenario('AThousandBlazingSuns',{events:sunEvents}).state(point(12)).rate1,0);
 const p=scenario('VividNotions',{roots:[row(0,{kind:'cast',action:'skill'}),row(1,{kind:'action',action:'plunge'})],events:[row(1,{kind:'hit',rootOrder:120,category:'plunge',index:9,onField:true})]});
 assert.deepEqual(p.state(point(1)),{rate1:1,rate2:1});assert.deepEqual(p.state(point(1.1)),{rate1:0,rate2:0});
 for(const name of ['Rainslasher','BloodstainedGreatsword']){
  const s=scenario(name),e=point(2),profile=s.rules.prepare(structuredClone(s.profiles[0]),0,e);
  s.rotation.reactionAt=()=>({targets:[{Hydro:name==='Rainslasher'?1:0,Electro:name==='BloodstainedGreatsword'?1:0,cryoAffected:0}]});
  s.rules.prepareTarget(profile,0,e,[0],profile.artifacts);near(profile.weapon.params[name].rate,1);
 }
 const nymph=scenario('WasterGreatsword',{events:[row(1,{kind:'hit',category:'normal'}),row(1.1,{kind:'hit',category:'equipment'})]});nymph.profiles[0].artifacts.forEach(a=>a.set_name='NymphsDream');
 const config=nymph.rules.prepare(structuredClone(nymph.profiles[0]),0,point(2)).artifact_config.config_nymphs_dream;assert.deepEqual([config.w1,config.w2,config.w3],[1,0,0]);
 const run=(m,g)=>{
  const a=scenario('BeaconOfTheReedSea',{math:m,events:[{...events[0],enabled:g}]}).state(point(2));
  const b=scenario('Whiteblind',{math:m,gate:g}).state(point(2));
  const c=scenario('TidalShadow',{math:m,heals:[{...h,enabled:g}]}).state(point(2));return [a.rate_atk,b.stack,c.rate];
 };
 const builder=createNumericProgram(),program=builder.finish(run(builder.math,builder.input(0)));
 for(const g of [1,0,1]){assert.deepEqual(run(scalarMath,g),[.5*g,g,g]);assert.deepEqual(executeNumericProgram(program,[g]),[.5*g,g,g]);}
});

test('claymore proc windows reuse candidate clocks and spend eight Pride activations rather than targets',()=>{
 function run(name,m=scalarMath,g=1){
  const out=[],runtime=createRuntimeEquipmentEvents([{character:{name:'Sandrone'},weapon:weapon(name)}],{slots:['owner'],activeRole:()=>0},m,{enemy_count:3});
  const roots=[row(0,{kind:'cast',action:name==='DebateClub'?'skill':'burst',enabled:g}),...Array.from({length:10},(_,i)=>row(i+1,{kind:'hit',category:name==='LuxuriousSeaLord'?'burst':'normal',onField:true,targetIds:[0,1,2],eventId:'n'+i}))];
  for(const e of roots)runtime.afterEvent(e,h=>out.push(h));return out;
 }
 const pride=run('SkywardPride');assert.equal(pride.length,8);assert.deepEqual(pride.map(h=>h.time),[1,2,3,4,5,6,7,8].map(t=>t+1/60));assert.ok(pride.every(h=>h.ratio===.8&&h.targetIds===undefined));
 assert.deepEqual(run('SkywardPride',scalarMath,0),[]);assert.deepEqual(run('DebateClub').map(h=>h.time),[1,4,7,10].map(t=>t+1/60));
 near(run('PrototypeArchaic')[0].probability,.5);near(run('PrototypeArchaic')[0].ratio,2.4);near(run('SnowTombedStarsilver')[0].ratio,.8);near(run('SnowTombedStarsilver')[0].cryoRatio,2);
 assert.equal(run('LuxuriousSeaLord').length,1);near(run('LuxuriousSeaLord')[0].ratio,1);
 const b=createNumericProgram(),out=run('SkywardPride',b.math,b.input(0)),program=b.finish(out.map(e=>e.enabled));
 for(const gate of [1,0,1])assert.deepEqual(executeNumericProgram(program,[gate]),Array(10).fill(0).map((_,i)=>i<8?gate:0));
});

test('team equipment grants preserve ownership, shared caps, live radiance and exact star expiry',()=>{
 const s=scenario('SongOfBrokenPines',{events:[0,1,2,3].map(t=>row(t,{kind:'hit',category:'normal',onField:true})),reactions:[row(1,{role:1,kind:'reaction',reaction:'Frozen',elements:['Hydro','Cryo']}),row(2,{role:1,kind:'reaction',reaction:'StellarConduct',elements:['Electro','Cryo']})]});
 s.profiles[1].weapon=weapon('FreedomSworn');s.profiles[1].weapon.refine=5;s.profiles[2].weapon=weapon('WolfsGravestone');s.input.team_dps.weapon_conditions=[{},{},{WolfsGravestone:{rate:.5}}];
 s.profiles[0].artifacts.forEach(a=>a.set_name='HeartOfTheFurnace');s.profiles[1].artifacts.forEach(a=>a.set_name='HeartOfTheFurnace');
 const rules=createEquipmentAxisRules(s.profiles,s.rotation,s.input.team_dps),builds=s.profiles.map(p=>p.artifacts),values=(r,time)=>Object.fromEntries(rules.baseBuffs(builds,r,point(time,{damageModel:'reaction.stellarConduct'})).map(b=>[b.config.ExtensionEffect.label,b.config.ExtensionEffect.values]));
 const out=values(2,4);near(out['千年的大乐章·攻击力'].ATKPercentage,.4);near(out['狼的末路·如狼般狩猎者'].ATKPercentage,.2);near(out['炉火融炼之心4·星超导'].EnhanceStellarSuperconduct,.5);assert.ok(!out['炉火融炼之心4·攻击力']);near(values(1,4)['炉火融炼之心4·攻击力'].ATKPercentage,.12);assert.ok(!values(2,14)['炉火融炼之心4·星超导']);
 const run=(m,g,mode,time=4)=>{
  const reaction=row(1,{reaction:'StellarConduct',enabled:g}),ctx={math:m,history:createCombatHistory(m),rotation:{reactionAt:()=>({radiance:mode})},reactions:[reaction],teamReactions:[reaction,row(2,{reaction:'Frozen'}),row(3,{reaction:'Superconduct'})],casts:[row(0)],hits:[],elements:[]};
  const a=stellarEquipmentEffect(weapon('BladeOfAtonement'),point(time,{damageModel:'reaction.stellarConduct'}),ctx).values,b=stellarEquipmentEffect(weapon('StarsealedEdict'),point(time,{damageModel:'reaction.stellarConduct'}),ctx).values;return [a.ATKPercentage,a.ElementalMastery,b.ElementalMastery,b.StellarConductCritDamage];
 };
 const b=createNumericProgram(),p=b.finish(run(b.math,b.input(0),b.input(1)));
 for(const g of [0,1])for(const mode of [0,1]){const expected=[.16*g,64*g,96+24*g,mode*(.24+.12*g)];run(scalarMath,g,mode).forEach((v,i)=>near(v,expected[i]));executeNumericProgram(p,[g,mode]).forEach((v,i)=>near(v,expected[i]));}
 assert.deepEqual(run(scalarMath,1,1,20),[0,0,0,0]);
 const cast=row(0),castContext={math:scalarMath,history:createCombatHistory(),rotation:{reactionAt:()=>({radiance:1})},reactions:[],teamReactions:[],casts:[cast],hits:[],elements:[]};
 near(stellarEquipmentEffect(weapon('StarsealedEdict'),cast,castContext).values.ElementalMastery,48);
 near(stellarEquipmentEffect(weapon('StarsealedEdict'),{...cast,step:-1},castContext).values.ElementalMastery,0);
 const gold=scenario('ForgedByTheGoldenMelody',{reactions:[row(11,{kind:'reaction',reaction:'StellarConduct',elements:['Cryo','Electro']})]}).state(point(21));assert.equal(gold.counterpoint_active,true);assert.equal(gold.counterpoint_state,2);assert.equal(gold.state,2);
});

test('current equipment integration preserves native formulas, targets, snapshots, party order and compiled A/B/A',async()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')},gpu=[];
 for(const mode of (process.env.TEAM_EQUIPMENT_CASE?[process.env.TEAM_EQUIPMENT_CASE]:['stellar','ice-proc','live-states'])){
  const input=sandroneInput(0,mode==='stellar'?[sandroneAction('electro',2,'skill',0),sandroneAction('e',0,'skill',.2),sandroneAction('n',0,'normal.1',1),sandroneAction('star',0,'charged',1.5),sandroneEnd(3)]:[sandroneAction('ice',3,'burst',0),sandroneAction('n',0,'normal.1',1.5),sandroneEnd(1.7)]);
  input.team_dps.enemy_count=2;input.team_dps.initial_hp=[1,1,1,1];input.single_interfaces[0].weapon=weapon(mode==='stellar'?'BladeOfAtonement':'SnowTombedStarsilver');input.single_interfaces[0].weapon.refine=5;
  if(mode==='live-states'){
   const p=fixture('Mona');p.character.constellation=0;p.artifacts=input.single_interfaces[1].artifacts;p.weapon=weapon('StarsealedEdict');input.single_interfaces[1]=p;input.team_dps.axis.members[1].character='Mona';input.single_interfaces[0].weapon=weapon('MasterKey');
   input.team_dps.axis.timeline=[sandroneAction('me',1,'skill',0),sandroneAction('electro',2,'skill',.1),sandroneAction('e',0,'skill',.5),sandroneAction('n',0,'normal.1',1),sandroneAction('mn',1,'normal.1',1.1),sandroneEnd(1.2)];
  }
  input.single_interfaces[0].artifacts.forEach(a=>a.set_name='HeartOfTheFurnace');
  const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.flat().forEach(a=>a.id+=10000);b[0].forEach(a=>a.set_name='Empty');b[0][0].sub_stats=[['ElementalMastery',250],['ATKFixed',100]];const teams=[a,b,a];
  const evaluator=(api,input,execution={})=>createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{const rotation=compileActionAxis(...args);for(const h of rotation.events){if(mode==='ice-proc'&&h.eventId.startsWith('ice/'))h.targetIds=[0];if(mode==='live-states'&&h.eventId.startsWith('electro/')){const role=input.single_interfaces.findIndex(p=>p.character.name==='Sandrone');h.enabled=execution.setCount?execution.math.ge(execution.setCount(role,'HeartOfTheFurnace'),4):input.testElectro??1;}}return rotation;}});
  const native=teams.map((t,i)=>evaluator(api,{...input,testElectro:i===1?0:1}).evaluate(t,true));
  if(mode==='stellar')assert.ok(native[0].hits.some(h=>h.damageModel==='reaction.stellarConduct'&&Object.keys(h.analysis.direct_stellarconduct_compose).some(k=>k.includes('炉火融炼之心'))));
  else if(mode==='ice-proc'){const procs=native[0].hits.filter(h=>h.category==='equipment'&&h.role===0);assert.equal(procs.length,2);[3.6,1.4].forEach((v,i)=>near(Object.values(procs[i].analysis.atk_ratio).reduce((a,b)=>a+b,0),v));}
  else {
   const named=(h,text)=>Object.entries(h.analysis.em).filter(([k])=>k.includes(text)).reduce((n,[,v])=>n+v,0);
   near(named(native[0].hits.find(h=>h.eventId==='n/'),'万能钥匙'),60);near(named(native[1].hits.find(h=>h.eventId==='n/'),'万能钥匙'),0);
   near(named(native[0].hits.find(h=>h.eventId.startsWith('mn/')),'秘星典谕'),96);near(named(native[1].hits.find(h=>h.eventId.startsWith('mn/')),'秘星典谕'),48);
  }
  const order=[2,0,3,1],changed=structuredClone(input);changed.single_interfaces=order.map(i=>input.single_interfaces[i]);changed.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(evaluator(api,changed).evaluate(order.map(i=>a[i])).expectation,native[0].expectation);
  const artifacts=[...a.flat(),...b.flat()],ids=teams.map(t=>t.map(b=>b.map(a=>a.id))),model=compileTeamDpsExpression(api,input,artifacts,resources,evaluator,{trace:true}),scoreModel=createTeamDpsScoreModel(compileTeamDpsExpression(api,input,artifacts,resources,evaluator));
  const cpu=createTeamDpsComputation(model,artifacts),scores=createTeamDpsComputation(scoreModel,artifacts);
  try{const results=(await cpu.score(ids,{detail:true})).results,ranked=(await scores.score(ids)).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);near(ranked[i].expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);gpu.push({name:mode,model,scoreModel,artifacts,teams:ids,expected:results,expectedScores:ranked});}finally{cpu.dispose();scores.dispose();}
 }
 if(process.env.TEAM_EQUIPMENT_GPU_CASES)fs.writeFileSync(process.env.TEAM_EQUIPMENT_GPU_CASES,JSON.stringify(packTeamDpsResult(gpu)));
});
