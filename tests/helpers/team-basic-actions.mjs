import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture} from '../../beta-tools/interface-audit-7108.mjs';

export const basicActions={
 Skirk:[['normal.1',0,1],['normal.2',1,1],['normal.3',2,2],['normal.4',3,1],['normal.5',4,1],['charged',5,2],['plunge.collision',6,1],['plunge.low',7,1],['plunge',8,1]],
 Furina:[['normal.1',0,1],['normal.2',1,1],['normal.3',2,1],['normal.4',3,1],['charged',4,1],['plunge.collision',5,1],['plunge.low',6,1],['plunge',7,1]],
 Escoffier:[['normal.1',0,1],['normal.2',1,1],['normal.3',2,2],['charged',3,1],['plunge.collision',4,1],['plunge.low',5,1],['plunge',6,1]],
 Vodyanitsa:[['normal.1',0,1],['normal.2',1,1],['normal.3',2,1],['normal.4',3,1],['charged',4,1],['plunge.collision',5,1],['plunge.low',6,1],['plunge',7,1]],
 Mona:[['normal.1',0,1],['normal.2',1,1],['normal.3',2,1],['normal.4',3,1],['charged',4,1],['plunge.collision',5,1],['plunge.low',6,1],['plunge',7,1]],
};

export function basicActionInput(omit='Furina'){
 const input=effectInput(),names=Object.keys(basicActions).filter(name=>name!==omit);
 input.single_interfaces=names.map((name,role)=>{
  const profile=fixture(name);profile.artifacts=structuredClone(input.single_interfaces[role].artifacts);
  profile.artifacts.forEach(a=>a.set_name='GladiatorsFinale');profile.character.skill1=5;
  return profile;
 });
 input.team_dps.axis.members=names.map(character=>({slot:character,character}));input.team_dps.axis.initialActiveSlot=names[0];
 input.team_dps.initial_hp=[.5,.6,.7,.8];input.team_dps.initial_ids=input.single_interfaces.map(p=>p.artifacts.map(a=>a.id));
 input.team_dps.axis.timeline=names.flatMap(name=>basicActions[name].map(([id])=>action(name+'/'+id,name,id,0)));
 input.team_dps.axis.timeline.forEach((a,i)=>a.timeMs=500+i*500);
 // A phase transition with different attack/skill levels tests element and
 // talent selection, then a switch removes the form before the final plunge.
 if(names.includes('Skirk')){
  let time=input.team_dps.axis.timeline.at(-1).timeMs;
  for(const id of ['skill','plunge.collision','plunge.low','plunge','normal.3','normal.4','charged'])input.team_dps.axis.timeline.push(action('phase/'+id,'Skirk',id,time+=500));
  input.team_dps.axis.timeline.push({id:'exit',kind:'switch',actor:names.find(name=>name!=='Skirk'),timeMs:time+500},action('after/plunge','Skirk','plunge',time+1000));
 }
 return input;
}

export function basicActionTeams(input){
 const first=input.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);
 second.flat().forEach(a=>{a.id+=900000;a.sub_stats.push(['ATKPercentage',.17],['HPPercentage',.13],['CryoBonus',.11]);});
 return [first,second];
}
