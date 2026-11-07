import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';

// Three small teams cover the registered roster; mechanism suites own the
// longer rotations. These cases exercise the shipped page/Worker contracts.
export function productAcceptanceCases(){
 return [['Skirk','Furina','Escoffier','Vodyanitsa'],['Sandrone','Odette','Alyosha','Qiqi'],['Mona','YaeMiko','Qiqi','Skirk']].map((names,index)=>{
  const profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=0;p.weapon=weapon(characterPackages[name].previewWeapon);p.artifacts=p.artifacts.map((a,i)=>({...a,id:index*100+r*5+i+1,set_name:'GladiatorsFinale',main_stat:['HPFixed',100+i],sub_stats:[['ATKFixed',10+r*5+i]]}));p.buffs=[];p.constraint=null;p.filter={};return p;});
  const axis=createActionAxis('product-acceptance-'+index,names);axis.title='验收合成队伍 '+(index+1);
  axis.timeline=names.map((_,r)=>({id:'n'+r,kind:'action',actor:'member'+(r+1),action:'normal.1',timeMs:r*200}));
  axis.timeline.push({id:'end',kind:'switch',actor:'member4',timeMs:1000});
  return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'all',initial_hp:[1,1,1,1],initial_ids:profiles.map(p=>p.artifacts.map(a=>a.id)),max_evaluations:4,result_count:3,search_algorithm:'auto',objective:'damage',metric:'expectation'}};
 });
}
