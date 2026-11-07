import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';

// Synthetic elemental contacts on an existing package isolate the shared
// scheduler; they are not a declaration of Mona's in-game element mechanics.
export function installElementalFixture(stellar){
 const owner=characterPackages.Mona,expand=owner.expand,enabled=owner.enablesStellarConduct;
 owner.enablesStellarConduct=stellar;
 owner.expand=ctx=>expand({...ctx,hit:(a,t,...rest)=>{
  const id=a.id,element=id==='seed'?'Electro':id==='physical'?'Physical':'Cryo';
  const application=['seed','trigger','record'].includes(id)?{gauge:1,group:null,hits:1,interval:0}:null;
  const payload={...t,element,nativeElement:element,application,...(id==='seed'?{enabled:ctx.settings.testGate??1}:{})};
  if(id.startsWith('stellar'))Object.assign(payload,{damageModel:'reaction.stellarConduct',stellarRatio:2});
  ctx.hit(a,payload,...rest);
 }});
 return ()=>{owner.expand=expand;if(enabled===undefined)delete owner.enablesStellarConduct;else owner.enablesStellarConduct=enabled;};
}
export function elementalEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  if(execution.setCount)for(const e of plan.events)if(e.eventId.startsWith('seed/'))e.enabled=execution.math.ge(execution.setCount(e.role,'GladiatorsFinale'),4);
  return plan;
 }});
}
