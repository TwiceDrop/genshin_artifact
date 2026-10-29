import {sample,gear} from '../../beta-tools/team-dps-full-audit.mjs';
export const action=(id,actor,action,timeMs)=>({id,actor,action,timeMs,kind:'action'});
export function effectInput(){
 const input=sample(),names=input.single_interfaces.map(p=>p.character.name);
 input.single_interfaces[2].character.constellation=2;
 input.single_interfaces[3].character.constellation=1;
 input.single_interfaces[3].artifacts=gear(3,'TenacityOfTheMillelith');
 input.team_dps.axis={format:'mona-action-axis',formatVersion:1,id:'effect-refactor-fixture',title:'合成效果轴',initialActiveSlot:'Vodyanitsa',endHit:'include',members:names.map(character=>({slot:character,character})),timeline:[
  action('v-e','Vodyanitsa','skill',0),action('e-e','Escoffier','skill',500),action('s-e','Skirk','skill',1000),
  action('n1','Skirk','normal.1',2000),action('n2','Skirk','normal.2',3000),action('end','Skirk','normal.1',4000),
 ]};
 Object.assign(input.team_dps,{damage_scope:'all',enemy_count:3,initial_ids:input.single_interfaces.map(p=>p.artifacts.map(a=>a.id))});
 return input;
}
