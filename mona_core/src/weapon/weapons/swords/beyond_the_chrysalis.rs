
use crate::attribute::{Attribute,AttributeName};use crate::character::character_common_data::CharacterCommonData;
use crate::common::WeaponType;use crate::weapon::weapon_base_atk::WeaponBaseATKFamily;use crate::weapon::weapon_sub_stat::WeaponSubStatFamily;
use crate::weapon::weapon_common_data::WeaponCommonData;use crate::weapon::weapon_effect::WeaponEffect;use crate::weapon::weapon_static_data::WeaponStaticData;use crate::weapon::weapon_trait::WeaponTrait;use crate::weapon::{WeaponConfig,WeaponName};
pub struct BeyondTheChrysalis;pub struct Effect{loyal:f64,rebel:f64}
impl<A:Attribute> WeaponEffect<A> for Effect{fn apply(&self,d:&WeaponCommonData,a:&mut A){
 a.set_value_by(AttributeName::StellarSwirlBonus,"蝶变·叛弃之风",(0.27+0.09*d.refine as f64)*self.rebel);
 a.set_value_by(AttributeName::CriticalDamageBase,"蝶变·忠忱之风",(0.4+0.16*d.refine as f64)*self.loyal);
 // 丰获之风 restores flat energy, not Recharge or damage. The UI reports it separately.
}}
impl WeaponTrait for BeyondTheChrysalis{
const META_DATA:WeaponStaticData=WeaponStaticData{name:WeaponName::BeyondTheChrysalis,internal_name:"Sword_BeyondTheChrysalis",weapon_type:WeaponType::Sword,weapon_sub_stat:Some(WeaponSubStatFamily::CriticalDamage96),weapon_base:WeaponBaseATKFamily::ATK674,star:5,#[cfg(not(target_family="wasm"))]effect:None,#[cfg(not(target_family="wasm"))]name_locale:locale!(zh_cn:"蝶变",en:"Beyond the Chrysalis")};
fn get_effect<A:Attribute>(_:&CharacterCommonData,c:&WeaponConfig)->Option<Box<dyn WeaponEffect<A>>>{
 let(loyal,rebel)=match c{
 WeaponConfig::BeyondTheChrysalis{loyal_wind,rebel_wind,on_field,loyal_rate,rebel_rate,..} if *on_field => (
 loyal_rate.unwrap_or(if *loyal_wind{100.0}else{0.0}).clamp(0.0,100.0)/100.0,
 rebel_rate.unwrap_or(if *rebel_wind{100.0}else{0.0}).clamp(0.0,100.0)/100.0),_=>(0.0,0.0)};
 Some(Box::new(Effect{loyal,rebel}))}
}
