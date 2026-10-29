import {scalarMath} from './team-dps-numeric-rules.mjs';
const before=(a,b)=>a.time<b.time||(a.time===b.time&&(a.rootOrder<b.rootOrder||(a.rootOrder===b.rootOrder&&a.order<b.order)));
const within=(a,e,seconds)=>before(a,e)&&e.time<a.time+seconds;
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);

export function createEquipmentHealthRules(profiles,rotation,{math=scalarMath}={}){
 const m=math,and=(a,b)=>m.choose(a,b,0),or=(a,b)=>m.max(a,b),enabled=h=>h.enabled??1;
 const hp=rotation.hpEvents.slice().sort(order),bonds=(rotation.bonds||[]).slice().sort(order),heals=rotation.heals.slice().sort(order);
 function count(rows,e,span,limit,interval=0){
  let last=-Infinity,n=0;
  for(const h of rows)if(before(h,e)){
   const trigger=and(enabled(h),m.ge(m.sub(h.time,last),interval-1e-9));last=m.choose(trigger,h.time,last);
   if(e.time<h.time+span)n=m.add(n,m.choose(trigger,h.probability??1,0));
  }return m.min(limit,n);
 }
 function refreshed(rows,e,span,limit,interval=0){
  let last=-Infinity,n=0;
  for(const h of rows)if(before(h,e)){
   const trigger=and(enabled(h),m.ge(m.sub(h.time,last),interval-1e-9));
   n=m.choose(trigger,m.choose(m.ge(m.sub(h.time,last),span),1,m.min(limit,m.add(n,1))),n);last=m.choose(trigger,h.time,last);
  }return m.choose(m.lt(e.time,m.add(last,span)),n,0);
 }
 const recipient=(h,r)=>h.healedRecipients.reduce((n,j)=>or(n,typeof j==='object'?(j.role===r?j.enabled:0):Number(j===r)),0);
 const qualifies=(h,r)=>and(enabled(h),and(m.gt(h.healingAmount,0),h.role===r?1:recipient(h,r)));
 const sweet=(owner,r,e)=>heals.filter(h=>h.role===owner&&within(h,e,3)).reduce((n,h)=>or(n,and(enabled(h),and(m.gt(h.healingAmount,0),owner===r?1:recipient(h,r)))),0);
 const hymnStacks=(r,e)=>count(heals.filter(h=>h.role===r).map(h=>({...h,enabled:and(enabled(h),m.gt(h.healingAmount,0))})),e,10,3);
 function marks(r,e){
  let available=[-Infinity,-Infinity,-Infinity],ready=-Infinity,stacks=0;
  const rows=[...heals,...rotation.roots.filter(h=>h.kind==='cast'&&h.role===r)].sort(order);
  for(const h of rows)if(before(h,e)){
   available=available.map(time=>m.choose(m.ge(h.time,m.add(time,30)),-Infinity,time));
   if(h.kind==='heal'){
    const trigger=qualifies(h,r),shift=[available[1],available[2],h.time];available=available.map((t,i)=>m.choose(trigger,shift[i],t));
   }else{
    const n=available.reduce((v,t)=>m.add(v,m.gt(t,-Infinity)),0),trigger=and(m.ge(h.time,ready),m.gt(n,0));
    if(e.time<h.time+10)stacks=m.choose(trigger,n,stacks);
    available=available.map(t=>m.choose(trigger,-Infinity,t));ready=m.choose(trigger,h.time+15,ready);
   }
  }return stacks;
 }
 function clearAmount(r,e){let value=0;for(const h of bonds)if(h.role===r&&h.change==='clear'&&within(h,e,15))value=m.choose(enabled(h),h.amount,value);return value;}
 function weaponState(r,e){
  const name=profiles[r].weapon.name,own=hp.filter(h=>h.role===r),front=own.filter(h=>rotation.activeRole(h.time,h.rootOrder)===r),changes=bonds.filter(h=>h.role===r);
  if(name==='SplendorOfTranquilWaters')return {stack1:refreshed(own,e,6,3,.2),stack2:refreshed(hp.filter(h=>h.role!==r),e,6,2,.2)};
  if(name==='TomeOfTheEternalFlow'||name==='CashflowSupervision')return {stack:refreshed(front,e,4,3,.3)};
  if(name==='Absolution')return {stack:count(changes.filter(h=>h.change==='increase'),e,6,3)};
  if(name==='CrimsonMoonsSemblance'){
   let amount=0,ratio=0;for(const h of changes)if(h.change!=='clear'&&before(h,e)){amount=m.choose(enabled(h),h.amount,amount);ratio=m.choose(enabled(h),h.ratio,ratio);}
   return {rate1:m.choose(m.gt(amount,0),1,0),rate2:m.choose(m.ge(ratio,.3),1,0)};
  }
  if(name==='ProspectorsDrill'||name==='TheDockhandsAssistant')return {stack:marks(r,e)};
  if(name==='HarbingerOfDawn')return {rate:m.choose(m.gt(rotation.healthAt(e).ratios[r],.9),1,0)};
  if(name==='StaffOfHoma')return {be50_rate:m.choose(m.lt(rotation.healthAt(e).ratios[r],.5),1,0)};
  return {};
 }
 function artifactState(r,e){
  const own=hp.filter(h=>h.role===r),burst=rotation.lastCast(r,'burst',e.time,e.rootOrder);
  const on=rotation.activeRole(e.time,e.rootOrder)===r,vermillion=on&&e.time>=burst&&e.time<burst+16&&burst>=rotation.entered(e.time,e.rootOrder);
  return {
   Berserker:{rate:m.choose(m.lt(rotation.healthAt(e).ratios[r],.7),1,0)},
   // Four-piece stacks are owned by the shared effect lifecycle.
   MarechausseeHunter:{stack:0},
   VermillionHereafter:{rate_q:vermillion?1:0,stack:vermillion?count(own.filter(h=>['decrease','damage'].includes(h.change)&&h.time>=burst),e,16,4,.8):0},
   FragmentOfHarmonicWhimsy:{level:refreshed(bonds.filter(h=>h.role===r&&h.change!=='clear'),e,6,3,.3)},
  };
 }
 return {count,refreshed,sweet,hymnStacks,clearAmount,weaponState,artifactState};
}
