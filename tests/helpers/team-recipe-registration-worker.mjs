import {parentPort,workerData} from 'node:worker_threads';import fs from 'node:fs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {recipeCharacter} from './recipe-character.mjs';
characterPackages[recipeCharacter.id]=recipeCharacter;
// Install before importing the catalog, exactly as a new static import plus
// registration entry would do. No catalog/evaluator/timeline patch is needed.
const {TEAM_ACTION_CATALOG,validateActionAxis}=await import('../../beta-data/team-engine/action-config.mjs');
const x=workerData.input;validateActionAxis(x.team_dps.axis);
const builds=x.single_interfaces.map(p=>p.artifacts),teams=[builds,structuredClone(builds)];teams[1].flat().forEach(a=>a.id+=900000);teams[1][3].forEach(a=>a.sub_stats.push(['ATKPercentage',.2]));
const artifacts=teams.flat(2),ids=teams.map(team=>team.map(b=>b.map(a=>a.id)));let results,model;
if(workerData.graph){
 const {api}=await import('../../beta-tools/runtime-team-dps-graph.mjs'),{capturedTeamGraph}=await import('../../beta-data/team-dps-graph-reader.mjs'),{compileTeamDpsExpression}=await import('../../beta-data/team-dps-program.mjs'),{createTeamDpsComputation}=await import('../../beta-data/team-dps-computation.mjs');
 const read=name=>JSON.parse(fs.readFileSync(new URL('../../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
 model=compileTeamDpsExpression(api,x,artifacts,resources,undefined,{trace:true});const computation=createTeamDpsComputation(model,artifacts);
 results=(await computation.score(ids,{detail:true})).results;computation.dispose();
}else{
 const {api}=await import('../../beta-tools/runtime-7106.mjs'),{createTeamDpsEvaluator}=await import('../../beta-data/team-dps-evaluator.mjs'),{nativeEventTrace}=await import('./team-dps-result-comparison.mjs');
 const evaluator=createTeamDpsEvaluator(api,x);results=teams.map(team=>{const result=evaluator.evaluate(team,true);return {...result,eventTrace:nativeEventTrace(result)};});
}
parentPort.postMessage({registered:TEAM_ACTION_CATALOG.Kaeya,results:results.map(({expectation,eventTrace})=>({expectation,eventTrace})),...(workerData.exportModel?{fixture:{name:'test_only_registration',input:x,model,artifacts,ids,expected:results}}:{})});
