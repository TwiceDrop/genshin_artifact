import {effectInput,action} from './team-effect-refactor.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
export {characterTeams as equipmentFactsTeams} from './team-character-runtime.mjs';
export {equipmentFactsAxis} from './team-equipment-facts-axis.mjs';
export const equipmentFactCases=['Azurelight','MistsplitterReforged','FinaleOfTheDeepGalleries','KitainCrossSpear','leaf-generate','leaf-pickup'];
export function equipmentFactsInput(name){
 const x=effectInput();x.single_interfaces.forEach(p=>p.character.constellation=0);
 x.team_dps.axis.id='synthetic-equipment-facts-'+name;
 x.team_dps.axis.timeline=[action('f-e','Furina','skill',0),action('e-e','Escoffier','skill',500),action('n1','Furina','normal.1',1000),action('n2','Furina','normal.2',2000),{id:'end',kind:'switch',actor:'Furina',timeMs:4000}];
 if(['Azurelight','MistsplitterReforged'].includes(name))x.single_interfaces[1].weapon=weapon(name);
 if(name==='FinaleOfTheDeepGalleries')x.single_interfaces[1].artifacts.forEach(a=>a.set_name=name);
 if(name==='KitainCrossSpear')x.single_interfaces[2].weapon=weapon(name);
 if(name==='leaf-generate')x.single_interfaces[2].weapon=weapon('Moonpiercer');
 if(name==='leaf-pickup')x.single_interfaces[0].weapon=weapon('SapwoodBlade');
 if(name==='DaybreakChronicles'){
  x.single_interfaces[3].weapon=weapon(name);
  x.team_dps.axis.timeline=[action('e','Vodyanitsa','skill',0),action('n1','Vodyanitsa','normal.1',500),action('n2','Vodyanitsa','normal.1',550),action('n3','Vodyanitsa','normal.1',800),{id:'out',kind:'switch',actor:'Furina',timeMs:1200},{id:'in',kind:'switch',actor:'Vodyanitsa',timeMs:4500},action('n4','Vodyanitsa','normal.1',5100)];
 }
 x.team_dps.initial_ids=x.single_interfaces.map(p=>p.artifacts.map(a=>a.id));return x;
}
