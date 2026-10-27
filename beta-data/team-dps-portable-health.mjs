import {scalarMath,createTeamNumericRules} from './team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from './team-dps-character-rules.mjs';
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);

// Static event times are unrolled once. Numeric conditions remain in the shared
// expression program, so each candidate owns its HP, healing and proc states.
export function resolvePortableHealth(profiles,builds,base,{panelAt,healAt,criticalAt,refresh,math=scalarMath,setCount}){
 const m=math,numeric=createTeamNumericRules(m),sum=values=>values.reduce((a,b)=>m.add(a,b),0),total=p=>sum(Object.values(p||{}));
 const and=(a,b)=>m.choose(a,b,0),not=a=>m.choose(a,0,1),le=(a,b)=>m.ge(b,a),eq=m.eq;
 const sets=builds.map(b=>{const c={};for(const a of b)c[a.set_name]=(c[a.set_name]||0)+1;return c;});
 const has=(r,name)=>m.ge(setCount?setCount(r,name):(sets[r][name]||0),4);
 const insert=(list,row,enabled=1)=>{
  if(typeof enabled==='number'||typeof enabled==='boolean'){if(enabled)list.push(row);}
  else if(typeof row==='object'){row.enabled=enabled;list.push(row);}
  else list.push({role:row,enabled});
 };
 const initial={...base.initialHealth,ratios:[...base.initialHealth.ratios],time:0,rootOrder:-Infinity,order:-Infinity,label:'初始血量'};
 const rotation={...base,heals:[],bonds:[],hpEvents:[],health:[initial],salonCounts:new Map()};
 rotation.healthAt=e=>rotation.health.findLast(h=>order(h,e)<=0);
 const ratios=[...initial.ratios];let points=0,active=false,window=-1;
 const bonds=profiles.map(()=>({remaining:0,total:0,ready:-Infinity}));
 const black=profiles.map(()=>new Map([[-Infinity,1]])),isshin=profiles.map(()=>-Infinity),trials=new Map();
 const c4=profiles.map(()=>({cast:-Infinity,mass:[1,0,0,0,0,0,0,0]}));
 let a1End=-Infinity,a1Next=Infinity,a1Root=0;
 const furina=profiles.findIndex(p=>p.character.name==='Furina'),cons=profiles[furina].character.constellation;
 const queue=base.heals.filter(h=>h.role!==2||h.healing||h.recipients.length!==1||teamTalentUnlocked(profiles[2].character,1)).map(h=>({...h,order:h.order??0}));
 const enqueue=h=>{if(h.time<base.duration||(h.time===base.duration&&base.endHit==='include'))queue.push({...h,order:h.order??0});};
 base.fanfareWindows.forEach((w,i)=>{
  const cast=base.roots.filter(h=>h.kind==='cast'&&h.role===furina&&h.action==='burst')[i];
  enqueue({...cast,kind:'fanfare_reset',label:'芙宁娜·施放爆发'});
  enqueue({kind:'fanfare_start',label:'气氛开始',time:w.start,role:furina,rootOrder:w.start===cast.time?cast.rootOrder+.01:-Infinity,window:i});
  enqueue({kind:'fanfare_end',label:'气氛结束',time:w.end,role:furina,rootOrder:-Infinity,window:i});
 });
 for(const e of base.roots)if(e.kind==='hp_change'&&e.change!=='damage')enqueue({...e,kind:'team_hp_change',label:e.label||'队伍生命变化'});
 for(const e of base.events)if(e.hpDrain)enqueue({...e,kind:'salon_drain',rootOrder:e.rootOrder-.25,label:e.label+'·生命消耗'});
 for(const c of base.roots.filter(h=>h.kind==='cast')){
  if(c.action==='skill'&&['FinaleOfTheDeep','FlowingPurity'].includes(profiles[c.role].weapon.name))enqueue({...c,kind:'bond'});
  if(c.action==='burst')enqueue({...c,kind:'heal',healing:'traveling_doctor',rootOrder:c.rootOrder+.1,recipients:[c.role],set:'TravelingDoctor'});
 }
 for(const h of base.events){
  const name=profiles[h.role].weapon.name;
  if(h.onField&&['normal','charged','plunge'].includes(h.category)&&['TheBlackSword','PrizedIsshinBlade'].includes(name)){
   enqueue({...h,kind:'weapon_heal_trial'});
   enqueue({...h,kind:'heal',healing:name==='TheBlackSword'?'black_sword':'isshin',order:h.order+.1,recipients:[h.role],trial:h.order});
  }
  if(h.onField&&h.category==='charged'&&name==='CrimsonMoonsSemblance')enqueue({...h,kind:'bond',order:h.order+.1});
 }
 const f=profiles[furina].character;
 if(f.level>20||(f.level===20&&f.ascend)){
  const times=new Set();
  for(const h of [...queue].filter(h=>h.role!==furina&&h.kind==='heal'))for(let t=h.time+2;t<=base.duration;t+=2){
   const rootOrder=h.rootOrder+.2,key=t+'/'+rootOrder;if(times.has(key))continue;times.add(key);
   enqueue({kind:'heal',healing:'furina_a1',time:t,role:furina,rootOrder,recipients:profiles.map((_,j)=>j)});
  }
 }
 queue.sort(order);
 const changed=(h,j,amount,max,enabled=1)=>{
  const before=ratios[j],next=numeric.healthChange(before,amount,max);ratios[j]=m.choose(enabled,next,before);
  const delta=m.sub(ratios[j],before),size=m.abs(delta);
  insert(rotation.hpEvents,{...h,role:j,change:'increase',amount:m.mul(size,max),ratio:size},m.gt(delta,0));
  insert(rotation.hpEvents,{...h,role:j,change:'decrease',amount:m.mul(size,max),ratio:size},m.lt(delta,0));
  return delta;
 };
 const save=(h,enabled=1,extra={})=>{
  const row={...h,...extra,ratios:[...ratios],fanfare:numeric.fanfare(points,cons,active),overflow:numeric.overflow(points,cons,active),active};
  insert(rotation.health,row,enabled);refresh(rotation);
  const at={...h,order:h.order+.01};row.maxHP=profiles.map((_,r)=>total(panelAt(r,at).hp));row.hp=row.maxHP.map((max,r)=>m.mul(max,ratios[r]));
 };
 refresh(rotation);initial.maxHP=profiles.map((_,r)=>total(panelAt(r,{time:0,rootOrder:-1,order:-1}).hp));initial.hp=initial.maxHP.map((max,r)=>m.mul(max,ratios[r]));
 for(const event of queue){
  const {set,trial,...h}=event,r=h.role,{name,refine}=profiles[r].weapon;
  let enabled=set?has(r,set):1;
  if(h.kind==='fanfare_reset'){active=false;points=0;window=-1;save(h);continue;}
  if(h.kind==='fanfare_start'){active=true;points=numeric.fanfareStart(cons);window=h.window;save(h);continue;}
  if(h.kind==='fanfare_end'){if(window===h.window){active=false;points=0;save(h);}continue;}
  if(h.kind==='salon_drain'){
   const eligible=ratios.map(numeric.salonEligible);rotation.salonCounts.set(h.order,sum(eligible));
   const max=profiles.map((_,j)=>total(panelAt(j,h).hp)),delta=[];
   for(let j=0;j<profiles.length;j++)delta.push(m.sub(0,changed(h,j,m.mul(-h.hpDrain,max[j]),max[j],eligible[j])));
   points=numeric.fanfareGain(points,sum(delta),cons,active);
   save(h,1,{consumedRoles:eligible.every(v=>typeof v!=='object')?eligible.flatMap((v,j)=>v?[j]:[]):eligible});continue;
  }
  if(h.kind==='team_hp_change'){
   const recipients=h.recipients==='team'?profiles.map((_,j)=>j):[r],delta=[];
   for(const j of recipients){const max=total(panelAt(j,h).hp);delta.push(m.abs(changed(h,j,m.mul(max,h.ratio*(h.change==='increase'?1:-1)),max)));}
   points=numeric.fanfareGain(points,sum(delta),cons,active);save(h);continue;
  }
  if(h.kind==='bond'){
   const b=bonds[r],available=m.ge(h.time,b.ready),max=total(panelAt(r,h).hp),amount=m.mul(max,({FinaleOfTheDeep:.25,FlowingPurity:.24,CrimsonMoonsSemblance:.18}[name]));
   const added=m.choose(available,m.min(m.sub(m.mul(max,2),b.remaining),amount),0);
   b.ready=m.choose(available,h.time+(name==='CrimsonMoonsSemblance'?14:10),b.ready);b.remaining=m.add(b.remaining,added);b.total=m.add(b.total,added);
   insert(rotation.bonds,{...h,change:'increase',amount:b.remaining,ratio:m.div(b.remaining,max)},available);refresh(rotation);continue;
  }
  if(h.kind==='weapon_heal_trial'){
   if(name==='PrizedIsshinBlade'){
    const chance=h.time>=isshin[r]?1:0;trials.set(h.order,chance);if(chance)isshin[r]=h.time+8;
   }else if(h.category!=='plunge'){
    const chance=criticalAt(h),next=new Map(),ready=[];
    for(const [time,mass]of black[r])if(time<=h.time)ready.push(mass);else next.set(time,mass);
    const available=sum(ready),probability=m.mul(available,chance);next.set(-Infinity,m.sub(available,probability));
    next.set(h.time+5,m.add(next.get(h.time+5)||0,probability));black[r]=next;trials.set(h.order,probability);
   }else trials.set(h.order,0);
   continue;
  }
  if(trial!==undefined){const probability=trials.get(trial);if(name==='TheBlackSword')h.probability=probability;enabled=and(enabled,m.gt(probability,0));}
  if(h.healing==='furina_a1'){
   const due=and(eq(a1Next,h.time),eq(a1Root,h.rootOrder));enabled=and(due,le(h.time,a1End));
   a1Next=m.choose(and(due,not(enabled)),Infinity,a1Next);
  }
  if((typeof enabled==='number'||typeof enabled==='boolean')&&!enabled)continue;
  let multiplier=1;
  if(profiles[r].character.name==='Escoffier'&&h.healing!=='traveling_doctor'&&h.recipients.length===1&&profiles[r].character.constellation>=4){
   const cast=base.lastCast(r,'burst',h.time,h.rootOrder),s=c4[r],reset=not(eq(cast,s.cast));
   const mass=s.mass.map((v,i)=>m.choose(reset,i===0?1:0,v)),cr=m.min(1,m.max(0,total(panelAt(r,h).critical))),next=mass.map(()=>0);
   for(let i=0;i<8;i++){
    if(i===7){next[7]=m.add(next[7],mass[i]);continue;}
    const won=m.mul(mass[i],cr);multiplier=m.add(multiplier,won);next[i]=m.add(next[i],m.mul(mass[i],m.sub(1,cr)));next[i+1]=m.add(next[i+1],won);
   }
   s.mass=next.map((v,i)=>m.choose(enabled,v,s.mass[i]));s.cast=m.choose(enabled,cast,s.cast);
  }
  const amounts=healAt(h).map(v=>m.mul(m.mul(v,multiplier),h.probability??1)),effective=[],hpRecipients=[],healedRecipients=[],overheals=[],absorbedAmounts=[],deltas=[],healingParts=[];
  for(let i=0;i<h.recipients.length;i++){
   const j=h.recipients[i],b=bonds[j],absorbed=m.choose(enabled,m.min(b.remaining,amounts[i]),0);b.remaining=m.sub(b.remaining,absorbed);
   const cleared=and(m.gt(absorbed,0),eq(b.remaining,0));
   insert(rotation.bonds,{...h,role:j,change:'decrease',amount:b.remaining,ratio:m.div(b.remaining,total(panelAt(j,h).hp))},m.gt(absorbed,0));
   insert(rotation.bonds,{...h,role:j,change:'clear',amount:b.total},cleared);b.total=m.choose(cleared,0,b.total);
   const healing=m.sub(amounts[i],absorbed),max=total(panelAt(j,h).hp),applied=m.min(healing,m.mul(m.sub(1,ratios[j]),max)),change=changed(h,j,applied,max,enabled);
   effective.push(m.choose(enabled,applied,0));overheals.push(m.choose(enabled,m.sub(healing,applied),0));absorbedAmounts.push(absorbed);healingParts.push(m.choose(enabled,healing,0));deltas.push(change);
   insert(hpRecipients,j,m.gt(change,0));insert(healedRecipients,j,and(enabled,m.gt(healing,0)));
  }
  const done={...h,hpRecipients,healedRecipients,healingAmount:sum(healingParts),amount:sum(effective),amounts:effective,rawAmounts:amounts,overheals,absorbedAmounts};
  insert(rotation.heals,done,enabled);points=numeric.fanfareGain(points,sum(deltas),cons,active);
  save(h,enabled,{label:h.label||h.healing||profiles[r].character.name+'·治疗',healing:done});
  const recipientOnField=base.activeRole(h.time,h.rootOrder),i=h.recipients.indexOf(recipientOnField);
  if(r!==furina&&i>=0&&(f.level>20||(f.level===20&&f.ascend))){
   const trigger=and(enabled,m.gt(overheals[i],0)),start=and(trigger,eq(a1Next,Infinity));
   a1End=m.choose(trigger,h.time+4,a1End);a1Next=m.choose(start,h.time+2,a1Next);a1Root=m.choose(start,h.rootOrder+.2,a1Root);
  }
  if(h.healing==='furina_a1')a1Next=m.choose(enabled,m.choose(le(h.time+2,a1End),h.time+2,Infinity),a1Next);
 }
 return rotation;
}
