import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export const yaeAction=(id,role,action,time)=>({id,kind:'action',actor:'member'+(role+1),action,timeMs:time*1000});
export const yaeEnd=time=>({id:'end',kind:'switch',actor:'member4',timeMs:time*1000});
export function yaeInput(cons=6,rows){
 const names=['YaeMiko','Alyosha','Furina','Mona'],axis=createActionAxis('yae-runtime-test',names),profiles=names.map((name,r)=>{
  const p=fixture(name);p.artifacts=p.artifacts.map((a,i)=>({...a,id:100*r+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;
 });profiles[0].character.constellation=cons;profiles[0].weapon=weapon('KagurasVerity');
 axis.timeline=rows??[yaeAction('e1',0,'skill',0),yaeAction('e2',0,'skill',.95),yaeAction('e3',0,'skill',1.9),yaeAction('primer1',3,'normal.1',2.1),yaeAction('primer2',3,'normal.1',4.1),yaeAction('e4',0,'skill',6),yaeAction('q',0,'burst',8),yaeEnd(12)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'all'}};
}
export function yaeTeams(input){
 const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[3].forEach(item=>{item.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[0][0].sub_stats=[['ElementalMastery',500],['ATKFixed',300],['CriticalDamage',.4]];return [a,b,a];
}
// Controlled Cryo applications test Yae's real reaction consumer without
// claiming that Mona is Cryo or that the remaining character packs are ready.
export function installYaePrimer(stellar=true){
 const owner=characterPackages.Mona,old=owner.expand,flag=owner.enablesStellarConduct;owner.enablesStellarConduct=stellar;
 owner.expand=ctx=>old({...ctx,hit:(a,t,...rest)=>ctx.hit(a,a.id.startsWith('primer')?{...t,element:'Cryo',nativeElement:'Cryo',application:{gauge:1,group:null,hits:1,interval:0}}:t,...rest)});
 return ()=>{owner.expand=old;if(flag===undefined)delete owner.enablesStellarConduct;else owner.enablesStellarConduct=flag;};
}
export function gatedYaeEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const e of plan.events)if(e.eventId.startsWith('primer'))e.enabled=execution.setCount?execution.math.ge(execution.setCount(e.role,'GladiatorsFinale'),4):input.testPrimerEnabled??1;
  return plan;
 }});
}
