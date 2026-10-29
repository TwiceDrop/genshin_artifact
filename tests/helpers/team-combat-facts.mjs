import {createPortableHealth} from '../../beta-data/team-dps-portable-health.mjs';
import {resolveCombatTimeline} from '../../beta-data/team-engine/combat-runtime.mjs';
export function gatedHealthOutputs(m,gate){
 const profiles=['Skirk','Furina','Escoffier','Vodyanitsa'].map((name,r)=>({character:{name,level:90,constellation:r===1?1:0},weapon:{name:r===0?'FinaleOfTheDeep':'',refine:1}}));
 const base={model:'actions',initialHealth:{ratios:[.5,.5,.5,.5],fanfare:0,overflow:0,active:false},heals:[],events:[],roots:[],hpDrains:[],fanfareWindows:[],duration:10,endHit:'include',activeRole:()=>0,lastCast:()=>-Infinity};
 const health=createPortableHealth(profiles,[[],[],[],[]],base,{math:m,panelAt:()=>({hp:{base:100},critical:{base:0}}),healAt:h=>h.recipients.map(()=>h.raw),criticalAt:()=>0,refresh:()=>{}});
 const row=(time,kind,fields={})=>({time,rootOrder:time,order:0,eventId:kind+'/'+time,role:0,kind,enabled:gate,...fields});
 const events=[row(0,'fanfare_start',{role:1,window:0}),row(1,'heal',{raw:10,recipients:[0]}),row(2,'current_hp_drain',{hpDrain:.1}),row(3,'salon_drain',{role:1,hpDrain:.1}),row(4,'team_hp_change',{ratio:.1,change:'increase',recipients:'self'}),row(5,'bond'),row(6,'heal',{raw:30,recipients:[0],enabled:1}),row(7,'fanfare_end',{role:1,window:1,enabled:1}),row(8,'fanfare_end',{role:1,window:0})];
 const outputs=[];
 const checkpoints=new Set(events.filter(e=>[1,2,3,4,6,7,8].includes(e.time)).map(e=>e.eventId));
 resolveCombatTimeline(events,health,null,{afterEvent(event){if(checkpoints.has(event.eventId)){const state=health.rotation.health.at(-1);outputs.push(...state.ratios,state.fanfare);}}});
 return outputs;
}
export function gatedWeaponOutputs(m,gate,weapon){
 const profiles=['Skirk','Furina','Escoffier','Vodyanitsa'].map((name,r)=>({character:{name,level:90,constellation:0},weapon:{name:r===0?weapon:'',refine:1}}));
 const base={model:'actions',initialHealth:{ratios:[.5,.5,.5,.5],fanfare:0,overflow:0,active:false},heals:[],events:[],roots:[],hpDrains:[],fanfareWindows:[],duration:3,endHit:'include',activeRole:()=>0,lastCast:()=>-Infinity};
 const health=createPortableHealth(profiles,[[],[],[],[]],base,{math:m,panelAt:()=>({hp:{base:100},critical:{base:.5}}),healAt:()=>[10],criticalAt:()=>.5,refresh:()=>{}});
 const events=[0,1].flatMap(time=>{const e={role:0,time,rootOrder:time,order:time,eventId:'trial/'+time,kind:'weapon_heal_trial',category:'normal',enabled:time===0?gate:1};return [e,{...e,kind:'heal',eventId:'heal/'+time,healing:weapon==='TheBlackSword'?'black_sword':'isshin',order:time+.1,trial:time,recipients:[0]}];});
 const outputs=[];resolveCombatTimeline(events,health,null,{afterEvent:e=>{if(e.eventId.startsWith('heal/'))outputs.push(e.amount??0);}});return outputs;
}
