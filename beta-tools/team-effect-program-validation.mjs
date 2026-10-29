import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {api as scalarApi} from './runtime-7106.mjs';
import {effectInput,action} from '../tests/helpers/team-effect-refactor.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsProgram,createTeamProgramCodec,TEAM_PROGRAM_PANELS} from '../beta-data/team-dps-program.mjs';
import {executeNumericProgram,scheduleNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {fixture} from './interface-audit-7108.mjs';
import {characterEventInput} from '../tests/helpers/team-character-events.mjs';
import {equipmentRuntimeInput} from '../tests/helpers/team-equipment-runtime.mjs';
import {BUILTIN_TEAM_DPS_AXES} from '../beta-data/team-dps-builtins.mjs';

const folder=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??'.build-target/team-effect-refactor-20261028';
const selected=process.argv.find(arg=>arg.startsWith('--cases='));
fs.mkdirSync(folder,{recursive:true});
if(process.argv.includes('--scalar')){
const cases=[];
for(const name of selected?selected.slice(8).split(','):['effects-all','effects-single','fanfare','mona-boundary','vody-pools-all','vody-pools-single']){
 const input=name.startsWith('equipment-')?equipmentRuntimeInput(name):name.endsWith('-c6-events')?characterEventInput(name):effectInput();
 if(name==='effects-single')input.team_dps.damage_scope='single';
 if(name==='c1-boundary'){
  input.single_interfaces[2].character.constellation=1;
  input.team_dps.axis.timeline=[action('e-e','Escoffier','skill',0),action('s-e','Skirk','skill',14000),action('before','Skirk','normal.1',15000),action('refresh','Escoffier','burst',15000),action('after','Skirk','normal.2',15000),action('end','Skirk','normal.1',16000)];
 }
 if(name==='causal-boundary'){
  input.single_interfaces[0].character.constellation=4;input.single_interfaces[2].character.constellation=0;
  input.team_dps.axis.timeline=[action('s-e','Skirk','skill',0),action('before','Skirk','normal.1',1000),action('e-e','Escoffier','skill',1000),action('s-e2','Skirk','skill',1000),action('after','Skirk','normal.1',1000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:2000}];
 }
 if(name==='vody-c6-boundary'){
  input.team_dps.axis=structuredClone(BUILTIN_TEAM_DPS_AXES[0]);
  input.single_interfaces.forEach(p=>p.character.constellation=6);
 }
 if(name.startsWith('vody-pools-')){
  input.team_dps.damage_scope=name.endsWith('single')?'single':'all';
  input.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('hold','Skirk','skill.hold',500),action('q','Skirk','burst',1000),{id:'leave',actor:'Vodyanitsa',kind:'switch',timeMs:2830}];
 }
 if(name==='mona-boundary'){
  const mona=fixture('Mona');mona.artifacts=input.single_interfaces[3].artifacts;input.single_interfaces[3]=mona;
  input.team_dps.axis.members[3]={slot:'Mona',character:'Mona'};input.team_dps.axis.initialActiveSlot='Skirk';
  input.team_dps.axis.timeline=[action('s-e','Skirk','skill',0),action('before','Skirk','normal.1',1000),action('q','Mona','burst',1000),action('after','Skirk','normal.1',1000)];
 }
 if(name==='fanfare'){
  input.single_interfaces[1].character.constellation=2;
  input.team_dps.initial_hp=[.4,.6,.8,.5];
  input.team_dps.axis.timeline=[
   action('f-q','Furina','burst',0),action('f-e','Furina','skill',2100),
   action('v-e','Vodyanitsa','skill',2500),action('e-e','Escoffier','skill',3000),action('e-q','Escoffier','burst',4000),
   action('s-e','Skirk','skill',4500),action('n1','Skirk','normal.1',5000),action('n2','Skirk','normal.2',6000),action('charged','Skirk','charged',7000),action('end','Skirk','normal.1',10000),
  ];
 }
 if(name==='singer-clock'){
  input.single_interfaces[1].character.constellation=2;
  input.single_interfaces[1].artifacts.forEach(a=>a.set_name='OceanHuedClam');
  input.team_dps.initial_hp=[.2,.1,.3,.4];
  input.team_dps.axis.timeline=[action('f-q','Furina','burst',0),action('form','Furina','charged',100),action('f-e','Furina','skill',200),action('e-q','Escoffier','burst',4000),{id:'tail',kind:'switch',actor:'Furina',timeMs:7000}];
 }
 const teams=[input.single_interfaces.map(p=>p.artifacts)];teams.push(structuredClone(teams[0]));
 teams[1].flat().forEach(a=>a.id+=900000);
 teams[1][3].forEach(a=>a.sub_stats.push(['HPPercentage',.3]));
 teams[1][2].forEach(a=>a.sub_stats.push(['ATKPercentage',.2]));
 if(name==='singer-clock')teams[1][1].forEach(a=>a.sub_stats.push(['HPPercentage',.25]));
 if(name.startsWith('equipment-'))teams[1][2].forEach(a=>a.set_name=name.includes('clam')?'SongOfDaysPast':'OceanHuedClam');
 const scalar=teams.map(team=>createTeamDpsEvaluator(scalarApi,input).evaluate(team,true));
 cases.push({name,input,teams,scalar});
}
fs.writeFileSync(folder+'/numeric-fixtures.json',JSON.stringify(cases));
}else{
// Native bindings cache memory views. Keep the published and graph-capture
// WASM instances in separate processes rather than rebinding a used instance.
execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--scalar','--output='+folder,...(selected?[selected]:[])],{stdio:'inherit'});
const cases=JSON.parse(fs.readFileSync(folder+'/numeric-fixtures.json','utf8'));
const {api}=await import('./runtime-team-dps-graph.mjs');
const read=n=>JSON.parse(fs.readFileSync('beta-data/team-dps-native/'+n+'.json','utf8'));
const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const sum=values=>Object.values(values).reduce((a,b)=>a+b,0),reports=[];
for(const {name,input,teams,scalar} of cases){
 const started=performance.now(),inventory=teams.flat(2),model=compileTeamDpsProgram(api,input,inventory,resources);
 const compileMs=performance.now()-started,codec=createTeamProgramCodec(model,inventory);
 const encoded=codec.encode(teams.map(team=>team.map(build=>build.map(a=>a.id)))),expected=[];
 const report={name,compileMs,nodes:model.program.nodes.length,registers:scheduleNumericProgram(model.program).registerCount,outputs:0,maxRelativeError:0};
 scalar.forEach((out,k)=>{
  const values=[...['expectation','critical','non_critical','fanfare','furina_overflow'].map(key=>out[key]),...out.character_damage.flatMap(row=>['expectation','critical','non_critical'].map(key=>row[key])),...out.panels.flatMap(panel=>TEAM_PROGRAM_PANELS.map(key=>sum(panel[key]))),out.duration,out.dps];
  const actual=executeNumericProgram(model.program,encoded.slice(k*4*model.stride,(k+1)*4*model.stride));
  actual.forEach((value,i)=>{const error=Math.abs(value-values[i])/Math.max(1,Math.abs(values[i]));report.maxRelativeError=Math.max(report.maxRelativeError,error);report.outputs++;assert.ok(error<1e-10,`${name}/${k}/${i}: ${value} != ${values[i]}`);});
  expected.push(...values);
 });
 fs.writeFileSync(folder+'/'+name+'-program.json',JSON.stringify(model.program,(key,value)=>typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0))?String(Object.is(value,-0)?'-0':value):value));
 fs.writeFileSync(folder+'/'+name+'-input.bin',Buffer.from(encoded.buffer));
 fs.writeFileSync(folder+'/'+name+'-expected.bin',Buffer.from(new Float64Array(expected).buffer));
 reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync(folder+'/numeric-results.json',JSON.stringify(reports,null,2));
}
