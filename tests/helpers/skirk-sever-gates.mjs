import {createSkirkHitRuntime} from '../../beta-data/team-engine/characters/skirk-hit-runtime.mjs';
import {createEventScheduler} from '../../beta-data/team-engine/scheduler.mjs';

export function gated(m,gates){
 const root=(id,time,extra)=>({id,eventId:id,kind:'action',role:0,time,rootOrder:100*time,...extra});
 const n3=root('n3',1),n5=root('n5',2),initial=[root('grant',0,{skirkAbsorbedRifts:2,enabled:gates[0]}),n3,
  ...[0,1].map(part=>({...n3,id:undefined,kind:'hit',eventId:'n3/normal.3',skirkSeverCommand:'n3',rootOrder:120,part,enabled:gates[part+1]})),n5,
  {...n5,id:undefined,kind:'hit',eventId:'n5/normal.5',skirkSeverCommand:'n5',rootOrder:220,part:0,enabled:gates[3]},
  root('grant2',4,{skirkAbsorbedRifts:2,enabled:gates[4]}),root('q',15,{burstMode:'ruin',enabled:gates[5]})];
 const scheduler=createEventScheduler(initial),hits=[],resources=[],profile={character:{level:90,ascend:false,constellation:6}};
 const plugin=createSkirkHitRuntime({role:0,profile,math:m,window:()=>-1,windows:{},covered:()=>1,enqueue:scheduler.enqueue,resources,
  hit:(a,h,_offset,suffix)=>hits.push({...h,id:a.id+'/'+suffix,command:a.id}),observeHit:()=>1});
 for(const event of scheduler.events()){if(event.kind==='hit')plugin.onHit(event);else plugin.onEvent(event);}
 const count=id=>hits.filter(h=>h.command===id).reduce((n,h)=>m.add(n,m.mul(h.enabled??1,h.hits??1)),0);
 return {outputs:['n3','n5','q'].map(count),hits,resources};
}
export function oracle(gates){
 let expires=gates[0]?[15,15]:[],n3=0,n5=0;
 if((gates[1]||gates[2])&&expires.length){expires.shift();n3=3;}
 if(gates[3]&&expires.length){expires.shift();n5=3;}
 if(gates[4])expires=[...expires,19,19].slice(-3);
 expires=expires.filter(t=>t>15);
 return [n3,n5,gates[5]?expires.length:0];
}
