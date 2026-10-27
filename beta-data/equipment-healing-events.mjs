import {teamNumericRules as numeric} from './team-dps-numeric-rules.mjs';
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);
const total=p=>Object.values(p||{}).reduce((a,b)=>a+b,0);

// Team HP costs, healing and Bond of Life share a chronological candidate ledger.
// Enemy damage never enters this model. Maximum-HP changes preserve HP ratio.
export function resolveEquipmentHealing(profiles,builds,base,{panelAt,healAt,criticalAt,refresh}){
 const initial={...base.initialHealth,ratios:[...base.initialHealth.ratios],time:0,rootOrder:-Infinity,order:-Infinity,label:'初始血量'};
 const rotation={...base,heals:[],bonds:[],hpEvents:[],health:[initial],salonCounts:new Map()},sets=builds.map(b=>{const c={};for(const a of b)c[a.set_name]=(c[a.set_name]||0)+1;return c;});
 rotation.healthAt=e=>rotation.health.findLast(h=>order(h,e)<=0);
 const ratios=[...initial.ratios];let points=0,active=false,window=-1;
 const queue=base.heals.map(h=>({...h,order:h.order??0})),bond=profiles.map(()=>({remaining:0,total:0,ready:-Infinity}));
 const blackReady=profiles.map(()=>new Map([[-Infinity,1]])),isshinReady=profiles.map(()=>-Infinity);
 const c4=profiles.map(()=>({cast:-Infinity,mass:[1,0,0,0,0,0,0,0]}));
 let a1End=-Infinity,a1Next=Infinity;
 const furina=profiles.findIndex(p=>p.character.name==='Furina');
 const cons=profiles[furina].character.constellation;
 const enqueue=h=>{if(h.time<base.duration||(h.time===base.duration&&base.endHit==='include'))queue.push({...h,order:h.order??0});};
 const gain=delta=>{points=numeric.fanfareGain(points,delta,cons,active);};
 const changed=(h,j,amount,max)=>{
  const before=ratios[j];ratios[j]=numeric.healthChange(before,amount,max);
  const delta=ratios[j]-before;
  if(delta)rotation.hpEvents.push({...h,role:j,change:delta>0?'increase':'decrease',amount:Math.abs(delta)*max,ratio:Math.abs(delta)});
  return delta;
 };
 const save=(h,extra={})=>{
  const row={...h,...extra,ratios:[...ratios],fanfare:numeric.fanfare(points,cons,active),overflow:numeric.overflow(points,cons,active),active};
  rotation.health.push(row);refresh(rotation);
  const at={...h,order:h.order+.01};row.maxHP=profiles.map((_,r)=>total(panelAt(r,at).hp));row.hp=row.maxHP.map((max,r)=>max*ratios[r]);
 };
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
  if(c.action==='burst'&&sets[c.role].TravelingDoctor>=4)enqueue({...c,kind:'heal',healing:'traveling_doctor',rootOrder:c.rootOrder+.1,recipients:[c.role]});
 }
 for(const h of base.events){
  if(h.onField&&['normal','charged','plunge'].includes(h.category)&&['TheBlackSword','PrizedIsshinBlade'].includes(profiles[h.role].weapon.name))enqueue({...h,kind:'weapon_heal_trial'});
  if(h.onField&&h.category==='charged'&&profiles[h.role].weapon.name==='CrimsonMoonsSemblance')enqueue({...h,kind:'bond',order:h.order+.1});
 }
 refresh(rotation);
 initial.maxHP=profiles.map((_,r)=>total(panelAt(r,{time:0,rootOrder:-1,order:-1}).hp));initial.hp=initial.maxHP.map((max,r)=>max*ratios[r]);
 while(queue.length){
  queue.sort(order);const h=queue.shift(),r=h.role,{name,refine}=profiles[r].weapon;
  if(h.kind==='fanfare_reset'){active=false;points=0;window=-1;save(h);continue;}
  if(h.kind==='fanfare_start'){active=true;points=numeric.fanfareStart(cons);window=h.window;save(h);continue;}
  if(h.kind==='fanfare_end'){if(window===h.window){active=false;points=0;save(h);}continue;}
  if(h.kind==='salon_drain'){
   const eligible=ratios.map((v,j)=>numeric.salonEligible(v)?j:-1).filter(j=>j>=0);rotation.salonCounts.set(h.order,eligible.length);
   const max=profiles.map((_,j)=>total(panelAt(j,h).hp));let delta=0;
   for(const j of eligible)delta-=changed(h,j,-max[j]*h.hpDrain,max[j]);
   gain(delta);save(h,{consumedRoles:eligible});continue;
  }
  if(h.kind==='team_hp_change'){
   const recipients=h.recipients==='team'?profiles.map((_,j)=>j):[r];let delta=0;
   for(const j of recipients){const max=total(panelAt(j,h).hp);delta+=Math.abs(changed(h,j,max*h.ratio*(h.change==='increase'?1:-1),max));}
   gain(delta);save(h);continue;
  }
  if(h.kind==='bond'){
   if(h.time<bond[r].ready)continue;
   const max=total(panelAt(r,h).hp),amount=max*({FinaleOfTheDeep:.25,FlowingPurity:.24,CrimsonMoonsSemblance:.18}[name]),b=bond[r];
   b.ready=h.time+(name==='CrimsonMoonsSemblance'?14:10);const added=Math.min(max*2-b.remaining,amount);b.remaining+=added;b.total+=added;
   rotation.bonds.push({...h,change:'increase',amount:b.remaining,ratio:b.remaining/max});refresh(rotation);continue;
  }
  if(h.kind==='weapon_heal_trial'){
   if(name==='PrizedIsshinBlade'){
    if(h.time<isshinReady[r])continue;
    isshinReady[r]=h.time+8;enqueue({...h,kind:'heal',healing:'isshin',order:h.order+.1,recipients:[r]});
   }else if(h.category!=='plunge'){
    const chance=criticalAt(h),next=new Map();let available=0;
    for(const [ready,mass]of blackReady[r])if(ready<=h.time)available+=mass;else next.set(ready,mass);
    const probability=available*chance;next.set(-Infinity,available-probability);
    if(probability){next.set(h.time+5,(next.get(h.time+5)||0)+probability);enqueue({...h,kind:'heal',healing:'black_sword',probability,order:h.order+.1,recipients:[r]});}
    blackReady[r]=next;
   }
   continue;
  }
  if(h.healing==='furina_a1'&&h.time>a1End){a1Next=Infinity;continue;}
  let multiplier=1;
  if(profiles[r].character.name==='Escoffier'&&h.healing!=='traveling_doctor'&&h.recipients.length===1&&profiles[r].character.constellation>=4){
   const cast=base.lastCast(r,'burst',h.time,h.rootOrder),s=c4[r];
   if(cast!==s.cast){s.cast=cast;s.mass=[1,0,0,0,0,0,0,0];}
   const cr=Math.min(1,Math.max(0,total(panelAt(r,h).critical))),next=s.mass.map(()=>0);
   for(let i=0;i<8;i++){if(i===7){next[7]+=s.mass[i];continue;}multiplier+=s.mass[i]*cr;next[i]+=s.mass[i]*(1-cr);next[i+1]+=s.mass[i]*cr;}s.mass=next;
  }
  const amounts=healAt(h).map(v=>v*multiplier*(h.probability??1)),effective=[],hpRecipients=[],healedRecipients=[],overheals=[],absorbedAmounts=[];
  let healingAmount=0,delta=0;
  for(let i=0;i<h.recipients.length;i++){
   const j=h.recipients[i],b=bond[j],absorbed=Math.min(b.remaining,amounts[i]);b.remaining-=absorbed;
   if(absorbed){rotation.bonds.push({...h,role:j,change:'decrease',amount:b.remaining,ratio:b.remaining/total(panelAt(j,h).hp)});if(b.remaining===0){rotation.bonds.push({...h,role:j,change:'clear',amount:b.total});b.total=0;}}
   const healing=amounts[i]-absorbed,max=total(panelAt(j,h).hp),applied=Math.min(healing,(1-ratios[j])*max),change=changed(h,j,applied,max);
   effective.push(applied);overheals.push(healing-applied);absorbedAmounts.push(absorbed);healingAmount+=healing;delta+=change;
   if(change>0)hpRecipients.push(j);if(healing>0)healedRecipients.push(j);
  }
  const done={...h,hpRecipients,healedRecipients,healingAmount,amount:effective.reduce((a,b)=>a+b,0),amounts:effective,rawAmounts:amounts,overheals,absorbedAmounts};
  rotation.heals.push(done);gain(delta);save(h,{label:h.label||h.healing||profiles[r].character.name+'·治疗',healing:done});
  const recipientOnField=base.activeRole(h.time,h.rootOrder);
  const f=profiles[furina].character;
  if(r!==furina&&overheals[h.recipients.indexOf(recipientOnField)]>0&&(f.level>20||(f.level===20&&f.ascend))){
   a1End=h.time+4;
   if(a1Next===Infinity){a1Next=h.time+2;enqueue({kind:'heal',healing:'furina_a1',time:a1Next,role:furina,rootOrder:h.rootOrder+.2,recipients:profiles.map((_,i)=>i)});}
  }
  if(h.healing==='furina_a1'){a1Next=h.time+2;if(a1Next<=a1End)enqueue({...h,time:a1Next});else a1Next=Infinity;}
 }
 return rotation;
}
