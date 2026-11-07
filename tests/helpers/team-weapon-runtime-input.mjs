import {effectInput,action} from './team-effect-refactor.mjs';
import {monaRuntimeInput} from './team-runtime-mona.mjs';
import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
export const weaponRuntimeCases=['Halberd','spine-posterior','TheFlute','SkywardAtlas','EyeOfPerception','EchoesOfAnOffering','runtime-horn','furina-variants'];
export function weaponRuntimeInput(name){
 if(name==='runtime-horn'){
  const x=monaRuntimeInput('clam-tail');x.single_interfaces[3].weapon=weapon('AshGravenDrinkingHorn');return x;
 }
 const x=effectInput();
 for(const p of x.single_interfaces){p.character.constellation=0;for(const a of p.artifacts)a.set_name='GladiatorsFinale';}
 x.single_interfaces[3].artifacts.forEach(a=>a.set_name='TenacityOfTheMillelith');
 let role=name==='Halberd'||name==='spine-posterior'?2:name==='SkywardAtlas'||name==='EyeOfPerception'?3:name==='EchoesOfAnOffering'?0:1;
 const owner=x.single_interfaces[role];
 if(name==='EchoesOfAnOffering')owner.artifacts.forEach(a=>a.set_name='EchoesOfAnOffering');
 else owner.weapon=weapon(name==='spine-posterior'?'SkywardSpine':name==='furina-variants'?'SwordOfDescension':name);
 x.team_dps.axis.initialActiveSlot=owner.character.name;
 x.team_dps.axis.timeline=[0,100,500,1000,1500,2000,2500,3000,3500,16000].map((time,i)=>action('n'+i,owner.character.name,'normal.1',time));
 x.team_dps.axis.timeline.push({id:'tail',kind:'switch',actor:owner.character.name,timeMs:17000});
 if(name==='spine-posterior'){
  const mona=fixture('Mona');mona.character.constellation=0;mona.artifacts=x.single_interfaces[3].artifacts;x.single_interfaces[3]=mona;x.team_dps.axis.members[3]={slot:'Mona',character:'Mona'};
  x.team_dps.axis.timeline=[action('n0','Escoffier','normal.1',0),action('n1','Escoffier','normal.1',1000),action('q','Mona','burst',1001),{id:'tail',kind:'switch',actor:'Mona',timeMs:1200}];
 }
 if(name==='furina-variants'){
  owner.character.constellation=6;x.team_dps.axis.timeline=[action('e','Furina','skill',0),...Array.from({length:7},(_,i)=>action('n'+i,'Furina','normal.1',500+i*200)),{id:'tail',kind:'switch',actor:'Furina',timeMs:2000}];
 }
 x.team_dps.initial_ids=x.single_interfaces.map(p=>p.artifacts.map(a=>a.id));return x;
}
export function weaponRuntimeTeams(input){
 const first=input.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);
 second.flat().forEach(a=>a.id+=900000);second[3].forEach(a=>a.set_name='GladiatorsFinale');second[0].forEach(a=>a.sub_stats.push(['ATKPercentage',.1]));
 return [first,second];
}
