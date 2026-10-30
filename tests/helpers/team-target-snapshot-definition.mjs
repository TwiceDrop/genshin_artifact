import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';

const common={stage:'damage',target:'otherOnField',trigger:{kind:'cast',action:'skill'},duration:10,reads:{},filter:{element:['Hydro','Physical'],category:'normal'}};
export function installTargetSnapshot(mode){
 const owner=mode==='snapshot'?characterPackages.Mona:characterPackages.Escoffier,original=owner.effects;
 if(mode==='snapshot')owner.effects=()=>[{id:'test.snapshot.critical',label:'测试限时暴击',stage:'base',target:'self',trigger:{kind:'switch'},duration:10,reads:{},value:()=>({CriticalBase:.5})}];
 else owner.effects=()=>mode==='highest'?[100,80].map((value,i)=>({...common,id:'test.highest.'+i,label:'测试有限最高',uses:i+1,targetAggregation:'linearFlat',stacking:{group:'test.highest',mode:'highest'},value:()=>({ExtraDmgBase:value})})):
  [{...common,id:'test.finite.critical',label:'测试有限暴击',uses:1,value:()=>({CriticalBase:.9})}];
 return ()=>{if(original===undefined)delete owner.effects;else owner.effects=original;};
}

export function targetSnapshotEvaluator(api,input,execution={}){
 return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
  const plan=compileActionAxis(...args);
  for(const e of plan.events){
   if(e.eventId.startsWith('target-')){
    e.targetIds=[2,0,1];
    if(input.testTargetGate&&e.eventId.startsWith('target-1'))e.enabled=execution.setCount?execution.math.ge(execution.setCount(e.role,'GladiatorsFinale'),4):input.testTargetGate===1?1:0;
   }
   if(e.statSnapshot&&input.testSnapshotFields!==undefined)e.statSnapshot={...e.statSnapshot,fields:input.testSnapshotFields};
  }
  return plan;
 }});
}
