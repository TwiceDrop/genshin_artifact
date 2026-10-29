import {effectInput,action} from './team-effect-refactor.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
export function equipmentRuntimeInput(name='equipment-clam-all'){
 const x=effectInput();x.single_interfaces[2].artifacts.forEach(a=>a.set_name=name.includes('clam')?'OceanHuedClam':'SongOfDaysPast');
 x.single_interfaces[0].weapon=weapon('SkywardBlade');x.single_interfaces[3].weapon=weapon('EyeOfPerception');
 x.team_dps.damage_scope=name.endsWith('single')?'single':'all';x.team_dps.initial_hp=[.4,.5,.6,.7];
 x.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('e-q','Escoffier','burst',500),action('f-q','Furina','burst',1000),action('e-e','Escoffier','skill',1500),action('v-n','Vodyanitsa','normal.1',2000),action('s-e','Skirk','skill',3000),action('s-q','Skirk','burst',3500),...Array.from({length:11},(_,i)=>action('n'+i,'Skirk','normal.1',4000+i*1000))];
 return x;
}
