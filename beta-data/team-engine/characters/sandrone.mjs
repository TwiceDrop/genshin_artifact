import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,numericSum,actionTime,chronological} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

// Provisional timing, separated from the verified native talent coefficients.
// Source comparison and the user's calibration agreement: docs/team3-integration-20261028.md.
export const SANDRONE_TIMING=Object.freeze({windup:.5,sweep:1/3,firstRay:1.5,ray:1,heatTick:.2,heatPerTick:4,heatPerRay:12,
 passiveCooling:5,skillInitialCooling:40,skillCoolingTick:.1,skillCooling:10,overloadSweep:.5,c6Delay:.2,
 skillHits:[.2,.4],burstBombs:[2,2.1,2.2],burstRay:2.6});
export const sandrone={
 id:'Sandrone',element:'Cryo',weaponType:'Claymore',panelIndex:10,enablesStellarConduct:true,completionDelay:.2,
 modeled:['SandroneTalent1','SandroneC1','SandroneC6'],
 normalize:p=>{p.character.params={Sandrone:{stellar_base_active:false,em_conversion_active:teamTalentUnlocked(p.character,4),c1_team_stellar:false,c6_elevate_active:false}};},
 skillConfig:e=>({Sandrone:{stellarconduct_hits:0,c2_ray_stacks:e.sandroneRayStacks??0,prism_overcharge:e.sandroneOvercharge??false,burst_tactics_stacks:e.sandroneTactics??0}}),
 nativeRatioMultiplier:e=>e.sandroneOvercharge?4:1+(e.sandroneTactics??0)*.1,
 ratioLabel:'悠久的演算机关',
 expand({actions,hit}){
  for(const a of actions){
   if(['skill','burst','charged'].includes(a.action))continue;
   const index={'normal.1':0,'normal.2':1,'normal.3':2,'plunge.collision':7,'plunge.low':8,plunge:9}[a.action];
   hit(a,{index,category:a.action.startsWith('normal')?'normal':'plunge',element:'Physical',label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':'下落攻击'});
  }
 },
 createCombat({role,profile,roots,reactions,schedule,addHit,resources,activeRole}){
  const c=profile.character,t=SANDRONE_TIMING,scale=c.constellation>=1?.5:1;
  const s={heat:0,overloaded:false,decoding:false,holding:false,hoverUntil:-Infinity,tactics:[],cooled:0,rays:0,token:0,lastTime:0,c4Ready:-Infinity,onField:activeRole(0)===role};
  const at=(e,delay,run,phase=.005)=>schedule({time:actionTime(e.time+delay),rootOrder:e.rootOrder+phase,role,combatKind:'state',run});
  function power(time,value){
   const previous=s.heat;s.heat=Math.max(0,Math.min(100,value));
   if(previous>s.heat&&teamTalentUnlocked(c,1)){
    s.cooled+=previous-s.heat;
    while(s.cooled>=10-1e-9){s.cooled-=10;s.tactics=s.tactics.filter(end=>time<end);s.tactics.push(actionTime(time+60));if(s.tactics.length>10)s.tactics.shift();}
   }
   if(s.heat>=100)s.overloaded=true;
   if(s.heat<50)s.overloaded=false;
   if(previous!==s.heat)resources.push({role,time,kind:'sandrone.power',before:previous,after:s.heat});
  }
  function advance(e){
   if(!s.decoding&&e.time>s.lastTime&&s.lastTime>=s.hoverUntil)power(e.time,s.heat-(e.time-s.lastTime)*t.passiveCooling*(s.onField?1:3));
   s.lastTime=e.time;s.tactics=s.tactics.filter(end=>e.time<end);
  }
  function stop(){s.decoding=false;s.holding=false;s.hoverUntil=-Infinity;++s.token;}
  function charged(e){
   roots.find(a=>a.id===e.id).completionTime=e.time;
   const next=roots.find(a=>chronological(a,e)>0&&(a.role===role&&a.kind!=='switch'||a.kind==='switch'&&a.from===role&&a.role!==role));
   const terminal=!next,token=++s.token;s.holding=true;s.rays=0;
   const live=()=>s.holding&&token===s.token;
   function overload(parent){
    at(parent,t.overloadSweep,()=>{
     if(!live())return;
     const now={...e,time:actionTime(parent.time+t.overloadSweep)};
     if(!s.overloaded){begin(now,0);return;}
     addHit(now,{index:6,category:'charged',element:'Cryo',application:application(1,'sandrone.sweep',2,1.4),label:'功率过载·扫射'});overload(now);
    });
   }
   function heat(parent){
    at(parent,t.heatTick,()=>{
     if(!live()||!s.decoding)return;
     const now={...e,time:actionTime(parent.time+t.heatTick)};power(now.time,s.heat+t.heatPerTick*scale);
     if(s.overloaded){s.decoding=false;if(terminal)s.holding=false;else overload(now);}else heat(now);
    });
   }
   function sweep(parent,n){
    at(parent,n*t.sweep,()=>{
     if(!live()||!s.decoding)return;
     addHit({...e,time:actionTime(parent.time+n*t.sweep)},{index:3,category:'charged',element:'Cryo',application:application(1,'sandrone.sweep',2,1.4),label:'解算模式·扫射'});sweep(parent,n+1);
    });
   }
   function ray(parent,n){
    const delay=t.firstRay-t.windup+n*t.ray;
    at(parent,delay,()=>{
     if(!live()||!s.decoding)return;
     const now={...e,time:actionTime(parent.time+delay)},stellar=reactions.view().radiance,stacks=Math.min(++s.rays,3);
     addHit(now,{index:stellar?5:4,category:stellar?'reaction':'charged',element:'Cryo',damageKind:stellar?'stellarConduct':'normal',application:stellar?null:application(),sandroneRay:true,sandroneRayStacks:stacks,label:stellar?'冷凝射线·星超导':'冷凝射线'});
     if(c.constellation>=6&&s.rays>=3&&s.rays<=6)addHit(now,{index:stellar?17:16,category:stellar?'reaction':'charged',element:'Cryo',damageKind:stellar?'stellarConduct':'normal',application:null,sandroneRayStacks:stacks,label:stellar?'集束型冷凝射线·星超导':'集束型冷凝射线'},t.c6Delay);
     // Fire before applying its heat: the final ray retains the decoding buffs.
     at(now,0,()=>{if(!live())return;power(now.time,s.heat+t.heatPerRay*scale);if(s.overloaded){s.decoding=false;if(terminal)s.holding=false;else overload(now);}},.02);
     ray(parent,n+1);
    });
   }
   function begin(parent,delay){
    at(parent,delay,()=>{if(!live())return;const start={...e,time:actionTime(parent.time+delay)};s.decoding=true;s.rays=0;heat(start);sweep(start,0);ray(start,0);});
   }
   if(s.overloaded){if(terminal){addHit(e,{index:6,category:'charged',element:'Cryo',application:application(1,'sandrone.sweep',2,1.4),label:'功率过载·扫射'});s.holding=false;}else overload(e);}
   else begin(e,t.windup);
  }
  return {state:s,advance,onCommand(e){
   if(e.kind==='switch'){if(e.from===role&&e.role!==role)stop();s.onField=e.role===role;return;}
   if(e.role!==role)return;
   stop();
   if(e.action==='charged'){charged(e);return;}
   if(e.action==='skill'){
    const stellar=reactions.view().radiance,overcharge=teamTalentUnlocked(c,1)&&stellar&&s.heat>50;
    power(e.time,s.heat-t.skillInitialCooling);s.hoverUntil=actionTime(e.time+6);const token=s.token;
    const cool=(n)=>at(e,n*t.skillCoolingTick,()=>{if(token!==s.token||!s.onField)return;power(actionTime(e.time+n*t.skillCoolingTick),s.heat-t.skillCooling);if(n*t.skillCoolingTick<6)cool(n+1);});cool(1);
    addHit(e,{index:10,category:'skill',element:'Cryo',application:application(1,'sandrone.skill',3,2.5),label:'游衍解析·第一枚棱晶弹'},t.skillHits[0]);
    addHit(e,{index:stellar?11:10,category:stellar?'reaction':'skill',element:'Cryo',damageKind:stellar?'stellarConduct':'normal',application:stellar?null:application(1,'sandrone.skill',3,2.5),sandroneOvercharge:overcharge,label:stellar?'游衍解析·星超导':'游衍解析·第二枚棱晶弹'},t.skillHits[1]);
    roots.find(a=>a.id===e.id).completionTime=actionTime(e.time+t.skillHits[1]);
   }else if(e.action==='burst'){
    const stellar=reactions.view().radiance,tactics=stellar&&teamTalentUnlocked(c,1)?s.tactics.length:0;if(stellar)s.tactics=[];
    for(const [part,delay]of t.burstBombs.entries())addHit(e,{index:12,parts:3,part,category:'burst',element:'Cryo',application:application(1,'sandrone.burst',4,3),label:'万理证毕·轰炸第'+(part+1)+'段'},delay);
    addHit(e,{index:stellar?14:13,category:stellar?'reaction':'burst',element:'Cryo',damageKind:stellar?'stellarConduct':'normal',application:stellar?null:application(),sandroneTactics:tactics,label:stellar?'负温聚能光束·星超导':'负温聚能光束'},t.burstRay);
    roots.find(a=>a.id===e.id).completionTime=actionTime(e.time+t.burstRay);
   }
  },afterHit(e){
   if(e.role===role&&e.damageKind==='stellarConduct'&&c.constellation>=4&&e.time>=s.c4Ready){s.c4Ready=actionTime(e.time+4);addHit(e,{index:15,category:'reaction',element:'Cryo',damageKind:'stellarConduct',label:'桑多涅·四命谐振炮'});}
  }};
 },
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {attackBuffs(r,e){
   const state=rotation().combatAt(e).states[role];
   return [effect('桑多涅·解算模式',{EnhanceStellarSuperconduct:c.constellation>=1&&state.decoding?.3:0}),effect('桑多涅·六命',{StellarConductElevation:c.constellation>=6&&r===role?.2:0})];
  },damageBuffs(r,e,panels,source){return e.damageKind==='stellarConduct'?[effect('桑多涅·唯理为光',{StellarConductBaseBonus:m.min(.14,m.mul(sum(source(role).atk),.00007))})]:[];}};
 },
};
