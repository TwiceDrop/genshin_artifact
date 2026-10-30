import {effect,chronological,actionTime} from '../rule-utils.mjs';

const omenDuration=level=>[4,4,4,4.5,4.5,4.5,5,5,5,5,5,5,5,5,5][level];
const omenBonus=level=>[.42,.44,.46,.48,.5,.52,.54,.56,.58,.6,.6,.6,.6,.6,.6][level];
export const mona={
 id:'Mona',element:'Hydro',panelIndex:10,
 modeled:['MonaQ','MonaC1','MonaC2','MonaMagusGlow'],
 normalize:p=>{p.character.params='NoConfig';},
 skillConfig:e=>({Mona:{c6_charged_stack:e.monaC6Stacks??0,c6_omen:e.monaC6Omen??false}}),
 expand({actions,hit,profile,addWindow}){
  const skills=actions.filter(a=>a.action==='skill');
  for(const [i,a]of skills.entries()){
   const first=a.actionId==='skill.hold'?101:86,next=skills[i+1];
   a.completionTime=a.time;
   for(const [j,frame]of [first,first+59,first+118,first+177,first+243].entries()){
    const time=actionTime(a.time+frame/60);
    if(next&&chronological({time,rootOrder:a.rootOrder+20},next)>=0)continue;
    a.completionTime=time;
    hit(a,{index:j===4?9:8,category:'skill',parts:1,element:'Hydro',statSnapshot:{time:a.time,rootOrder:a.rootOrder,onField:true},label:j===4?'水中幻愿·爆裂':'水中幻愿·持续伤害'},frame/60,'phantom/'+j);
   }
  }
  for(const a of actions.filter(a=>a.action==='charged')){
   hit(a,{index:4,category:'charged',parts:1,element:'Hydro',label:'重击'},0,'charged');
   if(profile.character.constellation>=2)addWindow('monaC2',a,12);
  }
 },
 derive({actions,profile,events,hit,addWindow}){
  const bursts=actions.filter(a=>a.action==='burst');
  for(const [i,a]of bursts.entries()){
   const deadline=actionTime(a.time+8),next=bursts[i+1];
   const trigger=a.params?.bubbleDelayMs===undefined?events.filter(e=>chronological(e,a)>0&&e.time<=deadline).sort(chronological)[0]:null;
   const pop=trigger?trigger.time:actionTime(a.time+(a.params?.bubbleDelayMs??8000)/1000),popOrder=trigger?.rootOrder??a.rootOrder+19;
   const replaced=next&&chronological(next,{time:pop,rootOrder:popOrder})<0;
   const end=replaced?next.time:actionTime(pop+omenDuration(profile.character.skill3));
   addWindow('monaOmen',a,end-a.time,0,replaced?{endOrder:next.rootOrder}:{});
   // A new Q replaces an unbroken bubble. Otherwise its own delayed damage,
   // not the subsequent Omen duration, determines this action's completion.
   a.completionTime=replaced?a.time:actionTime(pop+1/60);
   if(!replaced)hit(a,{index:10,category:'burst',parts:1,element:'Hydro',monaBubble:true,label:'星命定轨·泡影破裂'},a.completionTime-a.time,'bubble');
  }
 },
 decorate({role,profile,events,windows,activeRole,covered}){
  if(profile.character.constellation<6)return;
  // Theoretical axis: one stack per second near Omen. The ticker continues
  // off field, but only grants stacks on field; a charged hit consumes them.
  const spans=[];
  for(const w of windows.monaOmen??[]){
   const last=spans.at(-1);
   if(last&&w.start<=last.end)last.end=Math.max(last.end,w.end);
   else spans.push({start:w.start,end:w.end});
  }
  const lastHit=events.at(-1)?.time??0,ticks=[];
  for(const w of spans)for(let time=actionTime(w.start+1);time<w.end&&time<=lastHit;time=actionTime(time+1))ticks.push({time,rootOrder:-Infinity,tick:true});
  let stacks=0,expiry=-Infinity;
  for(const e of [...ticks,...events.filter(e=>e.role===role&&e.category==='charged')].sort(chronological)){
   if(e.time>=expiry)stacks=0;
   if(e.tick){if(activeRole(e.time,e.rootOrder)===role){stacks=Math.min(3,stacks+1);expiry=actionTime(e.time+8);}}
   else{e.monaC6Stacks=stacks;e.monaC6Omen=covered('monaOmen',e.time,e.rootOrder);stacks=0;}
  }
 },
 create({role,profiles,rotation}){
  const c=profiles[role].character;
  return {attackBuffs(r,e){return c.constellation>=2&&rotation().covered('monaC2',e.time,e.rootOrder)?[effect('莫娜·星月的连珠',{ElementalMastery:80})]:[];},damageBuffs(r,e){
   if(!rotation().covered('monaOmen',e.time,e.rootOrder))return [];
   return [effect('莫娜·星异',{BonusBase:omenBonus(c.skill3)})];
  },criticalBuffs:e=>c.constellation>=4&&rotation().covered('monaOmen',e.time,e.rootOrder)?[effect('莫娜·灭绝的预言',{CriticalBase:.15,...(e.role===role?{CriticalDamageBase:.15}:{})})]:[]};
 },
};
