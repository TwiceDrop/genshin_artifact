import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {yaeInput} from './team-yae-fixture.mjs';
export const sandroneAction=(id,role,action,time)=>({id,kind:'action',actor:'member'+(role+1),action,timeMs:time*1000});
export const sandroneEnd=time=>({id:'end',kind:'switch',actor:'member4',timeMs:time*1000});
export function sandroneInput(cons=6,rows){
 const names=['Sandrone','Odette','Alyosha','Qiqi'],axis=createActionAxis('sandrone-runtime-test',names),profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=r===0?cons:0;p.weapon=weapon(characterPackages[name].previewWeapon);p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 axis.timeline=rows??[sandroneAction('seed',2,'skill',0),sandroneAction('oe',1,'skill',.5),sandroneAction('ca',0,'charged',1),sandroneAction('e',0,'skill',5),sandroneAction('q',0,'burst',5.7),sandroneAction('qe',3,'skill',6),sandroneEnd(9)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'all',initial_hp:[.2,.3,.4,.5]}};
}
export function sandroneTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[3].forEach(item=>{item.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[0][0].sub_stats=[['ATKFixed',2500],['ElementalMastery',500],['CriticalDamage',.4]];return [a,b,a];}
export function terminalSandroneInput(){const input=sandroneInput(0,[sandroneAction('ye',1,'skill',0),sandroneAction('ca',0,'charged',1.3)]);input.single_interfaces[1]=yaeInput(0).single_interfaces[0];input.single_interfaces[1].artifacts.forEach((a,i)=>{a.id=100+i+1;});input.team_dps.axis.members[1].character='YaeMiko';return input;}
export function gatedSandroneEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{const plan=compileActionAxis(...args);for(const e of plan.events)if(e.eventId==='seed/skill')e.enabled=execution.setCount?execution.math.ge(execution.setCount(3,'GladiatorsFinale'),4):input.testSeedEnabled??1;return plan;}});}
