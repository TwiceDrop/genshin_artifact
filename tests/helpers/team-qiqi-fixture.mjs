import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
export const qiqiAction=(id,role,action,time)=>({id,kind:'action',actor:'member'+(role+1),action,timeMs:time*1000});
export const qiqiEnd=time=>({id:'end',kind:'switch',actor:'member4',timeMs:time*1000});
export function qiqiInput(cons=6,rows){
 const names=['Qiqi','YaeMiko','Furina','Alyosha'],axis=createActionAxis('qiqi-runtime-test',names),profiles=names.map((name,r)=>{
  const p=fixture(name);p.artifacts=p.artifacts.map((a,i)=>({...a,id:100*r+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));
  p.weapon=weapon(characterPackages[name].previewWeapon);p.character.constellation=r===0?cons:0;return p;
 });
 axis.timeline=rows??[qiqiAction('e',0,'skill',0),qiqiAction('y1',1,'skill',1),qiqiAction('y2',1,'skill',2),qiqiAction('y3',1,'skill',3),qiqiAction('a',3,'skill',4),qiqiAction('q',0,'burst',5),qiqiAction('yn',1,'normal.1',6),qiqiAction('yn2',1,'normal.1',7),qiqiEnd(10)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[.1,.2,.3,.4]}};
}
export function qiqiTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[0][0].sub_stats=[['ATKFixed',400],['HealingBonus',.3]];return [a,b,a];}
// The remaining stellar enabler is not registered yet. Only the enabling
// capability is substituted; all Cryo/Electro applications are real pack hits.
export function enableQiqiFixtureStellar(){const old=characterPackages.Qiqi.enablesStellarConduct;characterPackages.Qiqi.enablesStellarConduct=true;return ()=>{if(old===undefined)delete characterPackages.Qiqi.enablesStellarConduct;else characterPackages.Qiqi.enablesStellarConduct=old;};}
