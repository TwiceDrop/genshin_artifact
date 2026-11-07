import {numericSum} from './rule-utils.mjs';
import {STELLAR_SWIRL_FIELDS} from './native-damage-fields.mjs';
import {characterPackages} from './character-packages.mjs';
import {contributionEffectEvent} from './reaction-events.mjs';

export const stellarSwirlModel={id:'reaction.stellarSwirl',evaluate(e,{math:m,numeric,profiles,actorIds,settings,enemy,trace,nativeDamageAt,reactionLevelBase}){
 const sum=numericSum(m),keys=['non_critical','critical','expectation'],zero=()=>Object.fromEntries(keys.map(k=>[k,0]));
 const output=new Map(),targets=e.targetIds,scored=settings.damage_scope==='all'?targets:targets.filter(id=>id===0);
 for(const id of targets){
  const rows=e.contributors.filter(c=>typeof c.enabled==='object'||c.enabled).map(c=>{
   const source={...e,role:c.role,index:characterPackages[profiles[c.role].character.name].stellarStatIndex??0,nativeElement:e.element,targetIds:[id],statSnapshot:undefined,effectEvent:contributionEffectEvent(e,c,m)},at={...source,...e.stellarSnapshot,eventKey:undefined};
   const captured=nativeDamageAt(at,[id]),live=nativeDamageAt(source,[id]),d=captured.damage,em=sum(d.em),cr=m.min(1,m.max(0,m.add(sum(d.critical),sum(d.critical_stellarswirl)))),cd=m.add(sum(d.critical_damage),sum(d.critical_damage_stellarswirl));
   const res=numeric.resistance(m.sub(enemy[e.element.toLowerCase()+'_res'],sum(live.damage.res_minus))),bonus=m.sub(sum(d.direct_stellarswirl_compose),m.div(m.mul(6,em),m.add(2000,em)));
   const n=numeric.stellarConduct({base:m.mul(e.stellarSwirlMultiplier,reactionLevelBase(c.role)),coefficient:1,baseBonus:sum(d.direct_stellarswirl_base_compose),em,bonus,independent:0,flat:sum(d.direct_stellarswirl_extra_fixed),elevation:m.add(sum(d.elevate_stellarswirl_compose),sum(d.elevate_stellar_glimmer_reaction_compose)),resistance:res,targets:m.mul(e.enabled??1,c.enabled),critical:cr,criticalDamage:cd});
   return {...c,...n,cr,cd,em,res,bonus,flat:sum(d.direct_stellarswirl_extra_fixed),native:captured};
  }).sort((a,b)=>actorIds[a.role].localeCompare(actorIds[b.role]));
  // Rank each actual critical outcome, then average. Ranking expected damage
  // first is incorrect when different contributors can exchange rank on crit.
  function weighted(values){return values.map((v,i)=>{
   const rank=values.reduce((n,w,j)=>j===i?n:m.add(n,j<i?m.ge(w,v):m.gt(w,v)),0);
   return m.mul(v,m.choose(m.eq(rank,0),.6,m.choose(m.eq(rank,1),.3,.05)));
  });}
  const normal=weighted(rows.map(r=>r.non_critical)),critical=weighted(rows.map(r=>r.critical)),expectation=rows.map(()=>0);
  for(let bits=0;bits<2**rows.length;bits++){
   const chance=rows.reduce((p,r,i)=>m.mul(p,bits&(1<<i)?r.cr:m.sub(1,r.cr)),1),damage=weighted(rows.map((r,i)=>bits&(1<<i)?r.critical:r.non_critical));
   damage.forEach((v,i)=>{expectation[i]=m.add(expectation[i],m.mul(chance,v));});
  }
  rows.forEach((r,i)=>{
   const value={non_critical:normal[i],critical:critical[i],expectation:expectation[i]},row=output.get(r.role)??{role:r.role,selected:zero(),actual:zero(),rows:[]};output.set(r.role,row);
   for(const k of keys){row.actual[k]=m.add(row.actual[k],value[k]);if(scored.includes(id))row.selected[k]=m.add(row.selected[k],value[k]);}
   if(trace&&scored.includes(id)){
    const detail=r.native.describe(r.native.damage);
    row.rows.push({...e,...value,enabled:m.mul(e.enabled??1,r.enabled),role:r.role,targetIds:[id],ownerActorId:actorIds[r.role],eventId:e.eventId+'/contributor/'+actorIds[r.role]+'/'+id,damageKind:'stellarSwirl',em:r.em,crit:r.cr,crit_damage:r.cd,bonus:r.bonus,res:r.res,def:1,flat:r.flat,
     analysis:{team_hit:true,damage_kind:'stellarSwirl',ignore_defense:true,target_count:1,element:e.element,is_heal:false,is_shield:false,em:detail.em,atk:detail.atk,hp:detail.hp,def:detail.def,critical:detail.critical,critical_damage:detail.critical_damage,res_minus:detail.res_minus,
      ...Object.fromEntries(STELLAR_SWIRL_FIELDS.map(k=>[k,detail[k]??{}])),atk_ratio:{},hp_ratio:{},def_ratio:{},em_ratio:{},extra_damage:{},bonus:{},def_minus:{},def_penetration:{},normal:{...value},direct_stellarswirl:{...value},reaction_coefficient:e.stellarSwirlMultiplier,reaction_level_base:reactionLevelBase(r.role)}});
   }
  });
 }
 return {contributions:[...output.values()].map(({rows,...c})=>({...c,row:rows}))};
}};
