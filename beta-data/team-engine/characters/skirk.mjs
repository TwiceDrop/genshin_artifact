import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,hydroCryo,chronological,actionTime} from '../rule-utils.mjs';

export const skirk={
 id:'Skirk',element:'Cryo',panelIndex:9,separateAtkRatio:true,ratioLabel:'丝柯克·万流归寂',
 modeled:[],
 teamSkillLevels:elements=>hydroCryo(elements)===4?1:0,
 normalize:p=>{p.character.params={Skirk:{death_crossing_stacks:0,team_has_hydro_cryo:false,c2_atk_bonus:false}};},
 skillConfig:e=>({Skirk:{cunning_stacks:e.cunning??50,seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}}),
 expand({actions,profile,role,hit,addWindow,state,switches,resources,duration}){
  const a1=teamTalentUnlocked(profile.character,1),c=profile.character.constellation;
  const s=state('rift/'+role,()=>({sever:[],phaseEnd:Infinity,nextDrain:Infinity,nextPause:Infinity,pauseStacks:0,cunning:0}));
  const record=(a,label)=>resources.push({time:a.time,role,rootOrder:a.rootOrder,eventId:a.id,resource:'蛇之狡谋',value:s.cunning,pauseStacks:s.pauseStacks,label});
  const endWindow=(w,a)=>{if(w&&(a.time<w.end||a.time===w.end&&a.rootOrder<(w.endOrder??-Infinity))){w.end=a.time;w.endOrder=a.rootOrder;}};
  const closePhase=a=>{endWindow(s.phaseWindow,a);endWindow(s.qWindow,a);s.phaseWindow=null;s.qWindow=null;s.phaseEnd=Infinity;s.nextDrain=Infinity;};
  const exit=(a,label)=>{s.cunning=0;closePhase(a);record(a,label);};
  // Timers precede commands on their exact boundary. Pause expiry is
  // exclusive; a drain at that instant resumes before the next action.
  const advance=until=>{
   for(let time;(time=Math.min(s.nextPause,s.nextDrain,s.phaseEnd))<=until;){
    const tick={time,rootOrder:-1,id:(s.phaseRoot?.id??'skirk')+'/resource/'+time};
    if(time===s.phaseEnd)exit(tick,'七相一闪到期');
    if(time===s.nextPause){s.pauseStacks--;s.nextPause=s.pauseStacks?actionTime(time+.15):Infinity;}
    if(time===s.nextDrain){
     s.nextDrain=actionTime(time+.2);
     if(s.pauseStacks)record(tick,'吸收暂停消耗');
     else{s.cunning=Math.max(0,Math.round(s.cunning*10-14)/10);record(tick,'七相自然消耗');if(s.cunning===0)exit(tick,'资源耗尽·退出七相');}
    }
   }
  };
  const absorb=a=>{
   const count=a1?(a.params?.absorbedRifts??0):0;
   s.cunning=Math.min(100,s.cunning+8*count);
   if(count){if(!s.pauseStacks)s.nextPause=actionTime(a.time+.15);s.pauseStacks=Math.min(6,s.pauseStacks+2*count);}
   if(c>=1)for(let i=0;i<count;i++)hit(a,{index:17,category:'charged',parts:1,element:'Cryo',label:'一命·晶刃'},0,'c1/'+i,22);
   if(c>=6)s.sever=[...s.sever.filter(end=>a.time<end),...Array(count).fill(a.time+15)].slice(-3);
   if(count)record(a,'吸收裂隙');return count;
  };
  const sequence=[...actions,...switches.filter(e=>e.from===role&&e.role!==role)].sort(chronological);
  for(const a of sequence){
   advance(a.time);
   if(a.kind==='switch'){if(s.phaseWindow)exit(a,'离开七相一闪');continue;}
   if(a.action==='skill'){
    closePhase(a);
    s.cunning=Math.min(100,s.cunning+45+(c>=2?10:0));record(a,'施放元素战技');
    if(a.actionId==='skill.hold')absorb(a);
    else{
     const phase=addWindow('skirkPhase',a,12.5);s.phaseEnd=phase.end;s.phaseWindow=phase;s.phaseRoot=a;s.nextDrain=actionTime(a.time+.2);
    }
    continue;
   }
   const sevenPhase=!!s.phaseWindow;
   if(a.action==='burst'){
    if(sevenPhase){
     a.burstMode='extinction';a.completionTime=a.time;a.qRifts=absorb(a);
     endWindow(s.qWindow,a);
     const w=addWindow('skirkC2',a,12.5,0,{qRifts:a.qRifts});w.end=Math.min(w.end,s.phaseEnd);s.qWindow=w;
    }else{
     a.burstMode='ruin';a.completionTime=actionTime(a.time+158/60);const cunning=s.cunning;
     for(const [i,frame]of [109,111,114,125,135].entries())hit(a,{index:15,category:'burst',parts:1,part:i,element:'Cryo',cunning,skirkBurst:true,talentRatioFields:['蛇之狡谋加成'],label:'极恶技·灭·斩击'},frame/60,'burst/'+i);
     hit(a,{index:16,category:'burst',parts:1,element:'Cryo',cunning,skirkBurst:true,talentRatioFields:['蛇之狡谋加成'],label:'极恶技·灭·最终斩击'},158/60,'burst/final');
     if(c>=6)for(const [i]of s.sever.filter(end=>a.time<end).entries())hit(a,{index:15,category:'burst',parts:1,ratio:7.5,cunning:50,skirkBurst:true,element:'Cryo',label:'虚境裂隙·六命爆发追加'},.2,'burst/c6/'+i,21);
     s.sever=[];s.cunning=0;record(a,'元素爆发消耗');
    }
   }else{
    const charged=a.action==='charged',step=Number(a.action.split('.')[1]),index=charged?(sevenPhase?14:5):(sevenPhase?8+step:step-1);
    const parts=sevenPhase?(charged?3:[1,1,2,2,1][step-1]):1;
    hit(a,{index,parts,sevenPhase,category:charged?'charged':'normal',element:sevenPhase?'Cryo':'Physical',nativeElement:sevenPhase?null:'Physical',label:(sevenPhase?'七相一闪·':'普通形态·')+(charged?'重击':a.action)},0,a.action);
    if(c>=6&&a1&&sevenPhase&&['normal.3','normal.5'].includes(a.action)){
     s.sever=s.sever.filter(end=>a.time<end);
     if(s.sever.length){s.sever.shift();hit(a,{index:9,category:'normal',parts:1,hits:3,ratio:1.8,c6:true,element:'Cryo',label:'虚境裂隙·六命'},0,'c6',21);}
    }
    if(charged&&sevenPhase)absorb(a);
   }
  }
  // Resolve the final window even when there is no later Skirk command.
  // The scheduler clips resource traces to the actual axis end afterwards.
  advance(Math.max(duration,Number.isFinite(s.phaseEnd)?s.phaseEnd:0));
 },
 decorate({role,events,window,windows}){
  const uses=new Map();
  for(const e of events)if(e.role===role&&e.category==='normal'&&!e.c6){
   const cycle=window('skirkC2',e.time,e.rootOrder),used=uses.get(cycle)||0;
   e.qRifts=windows.skirkC2?.[cycle]?.qRifts??0;
   // Preserve the accepted same-time sub-hit model; Q starts the counter.
   e.qBonus=e.sevenPhase&&cycle>=0&&used<10;if(e.qBonus)uses.set(cycle,used+1);
  }
 },
 create({role,profiles,elements,rotation}){
  const c=profiles[role].character,a1=teamTalentUnlocked(c,1),a4=teamTalentUnlocked(c,4);
  const stacks=e=>rotation().model==='actions'?profiles.filter((_,r)=>r!==role&&['Hydro','Cryo'].includes(elements[r])&&rotation().events.some(h=>h.role===r&&(h.element??elements[r])===elements[r]&&h.time<=e.time&&e.time<h.time+20)).length:3;
  return {
   prepare(p,e){p.character.params.Skirk.c2_atk_bonus=c.constellation>=2&&rotation().covered('skirkC2',e.time,e.rootOrder);},
   attackBuffs(r,e){return r===role&&a4&&c.constellation>=4&&(rotation().model==='actions'||rotation().covered('skirkC2',e.time))?[effect('丝柯克·四命',{ATKPercentage:[0,.1,.2,.4][stacks(e)]})]:[];},
   damageBuffs(r,e){
    const level=c.skill3+1,rifts=rotation().model==='actions'?e.qRifts:(a1?3:0);
    const bonus=[.03+.005*level,.06+.006*level,.08+.008*level,.1+.01*level][rifts];
    return r===role&&e.qBonus?[effect('丝柯克·凋尽',{BonusBase:bonus})]:[];
   },
   multiplier:e=>a4?(e.skirkBurst?[1,1.05,1.15,1.6][stacks(e)]:e.category==='normal'&&(rotation().model!=='actions'||e.sevenPhase||e.c6)?[1,1.1,1.2,1.7][stacks(e)]:1):1,
  };
 },
};
