import {scalarMath} from '../../beta-data/team-dps-numeric-rules.mjs';
import {TEAM_STAT_FIELDS} from '../../beta-data/team-engine/stat-contract.mjs';

// Synthetic completion contract: a four-piece candidate completes at 5s with
// 90 expected damage; the other completes at 10s with 100. This deliberately
// makes damage and DPS select different teams without inventing a game rule.
export function durationEvaluator(_api,input,execution={}){
 const m=execution.math||scalarMath,profiles=input.single_interfaces;
 const panel=()=>Object.fromEntries(TEAM_STAT_FIELDS.map(stat=>[stat,{synthetic:0}]));
 return {profiles,constraints:panel,evaluate(builds){
  const count=execution.setCount?execution.setCount(0,'OceanHuedClam'):builds[0].filter(a=>a.set_name==='OceanHuedClam').length;
  const short=m.ge(count,4),duration=m.choose(short,5,10),expectation=m.choose(short,90,100),critical=m.choose(short,100,160),non_critical=m.choose(short,30,80);
  const damage={expectation,critical,non_critical};
  return {...damage,total_damage:expectation,duration,dps:m.div(expectation,duration),fanfare:0,furina_overflow:0,profiles,panels:profiles.map(panel),character_damage:profiles.map((_,role)=>role===0?damage:{expectation:0,critical:0,non_critical:0})};
 }};
}

export function durationInput(){
 const slots=['Flower','Feather','Sand','Goblet','Head'];
 const mains=[['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],['CryoBonus','HydroBonus','ATKPercentage','HPPercentage'],['CriticalRate','CriticalDamage','HealingBonus','HPPercentage']];
 const single_interfaces=['Skirk','Furina','Escoffier','Mona'].map((name,role)=>({character:{name},constraint:{},filter:Object.fromEntries(['sand_main_stat','goblet_main_stat','head_main_stat'].map((key,i)=>[key,[mains[i][role]]])),artifacts:slots.map((slot,i)=>({id:role*5+i+1,slot,set_name:role===0?'OceanHuedClam':'GladiatorsFinale',star:5,level:20,main_stat:i<2?[i===0?'HPFixed':'ATKFixed',10]:[mains[i-2][role],.2],sub_stats:[]}))}));
 return {single_interfaces,team_dps:{initial_ids:single_interfaces.map(p=>p.artifacts.map(a=>a.id)),metric:'expectation',objective:'damage',result_count:5,max_evaluations:65536}};
}
