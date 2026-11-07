import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
export const action=(id,role,name,time,params)=>({id,kind:'action',actor:'member'+(role+1),action:name,timeMs:time*1000,...(params?{params}:{})});
export const end=time=>({id:'end',kind:'switch',actor:'member4',timeMs:time*1000});
export function originalCryoInput(stellar=false,rows){
 const names=['Skirk','Escoffier','YaeMiko',stellar?'Odette':'Mona'];
 const profiles=names.map((name,role)=>{
  const p=fixture(name);p.character.constellation=0;p.weapon=weapon(characterPackages[name].previewWeapon);
  p.artifacts=p.artifacts.map((a,i)=>({...a,id:role*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;
 });
 const axis=createActionAxis('original-cryo-applications',names);
 axis.timeline=rows??[action('ye',2,'skill',0),action('ee',1,'skill',.5),action('eq',1,'burst',1),action('se',0,'skill',2),action('sn3',0,'normal.3',2.1),action('sca',0,'charged',2.4),action('sn1',0,'normal.1',2.8),action('sn5',0,'normal.5',3.2),action('sn2',0,'normal.2',5.2),end(8)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[1,1,1,1]}};
}
export function originalCryoTeams(input){
 const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);
 b.forEach(build=>build.forEach(a=>{a.id+=10000;}));b[0][0].sub_stats=[['ElementalMastery',500]];b[1][0].sub_stats=[['ATKFixed',400]];b[2][0].sub_stats=[['ElementalMastery',500]];return [a,b,a];
}
