import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
function clean(){const x=effectInput();x.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon=fixture(p.character.name).weapon;});x.team_dps.damage_scope='single';x.team_dps.enemy_count=1;return x;}
export function snapshotReviewInput(timeMs=9000){
 const x=clean(),p=fixture('Mona');p.artifacts=x.single_interfaces[3].artifacts;p.weapon=weapon('TheWidsith');x.single_interfaces[3]=p;x.team_dps.widsith_mode={3:'t1_rate'};
 x.team_dps.axis.members[3]={slot:'Mona',character:'Mona'};x.team_dps.axis.initialActiveSlot='Skirk';
 x.team_dps.axis.timeline=[{id:'enter',kind:'switch',actor:'Mona',timeMs:0},action('e','Mona','skill',timeMs),{id:'tail',kind:'switch',actor:'Mona',timeMs:16000}];
 x.team_dps.initial_ids=x.single_interfaces.map(p=>p.artifacts.map(a=>a.id));return x;
}
export function royalReviewInput(long=false){
 const x=clean();x.single_interfaces.forEach(p=>p.artifacts=[]);x.team_dps.initial_ids=[[],[],[],[]];x.team_dps.initial_hp=[.1,.1,.1,.1];
 x.single_interfaces[2].character.constellation=4;x.single_interfaces[2].weapon=weapon('RoyalSpear');
 x.team_dps.axis.initialActiveSlot='Escoffier';x.team_dps.axis.timeline=[action('q','Escoffier','burst',0),action('n','Escoffier','normal.1',1001)];
 if(long){Object.assign(x.single_interfaces[1].character,{level:1,ascend:false,skill1:0,skill2:0,skill3:0});x.team_dps.axis.timeline=[action('f-q','Furina','burst',0),action('q','Escoffier','burst',0),{id:'front',kind:'switch',actor:'Skirk',timeMs:100},{id:'tail',kind:'switch',actor:'Skirk',timeMs:8050}];}
 return x;
}
export function procReviewInput(){
 const x=clean();x.single_interfaces.forEach(p=>p.artifacts=[]);x.team_dps.initial_ids=[[],[],[],[]];x.single_interfaces[2].weapon=weapon('SkywardSpine');x.team_dps.axis.initialActiveSlot='Escoffier';
 x.team_dps.axis.timeline=[action('n','Escoffier','normal.1',0),{id:'tail',kind:'switch',actor:'Escoffier',timeMs:1000}];return x;
}
