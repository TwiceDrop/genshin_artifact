// Shared equipment rules consume combat facts, not a particular rotation or build.
// A reaction fact names its owner; its elements and equipment benefits are rules.
import characters from '../src/assets/_gen_character.js';
import {TEAM_DPS_REACTIONS,TEAM_DPS_CHARACTER_CAPABILITIES} from './team-dps-config.mjs';
import {equipmentReactionFacts} from './equipment-reaction-rules.mjs';
import {MANUAL_WEAPON_OPTIONS,defaultWeaponOptions,widsithTriggers} from './team-dps-weapon-options.mjs';
import {hymnAttackBonus} from './weapon-effects.mjs';
import {symphonistAttack,thrillingTalesAttack,floatingDreamsMastery,evenstarAttack,xiphosRecharge,keyMastery,peakPatrolBonus} from './equipment-effect-values.mjs';
import {CONDITIONAL_WEAPON_FIELDS,conditionalWeaponState} from './equipment-conditional-rules.mjs';
import {equipmentEnergy,equipmentPickups,aimingStacks,fieldWeaponState,daybreakStacks,equipmentWeakpoint,equipmentHitElement} from './equipment-combat-facts.mjs';
import {createEquipmentHealthRules} from './equipment-health-rules.mjs';
import {scalarMath} from './team-dps-numeric-rules.mjs';
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
export const equipmentEffect=(label,values)=>({name:'ExtensionEffect',config:{ExtensionEffect:{label,values}}});
export const before=(a,b)=>a.time<b.time||(a.time===b.time&&(a.rootOrder<b.rootOrder||(a.rootOrder===b.rootOrder&&a.order<b.order)));
const within=(a,e,seconds)=>before(a,e)&&e.time<a.time+seconds;
const spaced=(rows,seconds)=>{let last=-Infinity;return rows.filter(e=>{if(e.time-last<seconds-1e-9)return false;last=e.time;return true;});};
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);
export const AUTO_WEAPON_FIELDS={
 ...CONDITIONAL_WEAPON_FIELDS,
 ...Object.fromEntries(Object.entries(MANUAL_WEAPON_OPTIONS).map(([n,rows])=>[n,rows.map(f=>f.key)])),
 MouunsMoon:['energy','rate'],Akuoumaru:['energy','rate'],Slingshot:['is_effect','rate','close_rate'],
 AlleyHunter:['stack'],SerpentSpine:['stack'],DaybreakChronicles:['rate','magus'],FadingTwilight:['state'],
 ForgedByTheGoldenMelody:['state','counterpoint_active','counterpoint_state','rate','counterpoint_rate'],
 ATeaspoonOfTranscendence:['atk_active','transcend_stacks'],
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
 WintersHeavyHeart:['cryo_count','electro_count','radiance','rate'],NewBough:['stacks','radiance','rate'],StarsealedEdict:['skill_active','stacks','radiance'],
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
 const {events,heals,switches,activeRole,lastCast,entered}=rotation;
 const roots=rotation.roots.slice().sort(order);
 const element=profiles.map(p=>characters[p.character.name].element);
 const capabilities=TEAM_DPS_CHARACTER_CAPABILITIES,hasShield=profiles.some(p=>capabilities[p.character.name]?.shield);
 const state=(role,name,e)=>name==='shield'?hasShield:roots.some(s=>s.kind==='state'&&s.state===name&&s.role===role&&within(s,e,s.durationMs/1000));
 const reactions=equipmentReactionFacts(events.map(h=>({...h,element:equipmentHitElement(profiles[h.role],h)})),element,roots),energy=equipmentEnergy(profiles,rotation),pickups=equipmentPickups(profiles,rotation,reactions);
 const defaults=defaultWeaponOptions(),manual=(r,n)=>({...defaults[n],...weapon_conditions[r]?.[n]});
 const songs=profiles.map((_,r)=>widsithTriggers(rotation,r));
 const hp=rotation.hpEvents.slice().sort(order);
 const health=createEquipmentHealthRules(profiles,rotation,{math:m});
 const ownHits=profiles.map((_,r)=>events.filter(e=>e.role===r&&e.damageKind!=='superconduct')),ownReactions=profiles.map((_,r)=>reactions.filter(e=>e.role===r));
 const stellarTriggers=profiles.map((_,r)=>[...ownReactions[r].filter(h=>h.reaction==='StellarConduct'),...ownHits[r].filter(h=>h.stellar)].sort(order));
 const hit=(r,e,cat,span)=>ownHits[r].filter(h=>(!cat||cat.includes(h.category))&&within(h,e,span));
 const count=(rows,e,span,limit,interval=0)=>Math.min(limit,spaced(rows,interval).filter(h=>within(h,e,span)).reduce((n,h)=>n+(h.probability??1),0));
 const refreshed=(rows,e,span,limit,interval=0)=>{let n=0,last=-Infinity;for(const h of spaced(rows,interval)){if(!before(h,e))continue;n=h.time-last>=span?1:Math.min(limit,n+1);last=h.time;}return e.time<last+span?n:0;};
 const castActive=(r,kind,e,seconds)=>{const t=lastCast(r,kind,e.time,e.rootOrder);return e.time>=t&&e.time<t+seconds;};
 const sweet=health.sweet;
 const hymn=(r,e)=>({stacks:health.hymnStacks(r,e),boosted:reactions.some(h=>h.reaction==='Frozen'&&h.category==='skill'&&within(h,e,5))});
 const setCounts=builds=>builds.map(b=>{const s={};for(const a of b)s[a.set_name]=(s[a.set_name]||0)+1;return s;});
 const superconductBonus=(builds,r)=>{
  const counts=setCounts(builds)[r],count=name=>execution.setCount?execution.setCount(r,name):counts[name]??0;
  return m.add(m.choose(m.ge(count('ThunderingFury'),4),.4,0),m.choose(m.ge(count('DisenchantmentInDeepShadow'),4),.8,0));
 };
 const ttds=profiles.map((p,r)=>spaced(switches.filter(s=>s.from===r&&s.role!==r),20));
 const freedom=ownReactions.map(rows=>{const out=[];let count=0,last=-Infinity,ready=-Infinity;for(const e of rows.slice().sort(order)){if(e.time<ready||e.time-last<.5)continue;last=e.time;if(++count===2){out.push(e);ready=e.time+20;count=0;}}return out;});
 const peaks=ownHits.map(rows=>spaced(rows.filter(e=>['normal','plunge'].includes(e.category)),.1));
 function peakStacks(r,e){return refreshed(peaks[r],e,6,2);}
 const peakTriggers=peaks.map(rows=>rows.filter((e,i)=>i>0&&e.time-rows[i-1].time<6));
 const keyHits=ownHits.map(rows=>spaced(rows.filter(e=>e.category==='skill'&&e.onField),.3));
 const keyTriggers=keyHits.map(rows=>rows.filter(e=>refreshed(rows,{...e,order:e.order+.5},20,3)===3));
 const prepared=profiles.map(()=>new Map());
 const foliar=ownHits.map(rows=>{const active=new Set();let start=-Infinity,ready=-Infinity,used=0;for(const e of rows){if(e.category==='normal'&&e.time>=ready){start=e.time;ready=e.time+12;used=0;continue;}if(e.time<start+12&&used<28&&['normal','skill'].includes(e.category)){active.add(e.order);used++;}}return active;});
 const spindle=ownHits.map(rows=>{const active=new Set();let last=-Infinity;for(const e of rows.filter(h=>h.category==='skill')){if(e.time>=last+1.5){last=e.time;active.add(e.order);}else if(e.time<last+.1)active.add(e.order);}return active;});
 const bone=ownHits.map((rows,r)=>{const active=new Set();let used=0,last;for(const e of rows){const sprint=roots.filter(s=>s.role===r&&s.kind==='sprint'&&before(s,e)).at(-1);if(sprint!==last){used=0;last=sprint;}if(e.category==='normal'&&sprint&&within(sprint,e,7)&&used<18){active.add(e.order);used++;}}return active;});
 function disaster(r,e){
  let ready=-Infinity,end=-Infinity,wushe=-Infinity,wuyu=-Infinity,last=-Infinity;
  const sequence=[...roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),...switches.filter(s=>s.from===r&&s.role!==r),...ownHits[r]].sort(order);
  for(const h of sequence){
   if(!before(h,e))continue;
   if(h.kind==='switch'){end=wushe=wuyu=-Infinity;continue;}
   if(h.kind==='cast'){
    if(h.time>=ready){ready=h.time+18;end=h.time+17;wushe=wuyu=h.time+3;last=-Infinity;}
   }else if(h.time<end&&h.time-last>=.1-1e-9){
    if(['normal','charged'].includes(h.category)){wuyu+=1;last=h.time;}
    else if(['skill','burst'].includes(h.category)){wushe+=1;last=h.time;}
   }
  }
  return {rate_wushe:e.time<end&&e.time<wushe?1:0,rate_wuyu:e.time<end&&e.time<wuyu?1:0,is_secret_arts:false};
 }
 function fruit(r,e){
  let stack=0,decay=Infinity;
  for(const h of spaced(ownReactions[r],.3))if(before(h,e)){
   if(h.time>=decay)stack=Math.max(0,stack-1-Math.floor((h.time-decay)/6));
   stack=Math.min(5,stack+1);decay=h.time+6;
  }
  return e.time>=decay?Math.max(0,stack-1-Math.floor((e.time-decay)/6)):stack;
 }
 function prepare(p,r,e){
  const cacheKey=[e.time,e.rootOrder,e.order].join('/');
  const cached=prepared[r].get(cacheKey);if(cached){p.weapon.params=structuredClone(cached.weapon);p.artifact_config=structuredClone(cached.artifacts);return p;}
  const on=activeRole(e.time,e.rootOrder)===r,n=p.weapon.name;
  const combat=rotation.combatAt?.(e),target=combat?.reaction.targets[e.targetIds?.[0]??0],radiance=!!combat?.reaction.radiance;
  // Direct kernel callers do not need UI-created parameters for automatic rules.
  if(AUTO_WEAPON_FIELDS[n]?.length)p.weapon.params={[n]:{...(p.weapon.params?.[n]||{})}};
  const w=p.weapon.params?.[n];
  const normal=hit(r,e,['normal'],Infinity),skill=hit(r,e,['skill'],Infinity),burst=hit(r,e,['burst'],Infinity),ownR=ownReactions[r];
  if(w){
   if('on_field'in w)w.on_field=on;if('off_field_rate'in w)w.off_field_rate=on?0:1;
   const patch={
    ATeaspoonOfTranscendence:{atk_active:true,transcend_stacks:count(hit(r,e,['charged'],Infinity),e,5,3,.2)},
    FreedomSworn:{rate:0},XiphosMoonlight:{rate:0},WanderingEvenstar:{rate:0},KeyOfKhajNisut:{stack:refreshed(keyHits[r],e,20,3),rate:0},PeakPatrolSong:{stack:peakStacks(r,e),rate:0},
    AThousandFloatingDreams:{same_count:element.filter((v,i)=>i!==r&&v===element[r]).length,diff_count:element.filter(v=>v!==element[r]).length},
    SymphonistOfScents:{off_field_rate:on?0:1,sweet_echoes_rate:0},HymnOfTheMaelstrom:{...hymn(r,e),hp:0,on_field:false},
    AthameArtis:{burst_hit:burst.some(h=>within(h,e,3)),secret_rite:false,rate:burst.some(h=>within(h,e,3))?1:0,magus:false},StarcallersWatch:{use_buff:false,rate:0},AngelosHeptades:{shield_active:false,shield_rate:0},CranesEchoingCall:{rate:0},SapwoodBlade:{rate:0},Moonpiercer:{rate:0},
    CalamityQueller:{stack:castActive(r,'skill',e,20)?Math.min(6,Math.floor(e.time-lastCast(r,'skill',e.time,e.rootOrder))):0,backend_rate:on?0:1},
    Azurelight:{after_skill:castActive(r,'skill',e,12),zero_energy:energy.at(r,e).zero},
    MistsplitterReforged:{emblem_level:Number(!energy.at(r,e).full)+Number(castActive(r,'burst',e,10))+Number(normal.some(h=>within(h,e,5)))},
    WolfFang:{e_stack:refreshed(skill.filter(h=>h.onField),e,10,4,.1),q_stack:refreshed(burst.filter(h=>h.onField),e,10,4,.1)},PrototypeRancour:{stack:refreshed(ownHits[r].filter(h=>['normal','charged'].includes(h.category)),e,6,4,.3)},
    PrimordialJadeWingedSpear:{stack:refreshed(ownHits[r].filter(h=>h.onField),e,6,7,.3),full_rate:refreshed(ownHits[r].filter(h=>h.onField),e,6,7,.3)===7?1:0},
    IronSting:{stack:refreshed(ownHits[r].filter(h=>h.onField),e,6,2,1)},MappaMare:{stack:refreshed(ownR.filter(h=>activeRole(h.time,h.rootOrder)===r),e,10,2)},
    KagurasVerity:{stack:refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,24,3),full_rate:refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,24,3)===3?1:0},
    MountainBracingBolt:{rate:roots.some(h=>h.kind==='cast'&&h.action==='skill'&&h.role!==r&&within(h,e,8))?1:0},
    WaveridingWhirl:{rate:spaced(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),15).some(h=>within(h,e,10))?1:0,hydro_count:element.filter(v=>v==='Hydro').length},
    OathswornEye:{rate:castActive(r,'skill',e,10)?1:0},FleuveCendreFerryman:{rate:castActive(r,'skill',e,5)?1:0},EngulfingLightning:{rate:castActive(r,'burst',e,12)?1:0},
    BalladOfTheFjords:{use_effect:new Set(element).size>=3},LithicSpear:{liyue_count:0},CalamityOfEshu:{rate:state(r,'shield',e)?1:0},UrakuMisugiri:{rate:0},
    FinaleOfTheDeep:{rate1:spaced(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),10).some(h=>within(h,e,15))?1:0,rate2:0},
    FlowingPurity:{rate1:spaced(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),10).some(h=>within(h,e,15))?1:0,rate2:0},
    LightOfFoliarIncision:{rate:foliar[r].has(e.order)?1:0},SturdyBone:{rate:bone[r].has(e.order)?1:0},CinnabarSpindle:{rate:spindle[r].has(e.order)?1:0},
    SerenitysCall:{reaction_active:ownR.some(h=>within(h,e,12)),moon_full:false,rate:ownR.some(h=>within(h,e,12))?1:0,full_moon:false},Emberwell:{reaction_active:ownR.some(h=>within(h,e,12)),stellar_active:ownR.some(h=>h.reaction==='StellarConduct'&&within(h,e,12)),reaction_rate:1,stellar_rate:1},
    WhitelakeFrostfeather:{stacks:count(skill,e,8,3),stack:count(skill,e,8,3),rate:1},WintersHeavyHeart:{cryo_count:element.filter(v=>v==='Cryo').length,electro_count:element.filter(v=>v==='Electro').length,radiance,rate:1},
    NewBough:{stacks:count(ownHits[r].filter(h=>castActive(r,'skill',h,12)),e,6,3,1),radiance,rate:1},StarsealedEdict:{skill_active:castActive(r,'skill',e,20),stacks:Math.min(3,reactions.filter(h=>within(h,e,20)&&h.time>=lastCast(r,'skill',e.time,e.rootOrder)).length),radiance},
    NightweaversLookingGlass:{skill_active:['Hydro','Dendro'].includes(element[r])&&skill.some(h=>within(h,e,4.5)),lunar_bloom_active:false,northernmost_runo_active:['Hydro','Dendro'].includes(element[r])&&skill.some(h=>within(h,e,4.5)),crescent_verse_active:false,skill_rate:1,lunar_rate:0,overlap_rate:0},FracturedHalo:{after_skill_burst:castActive(r,'skill',e,20)||castActive(r,'burst',e,20),has_shield:false},
   }[n];if(patch)Object.assign(w,patch);
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
   Object.assign(w,conditionalWeaponState(n,r,e,{on,ownHits,roots,hp,hit,count,refreshed,castActive,lastCast,entered,before,within,spaced,state}));
   if(['AlleyHunter','SerpentSpine'].includes(n))w.stack=fieldWeaponState(n,rotation,r,e);
   if(n==='DaybreakChronicles')Object.assign(w,{rate:0,magus:false});
   if(n==='FadingTwilight'){let ready=7,phase=0;for(const h of ownHits[r])if(before(h,e)&&h.time>=ready){phase=(phase+1)%3;ready=h.time+7;}w.state=phase;}
   if(n==='ForgedByTheGoldenMelody'){
    const trigger=spaced(ownHits[r].filter(h=>h.stellar),12).findLast(h=>within(h,e,12));
    Object.assign(w,{state:Math.floor(e.time/10)%3,counterpoint_active:!!trigger,counterpoint_state:trigger?Math.floor(trigger.time/10)%3+1:0,rate:1,counterpoint_rate:1});
   }
   if(n==='FlowerWreathedFeathers')w.stack=aimingStacks(rotation,r,e);
   if(n==='AquaSimulacra')w.is_enemy_around=true;
   if(n==='PrototypeCrescent')w.rate=ownHits[r].some(h=>equipmentWeakpoint(profiles[r],h)&&within(h,e,10))?1:0;
   if(n==='SharpshootersOath')w.rate=e.role===r&&equipmentWeakpoint(profiles[r],e)?1:0;
   if(['MakhairaAquamarine','ForestRegalia'].includes(n))w.rate=0;
   if(n==='Cloudforged')w.stack=count(energy.histories[r].rows,e,18,2);
   if(n==='Hamayumi')w.rate=energy.at(r,e).full?1:0;
   if(n==='ThunderingPulse')w.stack=Number(normal.some(h=>within(h,e,5)))+Number(castActive(r,'skill',e,10))+Number(!energy.at(r,e).full);
   if(n==='Verdict'){
    const lastSkill=ownHits[r].filter(h=>h.category==='skill'&&h.time+.2<=e.time).at(-1);
    w.stack=Math.min(2,pickups.crystals.filter(h=>within(h,e,15)&&(!lastSkill||h.time>=lastSkill.time+.2)).length);
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
   if(aura)w.rate=(combat?aura.some(el=>(target[el]??0)>0):element.some(el=>aura.includes(el)))?1:0;
   if(n==='DisasterAndRemorse')Object.assign(w,disaster(r,e));
   if(n==='MissiveWindspear')w.rate=ownR.some(h=>within(h,e,10))?1:0;
   if(n==='EmeraldOrb')w.rate=ownR.some(h=>['Vaporize','ElectroCharged','Frozen'].includes(h.reaction)&&within(h,e,12))?1:0;
   if(n==='FruitOfFulfillment')w.stack=fruit(r,e);
   if(n==='Frostbreath'){w.active=spaced(ownR.filter(h=>h.elements.includes('Cryo')||h.elements.includes('Hydro')),16).some(h=>within(h,e,15));w.rate=1;w.energy_rate=0;}
   if(n==='EchoesOfTheHeart')Object.assign(w,{reaction_active:ownR.some(h=>within(h,e,12)),stellar_active:ownR.some(h=>h.reaction==='StellarConduct'&&within(h,e,12)),reaction_rate:1,stellar_rate:1});
   if(n==='TheWidsith'){
    Object.assign(w,{t1_rate:0,t2_rate:0,t3_rate:0});
    const i=songs[r].findLastIndex(h=>within(h,e,10));if(i>=0)w[widsith_themes[r][i]]=1;
   }
  }
  const cfg=p.artifact_config={...(p.artifact_config||{})},put=(name,v)=>cfg['config_'+name.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase()]=v;
  for(const name of ['TenacityOfTheMillelith','NoblesseOblige','Instructor','ArchaicPetra','ViridescentVenerer','DeepwoodMemories','HeavensGift','HeartOfTheFurnace','ScarletProof'])put(name,{rate:0});
  put('ScrollOfTheHeroOfCinderCity',{elements:[],rate1:0,rate2:0});put('SongOfDaysPast',{regeneration:0,rate:0});
  put('RealmMirrorNight',{moon_state:0,moon_reaction_bonus:0});put('SpinMoonSerenade',{moon_state:0,moon_reaction_bonus:0});put('ObsidianCodex',{set2_rate:0,set4_rate:0});
  put('GoldenTroupe',{rate:!on||e.time-entered(e.time,e.rootOrder)<2?1:0});
  const cryoNow=combat?target.Cryo>0:element.includes('Cryo'),frozenNow=!combat&&frozen&&cryoNow&&element.includes('Hydro');
  put('BlizzardStrayer',{critical_bonus:frozenNow?.4:cryoNow?.2:0});
  put('ShimenawasReminiscence',{rate:1});
  // Start fully charged. With no compatible burning team, lose 10% at
  // seconds 6, 7, 8, 9 and 10. Party Pyro + Dendro keeps full coverage.
  put('UnfinishedReverie',{rate:element.includes('Dendro')&&element.includes('Pyro')?1:Math.max(0,Math.min(5,10-Math.floor(e.time)))/5});
  // The event layer supplies the per-hit probability and current ATK addition.
  put('EchoesOfAnOffering',{rate:0});
  const zeroEnergy=energy.at(r,e).zero;
  put('FinaleOfTheDeepGalleries',{rate1:zeroEnergy&&!burst.some(h=>within(h,e,6))?1:0,rate2:zeroEnergy&&!normal.some(h=>within(h,e,6))?1:0});
  put('DesertPavilionChronicle',{rate:hit(r,e,['charged'],15).length?1:0});
  put('VourukashasGlow',{stack:0});
  put('HeartOfDepth',{rate:castActive(r,'skill',e,15)?1:0});put('MartialArtist',{rate:castActive(r,'skill',e,8)?1:0});
  put('GildedDreams',{same_count:element.filter((v,i)=>i!==r&&v===element[r]).length,diff_count:element.filter(v=>v!==element[r]).length,rate:spaced(ownR,8).some(h=>within(h,e,8))?1:0});
  put('PaleFlame',{avg_level:refreshed(skill,e,7,2,.3),full_rate:refreshed(skill,e,7,2,.3)===2?1:0});
  const categories=new Set(hit(r,e,null,8).map(h=>h.category)),stacks=categories.size;
  put('NymphsDream',{w1:stacks===1?1:0,w2:stacks===2?1:0,w3:stacks>=3?1:0,rate:1});
  put('CrimsonWitchOfFlames',{level:refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,10,3)});
  for(const name of ['Lavawalker','Thundersoother','DisenchantmentInDeepShadow'])put(name,{rate:0});
  if(combat){put('Thundersoother',{rate:target.Electro>0?1:0});put('DisenchantmentInDeepShadow',{rate:target.superconduct||target.stellarConduct?1:0});}
  put('FlowerOfParadiseLost',{stack:0});put('AubadeOfMorningstarAndMoon',{rate:0,is_ascendant_gleam:false});
  put('ADayCarvedFromRisingWinds',{rate:hit(r,e,['normal','charged','skill','burst'],6).length?1:0,is_completed_witch_homework:false});
  let husk=0,lastGain=0,backTick=3,front=activeRole(0,-1)===r;
  for(const change of [...switches.filter(s=>(s.from===r||s.role===r)&&before(s,e)),...ownHits[r].filter(h=>h.onField&&element[r]==='Geo'&&before(h,e)),{time:e.time,role:activeRole(e.time,e.rootOrder)}].sort(order)){
   if(!front)while(backTick<=change.time){husk=Math.min(4,husk+1);lastGain=backTick;backTick+=3;}
   else if(change.time>=lastGain+6){const lost=Math.floor((change.time-lastGain)/6);husk=Math.max(0,husk-lost);lastGain+=lost*6;}
   if(change.category&&change.time-lastGain>=.3){husk=Math.min(4,husk+1);lastGain=change.time;}
   if(!change.category&&(change.role===r)!==front){front=change.role===r;if(!front)backTick=change.time+3;}
  }
  put('HuskOfOpulentDreams',{level:husk});put('NighttimeWhispersInTheEchoingWoods',{rate1:castActive(r,'skill',e,10)?1:0,rate2:0});
  for(const [name,config]of Object.entries(health.artifactState(r,e)))put(name,config);
  put('LongNightsOath',{level:Math.min(5,['plunge','charged','skill'].reduce((n,cat)=>n+spaced(ownHits[r].filter(h=>h.category===cat),1).filter(h=>within(h,e,6)).length*(cat==='plunge'?1:2),0))});put('RetracingBolide',{rate:state(r,'shield',e)?1:0});
  prepared[r].set(cacheKey,{weapon:structuredClone(p.weapon.params),artifacts:structuredClone(p.artifact_config)});
  return p;
 }
 function baseBuffs(builds,r,e){
  const sets=setCounts(builds),out=[],count=(j,n)=>execution.setCount?execution.setCount(j,n):(sets[j][n]||0),has=(j,n)=>m.ge(count(j,n),4);
  const add=(name,v,enabled=1)=>{if(typeof enabled!=='object'&&!enabled)return;out.push(equipmentEffect(name,Object.fromEntries(Object.entries(v).map(([k,value])=>[k,m.choose(enabled,value,0)]))));};
  const any=(name,qualifies)=>profiles.reduce((n,_,j)=>qualifies(j)?m.max(n,has(j,name)):n,0);
  add('游医2',{IncomingHealingBonus:.2},m.ge(count(r,'TravelingDoctor'),2));
  add('被怜爱的少女4',{IncomingHealingBonus:.2},any('MaidenBeloved',j=>castActive(j,'skill',e,10)||castActive(j,'burst',e,10)));
  add('千岩牢固4',{ATKPercentage:.2},any('TenacityOfTheMillelith',j=>spaced(ownHits[j].filter(h=>h.category==='skill'),.5).some(h=>within(h,e,3))));
  add('昔日宗室之仪4',{ATKPercentage:.2},any('NoblesseOblige',j=>castActive(j,'burst',e,12)));
  add('教官4',{ElementalMastery:120},any('Instructor',j=>ownReactions[j].some(h=>activeRole(h.time,h.rootOrder)===j&&within(h,e,8))));
  const furnaceActive=j=>stellarTriggers[j].some(h=>within(h,e,12));
  add('炉火之心4·攻击力',{ATKPercentage:.12},furnaceActive(r)?has(r,'HeartOfTheFurnace'):0);
  add('炉火之心4·星伤',{EnhanceStellarSuperconduct:.5},any('HeartOfTheFurnace',furnaceActive));
  const crystals=pickups.crystals.filter(h=>within(h,e,10)),crystalValues={};
  for(const crystal of crystals){const enabled=has(crystal.role,'ArchaicPetra');for(const element of new Set([...Object.keys(crystalValues),...crystal.elements]))crystalValues[element]=m.choose(enabled,crystal.elements.includes(element)?.35:0,crystalValues[element]||0);}
  if(crystals.length)add('悠古的磐岩4',Object.fromEntries(Object.entries(crystalValues).map(([el,v])=>['Bonus'+el,v])),Object.values(crystalValues).reduce((n,v)=>m.max(n,v),0));
  const leafGroups=new Map();
  for(const h of pickups.leaves){
   const weapon=profiles[h.source].weapon,moon=weapon.name==='Moonpiercer';
   if(h.role!==r||!within(h,e,12))continue;
   leafGroups.set(moon?'贯月矢·苏生之叶':'种识之叶',moon?{ATKPercentage:.12+.04*weapon.refine}:{ElementalMastery:45+15*weapon.refine});
  }
  for(const [label,values]of leafGroups)add(label,values);
  const cinder={};
  for(let j=0;j<profiles.length;j++){
   const {name,refine}=profiles[j].weapon;
   for(const h of ownReactions[j]){
    const grant=cinderElements(h.reaction,element[j],capabilities[profiles[j].character.name]?.nightsoul&&state(j,'nightsoul',{...h,rootOrder:h.rootOrder+.5}));
    if(!grant)continue;for(const el of grant.elements){const a=cinder[el]??[0,0];if(within(h,e,15))a[0]=m.max(a[0],m.choose(has(j,'ScrollOfTheHeroOfCinderCity'),grant.first,0));if(within(h,e,20))a[1]=m.max(a[1],m.choose(has(j,'ScrollOfTheHeroOfCinderCity'),grant.second,0));cinder[el]=a;}
   }
   if(name==='ThrillingTalesOfDragonSlayers'&&ttds[j].some(h=>h.role===r&&within(h,e,10)))add('讨龙英杰谭',{ATKPercentage:thrillingTalesAttack(refine)});
   if(name==='SymphonistOfScents')add('香韵奏者·甘美回奏',{ATKPercentage:symphonistAttack(refine)},sweet(j,r,e));
   if(name==='AThousandFloatingDreams'&&j!==r)add('千夜浮梦',{ElementalMastery:floatingDreamsMastery(refine)});
   if(name==='AthameArtis'&&r!==j&&activeRole(e.time,e.rootOrder)===r&&hit(j,e,['burst'],3).length)add('黑蚀·白昼之刃',{ATKPercentage:.12+.04*refine});
   if(name==='FreedomSworn'&&freedom[j].some(h=>within(h,e,12)))add('苍古自由之誓',{ATKPercentage:.15+.05*refine,BonusNormalAttack:.12+.04*refine,BonusChargedAttack:.12+.04*refine,BonusPlungingAttack:.12+.04*refine});
   if(j===r&&['WavebreakersFin','MouunsMoon','Akuoumaru'].includes(name))add(name,{BonusElementalBurst:(.3+.1*refine)*manual(r,name).rate});
   if(j===r&&name==='KagurasVerity')add('神乐之真意·星超导',{EnhanceStellarSuperconduct:(.09+.03*refine)*refreshed(roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='skill'),e,24,3)});
   if(j===r&&name==='Slingshot'){const value=(.4+.06*refine)*manual(r,name).close_rate-.1;add('弹弓·命中距离覆盖',{BonusNormalAttack:value,BonusChargedAttack:value});}
   if(j===r&&name==='DaybreakChronicles'){
    const levels=daybreakStacks(rotation,r,e,profiles.some(p=>capabilities[p.character.name]?.magus)),step=.075+.025*refine;
    add('黎明破晓之史·渐起的晓风',{BonusNormalAttack:levels.normal*step,BonusElementalSkill:levels.skill*step,BonusElementalBurst:levels.burst*step});
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
  const latest=(rows)=>rows.flatMap((list,j)=>list.filter(h=>before(h,e)).map(h=>({...h,owner:j}))).sort(order).at(-1);
  const latestKey=latest(keyTriggers.map((list,j)=>profiles[j].weapon.name==='KeyOfKhajNisut'?list:[]));
  const latestPeak=latest(peakTriggers.map((list,j)=>profiles[j].weapon.name==='PeakPatrolSong'?list:[]));
  const out=[];for(let j=0;j<profiles.length;j++){
   const {name,refine}=profiles[j].weapon,p=panels[j];let values;
   if(name==='WanderingEvenstar'||name==='MakhairaAquamarine'){
    const em=sum(p.elemental_mastery),ratio=j===r?1:.3;
    values={ATKFromSecondaryConversion:evenstarAttack(em,refine,ratio,m)};
   }
   if(name==='KeyOfKhajNisut'&&latestKey?.owner===j&&within(latestKey,e,20)){const at={...latestKey,order:latestKey.order+.5};values={ElementalMasteryExtra:keyMastery(sum(panelsAt(at)[j].hp),refine,m)};}
   if(name==='PeakPatrolSong'&&latestPeak?.owner===j&&within(latestPeak,e,15)){const at={...latestPeak,order:latestPeak.order+.5},bonus=peakPatrolBonus(sum(panelsAt(at)[j].def),refine,m);values=Object.fromEntries(['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro'].map(el=>['Bonus'+el,bonus]));}
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
 return {prepare,baseBuffs,derivedBuffs,convertedRecharge,setCounts,superconductBonus,state,reactions,hp,element,energy,pickups};
}
