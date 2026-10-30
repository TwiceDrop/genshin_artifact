import {effectInput,action} from './team-effect-refactor.mjs';
import {snapshotReviewInput} from './team-review-fixes.mjs';
export {installTargetSnapshot,targetSnapshotEvaluator} from './team-target-snapshot-definition.mjs';

export function targetSnapshotInput(mode='critical'){
 if(mode==='snapshot')return snapshotReviewInput();
 const x=effectInput();x.team_dps.initial_hp=[1,1,1,1];
 x.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon={...p.weapon,name:['Skirk','Furina'].includes(p.character.name)?'DullBlade':p.character.name==='Escoffier'?'BeginnersProtector':'ApprenticesNotes'};});
 x.team_dps.axis.timeline=[action('e','Escoffier','skill',0),action('target-1','Vodyanitsa','normal.1',1000),action('target-2','Vodyanitsa','normal.1',2000),{id:'end',kind:'switch',actor:'Vodyanitsa',timeMs:2500}];
 return x;
}
export function targetSnapshotTeams(x){
 const first=x.single_interfaces.map(p=>structuredClone(p.artifacts)),second=structuredClone(first);
 first[3].forEach(a=>a.set_name='GladiatorsFinale');
 second.flat().forEach(a=>{a.id+=800000;a.sub_stats.push(['HPPercentage',.1],['ATKPercentage',.12]);});
 second[3].forEach(a=>a.set_name='TenacityOfTheMillelith');
 return [first,second];
}
