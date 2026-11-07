import {odetteInput,odetteAction as a,odetteTeams} from './team-odette-fixture.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export function followupInput(endHit='include'){const input=odetteInput(4,[a('seed',1,'skill',0),a('e',0,'skill',.5),a('q',2,'burst',1)]);input.team_dps.axis.endHit=endHit;return input;}
export const followupTeams=odetteTeams;
export function gatedFollowupEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{const plan=compileActionAxis(...args);for(const e of plan.events)if(e.eventId==='seed/skill')e.enabled=execution.setCount?execution.math.ge(execution.setCount(2,'GladiatorsFinale'),4):input.testSeedEnabled??1;return plan;}});}
