import {effectInput,action} from './team-effect-refactor.mjs';
export function stackInput(kind='deterministic'){
 const x=effectInput();x.single_interfaces.forEach(p=>p.character.constellation=0);
 x.single_interfaces[kind==='random'?2:0].artifacts.forEach(a=>a.set_name='MarechausseeHunter');
 x.team_dps.initial_hp=[.5,.5,.5,.5];
 x.team_dps.axis.initialActiveSlot='Furina';
 x.team_dps.axis.timeline=[action('f-q','Furina','burst',0),action('f-e','Furina','skill',100),action('s-e','Skirk','skill',200),action('n1','Skirk','normal.1',1200),action('n2','Skirk','normal.2',2400),action('e-q','Escoffier','burst',2600),action('n3','Skirk','normal.3',3800),action('n4','Skirk','normal.4',5100),{id:'tail',kind:'switch',actor:'Skirk',timeMs:6500}];
 if(kind==='random'){
  x.single_interfaces[2].character.constellation=4;
  x.team_dps.axis.timeline=[action('f-q','Furina','burst',0),action('f-e','Furina','skill',100),action('e-q','Escoffier','burst',200),{id:'tail',kind:'switch',actor:'Escoffier',timeMs:2600}];
 }
 return x;
}
