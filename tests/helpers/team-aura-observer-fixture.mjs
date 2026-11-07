import {freezeInput,freezeTeams} from './team-freeze-fixture.mjs';
import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {elementalApplication} from '../../beta-data/team-engine/ice-electro-reactions.mjs';
import {actionTime} from '../../beta-data/team-engine/rule-utils.mjs';
export function auraObserverInput(){
 const input=freezeInput(),profile=fixture('Mona');profile.character.constellation=0;profile.weapon=weapon('ApprenticesNotes');profile.artifacts=input.single_interfaces[0].artifacts;input.single_interfaces[0]=profile;
 input.team_dps.axis=createActionAxis('synthetic-aura-consumer',input.single_interfaces.map(p=>p.character.name));
 input.team_dps.axis.timeline=[{id:'mq',actor:'member1',kind:'action',action:'burst',timeMs:0},{id:'eq',actor:'member2',kind:'action',action:'burst',timeMs:100},{id:'end',actor:'member1',kind:'switch',timeMs:8000}];
 return input;
}
export function auraObserverTeams(input){const teams=freezeTeams(input);teams[0][1].forEach(a=>a.set_name='GladiatorsFinale');return teams;}
// A test-only subscriber isolates the new scheduler contracts. Production
// Mona's complete bubble lifecycle is migrated separately, never duplicated here.
export function installAuraObserver(){
 const p=characterPackages.Mona,old={expand:p.expand,createCombat:p.createCombat,createTimeline:p.createTimeline};
 p.expand=ctx=>{
  old.expand(ctx);
  for(const a of ctx.actions.filter(e=>e.kind==='cast'&&e.action==='burst'))ctx.enqueue({kind:'application',role:ctx.role,eventId:a.id+'/application',time:actionTime(a.time+107/60),rootOrder:a.rootOrder+19,element:'Hydro',category:'burst',targetIds:[0,1],application:elementalApplication(),enabled:1});
 };
 p.createCombat=p.createTimeline=ctx=>{
  let cast;
  return {onEvent(e){if(e.role===ctx.role&&e.kind==='cast'&&e.action==='burst'){cast=e;ctx.complete?.(e,actionTime(e.time+107/60));}},afterEvent(e){
   if(e.kind==='application'&&e.role===ctx.role)ctx.reactions.watchFrozen(e.targetIds,7.8);
   if(e.kind==='aura_change'&&e.element==='Frozen')ctx.hit(cast,{index:10,category:'burst',element:'Hydro',parts:1,enabled:e.enabled,targetIds:e.targetIds,label:'冻结结束订阅测试'},actionTime(e.time+1/60-cast.time),'aura-loss/'+e.time+'/'+e.targetIds[0]);
  }};
 };
 return ()=>Object.assign(p,old);
}
export function gatedAuraEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
 const plan=compileActionAxis(...args),role=input.single_interfaces.findIndex(p=>p.character.name==='Escoffier');
 for(const e of plan.events)if(e.role===role&&e.category==='burst'){e.targetIds=[0];e.enabled=execution.setCount?execution.math.ge(execution.setCount(role,'GladiatorsFinale'),4):input.testIce??1;}
 return plan;
}});}
