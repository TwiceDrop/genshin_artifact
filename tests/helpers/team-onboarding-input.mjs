import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture} from '../../beta-tools/interface-audit-7108.mjs';
export function onboardingInput(){
 const x=effectInput();x.single_interfaces.forEach(p=>p.character.constellation=0);const profile=fixture('Kaeya');profile.artifacts=x.single_interfaces[3].artifacts;x.single_interfaces[3]=profile;
 x.team_dps.axis.members[3]={slot:'kaeya-slot',character:'Kaeya'};x.team_dps.axis.initialActiveSlot='kaeya-slot';x.team_dps.initial_hp=[.5,.5,.5,.5];
 x.team_dps.axis.timeline=[action('e','kaeya-slot','skill',0),action('q','kaeya-slot','burst',1000),action('s-e','Skirk','skill',2500),action('n','Skirk','normal.1',3000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:4000}];
 x.team_dps.enemy_count=2;x.team_dps.damage_scope='all';return x;
}
export function reactionInput(mode='regular'){
 const x=effectInput();x.team_dps.initial_hp=[1,1,1,1];x.team_dps.axis.initialActiveSlot='Vodyanitsa';
 x.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon={...p.weapon,name:['Skirk','Furina'].includes(p.character.name)?'DullBlade':p.character.name==='Escoffier'?'BeginnersProtector':'ApprenticesNotes'};});
 if(mode==='proc')x.single_interfaces[3].weapon={...x.single_interfaces[3].weapon,name:'SkywardAtlas'};
 x.team_dps.axis.timeline=[action('seed','Vodyanitsa','normal.1',1000),{id:'tail',kind:'switch',actor:'Vodyanitsa',timeMs:mode==='proc'?4000:1500}];return x;
}
export function reactionTeams(x){const first=x.single_interfaces.map(p=>structuredClone(p.artifacts));first[3].forEach(a=>a.set_name='GladiatorsFinale');const second=structuredClone(first);second.flat().forEach(a=>{a.id+=600000;a.sub_stats.push(['HPPercentage',.1]);});second[3].forEach(a=>a.set_name='TenacityOfTheMillelith');return [first,second];}
