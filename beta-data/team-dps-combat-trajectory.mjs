import {conditionStochasticTrajectory} from './team-dps-stochastic-trajectory.mjs';
import {decodeEventTrace} from './team-dps-event-trace.mjs';

export function queryCombatTrajectory(plan,result,{branch=0,evidence=[],choices=[]}={}){
 const selected=plan.branches.find(row=>row.branch===branch);
 if(!selected)throw Error('Unknown combat branch: '+branch);
 if(evidence.some(row=>plan.groups[row.group].branch!==branch))throw Error('Evidence must refer to the selected combat branch');
 const query=conditionStochasticTrajectory(result.trajectory,result.trace,{evidence,likelihoods:[selected.group],choices});
 const groups=plan.groups.flatMap((group,index)=>group.branch===branch&&group.channel!=='outcome'?[index]:[]),included=new Set(groups);
 const distributions=query.marginals({groups,weighted:false}),witness=query.witness();
 return {branch,label:selected.label,probability:query.probability,distribution:decodeEventTrace(plan,distributions),
  witness:witness?{semantics:'reachable-combat-trajectory',draws:witness.draws,assignmentProbability:witness.assignmentProbability,
   events:decodeEventTrace(plan,witness.trace.map((rows,index)=>included.has(index)?rows:[])).events,
  }:null,
 };
}
