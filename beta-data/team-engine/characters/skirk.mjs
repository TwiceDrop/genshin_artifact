import {createSkirkRuntime} from './skirk-runtime.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,hydroCryo,actionTime} from '../rule-utils.mjs';
import {compareEventPosition} from '../event-order.mjs';
import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {percent} from '../buff-preview-format.mjs';
import {skirkExtinctionUses} from './skirk-hit-runtime.mjs';

const rifts={key:'absorbedRifts',label:'吸收裂隙',min:0,max:3,integer:true,step:1,help:'本次动作吸收的裂隙数量，0～3个',error:'裂隙吸收数量无效'};
const extinctionBonuses=level=>[.03+.005*level,.06+.006*level,.08+.008*level,.1+.01*level];
const normalTiers=[1,1.1,1.2,1.7],burstTiers=[1,1.05,1.15,1.6],c4AttackTiers=[0,.1,.2,.4];

export const skirk={
 id:'Skirk',element:'Cryo',panelIndex:9,reactionStatIndex:0,usesElementalApplications:true,separateAtkRatio:true,ratioLabel:'丝柯克·万流归寂',
 nativeBackend:'legacy',constellationTalents:{3:'skill3',5:'skill2'},
 isBlunt:e=>[7,8].includes(e.index),
 nativeDamage:{
  ...Object.fromEntries([0,1,2,3,4,9,10,11,12,13].map(index=>[index,{category:'normal',element:'Cryo'}])),
  ...Object.fromEntries([5,14,17].map(index=>[index,{category:'charged',element:'Cryo'}])),
  ...Object.fromEntries([6,7,8].map(index=>[index,{category:'plunge',element:'Physical',plungeImpact:index!==6}])),
  15:{category:'burst',element:'Cryo'},16:{category:'burst',element:'Cryo'},
 },
 nativeParameters:{
  'skill.config.Skirk.cunning_stacks':{zero:50,unit:51,constantFields:['atk_ratio'],constantTerms:{atk_ratio:['蛇之狡谋加成']}},
  'character.params.Skirk.c2_atk_bonus':{zero:false,unit:true},
 },
 defaultWeapon:'Azurelight',previewWeapon:'DullBlade',
 capabilities:{energy:0,shield:false,nightsoul:false,arkhe:false},
 actions:[
  {id:'skill',label:'元素战技·点按'},
  {id:'skill.hold',label:'元素战技·长按',parameters:[rifts]},
  {id:'burst',label:'元素爆发',parameters:[rifts],endOffsetMs:158/60*1000},
  ...Array.from({length:5},(_,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'式'})),
  {id:'charged',label:'重击',parameters:[rifts]},
  {id:'plunge',label:'高空下落攻击'},
  {id:'plunge.low',label:'低空下落攻击'},
  {id:'plunge.collision',label:'下落期间伤害'},
 ],
 modeled:[],
 previewBuffDetails(key,{profile,window,api}){
  const c=profile.character;
  if(key==='skirkPhase')return ['普通攻击、重击与下落攻击造成冰元素伤害，使用元素战技倍率',
   ...(teamTalentUnlocked(c,4)?[`死河渡断 0／1／2／3 层时，普通攻击伤害倍率为 ${normalTiers.map(percent).join('／')}`]:[])];
  if(key==='skirkC2'){
   const lines=[`凋尽：七相一闪普通攻击伤害提高 ${percent(extinctionBonuses(c.skill3+1)[window.qRifts])}（吸收 ${window.qRifts} 个裂隙）`,`最多 ${skirkExtinctionUses} 次普攻命中生效`];
   if(c.constellation>=2){
    const attributes=active=>api.CommonInterface.get_attribute({...profile,character:{...c,params:{Skirk:{...c.params.Skirk,c2_atk_bonus:active}}}}).atk;
    const before=attributes(false),after=attributes(true),sum=values=>Object.values(values).reduce((a,b)=>a+b,0);
    lines.push(`二命：攻击力提高 ${percent((sum(after)-sum(before))/(before['角色基础攻击']+before['武器基础攻击']))}`);
   }
   return lines;
  }
  return [];
 },
 // Hold duration is player-controlled and is not present in the axis input.
 castFrames:(a,rotation)=>a.actionId==='skill.hold'?undefined:a.action==='skill'?43:a.action==='burst'?(rotation.covered('skirkPhase',a.time,a.rootOrder)?41:151):undefined,
 teamSkillLevels:elements=>hydroCryo(elements)===4?1:0,
 normalize:p=>{p.character.params={Skirk:{death_crossing_stacks:0,team_has_hydro_cryo:false,c2_atk_bonus:false}};},
 // The symbolic binding weights the 50→51 native delta with clamped excess.
 // Direct native calls continue to receive the actual resource balance.
 // 蛇之狡谋在引擎里按 0.1 点流失，原生内核只收整数点数（每满 1 点算一份加成），向下取整（开发者 2026-11-17 确认）
 skillConfig:e=>({Skirk:{cunning_stacks:typeof e.cunningBonus==='object'?e.cunningBonus:Math.floor(e.cunning??50),seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}}),
 expand(){},
 createTimeline:ctx=>createSkirkRuntime({...ctx,catalog:skirk.actions}),
 createCombat:ctx=>createSkirkRuntime({...ctx,catalog:skirk.actions}),
 combatCompletion:a=>a.kind==='cast'&&a.action==='burst'?actionTime(a.time+158/60):undefined,
 create({role,profiles,elements,rotation,math:m=scalarMath}){
  const c=profiles[role].character,a1=teamTalentUnlocked(c,1),a4=teamTalentUnlocked(c,4);
   const stacks=e=>rotation().model==='actions'?profiles.reduce((n,_,r)=>r===role||!['Hydro','Cryo'].includes(elements[r])?n:m.add(n,rotation().events.filter(h=>h.role===r&&(h.element??elements[r])===elements[r]&&compareEventPosition(h,e)<=0&&e.time<h.time+20).reduce((v,h)=>m.max(v,h.enabled??1),0)),0):3;
   const tier=(values,e)=>{const count=stacks(e);return values.reduce((v,value,i)=>m.choose(m.eq(count,i),value,v),values[0]);};
  return {
   prepare(p,e){
    const active=c.constellation>=2&&rotation().covered('skirkC2',e.time,e.rootOrder);
    p.character.params.Skirk.c2_atk_bonus=typeof active==='object'?active:!!active;
    // The shared native plunge formula reads skill1. In Seven-Phase Flash
    // its talent level comes from skill2, including the team's skill bonus.
    if(e.category==='plunge'&&e.sevenPhase)p.character.skill1=c.skill2;
   },
    attackBuffs(r,e){return r===role&&a4&&c.constellation>=4&&(rotation().model==='actions'||rotation().covered('skirkC2',e.time))?[effect('丝柯克·四命',{ATKPercentage:tier(c4AttackTiers,e)})]:[];},
   damageBuffs(r,e){
    const level=c.skill3+1,rifts=rotation().model==='actions'?e.qRifts:(a1?3:0);
    const bonus=extinctionBonuses(level).reduce((v,b,i)=>m.choose(m.eq(rifts,i),b,v),0);
    return r===role&&(typeof e.qBonus==='object'||e.qBonus)?[effect('丝柯克·凋尽',{BonusBase:m.mul(e.qBonus,bonus)})]:[];
   },
    multiplier:e=>a4?(e.skirkBurst?tier(burstTiers,e):e.category==='normal'&&(rotation().model!=='actions'||e.sevenPhase||e.c6)?tier(normalTiers,e):1):1,
  };
 },
};
