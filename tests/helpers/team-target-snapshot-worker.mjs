import fs from 'node:fs';import {parentPort} from 'node:worker_threads';
import {api} from '../../beta-tools/runtime-team-dps-graph.mjs';import {capturedTeamGraph} from '../../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../../beta-data/team-dps-program.mjs';import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
import {installTargetSnapshot,targetSnapshotEvaluator} from './team-target-snapshot-definition.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../../beta-data/team-dps-native/'+name+'.json',import.meta.url)));
parentPort.on('message',async({input,teams,mode})=>{
 const restore=installTargetSnapshot(mode);let computation;
 try{
  const artifacts=teams.flat(2),model=compileTeamDpsExpression(api,input,artifacts,{capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')},targetSnapshotEvaluator,{trace:true});
  computation=createTeamDpsComputation(model,artifacts);const ids=teams.map(t=>t.map(b=>b.map(a=>a.id))),out=await computation.score([...ids,ids[0]],{detail:true});parentPort.postMessage({results:out.results});
 }catch(error){parentPort.postMessage({error:error.stack});}finally{computation?.dispose();restore();}
});
