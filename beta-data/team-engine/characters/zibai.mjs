import {castFrameTable} from '../cast-frame-table.mjs';
import {createZibaiRuntime} from './zibai-runtime.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum} from '../rule-utils.mjs';
import {isMoonCrystallize,hasAscendantGleam} from '../moon-crystallize.mjs';

export const zibai={
 castFrames:castFrameTable({skill:52,'skill.cycle':52,stride:61,burst:103,charged:72},[40,36,45,67]),
 id:'Zibai',element:'Geo',weaponType:'Sword',panelIndex:8,reactionStatIndex:14,nativeBackend:'legacy',usesElementalApplications:true,enablesLunarCrystallize:true,moonsign:true,
 defaultWeapon:'DullBlade',previewWeapon:'DullBlade',capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},constellationTalents:{3:'skill2',5:'skill3'},
 nativeDamage:Object.fromEntries(Array.from({length:18},(_,i)=>[i,{category:i<4||i>=8&&i<=11?'normal':i===4||i===12?'charged':i<8?'plunge':i<=15?'skill':'burst',element:i<8?'Physical':'Geo',...(i>=5&&i<=7?{plungeImpact:i!==5}:{})}])),
 actions:[{id:'skill',label:'天地忽然身'},{id:'skill.cycle',label:'天地忽然身·循环起点'},{id:'stride',label:'灵驹飞踏',endOffsetMs:34/60*1000},{id:'burst',label:'三垣威仪法',endOffsetMs:1800},
  ...[1,2,3,4].map(i=>({id:'normal.'+i,label:'普通攻击·第'+i+'段',endOffsetMs:[11,12,27,47][i-1]/60*1000})),{id:'charged',label:'重击',endOffsetMs:32/60*1000},{id:'plunge.collision',label:'下落期间伤害'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge',label:'高空下落攻击'}],
 combatCompletion:e=>e.action==='stride'||e.action==='charged'||e.action?.startsWith('normal.')?e.time:undefined,
 expand(){},createTimeline:ctx=>createZibaiRuntime({...ctx,previewWindow:ctx.addWindow}),createCombat:createZibaiRuntime,
 nativeParameters:{'character.params.Zibai.interval_mode':{zero:false,unit:true,values:[0,1]},'character.params.Zibai.c1_rate':{constantFields:['direct_mooncrystallize_compose']},'skill.config.Zibai.c1_rate':{constantFields:['direct_mooncrystallize_compose']},'character.params.Zibai.c6_light_excess':{constantFields:['elevate_mooncrystallize_compose']},'character.params.Zibai.kick2_rate':{constantFields:['direct_mooncrystallize_extra_def_ratio']},'character.params.Zibai.c2_talent2_rate':{constantFields:['direct_mooncrystallize_extra_def_ratio']},'character.params.Zibai.c4_rate':{constantFields:['direct_mooncrystallize_ratio']}},
 modeled:['ZibaiTalent1','ZibaiC2'],
 normalize(p){p.character.params={Zibai:{interval_mode:false,talent1_enabled:false,other_geo:0,hydro:0,kick2_rate:0,c1_rate:0,c2_talent2_rate:0,c4_rate:0,c6_light_excess:0}};},
 skillConfig:e=>({Zibai:{c1_rate:e.initialStride??0}}),
 create({role,elements,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m),full=hasAscendantGleam(profiles);
  const phase=e=>rotation().characterState(role,e)?.phase??0;
  return {prepare(p,e){
   const params=p.character.params.Zibai,lastE=rotation().lastCast(role,'skill',e.time,e.rootOrder);
   const mode=e.zibaiPhase??phase(e);params.interval_mode=typeof mode==='object'?mode:!!mode;params.other_geo=elements.filter(el=>el==='Geo').length-1;params.hydro=elements.filter(el=>el==='Hydro').length;
   const blessing=m.max(Number(e.time-lastE<4),rotation().reactionAt?.(e).selenicDescent??0);
   params.kick2_rate=teamTalentUnlocked(c,1)?blessing:0;params.c2_talent2_rate=full?params.kick2_rate:0;
   params.c1_rate=e.initialStride??0;params.c4_rate=e.c4Bonus??0;
   params.c6_light_excess=e.zibaiExcess??rotation().characterState(role,e)?.excess??0;
  },damageBuffs(r,e,_panels,source){
   if(!isMoonCrystallize(e))return [];
   const values={EnhanceMoonCrystallizeBase:m.min(.14,m.mul(.00007,sum(source(role).def)))};
   if(c.constellation>=2&&r!==role)values.EnhanceMoonCrystallize=m.mul(.3,phase(e));
   return [effect('兹白·浮明若流',values)];
  }};
 },
};
