// Scoped Lunar consumers; input crit values already include ordinary elemental CR/CD.
use crate::attribute::{Attribute, AttributeName};
use crate::common::DamageResult;
#[derive(Clone, Copy)]
pub enum LunarKind { Electro, Bloom, Crystallize }
impl LunarKind {
 pub fn coefficient(self)->f64 {match self{Self::Electro=>3.0,Self::Bloom=>1.0,Self::Crystallize=>1.6}}
 fn elevation(self)->AttributeName {match self{Self::Electro=>AttributeName::ElevateMoonelectro,Self::Bloom=>AttributeName::ElevateMoonbloom,Self::Crystallize=>AttributeName::ElevateMoonCrystallize}}
 fn base_bonus(self)->AttributeName {match self{Self::Electro=>AttributeName::EnhanceMoonelectroBase,Self::Bloom=>AttributeName::EnhanceMoonbloomBase,Self::Crystallize=>AttributeName::EnhanceMoonCrystallizeBase}}
 fn bonus(self)->AttributeName {match self{Self::Electro=>AttributeName::EnhanceMoonelectro,Self::Bloom=>AttributeName::EnhanceMoonbloom,Self::Crystallize=>AttributeName::EnhanceMoonCrystallize}}
}
fn result(non_critical:f64,rate:f64,damage:f64)->DamageResult {
 let rate=rate.clamp(0.0,1.0);
 DamageResult{non_critical,critical:non_critical*(1.0+damage),expectation:non_critical*(1.0+rate*damage),is_heal:false,is_shield:false}
}
pub fn finish_lunar<A:Attribute>(a:&A,kind:LunarKind,main:f64,flat:f64,cr:f64,cd:f64,resistance:f64)->DamageResult {
 use AttributeName::*;
 let (extra,rate,damage)=match kind {
  LunarKind::Electro=>(0.0,0.0,0.0),
  LunarKind::Bloom=>(a.get_value(ExtraDmgMoonbloom),a.get_value(CriticalMoonbloom),a.get_value(CriticalDamageMoonbloom)),
  LunarKind::Crystallize=>(a.get_value(ExtraDmgMoonCrystallize),0.0,0.0),
 };
 let base=main*(1.0+a.get_value(MoonReactionDamageMultiplier))+flat+extra;
 result(base*resistance*(1.0+a.get_value(kind.elevation())),cr+a.get_value(CriticalMoonReaction)+rate,cd+a.get_value(CriticalDamageMoonReaction)+damage)
}
// base_bonus/reaction_bonus/flat are EXTRA explicit contributions, excluding the
// corresponding graph attributes read here. A direct hit may consume Illuga's flat.
pub fn lunar<A:Attribute>(a:&A,kind:LunarKind,direct:bool,scaled_base:f64,flat:f64,base_bonus:f64,reaction_bonus:f64,em:f64,cr:f64,cd:f64,resistance:f64)->DamageResult {
 let em=em.max(0.0);
 let main=scaled_base*kind.coefficient()*(1.0+base_bonus+a.get_value(kind.base_bonus()))*(1.0+6.0*em/(em+2000.0)+reaction_bonus+a.get_value(kind.bonus())+a.get_value(AttributeName::EnhanceMoonReaction));
 let direct_flat=if direct&&matches!(kind,LunarKind::Crystallize){a.get_value(AttributeName::ExtraDmgDirectMoonCrystallize)}else{0.0};
 finish_lunar(a,kind,main,flat+direct_flat,cr,cd,resistance)
}
pub fn lunar_enabled<A:Attribute>(a:&A,kind:LunarKind)->bool {
 a.get_value(match kind{LunarKind::Electro=>AttributeName::LunarElectroEnabled,LunarKind::Bloom=>AttributeName::LunarBloomEnabled,LunarKind::Crystallize=>AttributeName::LunarCrystallizeEnabled})>0.0
}
pub fn stellar_conduct<A:Attribute>(a:&A,skill_base:f64,coefficient:f64,base_bonus:f64,reaction_bonus:f64,em:f64,flat:f64,cr:f64,cd:f64,resistance:f64,elevation:f64)->DamageResult {
 let em=em.max(0.0);
 let coefficient=coefficient+a.get_value(AttributeName::StellarConductBaseMultiplier);
 let main=skill_base*coefficient*(1.0+base_bonus+a.get_value(AttributeName::StellarConductBaseBonus))*(1.0+6.0*em/(em+2000.0)+reaction_bonus+a.get_value(AttributeName::EnhanceStellarSuperconduct));
 result((main+flat)*resistance*(1.0+elevation),cr,cd)
}
pub fn stellar_swirl_cryo_coefficient<A:Attribute>(a:&A,vortex_coefficient:f64)->f64 {
 vortex_coefficient+a.get_value(AttributeName::StellarSwirlReactionCryoBaseMultiplier)
}
