import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';

export function monaRuntimeInput(name='clam-tail'){
 const x=effectInput(),mona=fixture('Mona');mona.artifacts=x.single_interfaces[3].artifacts;
 x.single_interfaces[3]=mona;x.team_dps.axis.members[3]={slot:'Mona',character:'Mona'};
 x.single_interfaces[2].artifacts.forEach(a=>a.set_name='OceanHuedClam');
 x.team_dps.axis.initialActiveSlot='Escoffier';
 x.team_dps.axis.timeline=[action('e-q','Escoffier','burst',0),action('m-q','Mona','burst',1000)];
 if(name==='clam-tail'||name==='clam-horn')x.team_dps.axis.timeline.push({id:'tail',kind:'switch',actor:'Mona',timeMs:6000});
 if(name==='clam-horn')mona.weapon=weapon('AshGravenDrinkingHorn');
 if(name==='c6-boundary'){
  mona.character.constellation=6;
  x.team_dps.axis.timeline.push(action('ca','Mona','charged',8100),{id:'tail',kind:'switch',actor:'Mona',timeMs:10000});
 }
 if(name==='spine'){
  x.single_interfaces[2].weapon=weapon('SkywardSpine');mona.weapon=weapon('AshGravenDrinkingHorn');
  x.team_dps.axis.timeline=[action('e-n','Escoffier','normal.1',0),action('m-q','Mona','burst',1),{id:'tail',kind:'switch',actor:'Mona',timeMs:1000}];
 }
 if(name==='atlas'){
  const vody=fixture('Vodyanitsa');vody.artifacts=x.single_interfaces[1].artifacts;vody.weapon=weapon('SkywardAtlas');
  x.single_interfaces[1]=vody;x.team_dps.axis.members[1]={slot:'Vodyanitsa',character:'Vodyanitsa'};
  x.team_dps.axis.initialActiveSlot='Vodyanitsa';mona.character.constellation=6;
  x.team_dps.axis.timeline=[action('v-n','Vodyanitsa','normal.1',0),action('q1','Mona','burst',100),action('q2','Mona','burst',3000),{id:'tail',kind:'switch',actor:'Mona',timeMs:4000}];
 }
 x.team_dps.initial_ids=x.single_interfaces.map(p=>p.artifacts.map(a=>a.id));
 return x;
}
export function runtimeTeams(input){
 const first=input.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);
 second.flat().forEach(a=>a.id+=900000);second[2].forEach(a=>a.set_name='GladiatorsFinale');
 second[3].forEach(a=>a.sub_stats.push(['HPPercentage',.2]));
 return [first,second];
}
