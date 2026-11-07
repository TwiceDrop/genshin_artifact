import {originalCryoInput,action,end} from './team-original-cryo-fixture.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
export function reactionEquipmentInput(){
 const input=originalCryoInput(true,[action('yn',2,'normal.1',0),action('se',0,'skill',.5),action('sn1',0,'normal.1',.6),action('sn2',0,'normal.2',1),action('eq',1,'burst',2),action('yn2',2,'normal.1',2.2),action('sn3',0,'normal.3',3),end(5)]);
 input.single_interfaces[0].weapon=weapon('DarkIronSword');
 for(const role of [0,1])input.single_interfaces[role].artifacts.forEach(a=>a.set_name='ScrollOfTheHeroOfCinderCity');
 return input;
}
export function reactionEquipmentTeams(input){
 const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);
 b.forEach(build=>build.forEach(a=>a.id+=10000));
 for(const role of [0,1])b[role].slice(2).forEach(a=>a.set_name='Empty');
 b[0][0].sub_stats=[['ATKFixed',200]];return [a,b,a];
}
