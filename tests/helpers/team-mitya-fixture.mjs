import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
export const action=(id,role,name,time,params)=>({id,kind:'action',actor:'member'+(role+1),action:name,timeMs:time*1000,...(params?{params}:{})});
export const end=time=>({id:'end',kind:'switch',actor:'member1',timeMs:time*1000});
export function mityaInput(names=['Mitya','Valeriy','Odette','YaeMiko'],rows){
 const profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=0;p.buffs=[];p.weapon=weapon(['Mitya','Sucrose','YaeMiko'].includes(name)?'ApprenticesNotes':name==='Sandrone'?'WasterGreatsword':'DullBlade');p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 const axis=createActionAxis('mitya-team-test',names);axis.timeline=rows??[action('e',0,'skill.hold',0),action('q',0,'burst',.6),action('ca',0,'charged',3),end(6.5)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'all'}};
}
