import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture} from '../../beta-tools/interface-audit-7108.mjs';

export function characterEventInput(name='furina-c6-events'){
 const x=effectInput();x.team_dps.initial_hp=[.4,.6,.8,.5];
 x.single_interfaces[1].character.constellation=6;x.single_interfaces[2].character.constellation=6;
 if(name==='mona-c6-events'){
  const p=fixture('Mona');p.artifacts=x.single_interfaces[3].artifacts;p.character.constellation=6;x.single_interfaces[3]=p;
  x.team_dps.axis.members[3]={slot:'Mona',character:'Mona'};x.team_dps.axis.initialActiveSlot='Mona';
  x.team_dps.axis.timeline=[action('q','Mona','burst',0),action('ca','Mona','charged',3100),action('f-q','Furina','burst',3500),action('f-e','Furina','skill',4000),action('e-e','Escoffier','skill',4500),action('f-n','Furina','normal.1',5000),action('s-e','Skirk','skill',5500),action('s-n','Skirk','normal.1',6000),action('q2','Mona','burst',8500),action('ca2','Mona','charged',11500)];
 }else{
  x.team_dps.axis.timeline=[action('f-q','Furina','burst',0),action('f-e','Furina','skill',0),action('e-e','Escoffier','skill',500),action('v-e','Vodyanitsa','skill',700),action('n1','Furina','normal.1',1000),action('ca','Furina','charged',2000),action('p','Furina','plunge',2500),action('ca2','Furina','charged',4000),action('n2','Furina','normal.2',4500),action('s-e','Skirk','skill',5000),action('s-n','Skirk','normal.1',6000),{id:'end',kind:'switch',actor:'Skirk',timeMs:9000}];
 }
 return x;
}
