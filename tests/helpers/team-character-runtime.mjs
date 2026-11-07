import {characterEventInput} from './team-character-events.mjs';
import {action} from './team-effect-refactor.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export function candidateCharacterInput(name='furina-c6-events'){
 const x=characterEventInput(name);
 if(name==='furina-black')x.single_interfaces[1].weapon=weapon('TheBlackSword');
 if(name==='furina-gated'){
  x.single_interfaces[1].weapon=weapon('PrizedIsshinBlade');
  x.team_dps.axis.timeline=[action('e','Furina','skill',0),action('e2','Escoffier','skill',0),...Array.from({length:7},(_,i)=>action('p'+i,'Furina','plunge',1000+i*500)),{id:'end',kind:'switch',actor:'Furina',timeMs:6500}];
 }
 if(name==='skirk-pool'){
  x.team_dps.axis.timeline=[action('e','Skirk','skill',0),action('q','Skirk','burst',100),...Array.from({length:11},(_,i)=>action('n'+i,'Skirk','normal.1',500+i*200))];
 }
 x.team_dps.initial_ids=x.single_interfaces.map(p=>p.artifacts.map(a=>a.id));return x;
}
export function characterTeams(input){
 const first=input.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);
 second.flat().forEach(a=>a.id+=900000);second[3].forEach(a=>a.set_name='GladiatorsFinale');
 second[1].forEach(a=>a.sub_stats.push(['HPPercentage',.2]));return [first,second];
}
export const gatedCharacterAxis=gate=>(...args)=>{
 const rotation=compileActionAxis(...args);
 const first=rotation.events.find(e=>e.eventId==='p0/plunge'||e.eventId==='n0/normal.1');
 if(!first)throw Error('Missing synthetic gated contact');first.enabled=gate;return rotation;
};
