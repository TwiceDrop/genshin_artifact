import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';

export const monaAction=(id,role,action,time,params)=>({id,actor:'member'+(role+1),kind:'action',action,timeMs:time*1000,...(params?{params}:{})});
export function monaCoreInput(rows){
 const names=['Mona','Escoffier','YaeMiko','Furina'],profiles=names.map((name,r)=>{
  const p=fixture(name);p.character.constellation=r===0?6:0;p.weapon=weapon(r===0||r===2?'ApprenticesNotes':r===1?'BeginnersProtector':'DullBlade');
  p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;
 });
 const axis=createActionAxis('mona-core-test',names);axis.timeline=rows??[
  monaAction('q',0,'burst',0),monaAction('ice',1,'burst',.1),monaAction('early',1,'normal.1',2),{id:'back',actor:'member1',kind:'switch',timeMs:2200},
  monaAction('late',0,'charged',7.5),monaAction('again',0,'charged',7.6),{id:'end',actor:'member1',kind:'switch',timeMs:8000},
 ];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[1,1,1,1],initial_ids:profiles.map(p=>p.artifacts.map(a=>a.id))}};
}
export function monaCoreTeams(input){
 const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.flat().forEach(a=>a.id+=10000);b[0][0].sub_stats=[['ATKFixed',400],['Recharge',.3]];return [a,b,a];
}
// Restrict the Cryo hit to one enemy; it is an explicit hit-target fact, not a
// character exception. Both targets still receive the same Mona application.
export function monaCoreAxis(...args){
 const plan=compileActionAxis(...args);for(const e of plan.events)if(e.eventId.startsWith('ice/'))e.targetIds=[0];return plan;
}
export const monaCoreEvaluator=(api,input,execution={})=>createTeamDpsEvaluator(api,input,{...execution,compileRotation:monaCoreAxis});
