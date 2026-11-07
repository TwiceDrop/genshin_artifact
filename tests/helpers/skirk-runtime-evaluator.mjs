import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
// Test-only candidate-valued command, not a new public axis input contract.
export function gatedSkirkEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(axis,profiles,settings,options)=>{
  const plan=compileActionAxis(axis,profiles,settings,options),command=plan.roots.find(e=>e.id==='optional');
  command.enabled=execution.setCount?execution.math.ge(execution.setCount(0,'GladiatorsFinale'),4):input.testCommandEnabled;
  return plan;
 }});
}
