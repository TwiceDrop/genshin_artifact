import fs from 'node:fs';import {parentPort,workerData} from 'node:worker_threads';
import {installStackSnapshotFixture} from './stack-snapshot-definition.mjs';
import {api} from '../../beta-tools/runtime-team-dps-graph.mjs';
import {capturedTeamGraph} from '../../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
const restore=installStackSnapshotFixture(),{input,teams,exportModel}=workerData;
try{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
 const artifacts=teams.flat(2),ids=teams.map(team=>team.map(build=>build.map(a=>a.id))),model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
 try{const {results}=await computation.score([...ids,ids[0]],{detail:true});parentPort.postMessage({results,...(exportModel?{fixture:{name:'synthetic_stack_snapshot',input,model,artifacts,ids,expected:results.slice(0,ids.length)}}:{})});}
 finally{computation.dispose();}
}finally{restore();}
