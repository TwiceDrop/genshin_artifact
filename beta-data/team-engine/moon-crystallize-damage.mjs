import {numericSum} from './rule-utils.mjs';
import {MOON_CRYSTALLIZE_FIELDS} from './native-damage-fields.mjs';
import {rankedReactionDamage} from './ranked-reaction-damage.mjs';
import {characterPackages} from './character-packages.mjs';
import {contributionEffectEvent} from './reaction-events.mjs';

function lunarDamage(e,context,native,live,body,flat,targets,cr){
 const {math:m,numeric,enemy}=context,sum=numericSum(m),d=native.damage;
 const bonus=m.add(sum(d.direct_mooncrystallize_compose),sum(d.enhance_moon_reaction_compose));
 const base=m.mul(m.mul(1.6,body),m.add(1,sum(d.mooncrystallize_base_compose)));
 const amplified=m.mul(m.mul(base,m.add(1,bonus)),m.add(1,sum(d.moon_reaction_damage_multiplier)));
 const elevation=m.add(sum(d.elevate_mooncrystallize_compose),sum(d.elevate_moon_reaction_compose));
 const res=numeric.resistance(m.sub(enemy.geo_res,sum(live.damage.res_minus)));
 const cd=m.add(sum(d.critical_damage),sum(d.critical_damage_moon_reaction));
 flat=m.add(flat,sum(d.mooncrystallize_extra_fixed));
 const damage=numeric.damage(m.mul(m.add(amplified,flat),m.add(1,elevation)),0,1,res,targets,cr,cd);
 return {damage,crit:cr,crit_damage:cd,bonus,res,flat,em:sum(d.em),atk:sum(d.atk),hp:sum(d.hp),def:1};
}
function detail(e,native,terms,damage,ids,event,live=native){
 const d=native.describe(native.damage);
 return {...e,...terms,...damage,targetIds:ids,damageKind:'lunarCrystallize',analysis:{team_hit:true,damage_kind:'lunarCrystallize',ignore_defense:true,element:'Geo',target_count:ids.length,is_heal:false,is_shield:false,
  ...Object.fromEntries(['atk','hp','em','def','res_minus','critical','critical_damage',...MOON_CRYSTALLIZE_FIELDS].map(k=>[k,d[k]??{}])),
  lunar_event:event,res_minus:live===native?d.res_minus:live.describe(live.damage).res_minus,
  atk_ratio:{},hp_ratio:{},def_ratio:{},em_ratio:{},extra_damage:{},bonus:{},def_minus:{},def_penetration:{},normal:{...damage},...(e.damageModel==='direct.lunarCrystallize'?{direct_mooncrystallize:{...damage}}:{})}};
}

export const directMoonCrystallize={id:'direct.lunarCrystallize',evaluate(e,context){
 const {math:m,nativeDamageAt,createCriticalResolver,resolveContacts,trace}=context,sum=numericSum(m),criticalFor=createCriticalResolver(e);
 return resolveContacts(e,(ids,advance,diagnose)=>{
  const native=nativeDamageAt(e,ids),d=native.damage,resolved=criticalFor(d,advance,sum(d.critical_moon_reaction)),cr=resolved.critical;
  const body=m.mul(sum(d[e.lunarStat]),sum(d.direct_mooncrystallize_ratio));
  const flat=m.add(sum(d.direct_mooncrystallize_extra_fixed),m.mul(sum(d.def),sum(d.direct_mooncrystallize_extra_def_ratio)));
  const {damage,...terms}=lunarDamage(e,context,native,native,body,flat,m.mul(ids.length,e.enabled??1),cr);
  return {damage,critical:cr,row:trace&&diagnose?detail(e,{...native,damage:resolved.damage},terms,damage,ids,{stat:e.lunarStat,targets:ids.length*(e.enabled??1)}):undefined};
 });
}};

export const moonHarmony={id:'reaction.lunarCrystallize',evaluate(e,context){
 const {math:m,nativeDamageAt,profiles,reactionLevelBase,settings,trace}=context,sum=numericSum(m),ids=e.targetIds;
 const id=ids[0],selectedTarget=settings.damage_scope==='all'||id===0;
 const members=e.contributors.filter(c=>typeof c.enabled==='object'||c.enabled).sort((a,b)=>a.actorId.localeCompare(b.actorId));
 const rows=members.map(c=>{
  const source={...e,role:c.role,index:characterPackages[profiles[c.role].character.name].reactionStatIndex,nativeElement:'Geo',effectEvent:contributionEffectEvent(e,c,m)};
  const snap=nativeDamageAt({...source,...e.lunarSnapshot,eventKey:undefined},ids),live=nativeDamageAt(source,ids),d=snap.damage;
  const cr=m.min(1,m.max(0,m.add(sum(d.critical),sum(d.critical_moon_reaction))));
  return {...c,cr,snap,live,level:reactionLevelBase(c.role),targets:m.mul(e.enabled,c.enabled),position:e.contributors.indexOf(c)};
 });
 const cases=e.catalogCases??[{weight:e.domainDouble?1.33:1}];
 const def=e.catalogCases?sum(context.panelAt(e.catalogOwner,{...e,...e.lunarSnapshot}).def):0;
 const totals=rows.map(()=>({non_critical:0,critical:0,expectation:0})),terms=rows.map(()=>({flat:0}));
 const tracedCases=trace&&selectedTarget?[]:null;
 for(const scenario of cases){
  const rolls=rows.map((r,i)=>{
   const flat=m.mul(def,scenario.flat?.[r.position]??0);
   const {damage,...stats}=lunarDamage(e,context,r.snap,r.live,r.level,flat,r.targets,r.cr);
   terms[i]={...stats,flat:m.add(terms[i].flat,m.mul(stats.flat,scenario.weight))};
   return {...damage,cr:r.cr};
  });
  if(tracedCases)tracedCases.push({weight:scenario.weight,flat:rows.map(r=>def*(scenario.flat?.[r.position]??0)),
   rolls:rolls.map(({non_critical,critical,cr},i)=>({non_critical,critical,cr,role:rows[i].role}))});
  rankedReactionDamage(rolls,m).forEach((ranked,i)=>{
   for(const key of Object.keys(ranked))totals[i][key]=m.add(totals[i][key],m.mul(scenario.weight,ranked[key]));
  });
 }
 return {contributions:rows.map((r,i)=>{
  const actual=totals[i];
  const selected=selectedTarget?actual:{critical:0,non_critical:0,expectation:0};
  const row=trace&&selectedTarget?detail({...e,role:r.role,ownerActorId:r.actorId,eventId:e.eventId+'/member/'+r.actorId},r.snap,terms[i],actual,ids,
   {level:r.level,targets:r.targets,member:i,cases:tracedCases},r.live):undefined;
  return {role:r.role,actual,selected,row};
 })};
}};
