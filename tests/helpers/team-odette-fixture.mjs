import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export const odetteAction=(id,role,action,time)=>({id,kind:'action',actor:'member'+(role+1),action,timeMs:time*1000});
export const odetteEnd=time=>({id:'end',kind:'switch',actor:'member4',timeMs:time*1000});
export function odetteInput(cons=6,rows){
 const names=['Odette','Alyosha','Qiqi','YaeMiko'],axis=createActionAxis('odette-runtime-test',names),profiles=names.map((name,r)=>{
  const p=fixture(name);p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));p.weapon=weapon(characterPackages[name].previewWeapon);p.character.constellation=r===0?cons:6;return p;
 });
 axis.timeline=rows??[odetteAction('a',1,'skill',0),odetteAction('conditional-e',0,'skill',.5),odetteAction('e2',0,'skill',1.2),odetteAction('qe',2,'skill',2.5),odetteAction('qq',2,'burst',3.2),odetteAction('y1',3,'skill',4),odetteAction('y2',3,'skill',4.7),odetteAction('y3',3,'skill',5.4),odetteAction('oq',0,'burst',6),odetteAction('oe',0,'skill',8),odetteEnd(10)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[.2,.3,.4,.5]}};
}
export function odetteTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[2].forEach(item=>{item.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[0][0].sub_stats=[['ATKFixed',2500],['ElementalMastery',500]];return [a,b,a];}
export function gatedOdetteEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{const plan=compileActionAxis(...args);for(const e of plan.roots)if(e.id==='conditional-e')e.enabled=execution.setCount?execution.math.ge(execution.setCount(2,'GladiatorsFinale'),4):input.testFirstEnabled??1;return plan;}});}
