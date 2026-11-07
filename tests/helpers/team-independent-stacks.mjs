import {effectInput,action} from './team-effect-refactor.mjs';
export function independentStackInput(){
 const x=effectInput();x.single_interfaces.forEach(p=>p.character.constellation=0);
 x.team_dps.initial_hp=[1,1,1,1];
 x.single_interfaces[2].artifacts.forEach(a=>a.set_name='LongNightsOath');
 x.team_dps.axis.initialActiveSlot='Escoffier';
 x.team_dps.axis.timeline=[action('e','Escoffier','skill',0),action('c','Escoffier','charged',500),action('p1','Escoffier','plunge',1000),action('p2','Escoffier','plunge',1500),action('p3','Escoffier','plunge',3000),{id:'out',kind:'switch',actor:'Skirk',timeMs:4000},action('p4','Escoffier','plunge',6500),action('p5','Escoffier','plunge',8000),{id:'tail',kind:'switch',actor:'Escoffier',timeMs:9000}];
 return x;
}
