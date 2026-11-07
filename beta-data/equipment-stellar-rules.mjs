// Keep passive arithmetic in the common numeric graph: independently sampling
// a native mode boolean and a stack count loses their product.
export const STELLAR_WEAPON_NEUTRAL={
 Emberwell:{reaction_active:false,stellar_active:false,reaction_rate:0,stellar_rate:0},
 EchoesOfTheHeart:{reaction_active:false,stellar_active:false,reaction_rate:0,stellar_rate:0},
 SongOfTheVigil:{stellar_active:false,rate:0,energy_rate:0},
 NewBough:{stacks:0,radiance:false,rate:0},
 WintersHeavyHeart:{cryo_count:0,electro_count:0,radiance:false,rate:0},
 BladeOfAtonement:{reaction_active:false,stellar_active:false,reaction_rate:0,stellar_rate:0},
 StarsealedEdict:{skill_active:false,stacks:0,radiance:false},
};
const labels={Emberwell:'引火之源',EchoesOfTheHeart:'寸心余响',SongOfTheVigil:'戍望谣歌',NewBough:'新枝',WintersHeavyHeart:'凝雪沉心',BladeOfAtonement:'救赎之斩',StarsealedEdict:'秘星典谕'};
export function stellarEquipmentEffect(weapon,e,{math:m,history,rotation,reactions,teamReactions,hits,casts,elements}){
 const name=weapon.name;if(!STELLAR_WEAPON_NEUTRAL[name])return null;
 const k=1+(weapon.refine-1)/4,active=rows=>history.any(rows,h=>history.within(h,e,12));
 let attack=0,em=0,stellar=0,critDamage=0;
 if(name==='StarsealedEdict'){
  // Cast snapshots read the state granted by that cast, like castActive in
  // the existing equipment rules; a prior same-time position still cannot.
  const at={...e,step:(e.step??0)+1};
  for(const c of history.latest(casts,at).filter(c=>history.within(c,at,20))){
   const stacks=history.count(teamReactions.filter(h=>history.within(c,h,20)),e,Infinity,3),enabled=history.gate(c);
   em=m.add(em,m.choose(enabled,m.mul(k,m.add(48,m.mul(24,stacks))),0));
   critDamage=m.add(critDamage,m.choose(enabled,m.choose(rotation.reactionAt(e).radiance,m.mul(.12*k,stacks),0),0));
  }
 }else if(['Emberwell','EchoesOfTheHeart','SongOfTheVigil','BladeOfAtonement'].includes(name)){
  const star=active(reactions.filter(h=>h.reaction==='StellarConduct'||h.reaction==='StellarSwirl'));
  if(name==='BladeOfAtonement'){em=m.mul(64*k,active(reactions));attack=m.mul(.16*k,star);}
  else if(name==='SongOfTheVigil')attack=m.mul(.2*k,star);
  else {const ordinary=active(reactions);if(name==='Emberwell')attack=m.mul(.16*k,ordinary);else em=m.mul(60*k,ordinary);stellar=m.mul(.16*k,star);}
 }else{
  const radiance=rotation.reactionAt?.(e).radiance??0;
  if(name==='WintersHeavyHeart'){
   const cryo=elements.filter(v=>v==='Cryo').length,electro=elements.filter(v=>v==='Electro').length;
   attack=m.choose(radiance,0,.048*k*electro);em=m.choose(radiance,20*k*(cryo+electro),24*k*cryo);stellar=m.choose(radiance,.06*k*(cryo+electro),0);
  }else{
   const eligible=hits.map(h=>({...h,enabled:m.choose(history.gate(h),history.any(casts,c=>history.within(c,h,12)),0)}));
   const stacks=history.count(eligible,e,6,3,1);
   attack=m.mul(stacks,m.choose(radiance,.06*k,.04*k));em=m.choose(radiance,0,m.mul(20*k,stacks));stellar=m.choose(radiance,m.mul(.08*k,stacks),0);
  }
 }
 const values={ATKPercentage:attack,ElementalMastery:em};
 if(e.damageModel==='reaction.stellarConduct')values.EnhanceStellarSuperconduct=stellar;
 if(name==='StarsealedEdict'&&e.damageModel==='reaction.stellarConduct')values.StellarConductCritDamage=critDamage;
 return {label:labels[name]+'·战斗状态',values};
}
