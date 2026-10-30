import {compileTeamDpsProgram,createTeamProgramCodec} from '../../beta-data/team-dps-program.mjs';
import {capturedTeamGraph} from '../../beta-data/team-dps-graph-reader.mjs';
import {createWebGpuNumericExecutor} from '../../beta-data/team-dps-webgpu.mjs';
import nativeFunctions from '../../beta-data/team-dps-native/native-functions.json';
import extensionFunctions from '../../beta-data/team-dps-native/extension-functions.json';
import projections from '../../beta-data/team-dps-native/projections.json';
import extensionSlots from '../../beta-data/team-dps-native/extension-slots.json';

import('../wasm/team-dps-native-api.mjs').then(api=>{
 let executor,codec;
 self.onmessage=async({data})=>{
  try{
   if(data.type==='initialize'){
    const started=performance.now();let updated=-Infinity;
    const onProgress=()=>{const now=performance.now();if(now-updated<250)return;updated=now;self.postMessage({type:'progress',data:{phase:'compile',evaluated_teams:0,total_teams:data.input.team_dps.max_evaluations,remaining_teams:data.input.team_dps.max_evaluations,elapsed_ms:now-started,eta_ms:null}});};
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'}),device=await adapter.requestDevice();
    const model=compileTeamDpsProgram(api,data.input,data.artifacts,{capture:capturedTeamGraph,libraries:[nativeFunctions,extensionFunctions],projections,extensionSlots,onProgress});
    codec=createTeamProgramCodec(model,data.artifacts);executor=await createWebGpuNumericExecutor(device,model.program);
    self.postMessage({type:'initialized',compile_ms:performance.now()-started});
   }else if(data.type==='score'){
    const values=await executor.evaluate(codec.encode(data.teams),data.teams.length);
    self.postMessage({type:'scored',results:codec.decode(values,data.teams.length)});
   }
  }catch(error){self.postMessage({type:'error',message:error.message,stack:error.stack});}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
