import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture} from '../../beta-tools/interface-audit-7108.mjs';

export function escoffierSkillInput(mode='solo'){
 const x=effectInput();x.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon=fixture(p.character.name).weapon;p.artifacts.forEach(a=>a.set_name='GladiatorsFinale');});
 x.team_dps.axis.initialActiveSlot='Escoffier';x.team_dps.initial_hp=[.3,.4,.5,.6];
 x.team_dps.axis.timeline=[action('e','Escoffier','skill',0),{id:'tail',kind:'switch',actor:'Escoffier',timeMs:23000}];
 if(mode==='recast')x.team_dps.axis.timeline.splice(1,0,action('e2','Escoffier','skill',2500),action('e3','Escoffier','skill',10000));
 if(mode==='team'){
  x.single_interfaces[1].character.constellation=2;x.single_interfaces[2].character.constellation=6;x.single_interfaces[3].character.constellation=1;
  x.team_dps.axis.timeline=[action('e','Escoffier','skill',0),action('v-e','Vodyanitsa','skill',100),action('f-q','Furina','burst',200),action('f-e','Furina','skill',400),action('s-e','Skirk','skill',800),...Array.from({length:8},(_,i)=>action('n'+i,'Skirk','normal.1',1500+i*700)),{id:'tail',kind:'switch',actor:'Skirk',timeMs:9000}];
 }
 return x;
}

export function escoffierSkillTeams(input){
 const first=input.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);second.flat().forEach(a=>a.id+=900000);
 second[2].forEach(a=>a.sub_stats.push(['ATKPercentage',.17]));second[1].forEach(a=>a.sub_stats.push(['HPPercentage',.13]));second[3].forEach(a=>a.sub_stats.push(['HPPercentage',.11]));
 return [first,second];
}
