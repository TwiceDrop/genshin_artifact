import {effectInput,action} from './team-effect-refactor.mjs';
import {stackInput} from './team-effect-stacks.mjs';
export function recipeInput(name='ordinary'){
 if(name==='random')return stackInput('random');
 const x=effectInput();x.single_interfaces.forEach(p=>p.character.constellation=0);x.team_dps.initial_hp=[.6,.5,.4,.3];
 x.team_dps.axis.initialActiveSlot='Vodyanitsa';
 if(name==='constellation'){
  x.single_interfaces[2].character.constellation=6;x.single_interfaces[3].character.constellation=2;
  x.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('e-e','Escoffier','skill',500),...Array.from({length:7},(_,i)=>action('n'+i,'Escoffier','normal.1',1000+i*500)),action('v-q','Vodyanitsa','burst',20000),{id:'tail',kind:'switch',actor:'Vodyanitsa',timeMs:26000}];
 }else{
  x.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('e-e','Escoffier','skill',500),action('e-q','Escoffier','burst',1000),action('v-q','Vodyanitsa','burst',1500),action('e-ca','Escoffier','charged',2000),action('v-n','Vodyanitsa','normal.1',2500),action('e-p','Escoffier','plunge',3000),action('v-ca','Vodyanitsa','charged',3500),action('v-p','Vodyanitsa','plunge',4000),action('e-e2','Escoffier','skill',4500),action('e-q2','Escoffier','burst',5000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:8000}];
 }
 return x;
}
