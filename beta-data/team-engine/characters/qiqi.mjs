import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {eventKey} from '../event-order.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {observeProcHit} from '../proc-outcomes.mjs';
import {createQiqiRuntime,qiqiApplication,qiqiSnapshot} from './qiqi-runtime.mjs';

export const qiqi={
 id:'Qiqi',element:'Cryo',weaponType:'Sword',panelIndex:12,reactionStatIndex:0,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill3',5:'skill2'},defaultWeapon:'SacrificialSword',previewWeapon:'DullBlade',
 capabilities:{energy:80,shield:false,nightsoul:false,arkhe:false,region:'Liyue'},
 isBlunt:e=>[10,11].includes(e.index),
 nativeDamage:{
  ...Object.fromEntries([0,1,2,3,4,5,6].map(index=>[index,{category:'normal',element:'Physical'}])),
  ...Object.fromEntries([7,8].map(index=>[index,{category:'charged',element:'Physical'}])),
  ...Object.fromEntries([9,10,11].map(index=>[index,{category:'plunge',element:'Physical',plungeImpact:index!==9}])),
  ...Object.fromEntries([12,15,16].map(index=>[index,{category:'skill',element:'Cryo',infusable:false}])),
  17:{category:'burst',element:'Cryo',infusable:false},19:{category:'burst',element:'Cryo',infusable:false},13:{kind:'healing'},14:{kind:'healing'},18:{kind:'healing'},
 },
 actions:[{id:'skill',label:'仙法·寒病鬼差',endOffsetMs:33/60*1000},{id:'burst',label:'仙法·救苦度厄',endOffsetMs:83/60*1000},
  ...Array.from({length:5},(_,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段',endOffsetMs:i===2||i===3?50:0})),
  {id:'charged',label:'重击',endOffsetMs:50},{id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'}],
 modeled:['QiqiTalent2StellarConduct','QiqiC6StellarConduct'],
 normalize:p=>{p.character.params={Qiqi:{stellar_conduct_state:false}};},
 effects:profile=>profile.character.constellation>=6?[{
  id:'qiqi.c6',label:'七七·洞玄',stage:'damage',target:'otherOnField',trigger:{kind:'cast',action:'burst'},duration:12,uses:4,
  filter:{damageModel:'reaction.stellarConduct'},reads:{attack:{stat:'atk',stage:'attack',timing:'live'}},value:({m,read})=>({StellarConductFlat:m.mul(6,read('attack'))}),
 }]:[],
 expand({actions,hit,heals,periodic,activeRole}){
  for(const a of actions){
   if(a.action==='skill'){
    const snapshot=qiqiSnapshot(a);
    hit(a,{index:12,category:'skill',application:qiqiApplication(),qiqiInitial:true,label:'仙法·寒病鬼差'},32/60,'initial');
    periodic(a,{duration:15,offsetAt:i=>1.6+Math.floor((i+1)/2)*2.25+Math.floor(i/2)},offset=>hit(a,{index:15,category:'skill',application:qiqiApplication(),qiqiRing:true,persistent:true,statSnapshot:snapshot,label:'寒病鬼差·环绕'},offset,'ring/'+offset));
    periodic(a,{duration:15,offsetAt:i=>32/60+i*4.5},offset=>{const time=actionTime(a.time+offset);heals.push({kind:'heal',time,role:a.role,rootOrder:a.rootOrder+30,eventId:a.id+'/periodic/'+offset,recipients:[activeRole(time,a.rootOrder+30)],healing:'qiqi.periodic',statSnapshot:snapshot,label:'寒病鬼差·持续治疗'});});
   }else if(a.action==='burst')hit(a,{index:17,category:'burst',application:application(2),qiqiBurst:a.id,label:'仙法·救苦度厄'},82/60,'burst');
   else{
    const indices={'normal.1':[0],'normal.2':[1],'normal.3':[2,3],'normal.4':[4,5],'normal.5':[6],charged:[7,8],'plunge.collision':[9],'plunge.low':[10],plunge:[11]}[a.action];
    indices.forEach((index,i)=>hit(a,{index,category:a.action.startsWith('normal')?'normal':a.action.startsWith('plunge')?'plunge':'charged',element:'Physical',application:null,label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':a.action==='charged'?'重击':'下落攻击'},i/20,a.action+'/'+i));
   }
  }
 },
 createTimeline:createQiqiRuntime,createCombat:createQiqiRuntime,
 finiteFollowupDelay:()=>1/60,
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {
   attackBuffs(r,e){return r===role&&c.constellation>=2?[effect('七七·冰寒蚀骨',{ATKPercentage:m.choose(rotation().reactionAt?.(e).radiance??0,.5,0)})]:[];},
   damageBuffs(r,e){
    const rot=rotation(),state=rot.characterState?.(role,e),reaction=rot.reactionAt?.(e),out=[];
    if(teamTalentUnlocked(c,1)&&['reaction.stellarConduct','reaction.superconduct'].includes(e.damageModel))out.push(effect('七七·七宝奉真',{[e.damageModel==='reaction.stellarConduct'?'EnhanceStellarSuperconduct':'EnhanceSuperconduct']:m.choose(state?.herald??0,m.choose(reaction.radiance,.5,0),0)}));
    if(r===role&&c.constellation>=2&&['normal','charged'].includes(e.category))out.push(effect('七七·冰寒蚀骨·冰附着',{BonusBase:m.choose(reaction?.targets[e.targetIds?.[0]??0].cryoAffected??0,.15,0)}));
    return out;
   },
   incoming(h,recipient){return m.choose(rotation().characterState?.(role,h)?.incoming[recipient]??0,.2,0);},
   healingBase(h,p,native){return h.healing==='qiqi.c4'?{amount:m.mul(1.8,sum(p.atk)),outgoing:sum(p.healing_bonus)}:native({'qiqi.periodic':14,'qiqi.attack':13,'qiqi.talisman':18}[h.healing]);},
  };
 },
 randomHealth:profile=>teamTalentUnlocked(profile.character,4),
 createHealth({role,profiles,base,settings,math:m,random}){
  const c=profiles[role].character,and=(a,b)=>m.choose(a,b,0),until=[],ready=[];let a4Ready=-Infinity;
  function heal(e,enqueue,healing,recipients,enabled,step,extra={}){if(typeof enabled!=='object'&&!enabled)return;enqueue({kind:'heal',role,time:e.time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+step,eventId:eventKey(e)+'/'+healing+'/'+step,parentEventId:eventKey(e),healing,recipients,enabled,label:healing==='qiqi.attack'?'寒病鬼差·命中治疗':healing==='qiqi.c4'?'七七·四命治疗':'度厄真符·治疗',...extra});}
  return {
   setup(queue){for(const a of base.roots)if(a.role===role&&a.kind==='cast'&&a.action==='burst')queue.push({kind:'character_health',role,time:actionTime(a.time+40/60),rootOrder:a.rootOrder+10,eventId:a.id+'/talisman',qiqiMark:true});},
   before(e,_save,enabled){if(e.role!==role||!e.qiqiMark)return;for(const id of hitTargets(e,settings))until[id]=m.choose(enabled,actionTime(e.time+15),until[id]??-Infinity);return true;},
   afterHit(e,enqueue){
    const gate=and(e.enabled??1,observeProcHit(e)),state=base.characterState(role,e),ownAttack=e.role===role&&['normal','charged'].includes(e.category);
    if(ownAttack){
     heal(e,enqueue,'qiqi.attack',profiles.map((_,i)=>i),and(gate,state.herald),1,{statSnapshot:state.snapshot});
     if(teamTalentUnlocked(c,4))for(const target of hitTargets(e,settings)){
      const active=and(gate,and(m.ge(e.time,a4Ready),m.lt(until[target]??-Infinity,actionTime(e.time+6)))),radiance=base.reactionAt(e).radiance;
      const won=random('health.qiqi.a4/'+base.slots[role]+'/'+eventKey(e)+'/'+target,and(active,m.choose(radiance,1,.5)),'七七·玉签偶开');
      a4Ready=m.choose(won,m.add(e.time,m.choose(radiance,15,30)),a4Ready);until[target]=m.choose(won,actionTime(e.time+6),until[target]??-Infinity);
     }
    }
    for(const [i,target]of hitTargets(e,settings).entries()){
     const enabled=and(gate,and(m.lt(e.time,until[target]??-Infinity),m.ge(e.time,ready[target]??-Infinity)));
     ready[target]=m.choose(enabled,actionTime(e.time+1),ready[target]??-Infinity);
     heal(e,enqueue,'qiqi.talisman',[e.role],enabled,2+i*2);
     if(c.constellation>=4)heal(e,enqueue,'qiqi.c4',profiles.map((_,r)=>r),enabled,3+i*2,{lowestOnly:true});
    }
   },
  };
 },
};
