import {parentPort} from 'node:worker_threads';import fs from 'node:fs';
import {api} from '../../beta-tools/runtime-team-dps-graph.mjs';import {capturedTeamGraph} from '../../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../../beta-data/team-dps-program.mjs';import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
import {gatedSkirkEvaluator} from './skirk-runtime-evaluator.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../../beta-data/team-dps-native/'+name+'.json',import.meta.url)));
parentPort.on('message',async({input,teams})=>{
 let computation;
 try{
  const artifacts=teams.flat(2),model=compileTeamDpsExpression(api,input,artifacts,{capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')},gatedSkirkEvaluator,{trace:true});
  computation=createTeamDpsComputation(model,artifacts);const ids=teams.map(t=>t.map(b=>b.map(a=>a.id))),output=await computation.score([...ids,ids[0]],{detail:true});parentPort.postMessage({results:output.results});
 }catch(error){parentPort.postMessage({error:error.stack});}finally{computation?.dispose();}
});
