import {compareEvents} from './team-engine/event-order.mjs';
import {characterPackages} from './team-engine/character-packages.mjs';
// Conditional state for equipment. Values come from the public WASM; this module
// owns trigger timing. Manual task settings are applied by equipment-axis-rules.
export const CONDITIONAL_WEAPON_FIELDS={
 TheUnforged:['stack','shield_rate'],Whiteblind:['stack'],SkyriderGreatsword:['stack'],TheBell:['rate'],
 Rainslasher:['rate'],BloodstainedGreatsword:['rate'],FerrousShadow:['rate'],Quartz:['rate'],LithicBlade:['liyue_count'],
 BeaconOfTheReedSea:['rate_atk','rate_hp'],MailedFlower:['rate'],TidalShadow:['rate'],PortablePowerSaw:['stack'],
 EarthShaker:['rate'],FangOfTheMountainKing:['stack'],FruitfulHook:['rate'],AThousandBlazingSuns:['rate1','rate2'],
 MasterKey:['enable','moon_state'],GestOfTheMightyWolf:['stack','ritual_active'],FlameForgedInsight:['uptime'],
 ATeaspoonOfTranscendence:['atk_active','transcend_stacks'],SongOfBrokenPines:['rate'],
 SummitShaper:['stack','shield_rate'],VortexVanquisher:['stack','shield_rate'],MemoryOfDust:['stack','shield_rate'],
 TheAlleyFlash:['rate'],LionsRoar:['rate'],DarkIronSword:['rate'],SkyriderSword:['rate'],CursedBlade:['rate'],ToukabouShigure:['rate'],
 BlackcliffLongsword:['stack'],BlackcliffPole:['stack'],BlackcliffAgate:['stack'],TwinNephrite:['rate'],
 FluteOfEzpitzal:['rate'],ExaiphanesBlade:['active','resonated_elements','rate'],StaffOfHoma:['be50_rate'],
 PrototypeStarglitter:['stack'],Deathmatch:['ge2'],StaffOfTheScarletSands:['stack'],LumidouceElegy:['stack'],
 FootprintOfTheRainbow:['rate'],TamayurateiNoOhanashi:['rate'],BloodsoakedRuins:['after_burst_rate','elegy_active'],
 SacrificersStaff:['stack'],ProspectorsShovel:['moon_state'],SongOfTheVigil:['stellar_active','rate','energy_rate'],
 LostPrayerToTheSacredWinds:['stack'],WindAndSong:['rate'],SolarPearl:['rate1','rate2'],DodocoTales:['rate1','rate2'],
 AmberBead:['stack'],JadeFallsSplendor:['rate'],BalladOfTheBoundlessBlue:['stack'],RingOfYaxche:['rate'],
 SunnyMorningSleepIn:['rate1','rate2','rate3'],ReliquaryOfTruth:['false_secret_active','true_moon_active','skill_rate','lunar_rate','overlap_rate'],
 DawningFrost:['rate_charged','rate_skill'],EtherlightSpindlelute:['rate'],BlackmarrowLantern:['moon_state'],NocturnesCurtainCall:['sacred_wine_uptime'],
 BeyondTheChrysalis:['loyal_rate','rebel_rate','plenty_rate','on_field'],SilverLight:['stacks'],
 TulaytullahsRemembrance:['stack'],SurfsUp:['stack'],VividNotions:['rate1','rate2'],ClashOfKings:['active','rate'],
 LightbearingMoonshard:['extra_active','rate'],
};
export function conditionalWeaponState(n,r,e,ctx){
 const {on,ownHits,ownReactions,activeRole,roots,hp,hit,count,refreshed,castActive,lastCast,entered,before,within,spaced,state,active:exists,math:m,history,profile}=ctx;
 const front=ownHits[r].filter(h=>h.onField),casts=roots.filter(h=>h.role===r&&h.kind==='cast'),skill=front.filter(h=>h.category==='skill');
 const na=hit(r,e,['normal'],Infinity).filter(h=>h.onField),ca=hit(r,e,['charged'],Infinity).filter(h=>h.onField);
 const nq=front.filter(h=>['normal','charged','plunge'].includes(h.category));
 const active=(rows,d)=>exists(rows,h=>within(h,e,d)),bool=value=>typeof value==='object'?value:!!value;
 if(['SummitShaper','VortexVanquisher','MemoryOfDust','TheUnforged'].includes(n))return {stack:refreshed(front,e,8,5,.3),shield_rate:state(r,'shield',e)?1:0};
 if(['Whiteblind','SkyriderGreatsword'].includes(n))return {stack:refreshed(front.filter(h=>['normal','charged'].includes(h.category)),e,6,4,.5)};
 if(n==='TheBell')return {rate:state(r,'shield',e)?1:0};
 if(n==='Quartz')return {rate:active(ownReactions[r].filter(h=>h.elements.includes('Pyro')&&activeRole(h.time,h.rootOrder)===r),12)};
 if(n==='BeaconOfTheReedSea')return {rate_atk:m.mul(.5,active(ownHits[r].filter(h=>h.category==='skill'),8)),rate_hp:state(r,'shield',e)?0:1};
 if(n==='MailedFlower')return {rate:m.max(active(skill,8),active(ownReactions[r].filter(h=>activeRole(h.time,h.rootOrder)===r),8))};
 if(n==='EarthShaker')return {rate:active(ownReactions.flat().filter(h=>h.elements.includes('Pyro')),8)};
 if(n==='FangOfTheMountainKing')return {stack:count(skill,e,6,6,.5)}; // Current roster has no Burning/Burgeon source.
 if(n==='FruitfulHook')return {rate:active(front.filter(h=>h.category==='plunge'),10)};
 if(n==='MasterKey')return {enable:bool(active(ownReactions[r],12)),moon_state:0};
 if(n==='FlameForgedInsight')return {uptime:active(spaced(ownReactions[r].filter(h=>h.reaction==='ElectroCharged'),15),15)};
 if(n==='ATeaspoonOfTranscendence')return {atk_active:true,transcend_stacks:count(ca,e,5,3,.2)};
 if(n==='SongOfBrokenPines')return {rate:0}; // Shared Millennial Movement is applied once to the team.
 if(n==='GestOfTheMightyWolf'){
  const rows=[...front.filter(h=>h.category==='normal').map(h=>({...h,gain:1})),...roots.filter(h=>h.role===r&&(h.kind==='cast'&&h.action==='skill'||h.kind==='action'&&h.action==='charged')).map(h=>({...h,gain:2}))].sort(compareEvents);
  let stack=0,last=-Infinity;
  for(const h of spaced(rows,.01))if(before(h,e)){
   const gate=history.gate(h);stack=m.choose(gate,m.min(4,m.add(m.choose(m.lt(h.time,m.add(last,4)),stack,0),h.gain)),stack);last=m.choose(gate,h.time,last);
  }
  return {stack:m.choose(m.lt(e.time,m.add(last,4)),stack,0),ritual_active:false};
 }
 if(n==='AThousandBlazingSuns'){
  let ready=-Infinity,end=-Infinity,extended=0,last=-Infinity;
  for(const h of [...casts,...front.filter(h=>['normal','charged'].includes(h.category)&&h.element!=='Physical')].sort(compareEvents))if(before(h,e)){
   const gate=history.gate(h);
   if(h.kind==='cast'){
    const trigger=m.choose(gate,m.ge(h.time,ready),0);end=m.choose(trigger,h.time+6,end);ready=m.choose(trigger,h.time+10,ready);extended=m.choose(trigger,0,extended);
   }else{
    const trigger=m.choose(gate,m.choose(m.lt(h.time,end),m.choose(m.lt(extended,6),m.ge(h.time,m.add(last,1-1e-9)),0),0),0);
    end=m.add(end,m.choose(trigger,2,0));extended=m.add(extended,m.choose(trigger,2,0));last=m.choose(trigger,h.time,last);
   }
  }
  return {rate1:m.choose(m.lt(e.time,end),1,0),rate2:0};
 }
 if(n==='TheAlleyFlash')return {rate:1};
 if(n==='LionsRoar')return {rate:0}; // Target-dependent rate is supplied at impact.
 if(n==='DarkIronSword')return {rate:active(ownReactions[r].filter(h=>activeRole(h.time,h.rootOrder)===r&&(['Overloaded','Superconduct','StellarConduct','ElectroCharged','Quicken','Aggravate','Hyperbloom','LunarCharged','SwirlElectro'].includes(h.reaction)||(h.reaction==='Swirl'&&h.elements.includes('Electro')))),12)};
 if(n==='SkyriderSword')return {rate:castActive(r,'burst',e,15)?1:0};
 if(n==='CursedBlade')return {rate:active(spaced(nq,8),8)};
 if(['FluteOfEzpitzal','FootprintOfTheRainbow'].includes(n))return {rate:castActive(r,'skill',e,15)?1:0};
 if(n==='TamayurateiNoOhanashi')return {rate:castActive(r,'skill',e,10)?1:0};
 if(n==='ExaiphanesBlade')return {active:false,hit_active:false,resonated_elements:0,rate:0};
 if(n==='PrototypeStarglitter')return {stack:refreshed(casts.filter(h=>h.action==='skill'),e,12,2)};
 if(n==='StaffOfTheScarletSands')return {stack:count(skill,e,10,3)};
 if(n==='SacrificersStaff')return {stack:count(hit(r,e,['skill'],Infinity),e,6,3)};
 if(n==='LumidouceElegy')return {stack:0};
 if(n==='BloodsoakedRuins')return {after_burst_rate:castActive(r,'burst',e,3.5)?1:0,elegy_active:false};
 if(['ProspectorsShovel','BlackmarrowLantern'].includes(n))return {moon_state:0,moon_full:false};
 if(n==='LostPrayerToTheSacredWinds')return {stack:on?Math.min(4,Math.floor((e.time-entered(e.time,e.rootOrder))/4)):0};
 if(n==='WindAndSong')return {rate:active(roots.filter(h=>h.role===r&&h.kind==='sprint'),5)};
 if(n==='SolarPearl')return {rate1:active(na,6),rate2:active(front.filter(h=>['skill','burst'].includes(h.category)),6)};
 if(n==='DodocoTales')return {rate1:active(na,6),rate2:active(ca,6)};
 if(n==='AmberBead'){const stacks=count(na,e,6,2);return {stack:stacks,stacks};}
 if(n==='JadeFallsSplendor')return {rate:castActive(r,'burst',e,3)?1:0}; // No shield creators among the four.
 if(n==='BalladOfTheBoundlessBlue')return {stack:count(nq.filter(h=>h.category!=='plunge'),e,6,3,.3)};
 if(n==='RingOfYaxche')return {rate:castActive(r,'skill',e,10)?1:0};
 if(n==='SunnyMorningSleepIn')return {rate1:0,rate2:active(hit(r,e,['skill'],Infinity),9),rate3:active(hit(r,e,['burst'],Infinity),30)};
 if(n==='ReliquaryOfTruth'){const on=castActive(r,'skill',e,12);return {false_secret_active:on,skill_active:on,true_moon_active:false,lunar_bloom_hit:false,skill_rate:on?1:0,lunar_rate:0,overlap_rate:0};}
 if(n==='DawningFrost'){const charged=active(ca,10),sk=active(skill,10);return {rate_charged:charged,charged_active:bool(charged),charged_rate:charged,rate_skill:sk,skill_active:bool(sk),skill_rate:sk};}
 if(n==='EtherlightSpindlelute'){const on=castActive(r,'skill',e,20);return {skill_active:on,rate:on?1:0};}
 if(n==='NocturnesCurtainCall')return {sacred_wine_uptime:0,lunar_active:false,rate:0};
 if(n==='LightbearingMoonshard')return {skill_active:false,extra_active:false,rate:0}; // No Lunar-Crystallize in this team.
 if(n==='SilverLight')return {stacks:count(casts.filter(h=>h.action==='skill'),e,12,2)};
 if(n==='TulaytullahsRemembrance'){
  const t=lastCast(r,'skill',e.time,e.rootOrder),valid=on&&t>=entered(e.time,e.rootOrder)&&e.time<t+12;
  return {stack:valid?m.min(10,m.add(Math.floor(e.time-t),m.mul(2,count(na.filter(h=>h.time>=t),e,Infinity,Infinity,.3)))):0};
 }
 if(n==='SurfsUp'){
  const c=spaced(casts.filter(h=>h.action==='skill'),15).findLast(h=>within(h,e,14));
  return {stack:c?m.max(0,m.sub(4,count(na.filter(h=>before(c,h)),e,Infinity,Infinity,1.5))):0}; // This team cannot Vaporize.
 }
 if(n==='VividNotions'){
  const starts=roots.filter(h=>h.role===r&&h.kind==='action'&&h.action.startsWith('plunge'));
  const landings=front.filter(h=>h.category==='plunge'&&characterPackages[profile.character.name].nativeDamage[h.index].plungeImpact);
  // Candidate-disabled impacts must not clear either active window.
  const window=rows=>rows.filter(c=>within(c,e,15)).reduce((value,c)=>m.max(value,m.choose(history.gate(c),m.choose(exists(landings,h=>before(c,h)&&h.time+.1<=e.time),0,1),0)),0);
  return {rate1:window(starts),rate2:window(casts)};
 }
 if(n==='ClashOfKings'){
  const value=exists(spaced(casts.filter(h=>h.action==='skill'),12).filter(c=>before(c,e)).map(c=>({...c,enabled:m.choose(m.lt(e.time,m.add(c.time+6,m.mul(6,exists(ca,h=>within(c,h,6))))),c.enabled??1,0)})));
  return {active:bool(value),rate:value};
 }
 if(n==='BeyondTheChrysalis'){
  const start=entered(e.time,e.rootOrder),sequence=casts.filter(h=>h.time>=start&&before(h,e));
  return {on_field:on,loyal_rate:on&&sequence.some((h,i)=>i%3===0&&within(h,e,10))?100:0,rebel_rate:on&&sequence.some((h,i)=>i%3===1&&within(h,e,10))?100:0,plenty_rate:0};
 }
 return {};
}
