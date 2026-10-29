// Conditional state for equipment. Values come from the public WASM; this module
// owns trigger timing. Manual task settings are applied by equipment-axis-rules.
export const CONDITIONAL_WEAPON_FIELDS={
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
 const {on,ownHits,roots,hp,hit,count,refreshed,castActive,lastCast,entered,before,within,spaced,state,active:exists,math:m}=ctx;
 const front=ownHits[r].filter(h=>h.onField),casts=roots.filter(h=>h.role===r&&h.kind==='cast'),skill=front.filter(h=>h.category==='skill');
 const na=hit(r,e,['normal'],Infinity).filter(h=>h.onField),ca=hit(r,e,['charged'],Infinity).filter(h=>h.onField);
 const nq=front.filter(h=>['normal','charged','plunge'].includes(h.category));
 const active=(rows,d)=>exists(rows,h=>within(h,e,d)),bool=value=>typeof value==='object'?value:!!value;
 if(['SummitShaper','VortexVanquisher','MemoryOfDust'].includes(n))return {stack:refreshed(front,e,8,5,.3),shield_rate:state(r,'shield',e)?1:0};
 if(n==='TheAlleyFlash')return {rate:1};
 if(['LionsRoar','DarkIronSword'].includes(n))return {rate:0}; // No Pyro/Electro application in this team.
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
 if(n==='SongOfTheVigil')return {stellar_active:false,rate:0,energy_rate:0};
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
 if(n==='VividNotions')return {rate1:0,rate2:castActive(r,'skill',e,15)||castActive(r,'burst',e,15)?1:0}; // No plunge action in this adapter.
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
