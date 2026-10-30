import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

const qiqiApplication=()=>application(1,'qiqi.elementalArt',2,2);
export const qiqi={
 id:'Qiqi',element:'Cryo',weaponType:'Sword',panelIndex:12,completionDelay:1/60,
 modeled:['QiqiTalent2StellarConduct','QiqiC6StellarConduct'],
 normalize:p=>{p.character.params={Qiqi:{stellar_conduct_state:false}};},
 expand({actions,hit,heal,periodic}){
  for(const a of actions){
   if(a.action==='skill'){
    const snapshot={time:actionTime(a.time+32/60),rootOrder:a.rootOrder+20};
    a.completionTime=snapshot.time;
    hit(a,{index:12,category:'skill',application:qiqiApplication(),qiqiInitial:true,qiqiCast:a.id,label:'仙法·寒病鬼差'},32/60,'initial');
    periodic(a,{duration:15,offsetAt:i=>1.6+Math.floor((i+1)/2)*2.25+Math.floor(i/2)},offset=>hit(a,{index:15,category:'skill',application:qiqiApplication(),qiqiRing:true,persistent:true,qiqiCast:a.id,statSnapshot:snapshot,label:'寒病鬼差·环绕'},offset,'ring/'+offset));
    periodic(a,{duration:15,offsetAt:i=>32/60+i*4.5},offset=>heal(a,offset,'active',{healing:'qiqi.periodic',statSnapshot:snapshot,label:'寒病鬼差·持续治疗'}));
   }else if(a.action==='burst'){
    a.completionTime=actionTime(a.time+82/60);
    hit(a,{index:17,category:'burst',application:application(2),qiqiBurst:a.id,label:'仙法·救苦度厄'},82/60,'burst');
   }else{
    const indices={'normal.1':[0],'normal.2':[1],'normal.3':[2,3],'normal.4':[4,5],'normal.5':[6],charged:[7,8],'plunge.collision':[9],'plunge.low':[10],plunge:[11]}[a.action];
    indices.forEach((index,i)=>hit(a,{index,category:a.action.startsWith('normal')?'normal':a.action.startsWith('plunge')?'plunge':'charged',element:'Physical',application:null,label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':a.action==='charged'?'重击':'下落攻击'},i/20,a.action+'/'+i));
   }
  }
 },
 createCombat({role,profile,profiles,settings,reactions,schedule,addHit,addHeal,activeRole}){
  const c=profile.character,count=settings.enemy_count??1;
  let heraldSnapshot=null;
  const s={heraldUntil:-Infinity,cast:null,coordinateReady:profiles.map(()=>-Infinity),incomingUntil:profiles.map(()=>-Infinity),bursts:{},c6:0,c6Until:-Infinity,
   talismans:[{weight:1,until:Array(count).fill(-Infinity),healReady:Array(count).fill(-Infinity),a4Ready:-Infinity}]};
  function mergeBranches(){
   const map=new Map();for(const branch of s.talismans){const key=JSON.stringify([branch.until,branch.healReady,branch.a4Ready]),old=map.get(key);if(old)old.weight+=branch.weight;else map.set(key,branch);}s.talismans=[...map.values()];
  }
  return {state:s,onCommand(e){
   if(e.role!==role||e.kind!=='cast')return;
   if(e.action==='skill'){s.heraldUntil=actionTime(e.time+15);s.cast=e.id;heraldSnapshot=null;}
   if(e.action==='burst'){
    s.bursts[e.id]=reactions.view().radiance;
    if(c.constellation>=6){s.c6=4;s.c6Until=actionTime(e.time+12);}
    schedule({time:actionTime(e.time+40/60),rootOrder:e.rootOrder+10,role,combatKind:'state',run:()=>{for(const b of s.talismans)b.until.fill(actionTime(e.time+40/60+15));mergeBranches();}});
   }
  },beforeHit(e){
   if(e.role===role&&e.qiqiRing&&heraldSnapshot)e.statSnapshot={...e.statSnapshot,combat:heraldSnapshot};
   if(e.damageKind==='stellarConduct'&&e.role!==role&&e.onField&&e.time<s.c6Until&&s.c6>0){
    e.qiqiFlatTargets=reactions.targetIds(e).slice(0,s.c6);s.c6-=e.qiqiFlatTargets.length;
   }
  },afterHit(e){
   if(e.qiqiInitial&&e.role===role)heraldSnapshot=e.combat;
   if(e.role===role&&e.qiqiBurst&&s.bursts[e.qiqiBurst])addHit(e,{index:19,category:'burst',damageKind:'stellarConduct',application:null,qiqiBurst:null,label:'救苦度厄·星超导'});
   if(e.time<s.heraldUntil&&e.role===activeRole(e.time,e.rootOrder)&&e.damageKind!=='superconduct'&&!e.noCoordinate&&e.time>=s.coordinateReady[e.role]){
    s.coordinateReady[e.role]=actionTime(e.time+2.2);
    addHit(e,{role,index:16,category:'skill',element:'Cryo',damageKind:'normal',application:qiqiApplication(),noCoordinate:true,statSnapshot:undefined,qiqiBurst:null,qiqiInitial:false,qiqiRing:false,qiqiCast:s.cast,label:'寒病鬼差·协同攻击'},1/60);
   }
   if(teamTalentUnlocked(c,1)&&e.time<s.heraldUntil&&e.onField&&e.reactionFacts.length)s.incomingUntil[e.role]=actionTime(e.time+8);
   const ownAttack=e.role===role&&['normal','charged'].includes(e.category);
   if(ownAttack&&e.time<s.heraldUntil)addHeal(e,{role,recipients:profiles.map((_,i)=>i),healing:'qiqi.attack',statSnapshot:heraldSnapshot?{time:heraldSnapshot.time,combat:heraldSnapshot}:undefined,label:'寒病鬼差·命中治疗'});
   if(ownAttack&&teamTalentUnlocked(c,4)){
    const radiance=reactions.view().radiance,chance=radiance?1:.5,cd=radiance?15:30;
    for(const target of reactions.targetIds(e)){
     const next=[];
     for(const b of s.talismans){
      if(e.time<b.a4Ready||b.until[target]>=e.time+6){next.push(b);continue;}
      if(chance<1)next.push({...b,until:[...b.until],healReady:[...b.healReady],weight:b.weight*(1-chance)});
      const yes={...b,until:[...b.until],healReady:[...b.healReady],weight:b.weight*chance,a4Ready:actionTime(e.time+cd)};yes.until[target]=actionTime(e.time+6);next.push(yes);
     }
     s.talismans=next;
    }
    mergeBranches();
   }
   for(const target of reactions.targetIds(e)){
    let probability=0;
    for(const b of s.talismans)if(e.time<b.until[target]&&e.time>=b.healReady[target]){probability+=b.weight;b.healReady[target]=actionTime(e.time+1);}
    if(probability){
     addHeal(e,{role,recipients:[e.role],healing:'qiqi.talisman',probability,label:'度厄真符·治疗'});
     if(c.constellation>=4)addHeal(e,{role,recipients:profiles.map((_,i)=>i),lowestOnly:true,healing:'qiqi.c4',probability,label:'七七·四命治疗'});
    }
   }
  }};
 },
 create({role,profiles,rotation,math:m,settings}){
  const sum=numericSum(m);
  return {
   attackBuffs(r,e){
    const state=rotation().combatAt(e),c=profiles[role].character,result=[];
    // The shipped native C2 flag adds 0.5 flat ATK; supply the verified 50%
    // base-ATK increase through the shared attribute graph instead.
    if(r===role&&c.constellation>=2&&state.reaction.radiance)result.push(effect('七七·冰寒蚀骨',{ATKPercentage:.5}));
    if(e.time<state.states[role].heraldUntil&&state.reaction.radiance)result.push(effect('七七·七宝奉真',{EnhanceStellarSuperconduct:.5,EnhanceSuperconduct:.5}));
    return result;
   },
   damageBuffs(r,e,panels,source){
    const out=[],target=rotation().combatAt(e).reaction.targets[e.targetIds?.[0]??0];
    if(r===role&&profiles[role].character.constellation>=2&&['normal','charged'].includes(e.category)&&target.Cryo>0)out.push(effect('七七·冰寒蚀骨·冰附着',{BonusBase:.15}));
    if(!e.qiqiFlatTargets?.length)return out;
    const ids=settings.damage_scope==='all'?e.qiqiFlatTargets:e.qiqiFlatTargets.filter(i=>i===0),targets=settings.damage_scope==='all'?(e.targetIds?.length??Math.min(settings.enemy_count??1,e.targetLimit??Infinity)):1;
    if(ids.length)out.push(effect('七七·洞玄',{StellarConductFlat:m.mul(sum(source(role).atk),6*ids.length/targets)}));
    return out;
   },
   incoming(h,recipient){return h.time<(rotation().combatAt(h).states[role].incomingUntil?.[recipient]??-Infinity)?.2:0;},
   healingBase(h,p,native){if(h.healing==='qiqi.c4')return {amount:m.mul(1.8,sum(p.atk)),outgoing:sum(p.healing_bonus)};return native({'qiqi.periodic':14,'qiqi.attack':13,'qiqi.talisman':18}[h.healing]);},
  };
 },
};
