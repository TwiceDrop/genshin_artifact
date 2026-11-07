import {effect,numericSum} from '../rule-utils.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {createMityaRuntime,MITYA_TIMING} from './mitya-runtime.mjs';
import {MITYA_BUFF_PARTS} from '../../preview-7201-buffs.mjs';
export const mitya={
 id:'Mitya',element:'Electro',weaponType:'Catalyst',panelIndex:9,reactionStatIndex:0,enablesStellarConduct:true,replacesStellarPrism:true,usesElementalApplications:true,
 nativeBackend:'extension',constellationTalents:{3:'skill2',5:'skill1'},defaultWeapon:'SacrificialFragments',previewWeapon:'ApprenticesNotes',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},isBlunt:e=>[5,6].includes(e.index),
 nativeDamage:Object.fromEntries(Array.from({length:16},(_,index)=>[index,{category:index<3?'normal':[3,7,8].includes(index)?'charged':index<7?'plunge':index===14?'burst':index===15?'other':'skill',element:'Electro',...(index>=4&&index<=6?{plungeImpact:index!==4}:{})}])),
 actions:[{id:'skill',label:'律定·变量侦测·点按／切换',endOffsetMs:MITYA_TIMING.tap*1000},{id:'skill.hold',label:'律定·变量侦测·长按',endOffsetMs:MITYA_TIMING.hold*1000},{id:'burst',label:'解析·递变之理',endOffsetMs:MITYA_TIMING.burst*1000},
  {id:'charged',label:'重击／递变聚爆',completionOffsetMs:p=>p?.holdMs??2800,parameters:[{key:'holdMs',label:'长按时长（秒）',min:1000,max:10000,scale:1000,step:.1,error:'长按时长须为1～10秒'}]},
  ...[1,2,3].map(n=>({id:'normal.'+n,label:'普通攻击·第'+n+'段'})),{id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'}],
 modeled:['MityaSupport',...Object.keys(MITYA_BUFF_PARTS)],
 // Native mode selects a formula only. Runtime owns the existence of each hit
 // and all party buffs. In mode 2/off-field, native C1/C2 are neutral.
 normalize:p=>{p.character.params={Mitya:{core_mode:2,beacons:1,crit_stacks:0,on_field:false,polestar:false,field_hits:0}};},
 expand({actions,hit}){for(const a of actions){if(['skill','burst','charged'].includes(a.action))continue;const index={'normal.1':0,'normal.2':1,'normal.3':2,'plunge.collision':4,'plunge.low':5,plunge:6}[a.action];hit(a,{index,category:index<3?'normal':'plunge',element:'Electro',application:index<3?application(1,'mitya.normal',3,2.5):index===4?null:application(),label:index<3?'普通攻击·第'+(index+1)+'段':'下落攻击'});}},
 createTimeline:createMityaRuntime,createCombat:createMityaRuntime,randomCombat:p=>p.character.constellation>=6,
 adjustNativeDamage({native,result,math:m,adjustSource}){
  if(!native.stellar_detail)return;
  const em=Object.values(result.em).reduce((n,v)=>m.add(n,v),0),before=native.stellar_detail.base_bonus['米提亚·星耀祝礼']??0,value=m.min(.14,m.mul(.00028,m.max(0,em)));
  result.direct_stellarconduct_base_compose.compiled=m.add(result.direct_stellarconduct_base_compose.compiled,m.sub(value,before));adjustSource?.('direct_stellarconduct_base_compose','米提亚·星耀祝礼',value,true);
 },
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {
   attackBuffs(r,e){const rot=rotation(),s=rot.characterState?.(role,e);if(!s)return [];const steady=m.eq(s.mode,1),live=m.gt(s.mode,0),front=rot.activeRole(e.time,e.rootOrder)===r;
    return [effect('米提亚·侦测炉心',{ElementalMastery:m.add(teamTalentUnlocked(c,1)?m.choose(steady,m.mul(30,s.beacons),0):0,c.constellation>=2?m.choose(steady,123,front?m.choose(live,234,0):0):0),CriticalDamageBase:c.constellation>=1&&front?m.choose(live,.4,0):0,CriticalBase:r===role?m.mul(.05,s.crit):0})];
   },
   damageBuffs(r,e,_p,source){const rot=rotation(),s=rot.characterState?.(role,e),out=[];
    if(c.constellation>=2)out.push(effect('米提亚·惰性之外的沉寂物',{ResMinusCryo:m.choose(s?m.gt(s.mode,0):0,m.mul(.2,rot.reactionAt(e).fieldActive),0),ResMinusElectro:m.choose(s?m.gt(s.mode,0):0,m.mul(.2,rot.reactionAt(e).fieldActive),0)}));
    if(e.damageModel==='reaction.stellarConduct'){
     if(r!==role)out.push(effect('米提亚·星耀祝礼',{StellarConductBaseBonus:m.min(.14,m.mul(.00028,sum(source(role).elemental_mastery))),StellarConductElevation:c.constellation>=6?.2:0}));
    }
    return out;
   },
  };
 },
};
