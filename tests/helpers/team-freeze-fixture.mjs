import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export function freezeInput(){
 const names=['Furina','Escoffier','Qiqi','Skirk'],axis=createActionAxis('freeze-real-party',names);
 const profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=r===2?2:0;p.weapon=weapon(characterPackages[name].previewWeapon);p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 axis.timeline=[{id:'fe',actor:'member1',kind:'action',action:'skill',timeMs:0},{id:'ee',actor:'member2',kind:'action',action:'skill',timeMs:200},{id:'qn',actor:'member3',kind:'action',action:'normal.1',timeMs:1000},{id:'se',actor:'member4',kind:'action',action:'skill',timeMs:3500},{id:'sn',actor:'member4',kind:'action',action:'normal.3',timeMs:4000},{id:'end',actor:'member4',kind:'switch',timeMs:8000}];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[1,1,1,1],frozen:true}};
}
export function freezeTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[0].forEach(a=>{a.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(a=>{a.id+=10000;}));b[0][0].sub_stats=[['HPFixed',10000]];b[1][0].sub_stats=[['ATKFixed',400]];return [a,b,a];}
export function gatedFreezeEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{const plan=compileActionAxis(...args);for(const e of plan.events)if(e.role===0&&e.index===9)e.enabled=execution.setCount?execution.math.ge(execution.setCount(0,'GladiatorsFinale'),4):input.testFirstBubble??1;return plan;}});}
