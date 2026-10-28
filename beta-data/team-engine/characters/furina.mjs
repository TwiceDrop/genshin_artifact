import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {createTeamNumericRules} from '../../team-dps-numeric-rules.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';

export const furina={
 id:'Furina',element:'Hydro',panelIndex:9,hpRatioLabel:'芙宁娜·六命始基力追加',
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
 derive({role,profile,events,heals,hpDrains,roots,duration}){
  if(profile.character.constellation<6)return;
  let cast=null,last=-Infinity,uses=0,end=-Infinity,next=Infinity,healSource='';
  for(const e of events.filter(e=>e.role===role&&['normal','charged','plunge'].includes(e.category))){
   const latest=roots.findLast(a=>a.role===role&&a.kind==='cast'&&a.action==='skill'&&(a.time<e.time||a.time===e.time&&a.rootOrder<=e.rootOrder));if(latest!==cast){cast=latest;uses=0;}
   e.furinaC6=!!cast&&e.time<cast.time+10&&uses<6;
   if(e.arkheStrike){e.hpRatioBonus=e.furinaC6?.18:0;continue;}
   if(!e.furinaC6||e.plungeCollision||e.time-last<.1-1e-9)continue;
   while(next<=end&&next<=e.time){heals.push({time:next,role,rootOrder:e.rootOrder-.1,eventId:healSource+'/furina.c6/'+next,kind:'heal',healing:'furina_c6',recipients:[0,1,2,3]});next+=1;}
   if(e.arkhe==='pneuma')hpDrains.push({kind:'current_hp_drain',time:e.time,role,rootOrder:e.rootOrder+.1,eventId:e.eventId+'/furina.c6-drain',hpDrain:.01,label:'芙宁娜·六命芒性生命消耗'});
   else {if(e.time>=end){end=e.time+2.9;next=e.time+1;}else end+=2.9;healSource=e.eventId;}
   last=e.time;uses++;
  }
  while(next<=end&&next<=duration){heals.push({time:next,role,rootOrder:Infinity,eventId:healSource+'/furina.c6/'+next,kind:'heal',healing:'furina_c6',recipients:[0,1,2,3]});next+=1;}
 },
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
  let points=0,active=false,window=-1,a1End=-Infinity,a1Next=Infinity,a1Root=0;const singerNext=new Map();
  return {
   setup(queue,enqueue){
    for(const [cycle,w]of (base.windows?.furinaSinger||[]).entries()){
     singerNext.set(cycle,63);
     // Unroll only reachable 60fps healing ticks. Candidate HP selects the next
     // tick numerically, preserving the same health clock on CPU and GPU.
     const reachable=new Set([63]),intervals=teamTalentUnlocked(c,4)?Array.from({length:20},(_,i)=>101+i):[120],limit=Math.floor((Math.min(w.end,base.duration)-w.start)*60+1e-8);
     for(let frame=63;frame<=limit;frame++)if(reachable.has(frame)){
      const time=actionTime(w.start+frame/60),rootOrder=w.rootOrder+40;
      if(time<w.end||time===w.end&&rootOrder<w.endOrder)enqueue({kind:'heal',healing:'furina_singer',label:'众水的歌者',time,role,rootOrder,eventId:w.eventId+'/'+frame,singerCycle:cycle,singerFrame:frame,recipients:[base.activeRole(time,rootOrder)]});
      for(const interval of intervals)if(frame+interval<=limit)reachable.add(frame+interval);
     }
    }
    base.fanfareWindows.forEach((w,i)=>{
     const cast=base.roots.filter(h=>h.kind==='cast'&&h.role===role&&h.action==='burst')[i];
     enqueue({...cast,kind:'fanfare_reset',label:'芙宁娜·施放爆发'});
     enqueue({kind:'fanfare_start',label:'气氛开始',time:w.start,role,rootOrder:w.start===cast.time?cast.rootOrder+.01:-Infinity,window:i});
     enqueue({kind:'fanfare_end',label:'气氛结束',time:w.end,role,rootOrder:-Infinity,window:i});
    });
    if(a1){const times=new Set();for(const h of [...queue].filter(h=>h.role!==role&&h.kind==='heal'))for(let t=h.time+2;t<=base.duration;t+=2){
     const rootOrder=h.rootOrder+.2,key=t+'/'+rootOrder;if(times.has(key))continue;times.add(key);
     enqueue({kind:'heal',healing:'furina_a1',time:t,role,rootOrder,eventId:(h.eventId??h.id)+'/furina.a1/'+t,recipients:profiles.map((_,j)=>j)});
    }}
   },
   before(h,save){
    if(h.kind==='fanfare_reset'){active=false;points=0;window=-1;save(h);return true;}
    if(h.kind==='fanfare_start'){active=true;points=n.fanfareStart(cons);window=h.window;save(h);return true;}
    if(h.kind==='fanfare_end'){if(window===h.window){active=false;points=0;save(h);}return true;}
    return false;
   },
   gain:delta=>{points=n.fanfareGain(points,delta,cons,active);},
   snapshot:()=>({fanfare:n.fanfare(points,cons,active),overflow:n.overflow(points,cons,active),active}),
   healEnabled(h){
    if(h.healing==='furina_singer'&&h.role===role){
     const enabled=m.eq(singerNext.get(h.singerCycle),h.singerFrame),hp=total(panelAt(role,h).hp),reduction=teamTalentUnlocked(c,4)?m.min(.16,m.mul(hp,.000004)):0,interval=m.floor(m.add(m.mul(120,m.sub(1,reduction)),.5));
     singerNext.set(h.singerCycle,m.choose(enabled,m.add(h.singerFrame,interval),singerNext.get(h.singerCycle)));return enabled;
    }
    if(h.healing!=='furina_a1')return 1;
    const due=and(m.eq(a1Next,h.time),m.eq(a1Root,h.rootOrder)),enabled=and(due,le(h.time,a1End));
    a1Next=m.choose(and(due,m.choose(enabled,0,1)),Infinity,a1Next);return enabled;
   },
   afterHeal(h,overheals,enabled){
    const i=h.recipients.indexOf(base.activeRole(h.time,h.rootOrder));
    if(h.role!==role&&i>=0&&a1){const trigger=and(enabled,m.gt(overheals[i],0)),start=and(trigger,m.eq(a1Next,Infinity));a1End=m.choose(trigger,h.time+4,a1End);a1Next=m.choose(start,h.time+2,a1Next);a1Root=m.choose(start,h.rootOrder+.2,a1Root);}
    if(h.healing==='furina_a1')a1Next=m.choose(enabled,m.choose(le(h.time+2,a1End),h.time+2,Infinity),a1Next);
   },
  };
 },
};
