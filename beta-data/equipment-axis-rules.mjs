import {createCombatHistory} from './team-engine/combat-history.mjs';
import {eventKey,eventBefore} from './team-engine/event-order.mjs';
// Shared equipment rules consume combat facts, not a particular rotation or build.
// A reaction fact names its owner; its elements and equipment benefits are rules.
import characters from '../src/assets/_gen_character.js';
import {TEAM_DPS_REACTIONS,TEAM_DPS_CHARACTER_CAPABILITIES} from './team-dps-config.mjs';
import {equipmentReactionFacts} from './equipment-reaction-rules.mjs';
import {MANUAL_WEAPON_OPTIONS,defaultWeaponOptions,widsithTriggers} from './team-dps-weapon-options.mjs';
import {hymnAttackBonus} from './weapon-effects.mjs';
import {symphonistAttack,thrillingTalesAttack,floatingDreamsMastery,evenstarAttack,xiphosRecharge,keyMastery,peakPatrolBonus} from './equipment-effect-values.mjs';
import {CONDITIONAL_WEAPON_FIELDS,conditionalWeaponState} from './equipment-conditional-rules.mjs';
import {equipmentEnergy,equipmentPickups,aimingStacks,fieldWeaponState,daybreakStacks,huskStacks,equipmentWeakpoint,equipmentHitElement} from './equipment-combat-facts.mjs';
import {createEquipmentHealthRules} from './equipment-health-rules.mjs';
import {scalarMath} from './team-dps-numeric-rules.mjs';
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
export const equipmentEffect=(label,values)=>({name:'ExtensionEffect',config:{ExtensionEffect:{label,values}}});
export const before=eventBefore;
const within=(a,e,seconds)=>before(a,e)&&e.time<a.time+seconds;
const spaced=(rows,seconds)=>{let last=-Infinity;return rows.filter(e=>{if(e.time-last<seconds-1e-9)return false;last=e.time;return true;});};
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);
const artifactConfigKeys=new Map();
const configKey=name=>{
 if(!artifactConfigKeys.has(name))artifactConfigKeys.set(name,'config_'+name.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase());
 return artifactConfigKeys.get(name);
};
export const AUTO_WEAPON_FIELDS={
 ...CONDITIONAL_WEAPON_FIELDS,
 ...Object.fromEntries(Object.entries(MANUAL_WEAPON_OPTIONS).map(([n,rows])=>[n,rows.map(f=>f.key)])),
 MouunsMoon:['energy','rate'],Akuoumaru:['energy','rate'],Slingshot:['is_effect','rate','close_rate'],
 AlleyHunter:['stack'],SerpentSpine:['stack'],DaybreakChronicles:['rate','magus'],FadingTwilight:['state'],
 ForgedByTheGoldenMelody:['state','counterpoint_active','counterpoint_state','rate','counterpoint_rate'],
 FlowerWreathedFeathers:['stack'],AquaSimulacra:['is_enemy_around'],PrototypeCrescent:['rate'],SharpshootersOath:['rate'],
 ForestRegalia:['rate'],Verdict:['stack'],MakhairaAquamarine:['rate'],Cloudforged:['stack'],Hamayumi:['rate'],ThunderingPulse:['stack'],
 HereticsMoltenBlade:['movement_rate','rate'],HarbingerOfDawn:['rate'],
 FinaleOfTheDeep:['rate1','rate2'],FlowingPurity:['rate1','rate2'],
 Deathmatch:['ge2'],WavebreakersFin:['energy'],TheWidsith:['t1_rate','t2_rate','t3_rate'],MoonweaverDawn:['max_energy'],BlackTassel:['rate'],
 CoolSteel:['rate'],DragonsBane:['rate'],MagicGuide:['rate'],DisasterAndRemorse:['rate_wushe','rate_wuyu','is_secret_arts'],
 MissiveWindspear:['rate'],EmeraldOrb:['rate'],FruitOfFulfillment:['stack'],Frostbreath:['active','rate','energy_rate'],EchoesOfTheHeart:['reaction_active','stellar_active','reaction_rate','stellar_rate'],
 ThrillingTalesOfDragonSlayers:[],SymphonistOfScents:['off_field_rate','sweet_echoes_rate'],HymnOfTheMaelstrom:['hp','stacks','boosted','on_field'],
 FreedomSworn:['rate'],XiphosMoonlight:['rate'],WanderingEvenstar:['rate'],AThousandFloatingDreams:['same_count','diff_count'],KeyOfKhajNisut:['stack','rate'],PeakPatrolSong:['stack','rate'],AthameArtis:['rate','magus'],
 StarcallersWatch:['use_buff','rate'],AngelosHeptades:['shield_rate'],CranesEchoingCall:['rate'],HakushinRing:[],SapwoodBlade:['rate'],Moonpiercer:['rate'],
 CalamityQueller:['stack','backend_rate'],SplendorOfTranquilWaters:['stack1','stack2'],Azurelight:['after_skill','zero_energy'],MistsplitterReforged:['emblem_level'],
 HaranGeppakuFutsu:['stack'],WolfFang:['e_stack','q_stack'],PrototypeRancour:['stack'],PrimordialJadeWingedSpear:['stack','full_rate'],
 IronSting:['stack'],MappaMare:['stack'],KagurasVerity:['stack','full_rate'],ProspectorsDrill:['stack'],TheDockhandsAssistant:['stack'],
 MountainBracingBolt:['rate'],WaveridingWhirl:['rate','hydro_count'],SacrificialJade:['rate'],OathswornEye:['rate'],FleuveCendreFerryman:['rate'],EngulfingLightning:['rate'],
 BalladOfTheFjords:['use_effect'],LithicSpear:['liyue_count'],CalamityOfEshu:['rate'],UrakuMisugiri:['rate'],Absolution:['stack'],CrimsonMoonsSemblance:['rate1','rate2'],
 TomeOfTheEternalFlow:['stack'],CashflowSupervision:['stack'],LightOfFoliarIncision:['rate'],SturdyBone:['rate'],CinnabarSpindle:['rate'],
 SerenitysCall:['rate','full_moon'],Emberwell:['reaction_active','stellar_active','reaction_rate','stellar_rate'],WhitelakeFrostfeather:['stack','rate'],
 WintersHeavyHeart:['cryo_count','electro_count','radiance','rate'],NewBough:['stacks','radiance','rate'],
 NightweaversLookingGlass:['northernmost_runo_active','crescent_verse_active','skill_rate','lunar_rate','overlap_rate'],FracturedHalo:['after_skill_burst','has_shield'],
};
export const AUTO_ARTIFACT_SETS=['TenacityOfTheMillelith','NoblesseOblige','ScrollOfTheHeroOfCinderCity','Instructor','SongOfDaysPast','ArchaicPetra','ViridescentVenerer','DeepwoodMemories','GoldenTroupe','BlizzardStrayer','FinaleOfTheDeepGalleries','MarechausseeHunter','DesertPavilionChronicle','RealmMirrorNight','SpinMoonSerenade','ObsidianCodex','HeavensGift','HeartOfTheFurnace','ScarletProof','VourukashasGlow','HeartOfDepth','MartialArtist','GildedDreams','HuskOfOpulentDreams','PaleFlame','VermillionHereafter','NymphsDream','CrimsonWitch','NighttimeWhispersInTheEchoingWoods','FragmentOfHarmonicWhimsy','LongNightsOath','RetracingBolide'];
export const AUTO_EQUIPMENT_BUFFS=new Set(['ThrillingTalesOfDragonSlayers','SymphonistOfScents','VodyanitsaSignature','FreedomSworn','XiphosMoonlight','WanderingEvenstar','AThousandFloatingDreams','KeyOfKhajNisut','PeakPatrolSong','AthameArtis','StarcallersWatch','AngelosHeptades','CranesEchoingCall','HakushinRing','SapwoodBlade','Moonpiercer','TenacityOfTheMillelith4','NoblesseOblige4','ScrollOfTheHeroOfCinderCity4','Instructor4','SongOfDaysPast4','ArchaicPetra4','ViridescentVenerer4','DeepwoodMemories4','HeavensGift4','HeartOfTheFurnace4','SpinMoonSerenade','RealmMirrorNight','NightweaversLookingGlass','FracturedHalo']);
AUTO_ARTIFACT_SETS.push('CrimsonWitchOfFlames','ShimenawasReminiscence','UnfinishedReverie','EchoesOfAnOffering','FlowerOfParadiseLost','Lavawalker','Thundersoother','AubadeOfMorningstarAndMoon','ADayCarvedFromRisingWinds','DisenchantmentInDeepShadow');
AUTO_EQUIPMENT_BUFFS.add('MakhairaAquamarine');
AUTO_ARTIFACT_SETS.push('Berserker');
// The current character adapter has no Nightsoul-capable character. Future
// adapters supply capabilities; an axis cannot grant a character a new ability.
export function cinderElements(reaction,element,nightsoul){
 const elements=TEAM_DPS_REACTIONS[reaction];
 return elements?.includes(element)?{elements,first:.12,second:nightsoul?.28:0}:null;
}
export function createEquipmentAxisRules(profiles,rotation,{frozen=true,weapon_conditions=[],enemy_is_slime=false,widsith_themes={},damage_scope='single',enemy_count=1}={},execution={}){
 const m=execution.math||scalarMath,sum=x=>Object.values(x||{}).reduce((a,b)=>m.add(a,b),0);
 const history=createCombatHistory(m),{gate,any:active,spaced,count,refreshed}=history;
 const flag=value=>m.choose(value,1,0),bool=value=>typeof value==='object'?value:!!value;
 const {events,heals,switches,activeRole,lastCast,entered}=rotation;
 const roots=rotation.roots.slice().sort(order);
 const element=profiles.map(p=>characters[p.character.name].element);
 const capabilities=TEAM_DPS_CHARACTER_CAPABILITIES,hasShield=profiles.some(p=>capabilities[p.character.name]?.shield);
 const state=(role,name,e)=>name==='shield'?hasShield:roots.some(s=>s.kind==='state'&&s.state===name&&s.role===role&&within(s,e,s.durationMs/1000));
 const reactions=equipmentReactionFacts(events.map(h=>({...h,element:equipmentHitElement(profiles[h.role],h)})),element,roots),energy=equipmentEnergy(profiles,rotation,{math:m,history}),pickups=equipmentPickups(profiles,rotation,reactions,{math:m,history});
 const defaults=defaultWeaponOptions(),manual=(r,n)=>({...defaults[n],...weapon_conditions[r]?.[n]});
 const songs=profiles.map((_,r)=>widsithTriggers(rotation,r));
 const hp=rotation.hpEvents.slice().sort(order);
 const health=createEquipmentHealthRules(profiles,rotation,{math:m});
 const ownHits=profiles.map((_,r)=>events.filter(e=>e.role===r)),ownReactions=profiles.map((_,r)=>reactions.filter(e=>e.role===r));
 const hit=(r,e,cat,span)=>ownHits[r].filter(h=>(!cat||cat.includes(h.category))&&within(h,e,span));
 const castActive=(r,kind,e,seconds)=>{const t=lastCast(r,kind,e.time,e.rootOrder);return e.time>=t&&e.time<t+seconds;};
 const sweet=health.sweet;
 const hymn=(r,e)=>({stacks:health.hymnStacks(r,e),boosted:bool(active(reactions,h=>h.reaction==='Frozen'&&h.category==='skill'&&within(h,e,5)))});
 const setCounts=builds=>builds.map(b=>{const s={};for(const a of b)s[a.set_name]=(s[a.set_name]||0)+1;return s;});
 const ttds=profiles.map((p,r)=>spaced(switches.filter(s=>s.from===r&&s.role!==r),20));
 const possible=value=>typeof value==='object'||!!value,and=(a,b)=>m.choose(a,b,0);
 const emit=(out,row,enabled)=>{if(possible(enabled))out.push({...row,enabled});};
 const freedom=ownReactions.map((rows,r)=>{
  if(profiles[r].weapon.name!=='FreedomSworn')return [];
  const out=[];let used=0,last=-Infinity,ready=-Infinity;
  for(const row of rows){
   const accepted=and(gate(row),and(m.ge(row.time,ready),m.ge(row.time,m.add(last,.5))));
   const next=m.add(used,1),trigger=and(accepted,m.eq(next,2));emit(out,row,trigger);
   used=m.choose(accepted,m.choose(trigger,0,next),used);last=m.choose(accepted,row.time,last);ready=m.choose(trigger,row.time+20,ready);
  }return out;
 });
 const peaks=ownHits.map((rows,r)=>profiles[r].weapon.name==='PeakPatrolSong'?spaced(rows.filter(e=>['normal','plunge'].includes(e.category)),.1):[]);
 function peakStacks(r,e){return refreshed(peaks[r],e,6,2);}
 const keyHits=ownHits.map((rows,r)=>profiles[r].weapon.name==='KeyOfKhajNisut'?spaced(rows.filter(e=>e.category==='skill'&&e.onField),.3):[]);
 const triggers=(rows,span,limit)=>{const out=[];for(const row of rows)emit(out,row,and(gate(row),m.eq(refreshed(rows,{...row,step:(row.step??0)+1},span,limit),limit)));return out;};
 const peakTriggers=peaks.map(rows=>triggers(rows,6,2)),keyTriggers=keyHits.map(rows=>triggers(rows,20,3));
 const prepared=profiles.map(()=>new Map());
 const foliar=ownHits.map((rows,r)=>{
  const out=new Map();if(profiles[r].weapon.name!=='LightOfFoliarIncision')return out;
  let start=-Infinity,ready=-Infinity,used=0;
  for(const row of rows){
   const enabled=gate(row),activate=row.category==='normal'?and(enabled,m.ge(row.time,ready)):0;
   const spend=['normal','skill'].includes(row.category)?and(enabled,and(m.choose(activate,0,1),and(m.lt(row.time,m.add(start,12)),m.lt(used,28)))):0;
   out.set(eventKey(row),flag(spend));start=m.choose(activate,row.time,start);ready=m.choose(activate,row.time+12,ready);used=m.choose(activate,0,m.add(used,m.choose(spend,1,0)));
  }return out;
 });
 const spindle=ownHits.map((rows,r)=>{
  const out=new Map();if(profiles[r].weapon.name!=='CinnabarSpindle')return out;
  let last=-Infinity;for(const row of rows.filter(h=>h.category==='skill')){
   const trigger=and(gate(row),m.ge(row.time,m.add(last,1.5))),active=and(gate(row),m.choose(trigger,1,m.lt(row.time,m.add(last,.1))));
   out.set(eventKey(row),flag(active));last=m.choose(trigger,row.time,last);
  }return out;
 });
 const bone=ownHits.map((rows,r)=>{
  const out=new Map();if(profiles[r].weapon.name!=='SturdyBone')return out;
  let used=0,last;for(const row of rows){
   const sprint=roots.filter(s=>s.role===r&&s.kind==='sprint'&&before(s,row)).at(-1);if(sprint!==last){used=0;last=sprint;}
   const active=row.category==='normal'&&sprint&&within(sprint,row,7)?and(gate(row),m.lt(used,18)):0;
   out.set(eventKey(row),flag(active));used=m.add(used,m.choose(active,1,0));
  }return out;
 });
 function disaster(r,e){
  let ready=-Infinity,end=-Infinity,wushe=-Infinity,wuyu=-Infinity,last=-Infinity;
  const sequence=[...roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),...switches.filter(s=>s.from===r&&s.role!==r),...ownHits[r]].sort(order);
  for(const h of sequence){
   if(!before(h,e))continue;const enabled=gate(h);
   if(h.kind==='switch'){end=m.choose(enabled,-Infinity,end);wushe=m.choose(enabled,-Infinity,wushe);wuyu=m.choose(enabled,-Infinity,wuyu);continue;}
   if(h.kind==='cast'){
    const trigger=and(enabled,m.ge(h.time,ready));ready=m.choose(trigger,h.time+18,ready);end=m.choose(trigger,h.time+17,end);wushe=m.choose(trigger,h.time+3,wushe);wuyu=m.choose(trigger,h.time+3,wuyu);last=m.choose(trigger,-Infinity,last);
   }else if(['normal','charged','skill','burst'].includes(h.category)){
    const trigger=and(enabled,and(m.lt(h.time,end),m.ge(h.time,m.add(last,.1-1e-9))));
    if(['normal','charged'].includes(h.category))wuyu=m.add(wuyu,m.choose(trigger,1,0));else wushe=m.add(wushe,m.choose(trigger,1,0));
    last=m.choose(trigger,h.time,last);
   }
  }
  return {rate_wushe:flag(and(m.lt(e.time,end),m.lt(e.time,wushe))),rate_wuyu:flag(and(m.lt(e.time,end),m.lt(e.time,wuyu))),is_secret_arts:false};
 }
 function fruit(r,e){
  let stack=0,decay=Infinity;
  const remaining=time=>m.choose(m.ge(time,decay),m.max(0,m.sub(stack,m.add(1,m.floor(m.div(m.sub(time,decay),6))))),stack);
  for(const h of spaced(ownReactions[r],.3))if(before(h,e)){
   const enabled=gate(h);stack=m.choose(enabled,m.min(5,m.add(remaining(h.time),1)),stack);decay=m.choose(enabled,h.time+6,decay);
  }
  return remaining(e.time);
 }
 function prepare(p,r,e,build=p.artifacts){
  const setNames=build.map(a=>a.set_name),setCounts={};for(const name of setNames)setCounts[name]=(setCounts[name]??0)+1;
  const relevant=name=>{const count=execution.setCount?execution.setCount(r,name):(setCounts[name]??0);return typeof count==='object'||count>=2;};
  const cacheKey=[eventKey(e),e.order,e.step,...setNames].join('/');
  const cached=prepared[r].get(cacheKey);if(cached){p.weapon.params=structuredClone(cached.weapon);p.artifact_config=structuredClone(cached.artifacts);return p;}
  const on=activeRole(e.time,e.rootOrder)===r,n=p.weapon.name;
  // Direct kernel callers do not need UI-created parameters for automatic rules.
  if(AUTO_WEAPON_FIELDS[n]?.length)p.weapon.params={[n]:{...(p.weapon.params?.[n]||{})}};
  const w=p.weapon.params?.[n];
  const normal=hit(r,e,['normal'],Infinity),skill=hit(r,e,['skill'],Infinity),burst=hit(r,e,['burst'],Infinity),ownR=ownReactions[r];
  if(w){
   if('on_field'in w)w.on_field=on;if('off_field_rate'in w)w.off_field_rate=on?0:1;
   const patch={
    FreedomSworn:()=>({rate:0}),XiphosMoonlight:()=>({rate:0}),WanderingEvenstar:()=>({rate:0}),KeyOfKhajNisut:()=>({stack:refreshed(keyHits[r],e,20,3),rate:0}),PeakPatrolSong:()=>({stack:peakStacks(r,e),rate:0}),
    AThousandFloatingDreams:()=>({same_count:element.filter((v,i)=>i!==r&&v===element[r]).length,diff_count:element.filter(v=>v!==element[r]).length}),
    SymphonistOfScents:()=>({off_field_rate:on?0:1,sweet_echoes_rate:0}),HymnOfTheMaelstrom:()=>({...hymn(r,e),hp:0,on_field:false}),
    AthameArtis:()=>({burst_hit:bool(active(burst,h=>within(h,e,3))),secret_rite:false,rate:active(burst,h=>within(h,e,3)),magus:false}),StarcallersWatch:()=>({use_buff:false,rate:0}),AngelosHeptades:()=>({shield_active:false,shield_rate:0}),CranesEchoingCall:()=>({rate:0}),SapwoodBlade:()=>({rate:0}),Moonpiercer:()=>({rate:0}),
    CalamityQueller:()=>({stack:castActive(r,'skill',e,20)?Math.min(6,Math.floor(e.time-lastCast(r,'skill',e.time,e.rootOrder))):0,backend_rate:on?0:1}),
    Azurelight:()=>({after_skill:castActive(r,'skill',e,12),zero_energy:energy.at(r,e).zero}),
    MistsplitterReforged:()=>({emblem_level:m.add(m.add(m.choose(energy.at(r,e).full,0,1),Number(castActive(r,'burst',e,10))),active(normal,h=>within(h,e,5)))}),
    WolfFang:()=>({e_stack:refreshed(skill.filter(h=>h.onField),e,10,4,.1),q_stack:refreshed(burst.filter(h=>h.onField),e,10,4,.1)}),PrototypeRancour:()=>({stack:refreshed(ownHits[r].filter(h=>['normal','charged'].includes(h.category)),e,6,4,.3)}),
    PrimordialJadeWingedSpear:()=>({stack:refreshed(ownHits[r].filter(h=>h.onField),e,6,7,.3),full_rate:flag(m.eq(refreshed(ownHits[r].filter(h=>h.onField),e,6,7,.3),7))}),
    IronSting:()=>({stack:refreshed(ownHits[r].filter(h=>h.onField),e,6,2,1)}),MappaMare:()=>({stack:refreshed(ownR.filter(h=>activeRole(h.time,h.rootOrder)===r),e,10,2)}),
    KagurasVerity:()=>({stack:refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,16,3),full_rate:flag(m.eq(refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,16,3),3))}),
    MountainBracingBolt:()=>({rate:roots.some(h=>h.kind==='cast'&&h.action==='skill'&&h.role!==r&&within(h,e,8))?1:0}),
    WaveridingWhirl:()=>({rate:spaced(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),15).some(h=>within(h,e,10))?1:0,hydro_count:element.filter(v=>v==='Hydro').length}),
    OathswornEye:()=>({rate:castActive(r,'skill',e,10)?1:0}),FleuveCendreFerryman:()=>({rate:castActive(r,'skill',e,5)?1:0}),EngulfingLightning:()=>({rate:castActive(r,'burst',e,12)?1:0}),
    BalladOfTheFjords:()=>({use_effect:new Set(element).size>=3}),LithicSpear:()=>({liyue_count:0}),CalamityOfEshu:()=>({rate:state(r,'shield',e)?1:0}),UrakuMisugiri:()=>({rate:0}),
    FinaleOfTheDeep:()=>({rate1:spaced(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),10).some(h=>within(h,e,15))?1:0,rate2:0}),
    FlowingPurity:()=>({rate1:spaced(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),10).some(h=>within(h,e,15))?1:0,rate2:0}),
    LightOfFoliarIncision:()=>({rate:foliar[r].get(eventKey(e))??0}),SturdyBone:()=>({rate:bone[r].get(eventKey(e))??0}),CinnabarSpindle:()=>({rate:spindle[r].get(eventKey(e))??0}),
    SerenitysCall:()=>({reaction_active:bool(active(ownR,h=>within(h,e,12))),moon_full:false,rate:active(ownR,h=>within(h,e,12)),full_moon:false}),Emberwell:()=>({reaction_active:bool(active(ownR,h=>within(h,e,12))),stellar_active:false,reaction_rate:1,stellar_rate:0}),
    WhitelakeFrostfeather:()=>({stacks:count(skill,e,8,3),stack:count(skill,e,8,3),rate:1}),WintersHeavyHeart:()=>({cryo_count:element.filter(v=>v==='Cryo').length,electro_count:element.filter(v=>v==='Electro').length,radiance:false,rate:1}),
    NewBough:()=>({stacks:count(ownHits[r].filter(h=>castActive(r,'skill',h,12)),e,6,3,1),radiance:false,rate:1}),
    NightweaversLookingGlass:()=>({skill_active:['Hydro','Dendro'].includes(element[r])&&bool(active(skill,h=>within(h,e,4.5))),lunar_bloom_active:false,northernmost_runo_active:['Hydro','Dendro'].includes(element[r])&&bool(active(skill,h=>within(h,e,4.5))),crescent_verse_active:false,skill_rate:1,lunar_rate:0,overlap_rate:0}),FracturedHalo:()=>({after_skill_burst:castActive(r,'skill',e,20)||castActive(r,'burst',e,20),has_shield:false}),
   }[n]?.();if(patch)Object.assign(w,patch);
   if(n==='HaranGeppakuFutsu'){const own=roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'&&before(h,e)),cast=own.at(-1),previous=own.at(-2);w.stack=cast&&within(cast,e,8)?Math.min(2,spaced(roots.filter(h=>h.kind==='cast'&&h.action==='skill'&&h.role!==r&&before(h,cast)&&(!previous||before(previous,h))),.3).length):0;}
   if(n==='SacrificialJade'){
    let active=false,front=activeRole(0,-1)===r,since=0;
    for(const s of [...switches.filter(s=>(s.from===r||s.role===r)&&before(s,e)),{time:e.time,role:activeRole(e.time,e.rootOrder)}]){
     if(front&&s.time-since>=10)active=false;
     if(!front&&s.time-since>5)active=true;
     if((s.role===r)!==front){front=s.role===r;since=s.time;}
    }
    w.rate=active?1:0;
   }
   Object.assign(w,conditionalWeaponState(n,r,e,{on,ownHits,roots,hp,hit,count,refreshed,castActive,lastCast,entered,before,within,spaced,state,active,math:m}));
   if(['AlleyHunter','SerpentSpine'].includes(n))w.stack=fieldWeaponState(n,rotation,r,e);
   if(n==='DaybreakChronicles')Object.assign(w,{rate:0,magus:false});
   if(n==='FadingTwilight'){let ready=7,phase=0;for(const h of ownHits[r])if(before(h,e)){const trigger=and(gate(h),m.ge(h.time,ready)),next=m.add(phase,1);phase=m.choose(trigger,m.sub(next,m.mul(3,m.floor(m.div(next,3)))),phase);ready=m.choose(trigger,h.time+7,ready);}w.state=phase;}
   if(n==='ForgedByTheGoldenMelody'){
    const triggers=history.latest(spaced(ownHits[r].filter(h=>h.stellar),12),e).filter(h=>within(h,e,12));
    Object.assign(w,{state:Math.floor(e.time/10)%3,counterpoint_active:bool(active(triggers)),counterpoint_state:triggers.reduce((value,h)=>m.add(value,m.mul(gate(h),Math.floor(h.time/10)%3+1)),0),rate:1,counterpoint_rate:1});
   }
   if(n==='FlowerWreathedFeathers')w.stack=aimingStacks(rotation,r,e,m);
   if(n==='AquaSimulacra')w.is_enemy_around=true;
   if(n==='PrototypeCrescent')w.rate=active(ownHits[r],h=>equipmentWeakpoint(profiles[r],h)&&within(h,e,10));
   if(n==='SharpshootersOath')w.rate=e.role===r&&equipmentWeakpoint(profiles[r],e)?1:0;
   if(['MakhairaAquamarine','ForestRegalia'].includes(n))w.rate=0;
   if(n==='Cloudforged')w.stack=count(energy.histories[r].rows,e,18,2);
   if(n==='Hamayumi')w.rate=flag(energy.at(r,e).full);
   if(n==='ThunderingPulse')w.stack=m.add(m.add(active(normal,h=>within(h,e,5)),Number(castActive(r,'skill',e,10))),m.choose(energy.at(r,e).full,0,1));
   if(n==='Verdict'){
    let lastSkill=-Infinity;for(const h of ownHits[r].filter(h=>h.category==='skill'&&h.time+.2<=e.time))lastSkill=m.choose(gate(h),h.time,lastSkill);
    w.stack=m.min(2,pickups.crystals.filter(h=>within(h,e,15)).reduce((value,h)=>m.add(value,m.choose(and(gate(h),m.ge(h.time,m.add(lastSkill,.2))),1,0)),0));
   }
   if(MANUAL_WEAPON_OPTIONS[n])Object.assign(w,manual(r,n));
   Object.assign(w,health.weaponState(r,e));
   if(n==='HereticsMoltenBlade')w.rate=1;
   if(n==='ToukabouShigure')w.rate=0;
   if(['WavebreakersFin','MouunsMoon','Akuoumaru'].includes(n))w.energy=0;
   if(n==='Slingshot')Object.assign(w,{is_effect:true,rate:0});
   if(n==='Deathmatch')w.ge2=false;
   if(n==='MoonweaverDawn'){w.energy_cost=capabilities[p.character.name].energy;w.max_energy=w.energy_cost;}
   if(n==='BlackTassel')w.rate=enemy_is_slime?1:0;
   const aura={CoolSteel:['Cryo','Hydro'],DragonsBane:['Hydro','Pyro'],MagicGuide:['Hydro','Electro'],LionsRoar:['Pyro','Electro']}[n];
   if(aura)w.rate=element.some(el=>aura.includes(el))?1:0;
   if(n==='DisasterAndRemorse')Object.assign(w,disaster(r,e));
   if(n==='MissiveWindspear')w.rate=active(ownR,h=>within(h,e,10));
   if(n==='EmeraldOrb')w.rate=active(ownR,h=>['Vaporize','ElectroCharged','Frozen'].includes(h.reaction)&&within(h,e,12));
   if(n==='FruitOfFulfillment')w.stack=fruit(r,e);
   if(n==='Frostbreath'){w.active=bool(active(spaced(ownR.filter(h=>h.elements.includes('Cryo')||h.elements.includes('Hydro')),16),h=>within(h,e,15)));w.rate=1;w.energy_rate=0;}
   if(n==='EchoesOfTheHeart')Object.assign(w,{reaction_active:bool(active(ownR,h=>within(h,e,12))),stellar_active:false,reaction_rate:1,stellar_rate:0});
   if(n==='TheWidsith'){
    Object.assign(w,{t1_rate:0,t2_rate:0,t3_rate:0});
    const i=songs[r].findLastIndex(h=>within(h,e,10));if(i>=0)w[widsith_themes[r][i]]=1;
   }
  }
  const cfg=p.artifact_config={...(p.artifact_config||{})},put=(name,value)=>{if(relevant(name))cfg[configKey(name)]=value();};
  for(const name of ['TenacityOfTheMillelith','NoblesseOblige','Instructor','ArchaicPetra','ViridescentVenerer','DeepwoodMemories','HeavensGift','HeartOfTheFurnace','ScarletProof'])put(name,()=>({rate:0}));
  put('ScrollOfTheHeroOfCinderCity',()=>({elements:[],rate1:0,rate2:0}));put('SongOfDaysPast',()=>({regeneration:0,rate:0}));
  put('RealmMirrorNight',()=>({moon_state:0,moon_reaction_bonus:0}));put('SpinMoonSerenade',()=>({moon_state:0,moon_reaction_bonus:0}));put('ObsidianCodex',()=>({set2_rate:0,set4_rate:0}));
  put('GoldenTroupe',()=>({rate:!on||e.time-entered(e.time,e.rootOrder)<2?1:0}));
  const cryoNow=element.includes('Cryo'),frozenNow=frozen&&cryoNow&&element.includes('Hydro');
  put('BlizzardStrayer',()=>({critical_bonus:frozenNow?.4:cryoNow?.2:0}));
  put('ShimenawasReminiscence',()=>({rate:1}));
  // Start fully charged. With no compatible burning team, lose 10% at
  // seconds 6, 7, 8, 9 and 10. Party Pyro + Dendro keeps full coverage.
  put('UnfinishedReverie',()=>({rate:element.includes('Dendro')&&element.includes('Pyro')?1:Math.max(0,Math.min(5,10-Math.floor(e.time)))/5}));
  // The event layer supplies the per-hit probability and current ATK addition.
  put('EchoesOfAnOffering',()=>({rate:0}));
  const zeroEnergy=energy.at(r,e).zero;
  put('FinaleOfTheDeepGalleries',()=>({rate1:m.choose(active(burst,h=>within(h,e,6)),0,flag(zeroEnergy)),rate2:m.choose(active(normal,h=>within(h,e,6)),0,flag(zeroEnergy))}));
  put('DesertPavilionChronicle',()=>({rate:active(hit(r,e,['charged'],15))}));
  put('VourukashasGlow',()=>({stack:0}));
  put('HeartOfDepth',()=>({rate:castActive(r,'skill',e,15)?1:0}));put('MartialArtist',()=>({rate:castActive(r,'skill',e,8)?1:0}));
  put('GildedDreams',()=>({same_count:element.filter((v,i)=>i!==r&&v===element[r]).length,diff_count:element.filter(v=>v!==element[r]).length,rate:active(spaced(ownR,8),h=>within(h,e,8))}));
  put('PaleFlame',()=>({avg_level:refreshed(skill,e,7,2,.3),full_rate:flag(m.eq(refreshed(skill,e,7,2,.3),2))}));
  put('NymphsDream',()=>{const rows=hit(r,e,null,8),categories=new Set(rows.map(h=>h.category)),stacks=[...categories].reduce((value,cat)=>m.add(value,active(rows,h=>h.category===cat)),0);return {w1:flag(m.eq(stacks,1)),w2:flag(m.eq(stacks,2)),w3:flag(m.ge(stacks,3)),rate:1};});
  put('CrimsonWitchOfFlames',()=>({level:refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,10,3)}));
  for(const name of ['Lavawalker','Thundersoother','DisenchantmentInDeepShadow'])put(name,()=>({rate:0}));
  put('FlowerOfParadiseLost',()=>({stack:0}));put('AubadeOfMorningstarAndMoon',()=>({rate:0,is_ascendant_gleam:false}));
  put('ADayCarvedFromRisingWinds',()=>({rate:active(hit(r,e,['normal','charged','skill','burst'],6)),is_completed_witch_homework:false}));
  put('HuskOfOpulentDreams',()=>({level:huskStacks(profiles,rotation,r,e,m)}));put('NighttimeWhispersInTheEchoingWoods',()=>({rate1:castActive(r,'skill',e,10)?1:0,rate2:0}));
  for(const [name,config]of Object.entries(health.artifactState(r,e)))put(name,()=>(config));
  put('LongNightsOath',()=>({level:0}));put('RetracingBolide',()=>({rate:state(r,'shield',e)?1:0}));
  prepared[r].set(cacheKey,{weapon:structuredClone(p.weapon.params),artifacts:structuredClone(p.artifact_config)});
  return p;
 }
 function baseBuffs(builds,r,e){
  const sets=setCounts(builds),out=[],count=(j,n)=>execution.setCount?execution.setCount(j,n):(sets[j][n]||0),has=(j,n)=>m.ge(count(j,n),4);
  const add=(name,v,enabled=1)=>{if(typeof enabled!=='object'&&!enabled)return;out.push(equipmentEffect(name,Object.fromEntries(Object.entries(v).map(([k,value])=>[k,m.choose(enabled,value,0)]))));};
  const any=(name,qualifies)=>profiles.reduce((n,_,j)=>m.max(n,m.choose(qualifies(j),has(j,name),0)),0);
  add('游医2',{IncomingHealingBonus:.2},m.ge(count(r,'TravelingDoctor'),2));
  add('被怜爱的少女4',{IncomingHealingBonus:.2},any('MaidenBeloved',j=>castActive(j,'skill',e,10)||castActive(j,'burst',e,10)));
  add('昔日宗室之仪4',{ATKPercentage:.2},any('NoblesseOblige',j=>castActive(j,'burst',e,12)));
  add('教官4',{ElementalMastery:120},any('Instructor',j=>active(ownReactions[j],h=>activeRole(h.time,h.rootOrder)===j&&within(h,e,8))));
  const crystals=pickups.crystals.filter(h=>within(h,e,10)),crystalValues={};
  for(const crystal of crystals){const enabled=and(gate(crystal),has(crystal.role,'ArchaicPetra'));for(const element of new Set([...Object.keys(crystalValues),...crystal.elements]))crystalValues[element]=m.choose(enabled,crystal.elements.includes(element)?.35:0,crystalValues[element]||0);}
  if(crystals.length)add('悠古的磐岩4',Object.fromEntries(Object.entries(crystalValues).map(([el,v])=>['Bonus'+el,v])),Object.values(crystalValues).reduce((n,v)=>m.max(n,v),0));
  const leafGroups=new Map();
  for(const h of pickups.leaves){
   const weapon=profiles[h.source].weapon,moon=weapon.name==='Moonpiercer';
   if(h.role!==r||!within(h,e,12))continue;
   const label=moon?'贯月矢·苏生之叶':'种识之叶',values=moon?{ATKPercentage:.12+.04*weapon.refine}:{ElementalMastery:45+15*weapon.refine},old=leafGroups.get(label)??{values:{},enabled:0},enabled=gate(h);
   leafGroups.set(label,{enabled:m.max(old.enabled,enabled),values:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,m.choose(enabled,value,old.values[key]??0)]))});
  }
  for(const [label,{values,enabled}]of leafGroups)add(label,values,enabled);
  const cinder={};
  for(let j=0;j<profiles.length;j++){
   const {name,refine}=profiles[j].weapon;
   for(const h of ownReactions[j]){
    const grant=cinderElements(h.reaction,element[j],capabilities[profiles[j].character.name]?.nightsoul&&state(j,'nightsoul',{...h,rootOrder:h.rootOrder+.5}));
    if(!grant)continue;for(const el of grant.elements){const a=cinder[el]??[0,0];if(within(h,e,15))a[0]=m.max(a[0],m.choose(and(gate(h),has(j,'ScrollOfTheHeroOfCinderCity')),grant.first,0));if(within(h,e,20))a[1]=m.max(a[1],m.choose(and(gate(h),has(j,'ScrollOfTheHeroOfCinderCity')),grant.second,0));cinder[el]=a;}
   }
   if(name==='ThrillingTalesOfDragonSlayers'&&ttds[j].some(h=>h.role===r&&within(h,e,10)))add('讨龙英杰谭',{ATKPercentage:thrillingTalesAttack(refine)});
   if(name==='SymphonistOfScents')add('香韵奏者·甘美回奏',{ATKPercentage:symphonistAttack(refine)},sweet(j,r,e));
   if(name==='AThousandFloatingDreams'&&j!==r)add('千夜浮梦',{ElementalMastery:floatingDreamsMastery(refine)});
   if(name==='AthameArtis'&&r!==j&&activeRole(e.time,e.rootOrder)===r)add('黑蚀·白昼之刃',{ATKPercentage:.12+.04*refine},active(hit(j,e,['burst'],3)));
   if(name==='FreedomSworn')add('苍古自由之誓',{ATKPercentage:.15+.05*refine,BonusNormalAttack:.12+.04*refine,BonusChargedAttack:.12+.04*refine,BonusPlungingAttack:.12+.04*refine},active(freedom[j],h=>within(h,e,12)));
   if(j===r&&['WavebreakersFin','MouunsMoon','Akuoumaru'].includes(name))add(name,{BonusElementalBurst:(.3+.1*refine)*manual(r,name).rate});
   if(j===r&&name==='Slingshot'){const value=(.4+.06*refine)*manual(r,name).close_rate-.1;add('弹弓·命中距离覆盖',{BonusNormalAttack:value,BonusChargedAttack:value});}
   if(j===r&&name==='DaybreakChronicles'){
    const levels=daybreakStacks(rotation,r,e,profiles.some(p=>capabilities[p.character.name]?.magus),m),step=.075+.025*refine;
    add('黎明破晓之史·渐起的晓风',{BonusNormalAttack:m.mul(levels.normal,step),BonusElementalSkill:m.mul(levels.skill,step),BonusElementalBurst:m.mul(levels.burst,step)});
   }
   if(j===r&&name==='Deathmatch'){const rate=manual(r,name).ge2_rate;add('决斗之枪·敌人数覆盖',{ATKPercentage:-(.06+.02*refine)*rate,DEFPercentage:(.12+.04*refine)*rate});}
   if(j===r&&name==='ToukabouShigure')add('东花坊时雨·纸伞',{BonusBase:(.12+.04*refine)*manual(r,name).rate/(damage_scope==='all'?enemy_count:1)});
   if(j===r&&['FinaleOfTheDeep','FlowingPurity'].includes(name)){
    const amount=health.clearAmount(r,e);
    if(name==='FinaleOfTheDeep')add('海渊终曲·清契',{ATKFixed:m.min(112.5+37.5*refine,m.mul(amount,.018+.006*refine))},m.gt(amount,0));
    else {const value=m.min(.09+.03*refine,m.mul(m.div(amount,1000),.015+.005*refine));add('纯水流华·清契',Object.fromEntries(['Pyro','Hydro','Cryo','Electro','Anemo','Geo','Dendro'].map(el=>['Bonus'+el,value])),m.gt(amount,0));}
   }
  }
  if(Object.keys(cinder).length)add('烬城勇者绘卷4',Object.fromEntries(Object.entries(cinder).map(([el,a])=>['Bonus'+el,m.add(a[0],a[1])])),Object.values(cinder).flat().reduce((n,v)=>m.max(n,v),0));
  // Identical non-stacking sources use the strongest active effect. Stackable
  // conversion weapons are added individually in derivedBuffs below.
  const unique=new Map();for(const b of out){const {label,values}=b.config.ExtensionEffect;if(['千夜浮梦'].includes(label)){unique.set(label+unique.size,b);continue;}const old=unique.get(label);if(!old)unique.set(label,b);else for(const [k,v]of Object.entries(values))old.config.ExtensionEffect.values[k]=m.max(old.config.ExtensionEffect.values[k]||0,v);}
  return [...unique.values()];
 }
 function derivedBuffs(builds,r,e,panels,panelsAt){
  const latest=(rows)=>history.latest(rows.flatMap((list,j)=>list.map(h=>({...h,owner:j}))).sort(order),e);
  const latestKey=latest(keyTriggers.map((list,j)=>profiles[j].weapon.name==='KeyOfKhajNisut'?list:[]));
  const latestPeak=latest(peakTriggers.map((list,j)=>profiles[j].weapon.name==='PeakPatrolSong'?list:[]));
  const out=[];for(let j=0;j<profiles.length;j++){
   const {name,refine}=profiles[j].weapon,p=panels[j];let values;
   if(name==='WanderingEvenstar'||name==='MakhairaAquamarine'){
    const em=sum(p.elemental_mastery),ratio=j===r?1:.3;
    values={ATKFromSecondaryConversion:evenstarAttack(em,refine,ratio,m)};
   }
   if(name==='KeyOfKhajNisut')for(const h of latestKey.filter(h=>h.owner===j&&within(h,e,20))){const at={...h,order:h.order+.5};values={ElementalMasteryExtra:m.add(values?.ElementalMasteryExtra??0,m.mul(gate(h),keyMastery(sum(panelsAt(at)[j].hp),refine,m)))};}
   if(name==='PeakPatrolSong')for(const h of latestPeak.filter(h=>h.owner===j&&within(h,e,15))){const at={...h,order:h.order+.5},bonus=m.mul(gate(h),peakPatrolBonus(sum(panelsAt(at)[j].def),refine,m));values=Object.fromEntries(['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro'].map(el=>['Bonus'+el,m.add(values?.['Bonus'+el]??0,bonus)]));}
   if(name==='HymnOfTheMaelstrom'&&activeRole(e.time,e.rootOrder)===r){const {stacks,boosted}=hymn(j,e);values={ATKPercentage:hymnAttackBonus(sum(p.hp),refine,stacks,boosted,m)};}
   if(values)out.push(equipmentEffect(name,values));
  }return out;
 }
 // Converted ER contributes to the final panel and constraints after the native
 // attribute graph has evaluated ER-based conversions (Emblem, Engulfing, etc.).
 function convertedRecharge(r,panels){
  const out={};
  for(let j=0;j<profiles.length;j++)if(profiles[j].weapon.name==='XiphosMoonlight')out['西福斯的月光·'+(j+1)]=xiphosRecharge(sum(panels[j].elemental_mastery),profiles[j].weapon.refine,j===r?1:.3,m);
  return out;
 }
 return {prepare,baseBuffs,derivedBuffs,convertedRecharge,setCounts,state,reactions,hp,element,energy,pickups};
}
