import {TEAM_DPS_CHARACTER_CAPABILITIES} from './team-dps-config.mjs';
import characters from '../src/assets/_gen_character.js';
import {equipmentWeakpoint} from './equipment-combat-facts.mjs';
import {equipmentHealingDamage} from './equipment-healing-damage-rules.mjs';
import {scalarMath} from './team-dps-numeric-rules.mjs';
// Equipment damage and healing accumulators are shared by all imported axes.
// healAmount is evaluated from the current candidate team's public kernel.
// Exact probability mass over the cooldown's next-ready time. Failure leaves
// the weapon ready; a successful trial starts its cooldown. No random seed,
// "half a proc every CD", or guaranteed first proc is used.
export function procProbabilities(hits,chance,cooldown){
 let states=new Map([[-Infinity,1]]);const out=[];
 for(const h of hits){
  let ready=0;const next=new Map();
  for(const [time,mass]of states)if(time<=h.time)ready+=mass;else next.set(time,mass);
  const probability=ready*chance;
  next.set(-Infinity,ready-probability);
  if(probability){const time=h.time+cooldown;next.set(time,(next.get(time)||0)+probability);out.push({...h,probability});}
  states=next;
 }
 return out;
}
// Both outcomes start the 0.2s trial cooldown. Successful trials also buff
// hits within 0.05s; those hits neither reroll nor extend the active window.
export function echoesProbabilities(hits){
 let mass=[1,0,0,0,0],ready=-Infinity,expires=-Infinity,success=0;
 const out=new Map();
 for(const h of hits){
  if(h.time>=ready-1e-9){
   const next=[0,0,0,0,0];success=0;
   for(let k=0;k<mass.length;k++){
    const chance=Math.min(1,.36+.2*k),won=mass[k]*chance;
    success+=won;next[0]+=won;
    // Off-field normals can trigger, but failures do not build stacks.
    next[h.onField?Math.min(4,k+1):k]+=mass[k]-won;
   }
   mass=next;ready=h.time+.2;expires=h.time+.05;
  }
  out.set(h.order,h.time<expires-1e-9?success:0);
 }
 return out;
}
const weaponProc=(h,data)=>({...h,...data,time:h.time+1/60,rootOrder:h.rootOrder,order:h.order+.5,snapshot:{...h,order:h.order+.5}});
export function equipmentDamageEvents(profiles,builds,rotation,healAmount,settings={},execution={}){
 const m=execution.math||scalarMath;
 const sets=builds.map(b=>{const x={};for(const a of b)x[a.set_name]=(x[a.set_name]||0)+1;return x;});
 const has=(r,name)=>m.ge(execution.setCount?execution.setCount(r,name):(sets[r][name]||0),4);
 const {waves,procs,flat}=equipmentHealingDamage(profiles,rotation,healAmount,has,settings,m),echoes=new Map();
 for(let r=0;r<profiles.length;r++){
  const echo=has(r,'EchoesOfAnOffering');
  if(typeof echo==='object'||echo)for(const [order,probability]of echoesProbabilities(rotation.events.filter(h=>h.role===r&&h.category==='normal')))echoes.set(order,m.choose(echo,probability,0));
  const {name,refine}=profiles[r].weapon,hits=rotation.events.filter(h=>h.role===r&&h.onField);
  const nc=hits.filter(h=>['normal','charged'].includes(h.category)),ncp=hits.filter(h=>['normal','charged','plunge'].includes(h.category));
  if(name==='Messenger')for(const h of procProbabilities(hits.filter(h=>equipmentWeakpoint(profiles[r],h)),1,10))procs.push(weaponProc(h,{ratio:.75+.25*refine,stat:'atk',label:'信使·飞矢传书',forceCritical:true,targetCount:1}));
  if(name==='SkywardSpine')for(const h of procProbabilities(nc,.5,2))procs.push(weaponProc(h,{ratio:.25+.15*refine,stat:'atk',label:'天空之脊·真空刃'}));
  if(['Frostbearer','DragonspineSpear'].includes(name))for(const h of procProbabilities(nc,.5+.1*refine,10))procs.push(weaponProc(h,{ratio:profiles.some(p=>characters[p.character.name].element==='Cryo')?1.6+.4*refine:.65+.15*refine,stat:'atk',label:(name==='Frostbearer'?'忍冬之果':'龙脊长枪')+'·恒冰晶核'}));
  if(name==='Halberd')for(const h of procProbabilities(hits.filter(h=>h.category==='normal'),1,10))procs.push(weaponProc(h,{ratio:1.2+.4*refine,stat:'atk',label:'钺矛·追加攻击'}));
  if(name==='PrizedIsshinBlade')for(const h of procProbabilities(ncp,1,8))procs.push(weaponProc(h,{ratio:1.8,stat:'atk',label:'「一心传」名刀·祟灵'}));
  if(name==='SwordOfNarzissenkreuz'&&!TEAM_DPS_CHARACTER_CAPABILITIES[profiles[r].character.name]?.arkhe&&settings.narzissenkreuz_enabled!==false)for(const h of procProbabilities(ncp,1,12))procs.push({...weaponProc(h,{ratio:1.2+.4*refine,stat:'atk',label:'水仙十字之剑·荒芒冲击'}),time:h.time+.1});
  if(name==='SkywardAtlas')for(const h of procProbabilities(hits.filter(h=>h.category==='normal'),.5,30))for(let i=1;i<=6;i++)procs.push({...weaponProc(h,{ratio:1.2+.4*refine,stat:'atk',label:'天空之卷·浮游攻击',targetCount:1}),time:h.time+i*147/60+10/60,order:h.order+.5+i/100});
  if(name==='EyeOfPerception')for(const h of procProbabilities(nc,.5,13-refine)){
   const ready=Array(settings.enemy_count??1).fill(-Infinity);let time=h.time;
   for(let i=0;i<5;i++){const target=ready.findIndex(t=>t<=time);if(target<0)break;ready[target]=time+.6;time+=10/60;
    if(settings.damage_scope==='all'||target===0)procs.push({...weaponProc(h,{ratio:2.1+.3*refine,stat:'atk',label:'昭心·昭心法球',targetCount:1}),time,order:h.order+.5+i/100});
   }
  }
  if(name==='FilletBlade')for(const h of procProbabilities(hits,.5,16-refine))procs.push(weaponProc(h,{ratio:2+.4*refine,stat:'atk',label:'吃虎鱼刀·决'}));
  if(name==='SwordOfDescension')for(const h of procProbabilities(hits.filter(h=>['normal','charged'].includes(h.category)),.5,10))procs.push(weaponProc(h,{ratio:2,stat:'atk',label:'降临之剑·降世'}));
  let last=-Infinity,harmonics=[];
  for(const h of hits){
   let ratio,stat='atk',label;
   if(name==='SkywardBlade'&&['normal','charged'].includes(h.category)&&h.time<rotation.lastCast(r,'burst',h.time,h.rootOrder)+12){ratio=.15+.05*refine;label='天空之刃·破空之势';}
   if(name==='CursedBlade'&&['normal','charged','plunge'].includes(h.category)&&h.time>=last+8){last=h.time;ratio=1.8;label='笼钓瓶一心·切落风';}
   if(name==='AshGravenDrinkingHorn'&&h.time>=last+15){last=h.time;ratio=.3+.1*refine;stat='hp';label='苍纹角杯·范围伤害';}
   if(name==='TheFlute'&&['normal','charged'].includes(h.category)&&h.time>=last+.5){
    last=h.time;harmonics=harmonics.filter(t=>h.time<t+30);harmonics.push(h.time);
    if(harmonics.length===5){harmonics=[];ratio=.75+.25*refine;label='笛剑·和音';}
   }
   if(ratio!==undefined)procs.push(['SkywardBlade','CursedBlade'].includes(name)?weaponProc(h,{ratio,stat,label}):{...h,role:r,rootOrder:h.rootOrder,order:h.order+.5,ratio,stat,label});
  }
 }
 return {flat,echoes,procs:procs.filter(p=>p.time<rotation.duration||(p.time===rotation.duration&&rotation.endHit==='include')).sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||a.order-b.order),waves};
}
