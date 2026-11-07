import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
export function alyoshaInput(cons=6){
 const names=['Alyosha','Mona','Furina','Escoffier'],profiles=names.map((name,r)=>{
  const p=fixture(name);p.artifacts=p.artifacts.map((a,i)=>({...a,id:100*r+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;
 });profiles[0].character.constellation=cons;profiles[0].weapon=weapon('FavoniusLance');
 const axis=createActionAxis('alyosha-runtime-test',names);
 axis.timeline=[['e1',0,'skill',0],['fanfare',2,'burst',50],['e2',0,'skill',500],['one',0,'normal.1',950],['q',0,'burst',1000],['two',0,'normal.1',3200],['other',1,'normal.1',3300]].map(([id,r,action,timeMs])=>({id,actor:'member'+(r+1),kind:'action',action,timeMs}));
 axis.timeline.push({id:'end',actor:'member2',kind:'switch',timeMs:10000});
 return {single_interfaces:profiles,team_dps:{axis,initial_hp:[.3,.4,.2,.16],enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'all'}};
}
export function alyoshaTeams(input){
 const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);
 b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[0][0].sub_stats=[['ATKFixed',400],['ElementalMastery',500],['Recharge',.4]];b[3][0].sub_stats=[['HPFixed',30000]];
 return [a,b,a];
}
