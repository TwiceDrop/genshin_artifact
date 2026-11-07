import {effectInput,action} from './team-effect-refactor.mjs';
export {testModelId,testEffect,testDamageModel,installTestDamageModel,modelEvaluator} from './team-effect-model-definition.mjs';

export function modelInput(){
 const input=effectInput();input.team_dps.initial_hp=[1,1,1,1];
 input.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon={...p.weapon,name:['Skirk','Furina'].includes(p.character.name)?'DullBlade':p.character.name==='Escoffier'?'BeginnersProtector':'ApprenticesNotes'};});
 input.team_dps.axis.timeline=[action('e','Escoffier','skill',0),action('model-1','Vodyanitsa','normal.1',1000),action('model-2','Vodyanitsa','normal.1',2000),{id:'end',kind:'switch',actor:'Vodyanitsa',timeMs:2500}];
 return input;
}

export function modelTeams(input){
 const first=input.single_interfaces.map(p=>structuredClone(p.artifacts)),second=structuredClone(first);
 first[3].forEach(a=>{a.set_name='GladiatorsFinale';});
 second.forEach(build=>build.forEach(a=>{a.id+=700000;a.sub_stats.push(['HPPercentage',.12],['ATKPercentage',.05]);}));
 second[3].forEach(a=>{a.set_name='TenacityOfTheMillelith';});
 return [first,second];
}
