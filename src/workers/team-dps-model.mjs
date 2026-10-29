import {compileTeamDpsExpression} from '../../beta-data/team-dps-program.mjs';
import {capturedTeamGraph} from '../../beta-data/team-dps-graph-reader.mjs';
import nativeFunctions from '../../beta-data/team-dps-native/native-functions.json';
import extensionFunctions from '../../beta-data/team-dps-native/extension-functions.json';
import extensionSlots from '../../beta-data/team-dps-native/extension-slots.json';
export function compileTeamDpsModel(api,input,artifacts,onProgress){
 return compileTeamDpsExpression(api,input,artifacts,{capture:capturedTeamGraph,libraries:[nativeFunctions,extensionFunctions],extensionSlots,onProgress},undefined,{trace:true});
}
