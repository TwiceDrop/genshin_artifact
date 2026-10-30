import {createFurinaHitRuntime} from './furina-hit-runtime.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {createTeamNumericRules} from '../../team-dps-numeric-rules.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';

const infusedDamage=(category,plungeImpact=false)=>({input})=>({category,plungeImpact,element:input.skill.config.Furina.c6_after_e?'Hydro':'Physical'});

export const furina={
 id:'Furina',element:'Hydro',panelIndex:9,hpRatioLabel:'芙宁娜·六命始基力追加',
 nativeBackend:'legacy',constellationTalents:{3:'skill3',5:'skill2'},
 nativeDamage:{
  ...Object.fromEntries([0,1,2,3].map(index=>[index,infusedDamage('normal')])),
  4:infusedDamage('charged'),5:infusedDamage('plunge'),6:infusedDamage('plunge',true),7:infusedDamage('plunge',true),
  // The native Arkhe formula defaults to Physical; actual Arkhe hits supply
  // nativeElement:Hydro independently of the C6 infusion state.
  8:{category:'normal',element:'Physical'},
  ...Object.fromEntries([9,10,11,12].map(index=>[index,{category:'skill',element:'Hydro'}])),
  13:{kind:'healing'},14:{category:'burst',element:'Hydro'},
 },
 adjustNativeDamage({input,event,fixed,native,result,math:m,adjustSource}){
  if(![10,11,12].includes(event.index))return;
  const talent=native.hp_ratio['技能倍率'],count=input.skill.config.Furina.hp_above50_count;
  result.hp_ratio.compiled=m.add(result.hp_ratio.compiled,m.mul(talent*.1,m.sub(count,fixed.skill.config.Furina.hp_above50_count)));
  adjustSource?.('hp_ratio','「沙龙成员」加成',m.mul(talent*.1,m.sub(count,fixed.skill.config.Furina.hp_above50_count)));
  const original=native.bonus['天赋「无人听的自白」'];
  if(original!==undefined)result.bonus.compiled=m.add(m.sub(result.bonus.compiled,original),m.min(.28,m.mul(.007,m.floor(m.div(result.hp.compiled,1000)))));
  if(original!==undefined)adjustSource?.('bonus','天赋「无人听的自白」',m.min(.28,m.mul(.007,m.floor(m.div(result.hp.compiled,1000)))),true);
 },
 defaultWeapon:'SplendorOfTranquilWaters',previewWeapon:'DullBlade',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:true},
 actions:[
  {id:'skill',label:'孤心沙龙',endOffsetMs:300},
  {id:'burst',label:'万众狂欢',endOffsetMs:2000},
  ...Array.from({length:4},(_,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段',endOffsetMs:500})),
  {id:'charged',label:'重击·切换荒芒'},
  {id:'plunge',label:'高空下落攻击'},
  {id:'plunge.low',label:'低空下落攻击'},
  {id:'plunge.collision',label:'下落期间伤害'},
 ],
 modeled:['FurinaQ'],
 normalize:p=>{p.character.params={Furina:{q_enable:false,q_fanfare:0,c2_overflow:0}};},
 skillConfig:(e,rot)=>({Furina:{hp_above50_count:e.hpDrain?rot.salonCounts.get(e.salonKey??e.order):0,c6_after_e:!!e.furinaC6,c6_pneuma:!!e.furinaC6&&e.arkhe==='pneuma'&&!e.arkheStrike&&!e.plungeCollision}}),
 hitElement:e=>['normal','charged','plunge'].includes(e.category)&&!e.furinaC6?'Physical':'Hydro',
 // Mean 60fps clocks and projectile delays from gcsim's measured Salon data.
 timing:{salon:{duration:30},bubble:.3,burstHit:2},
 expand(ctx){
  const {actions,hit,addWindow,hpDrains,duration}=ctx;
  let arkhe='ousia',expires=-Infinity,segment=null;const segments=[],arkheReady={ousia:-Infinity,pneuma:-Infinity};
  const replace=(a,start)=>{
   if(segment){segment.end=Math.min(segment.end,a.time);segment.endOrder=a.rootOrder+30;}
   segment=null;
   if(a.time<expires){segment={origin:a,start,end:expires,endOrder:-Infinity,arkhe};segments.push(segment);}
  };
  for(const a of actions){
   a.arkhe=arkhe;
   if(a.action==='skill'){
    expires=actionTime(a.time+30);replace(a,actionTime(a.time+(arkhe==='ousia'?.3:10/60)));
    a.completionTime=actionTime(a.time+(arkhe==='ousia'?.3:0));
    if(arkhe==='ousia')hit(a,{index:9,category:'skill',parts:1,arkhe,label:'荒性泡沫'},furina.timing.bubble,'bubble');
   }else if(a.action==='burst'){addWindow('fanfare',a,18);hit(a,{index:14,category:'burst',parts:1,label:'万众狂欢'},furina.timing.burstHit,'burst');}
   else{
    const normal=a.action.startsWith('normal.'),step=Number(a.action.split('.')[1]);
    const {index,category,label}=normal?{index:step-1,category:'normal',label:'普通攻击·第'+step+'段'}:{charged:{index:4,category:'charged',label:'重击'},plunge:{index:7,category:'plunge',label:'高空下落攻击'},'plunge.low':{index:6,category:'plunge',label:'低空下落攻击'},'plunge.collision':{index:5,category:'plunge',label:'下落期间伤害'}}[a.action];
    hit(a,{index,category,label,parts:1,arkhe,plungeCollision:a.action==='plunge.collision'},0,a.action);a.completionTime=a.time;
    if(normal&&a.time>=arkheReady[arkhe]){
     arkheReady[arkhe]=actionTime(a.time+6);a.completionTime=actionTime(a.time+.5);
     hit(a,{index:8,category:'normal',parts:1,arkhe,arkheStrike:true,nativeElement:'Hydro',element:'Hydro',label:arkhe==='ousia'?'流涌之刃':'灵息之刺'},.5,'arkhe');
    }
    // A charged hit uses the old alignment, then switches before the next command.
    if(a.action==='charged'){arkhe=arkhe==='ousia'?'pneuma':'ousia';replace(a,a.time);}
   }
  }
  for(const s of segments){
   if(s.start>=s.end)continue;
   const a=s.origin,active=(t,o)=>t<s.end||t===s.end&&o<s.endOrder;
   if(s.arkhe==='pneuma'){addWindow('furinaSinger',a,s.end-s.start,s.start-a.time,{endOrder:s.endOrder,eventId:a.id+'/singer'});continue;}
   for(const [index,initial,interval,travel,hpDrain,label,phase]of [[11,72.3333,97.5858,20,.016,'海薇玛夫人',21],[10,74.5,202.138,40,.024,'乌瑟勋爵',22],[12,71.5926,313.859,41,.036,'谢贝蕾妲小姐',23]])for(let n=0;;n++){
    const shot=actionTime(s.start+Math.round(initial+n*interval)/60),time=actionTime(shot+travel/60),offset=actionTime(time-a.time),suffix='salon-'+index+'/'+offset,salonKey=a.id+'/'+suffix;
    if(!active(shot,a.rootOrder+phase-.25)||shot>duration)break;
    hpDrains.push({kind:'salon_drain',time:shot,role:a.role,rootOrder:a.rootOrder+phase-.25,eventId:salonKey,salonKey,hpDrain,label:label+'·生命消耗'});
    if(active(time,a.rootOrder+phase))hit(a,{index,category:'skill',parts:1,hpDrain,hpDrainTime:shot,salonKey,arkhe:'ousia',label},offset,suffix,phase);
   }
  }
 },
 createTimeline:ctx=>createFurinaHitRuntime({...ctx,emitHealth:e=>(e.kind==='heal'?ctx.heals:ctx.hpDrains).push(e)}),
 createCombat:ctx=>createFurinaHitRuntime({...ctx,emitHealth:ctx.enqueue}),
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {
   prepare(p,e){p.character.params.Furina.c2_overflow=rotation().healthAt(e).overflow;},
   damageBuffs(r,e){return [effect('芙宁娜·万众狂欢',{BonusBase:m.mul(rotation().healthAt(e).fanfare,[.0007,.0009,.0011,.0013,.0015,.0017,.0019,.0021,.0023,.0025,.0027,.0029,.0031,.0033,.0035][c.skill3])})];},
   incoming:e=>m.mul(m.mul(rotation().healthAt(e).fanfare,c.skill3+1),.0001),
   healingBase:(h,p,native)=>h.healing==='furina_singer'?native(13):({amount:h.healing==='furina_c6'?m.mul(.04,sum(p.hp)):0,outgoing:sum(p.healing_bonus)}),
   recipientHealing:(h,j,value,p)=>h.healing==='furina_a1'?m.mul(sum(p.hp),.02):value,
  };
 },
 createHealth({role,profiles,base,math:m,total,panelAt}){
  const c=profiles[role].character,cons=c.constellation,a1=teamTalentUnlocked(c,1),n=createTeamNumericRules(m);
  const and=(a,b)=>m.choose(a,b,0),le=(a,b)=>m.ge(b,a);
  let points=0,active=false,window=-1,a1End=-Infinity,a1Next=Infinity,a1Root=0;
  const singerNext=new Map(),scheduledSinger=new Set(),scheduledA1=new Set();
  const singerIntervals=teamTalentUnlocked(c,4)?Array.from({length:20},(_,i)=>101+i):[120];
  function singerTick(cycle,frame,enqueue){
   const w=base.windows.furinaSinger[cycle],time=actionTime(w.start+frame/60),rootOrder=w.rootOrder+40,key=cycle+'/'+frame;
   if(time>w.end||time===w.end&&rootOrder>=w.endOrder||scheduledSinger.has(key))return;
   scheduledSinger.add(key);
   enqueue({kind:'heal',healing:'furina_singer',label:'众水的歌者',time,role,rootOrder,order:0,eventId:w.eventId+'/'+frame,singerCycle:cycle,singerFrame:frame,recipients:[base.activeRole(time,rootOrder)]});
  }
  function a1Tick(time,rootOrder,enqueue){
   const key=time+'/'+rootOrder;if(scheduledA1.has(key))return;scheduledA1.add(key);
   // A clock slot is shared by possible activations. Do not attach one
   // candidate's activation gate: healEnabled reads the live clock when due.
   enqueue({kind:'heal',healing:'furina_a1',time,role,rootOrder,order:0,eventId:'furina.a1/'+key,recipients:profiles.map((_,j)=>j)});
  }
  return {
   setup(_queue,enqueue){
    for(const [cycle]of (base.windows?.furinaSinger||[]).entries()){
     singerNext.set(cycle,63);
     singerTick(cycle,63,enqueue);
    }
    base.fanfareWindows.forEach((w,i)=>{
     const cast=base.roots.filter(h=>h.kind==='cast'&&h.role===role&&h.action==='burst')[i];
     enqueue({...cast,kind:'fanfare_reset',label:'芙宁娜·施放爆发'});
     enqueue({kind:'fanfare_start',label:'气氛开始',time:w.start,role,rootOrder:w.start===cast.time?cast.rootOrder+.01:-Infinity,window:i});
     enqueue({kind:'fanfare_end',label:'气氛结束',time:w.end,role,rootOrder:-Infinity,window:i});
    });
   },
    before(h,save,enabled=1){
     if(h.kind==='fanfare_reset'){active=m.choose(enabled,false,active);points=m.choose(enabled,0,points);window=m.choose(enabled,-1,window);save(h,enabled);return true;}
     if(h.kind==='fanfare_start'){active=m.choose(enabled,true,active);points=m.choose(enabled,n.fanfareStart(cons),points);window=m.choose(enabled,h.window,window);save(h,enabled);return true;}
     if(h.kind==='fanfare_end'){const due=and(enabled,m.eq(window,h.window));active=m.choose(due,false,active);points=m.choose(due,0,points);save(h,due);return true;}
    return false;
   },
   gain:delta=>{points=n.fanfareGain(points,delta,cons,active);},
   snapshot:()=>({fanfare:n.fanfare(points,cons,active),overflow:n.overflow(points,cons,active),active}),
   healEnabled(h,gate=1){
    if(h.healing==='furina_singer'&&h.role===role){
     const enabled=and(gate,m.eq(singerNext.get(h.singerCycle),h.singerFrame)),hp=total(panelAt(role,h).hp),reduction=teamTalentUnlocked(c,4)?m.min(.16,m.mul(hp,.000004)):0,interval=m.floor(m.add(m.mul(120,m.sub(1,reduction)),.5));
     singerNext.set(h.singerCycle,m.choose(enabled,m.add(h.singerFrame,interval),singerNext.get(h.singerCycle)));return enabled;
    }
    if(h.healing!=='furina_a1')return 1;
    const due=and(gate,and(m.eq(a1Next,h.time),m.eq(a1Root,h.rootOrder))),enabled=and(due,le(h.time,a1End));
    a1Next=m.choose(and(due,m.choose(enabled,0,1)),Infinity,a1Next);return enabled;
   },
   afterHeal(h,overheals,enabled,enqueue){
    if(h.healing==='furina_singer'&&h.role===role){
     const next=singerNext.get(h.singerCycle);
     // Scalar execution schedules its actual next tick. Program compilation
     // expands only reachable frame choices, all selected by the same clock.
     if(typeof next==='number')singerTick(h.singerCycle,next,enqueue);
     else for(const interval of singerIntervals)singerTick(h.singerCycle,h.singerFrame+interval,enqueue);
    }
    const i=h.recipients.indexOf(base.activeRole(h.time,h.rootOrder));
    if(h.role!==role&&i>=0&&a1){
     const trigger=and(enabled,m.gt(overheals[i],0)),start=and(trigger,m.eq(a1Next,Infinity)),next=actionTime(h.time+2),root=h.rootOrder+.2;
     a1End=m.choose(trigger,actionTime(h.time+4),a1End);a1Next=m.choose(start,next,a1Next);a1Root=m.choose(start,root,a1Root);
     if(typeof start==='object'||start)a1Tick(next,root,enqueue);
    }
    if(h.healing==='furina_a1'){
     const next=actionTime(h.time+2),continues=and(enabled,le(next,a1End));
     a1Next=m.choose(enabled,m.choose(continues,next,Infinity),a1Next);
     if(typeof continues==='object'||continues)a1Tick(next,h.rootOrder,enqueue);
    }
   },
  };
 },
};
