import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export const vodyAction=(id,r,action,timeMs)=>({id,actor:'member'+(r+1),kind:'action',action,timeMs});
export function vodyInput(){
 const names=['Vodyanitsa','YaeMiko','Escoffier','Furina'],axis=createActionAxis('vody-real-party',names);
 const profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=r===0?6:0;p.weapon=weapon(characterPackages[name].previewWeapon);p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 axis.timeline=[vodyAction('ve',0,'skill',0),vodyAction('fq',3,'burst',100),vodyAction('en',2,'normal.1',1000),vodyAction('yn',1,'normal.1',2000),vodyAction('eq',2,'burst',3200),vodyAction('vn',0,'normal.1',4000),vodyAction('en2',2,'normal.1',6500),vodyAction('vq',0,'burst',8200),{id:'end',actor:'member1',kind:'switch',timeMs:9000}];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[.2,.3,.25,.15],frozen:true}};
}
export function vodyTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[0].forEach(a=>{a.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(a=>{a.id+=10000;}));b[0][0].sub_stats=[['HPFixed',30000]];b[1][0].sub_stats=[['ElementalMastery',400]];return [a,b,a];}
export function gatedVodyEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
 const plan=compileActionAxis(...args),role=input.single_interfaces.findIndex(p=>p.character.name==='Vodyanitsa');
 for(const e of plan.events)if(e.role===role&&[8,9].includes(e.index)){
  e.targetIds=e.index===8?[0]:[1];
  if(e.index===9)e.enabled=execution.setCount?execution.math.ge(execution.setCount(role,'GladiatorsFinale'),4):input.testHorns??1;
 }
 return plan;
}});}
