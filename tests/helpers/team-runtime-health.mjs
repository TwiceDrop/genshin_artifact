import {createPortableHealth} from '../../beta-data/team-dps-portable-health.mjs';
import {resolveCombatTimeline} from '../../beta-data/team-engine/combat-runtime.mjs';
import {createEquipmentHealingDamage} from '../../beta-data/equipment-healing-damage-rules.mjs';

const profiles=()=>['Skirk','Furina','Escoffier','Vodyanitsa'].map(name=>({character:{name,level:90,constellation:0},weapon:{name:'',refine:1}}));
const rotation=(duration,endHit='include')=>({model:'actions',slots:['Skirk','Furina','Escoffier','Vodyanitsa'],initialHealth:{ratios:[.95,.5,.6,.7],fanfare:0,overflow:0,active:false},heals:[],events:[],roots:[],hpDrains:[],windows:{},fanfareWindows:[],duration,endHit,activeRole:()=>0,lastCast:()=>-Infinity});

// The source heals do not exist in the compiled rotation. They are children of
// a resolved hit, and their overheal must create A1, which can then feed Clam.
export function runtimeHealingChain(m,gate,{times=[1],duration=7,endHit='include'}={}){
 const base=rotation(duration,endHit),members=profiles(),observed=[];
 const health=createPortableHealth(members,[[],[],[],[]],base,{math:m,panelAt:()=>({hp:{base:1000},critical:{base:0}}),healAt:h=>h.recipients.map(()=>h.healing==='furina_a1'?20:200),criticalAt:()=>0,refresh:()=>{}});
 const equipment=createEquipmentHealingDamage(members,base,h=>h.rawAmounts.reduce((a,b)=>m.add(a,b),0),(role,set)=>Number(role===1&&set==='OceanHuedClam'),{enemy_count:1},m);
 let a1Count=0,a1Raw=0,effective=0,clam=0;
 const events=[{kind:'fanfare_start',role:1,time:0,rootOrder:0,order:0,window:0,eventId:'fanfare'},{kind:'hit',category:'normal',role:0,time:0,rootOrder:1,order:0,eventId:'seed'}];
 resolveCombatTimeline(events,health,null,{afterEvent(event,enqueue){
  observed.push(event);
  if(event.eventId==='seed')for(const [i,time]of times.entries())enqueue({kind:'heal',role:2,time,rootOrder:10+i,order:0,eventId:'runtime-heal/'+i,recipients:[0],enabled:gate});
  if(event.kind==='heal'&&event.rawAmounts){
   effective=m.add(effective,event.amount);
   if(event.healing==='furina_a1'){
    a1Count=m.add(a1Count,event.enabled??1);
    a1Raw=m.add(a1Raw,m.mul(event.enabled??1,event.rawAmounts.reduce((a,b)=>m.add(a,b),0)));
   }
  }
  if(event.category==='equipment')clam=m.add(clam,m.mul(event.fixed,event.enabled??1));
  equipment.afterEvent(event,enqueue);
 }});
 const last=health.rotation.health.at(-1);
 return {outputs:[...last.ratios,last.fanfare,a1Count,a1Raw,effective,clam],observed,rotation:health.rotation};
}

// A fixed frame vector lets scalar execution (actual ticks only) and symbolic
// execution (all reachable ticks) be compared contact by contact.
export function singerClock(m,initialHP,laterHP,{duration=7,end=7}={}){
 const base=rotation(duration),members=profiles(),frames=Array(Math.floor(duration*60)+1).fill(0),observed=[];
 base.windows.furinaSinger=[{start:0,end,endOrder:-Infinity,rootOrder:0,eventId:'singer'}];
 const health=createPortableHealth(members,[[],[],[],[]],base,{math:m,panelAt:(role,event)=>({hp:{base:role===1?m.choose(event.time>=4,laterHP,initialHP):100000},critical:{base:0}}),healAt:h=>h.recipients.map(()=>0),criticalAt:()=>0,refresh:()=>{}});
 resolveCombatTimeline([],health,null,{afterEvent(event){
  if(event.healing!=='furina_singer')return;
  observed.push(event);
  frames[event.singerFrame]=m.add(frames[event.singerFrame],event.enabled??1);
 }});
 return {outputs:frames,observed};
}
