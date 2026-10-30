import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

const precision=[.1166,.1272,.1378,.1484,.159,.1696,.1802,.1908,.2014,.212,.2247,.2374,.2502,.2629,.2756];
export const alyosha={
 id:'Alyosha',element:'Electro',weaponType:'Polearm',panelIndex:9,
 modeled:['AlyoshaHunterPrecision'],
 normalize:p=>{p.character.params={Alyosha:{hunter_precision_stacks:0,stellar_conduct_state:false}};},
 expand({actions,profile,hit,periodic}){
  for(const a of actions){
   if(a.action==='skill'){
    const hold=a.actionId==='skill.hold',offset=(hold?113:18)/60;
    a.completionTime=actionTime(a.time+offset);
    hit(a,{index:hold?10:9,category:'skill',application:application(),alyoshaMark:'apply',label:hold?'伏袭霆击·长按':'伏袭霆击·点按'},offset,'skill');
   }else if(a.action==='burst'){
    const life=14+(profile.character.constellation>=2?6:0);
    periodic(a,{duration:life,start:79/60,offsetAt:i=>(79+i*118)/60},(offset,end)=>{
     hit(a,{index:11,category:'burst',application:application(1,'alyosha.burst',2,1.6),alyoshaField:true,persistent:true,label:'轰霆猎场'},offset,'field/'+offset);
     if(actionTime(a.time+offset+39/60)<end)hit(a,{index:12,category:'burst',application:application(1,'alyosha.burst',2,1.6),alyoshaDog:true,persistent:true,label:'图加林'},offset+39/60,'tugarin/'+offset);
    });
   }else{
    const indices={'normal.1':[0],'normal.2':[1],'normal.3':[2,3],'normal.4':[4],charged:[5],'plunge.collision':[6],'plunge.low':[7],plunge:[8]}[a.action];
    indices.forEach((index,i)=>hit(a,{index,category:a.action.startsWith('normal')?'normal':a.action.startsWith('plunge')?'plunge':'charged',element:'Physical',application:null,alyoshaMark:index===4?'apply':null,label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':a.action==='charged'?'重击':'下落攻击'},i/20,a.action+'/'+i));
   }
  }
 },
 createCombat({role,profile,profiles,settings,reactions,schedule,addHeal,activeRole}){
  const c=profile.character,s={marks:Array(settings.enemy_count??1).fill(-Infinity),stacks:0,precisionUntil:-Infinity};
  function activate(time,targets,canApply){
   if(time>=s.precisionUntil)s.stacks=0;
   for(const target of targets){
    if(time<s.marks[target]){s.marks[target]=-Infinity;s.stacks=Math.min(c.constellation>=6?2:1,s.stacks+1);s.precisionUntil=actionTime(time+15);}
    else if(canApply)s.marks[target]=actionTime(time+15);
   }
  }
  return {state:s,afterHit(e){
   if(e.role!==role)return;
   const targets=reactions.targetIds(e);
   // gcsim's documented in-game observation places C2's non-activating mark
   // on the hunting-field hit, before the following Tugarin bite.
   if(e.alyoshaField&&c.constellation>=2&&targets.length)s.marks[targets[0]]=actionTime(e.time+15);
   if(e.alyoshaMark||e.alyoshaDog)schedule({time:actionTime(e.time+.1),rootOrder:e.rootOrder,role,combatKind:'state',run:()=>activate(actionTime(e.time+.1),targets,!!e.alyoshaMark)});
   if(e.alyoshaDog){
    if(teamTalentUnlocked(c,1))addHeal(e,{role,recipients:[activeRole(e.time,e.rootOrder)],healing:'alyosha.a1',label:'阿罗夏·图加林治疗'});
    if(c.constellation>=4)addHeal(e,{role,recipients:profiles.map((_,i)=>i),lowestOnly:true,healing:'alyosha.c4',label:'阿罗夏·四命治疗'});
   }
  }};
 },
 create({role,profiles,rotation}){
  const c=profiles[role].character;
  return {attackBuffs(r,e){
   const rot=rotation(),combat=rot.combatAt(e),s=combat.states[role];
   if(e.time>=s.precisionUntil||rot.activeRole(e.time,e.rootOrder)!==r)return [];
   const count=s.stacks??0;
   return count?[effect('阿罗夏·猎者之准',{ATKPercentage:precision[c.skill2]*count,ElementalMastery:c.constellation>=6&&count===2?100:0,EnhanceStellarSuperconduct:combat.reaction.radiance?.2*count:0})]:[];
  },healingBase:(h,p,native)=>native(h.healing==='alyosha.c4'?14:13)};
 },
};
