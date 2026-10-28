import {createTeamDpsEvaluator} from '../team-dps-evaluator.mjs';
import {compileActionAxis} from './timeline.mjs';

export {compileActionAxis};
export function createActionTeamEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:compileActionAxis});
}
