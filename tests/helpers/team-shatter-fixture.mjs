import {freezeInput,freezeTeams,gatedFreezeEvaluator} from './team-freeze-fixture.mjs';
export {freezeTeams as shatterTeams,gatedFreezeEvaluator as gatedShatterEvaluator};
export function shatterInput(){
 const input=freezeInput();input.team_dps.axis.id='shatter-real-party';
 input.team_dps.axis.timeline=[...input.team_dps.axis.timeline.slice(0,2),{id:'collision',actor:'member4',kind:'action',action:'plunge.collision',timeMs:900},{id:'plunge',actor:'member4',kind:'action',action:'plunge',timeMs:1000},{id:'end',actor:'member4',kind:'switch',timeMs:1400}];
 return input;
}
