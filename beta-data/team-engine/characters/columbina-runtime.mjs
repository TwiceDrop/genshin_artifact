import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {actionTime} from '../rule-utils.mjs';
import {eventKey,afterEvent,compareEventPosition} from '../event-order.mjs';
import {isMoonCrystallize} from '../native-damage-fields.mjs';
import {characterPackages} from '../character-packages.mjs';

export function createColumbinaRuntime({role,profiles,profile,math:m=scalarMath,enqueue,covered,observeHit=e=>e.enabled??1}){
 const c=profile.character,elements=profiles.map(p=>characterPackages[p.character.name].element);
 const count=el=>elements.filter(value=>value===el).length;
 const crystalPriority=count('Geo')>Math.max(count('Electro'),count('Dendro'));
 const state={shieldUntil:-Infinity,critUntil:-Infinity},history=[];
 let gravity=0,cycleContact=0,until=-Infinity,chargingUntil=-Infinity,cycle=false,token=0,ticking=false,c1Ready=-Infinity,c4Ready=-Infinity;
 const remember=e=>history.push({at:afterEvent(e),...state});
 const possible=g=>typeof g==='object'||!!g;
 function timer(e,time){
  enqueue({kind:'timer',role,time:actionTime(time),rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+1,mechanic:'columbina.gravity',eventId:'columbina/gravity/'+token+'/'+actionTime(time),token});
 }
 function gravityHit(e,gate,delay){
  if(!possible(gate))return;
  const time=actionTime(e.time+delay),c4=c.constellation>=4?m.choose(gate,m.ge(e.time,c4Ready),0):0;
  c4Ready=m.choose(c4,e.time+15,c4Ready);
  if(c.constellation>=1){state.shieldUntil=m.choose(gate,e.time+8,state.shieldUntil);remember(e);}
  enqueue({kind:'hit',index:12,role,element:'Geo',category:'skill',damageModel:'direct.lunarCrystallize',lunarStat:'hp',label:'引力干涉·月结晶',
   persistent:true,time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+1,eventId:eventKey(e)+'/gravity-hit',enabled:gate,columbinaC4:c4,part:0,parts:1});
 }
 function charge(e){
  if(e.time>=until)return;
  const gate=m.choose(e.enabled??1,observeHit(e),0);if(!possible(gate))return;
  if(cycle){cycleContact=m.max(cycleContact,gate);return;}
  chargingUntil=m.choose(gate,e.time+2,chargingUntil);
  if(!ticking){ticking=true;timer(e,e.time);}
 }
 return {stateAt:e=>history.findLast(row=>compareEventPosition(row.at,e)<=0),
  beforeEvent(e){
   if(e.role!==role||!e.cycleGravity)return;
   e.enabled=m.choose(e.enabled??1,cycleContact,0);
   if(!possible(e.enabled))return;
   if(c.constellation>=4){e.columbinaC4=m.choose(e.enabled,m.ge(e.time,c4Ready),0);c4Ready=m.choose(e.columbinaC4,e.time+15,c4Ready);}
   if(c.constellation>=1){state.shieldUntil=m.choose(e.enabled,e.time+8,state.shieldUntil);remember(e);}
  },
  onEvent(e){
   if(e.mechanic==='columbina.gravity'&&e.token===token){
    const live=m.lt(e.time,chargingUntil);
    if(e.time>=until||!possible(live)){ticking=false;return;}
    gravity=m.add(gravity,m.mul(live,c.constellation>=2?.67:.5));
    const full=m.ge(gravity,60);gravityHit(e,full,43/60);gravity=m.choose(full,0,gravity);
    timer(e,e.time+.05);
   }else if(e.kind==='reaction'&&e.reactionType==='LunarCrystallize'){
    charge(e);
    if(c.constellation===6&&covered('月之领域',e.time,e.rootOrder)){
     state.critUntil=m.choose(e.enabled??1,e.time+8,state.critUntil);remember(e);
    }
   }
  },onHit(e){
   if(e.role!==role||e.index!==8)return;
   if(e.time>=until){
    cycle=e.cycleStart;gravity=0;cycleContact=0;chargingUntil=-Infinity;ticking=false;token++;
   }
   until=e.time+25;
   if(!cycle&&c.constellation>=1&&crystalPriority&&e.time>=c1Ready){gravityHit(e,e.enabled??1,43/60);c1Ready=e.time+15;}
  },afterEvent(e){if(e.kind==='hit'&&isMoonCrystallize(e))charge(e);},
 };
}
