import {scalarMath,createTeamNumericRules} from './team-dps-numeric-rules.mjs';
import {createCharacterHealth} from './team-engine/registry.mjs';
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
 const ratios=[...initial.ratios];
 const bonds=profiles.map(()=>({remaining:0,total:0,ready:-Infinity}));
 const black=profiles.map(()=>new Map([[-Infinity,1]])),isshin=profiles.map(()=>-Infinity),trials=new Map();
 const characters=createCharacterHealth(profiles,base,{math:m,total,panelAt});
 const gain=delta=>characters.forEach(c=>c.gain?.(delta));
 const queue=base.heals.filter(h=>characters.every(c=>!c.keepHeal||c.keepHeal(h))).map(h=>({...h,order:h.order??0}));
 const enqueue=h=>{if(h.time<base.duration||(h.time===base.duration&&base.endHit==='include'))queue.push({...h,order:h.order??0});};
 for(const e of base.roots)if(e.kind==='hp_change'&&e.change!=='damage')enqueue({...e,kind:'team_hp_change',label:e.label||'队伍生命变化'});
 if(base.model==='actions')for(const e of base.hpDrains)enqueue(e);
 else for(const e of base.events)if(e.hpDrain)enqueue({...e,time:e.hpDrainTime??e.time,kind:'salon_drain',rootOrder:e.rootOrder-.25,label:e.label+'·生命消耗'});
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
 for(const c of characters)c.setup?.(queue,enqueue);
 queue.sort(order);
 const changed=(h,j,amount,max,enabled=1)=>{
  const before=ratios[j],next=numeric.healthChange(before,amount,max);ratios[j]=m.choose(enabled,next,before);
  const delta=m.sub(ratios[j],before),size=m.abs(delta);
  insert(rotation.hpEvents,{...h,role:j,change:'increase',amount:m.mul(size,max),ratio:size},m.gt(delta,0));
  insert(rotation.hpEvents,{...h,role:j,change:'decrease',amount:m.mul(size,max),ratio:size},m.lt(delta,0));
  return delta;
 };
 const save=(h,enabled=1,extra={})=>{
  const row={...h,...extra,ratios:[...ratios],fanfare:0,overflow:0,active:false,...Object.assign({},...characters.map(c=>c.snapshot?.()||{}))};
  insert(rotation.health,row,enabled);refresh(rotation);
  const at={...h,order:h.order+.01};row.maxHP=profiles.map((_,r)=>total(panelAt(r,at).hp));row.hp=row.maxHP.map((max,r)=>m.mul(max,ratios[r]));
 };
 refresh(rotation);initial.maxHP=profiles.map((_,r)=>total(panelAt(r,{time:0,rootOrder:-1,order:-1}).hp));initial.hp=initial.maxHP.map((max,r)=>m.mul(max,ratios[r]));
 for(const event of queue){
  const {set,trial,...h}=event,r=h.role,{name,refine}=profiles[r].weapon;
  let enabled=set?has(r,set):1;
  if(characters.some(c=>c.before?.(h,save)))continue;
  if(h.kind==='current_hp_drain'){
   const delta=profiles.map((_,j)=>{const max=total(panelAt(j,h).hp);return m.sub(0,changed(h,j,m.mul(m.mul(-h.hpDrain,ratios[j]),max),max));});
   gain(sum(delta));save(h);continue;
  }
  if(h.kind==='salon_drain'){
   const eligible=ratios.map(numeric.salonEligible);rotation.salonCounts.set(h.salonKey??h.order,sum(eligible));
   const max=profiles.map((_,j)=>total(panelAt(j,h).hp)),delta=[];
   for(let j=0;j<profiles.length;j++)delta.push(m.sub(0,changed(h,j,m.mul(-h.hpDrain,max[j]),max[j],eligible[j])));
   gain(sum(delta));
   save(h,1,{consumedRoles:eligible.every(v=>typeof v!=='object')?eligible.flatMap((v,j)=>v?[j]:[]):eligible});continue;
  }
  if(h.kind==='team_hp_change'){
   const recipients=h.recipients==='team'?profiles.map((_,j)=>j):[r],delta=[];
   for(const j of recipients){const max=total(panelAt(j,h).hp);delta.push(m.abs(changed(h,j,m.mul(max,h.ratio*(h.change==='increase'?1:-1)),max)));}
   gain(sum(delta));save(h);continue;
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
  for(const c of characters)enabled=and(enabled,c.healEnabled?.(h)??1);
  if((typeof enabled==='number'||typeof enabled==='boolean')&&!enabled)continue;
  const multiplier=characters.reduce((v,c)=>m.mul(v,c.healMultiplier?.(h,enabled)??1),1);
  const amounts=healAt(h).map(v=>m.mul(m.mul(v,multiplier),h.probability??1)),effective=[],hpRecipients=[],healedRecipients=[],overheals=[],absorbedAmounts=[],deltas=[],healingParts=[];
  if(h.lowestOnly){
   // Lowest remaining HP percentage is candidate-dependent. Preserve the same
   // comparison in the GPU expression graph; ties prefer the healer.
   let winner=r,lowest=ratios[r];
   for(const j of h.recipients){const lower=m.lt(ratios[j],lowest);winner=m.choose(lower,j,winner);lowest=m.min(lowest,ratios[j]);}
   for(let i=0;i<amounts.length;i++)amounts[i]=m.choose(m.eq(winner,h.recipients[i]),amounts[i],0);
  }
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
  insert(rotation.heals,done,enabled);gain(sum(deltas));
  save(h,enabled,{label:h.label||h.healing||profiles[r].character.name+'·治疗',healing:done});
  for(const c of characters)c.afterHeal?.(h,overheals,enabled);
 }
 return rotation;
}
