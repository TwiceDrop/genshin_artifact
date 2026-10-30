import {createSkirkRuntime} from '../../beta-data/team-engine/characters/skirk-runtime.mjs';
import {createEventScheduler} from '../../beta-data/team-engine/scheduler.mjs';
export function runtimeGates(m,gates,cons=0){
 const command=(id,action,time,enabled,extra={})=>({id,eventId:id,kind:['skill','burst'].includes(action)?'cast':'action',action,actionId:action,role:0,rootOrder:time*100,time,enabled,...extra});
 const events=[command('e','skill',0,gates[0]),command('q1','burst',1,gates[1],{params:{absorbedRifts:3}}),command('ca','charged',1.1,gates[2],{params:{absorbedRifts:3}}),
  {kind:'switch',id:'away',eventId:'away',role:1,from:0,time:2,rootOrder:200,enabled:gates[3]},command('h','skill',3,gates[4],{actionId:'skill.hold',params:{absorbedRifts:1}}),command('q2','burst',4,gates[5],{params:{absorbedRifts:1}})];
 const queue=createEventScheduler(events),hits=[],resources=[],windows={};let scheduled=0;
 const enqueue=e=>{if(++scheduled>256)throw Error('Unbounded resource timer schedule in six-command fixture');queue.enqueue(e);};
 const plugin=createSkirkRuntime({role:0,profile:{character:{level:90,ascend:false,constellation:cons}},math:m,resources,catalog:[],enqueue,
  complete(){},hit:(a,h,_offset,suffix)=>hits.push({...h,command:a.id,suffix}),
  addWindow:(key,a,life,_offset=0,values={})=>{const w={start:a.time,end:a.time+life,rootOrder:a.rootOrder,...values};(windows[key]??=[]).push(w);return w;}});
 for(const e of queue.events())plugin.onEvent(e);
 const sum=(id,predicate,read)=>hits.filter(h=>h.command===id&&predicate(h)).reduce((n,h)=>m.add(n,m.mul(h.enabled??1,read(h))),0);
 const burst=h=>h.skirkBurst&&h.ratio===undefined;
 return {outputs:[sum('q1',burst,()=>1),sum('q1',burst,h=>m.div(h.cunning,6)),sum('ca',h=>h.suffix==='charged',h=>h.sevenPhase?h.parts:0),sum('q2',burst,()=>1),sum('q2',burst,h=>m.div(h.cunning,6)),resources.reduce((n,r)=>m.choose(r.enabled??1,r.after,n),0)],resources,hits,scheduled};
}
// Independent frame stepping, with no production timer/window helpers.
export function runtimeOracle(gates,cons=0){
 let units=0,phase=false,start=-1,drain=-1,pause=0,nextPause=-1;const out=[0,0,0,0,0,0];
 function absorb(frame,n){units=Math.min(1000,units+n*80);if(!pause)nextPause=frame+9;pause=Math.min(6,pause+n*2);}
 function burst(frame,slot,n){if(phase)absorb(frame,n);else{out[slot]=6;out[slot+1]=units/10;units=0;}}
 for(let frame=0;frame<=1000;frame++){
  if(phase&&frame===start+750){phase=false;units=0;}
  if(frame===nextPause){pause--;nextPause=pause?frame+9:-1;}
  if(phase&&frame===drain){drain+=12;if(!pause){units=Math.max(0,units-14);if(!units)phase=false;}}
  if(frame===0&&gates[0]){units=Math.min(1000,units+(cons>=2?550:450));phase=true;start=0;drain=12;}
  if(frame===60&&gates[1])burst(frame,0,3);
  if(frame===66&&gates[2]&&phase){out[2]=3;absorb(frame,3);}
  if(frame===120&&gates[3]&&phase){phase=false;units=0;}
  if(frame===180&&gates[4]){phase=false;units=Math.min(1000,units+(cons>=2?550:450));absorb(frame,1);}
  if(frame===240&&gates[5])burst(frame,3,1);
 }
 out[5]=units/10;return out;
}
