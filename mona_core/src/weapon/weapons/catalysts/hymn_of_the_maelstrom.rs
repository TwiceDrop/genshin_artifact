
use crate::attribute::{Attribute,AttributeName,AttributeCommon};
use crate::common::i18n::locale;
use crate::character::character_common_data::CharacterCommonData;
use crate::common::WeaponType;
use crate::weapon::weapon_base_atk::WeaponBaseATKFamily;
use crate::weapon::weapon_sub_stat::WeaponSubStatFamily;
use crate::weapon::weapon_common_data::WeaponCommonData;
use crate::weapon::weapon_effect::WeaponEffect;
use crate::weapon::weapon_static_data::WeaponStaticData;
use crate::weapon::weapon_trait::WeaponTrait;
use crate::weapon::{WeaponConfig,WeaponName};
pub struct HymnOfTheMaelstrom;pub struct Effect{stacks:usize,boosted:bool,on:bool,hp:f64}
impl<A:Attribute> WeaponEffect<A> for Effect {
 fn apply(&self,d:&WeaponCommonData,a:&mut A){use AttributeName::*;let p=0.03+d.refine as f64*0.01;let m=if self.boosted{1.75}else{1.0};let n=self.stacks.min(3) as f64;
 a.set_value_by(HealingBonus,"漩流颂歌·治疗",p);a.add_hp_percentage("漩流颂歌·生命",p*m*n);
 if self.on && self.hp>0.0 {
  // This is an explicitly supplied final HP, already including all active HP bonuses.
  a.add_atk_percentage("漩流颂歌·自定义生命转攻击",((self.hp-40000.0).max(0.0)/1000.0*(p/10.0)).min(p*2.0)*m*n);
 } else if self.on{a.add_edge2(HP,ATKBase,ATKPercentage,Box::new(move|h,b|(((h-40000.0).max(0.0)/1000.0)*(p/10.0)).min(p*2.0)*m*n*b),Box::new(move|g,h,b|(if h>40000.0&&h<60000.0{g*b*p/10000.0*m*n}else{0.0},g*(((h-40000.0).max(0.0)/1000.0)*(p/10.0)).min(p*2.0)*m*n)),"漩流颂歌·场上加攻");}
 }
}
impl WeaponTrait for HymnOfTheMaelstrom {
 const META_DATA:WeaponStaticData=WeaponStaticData{name:WeaponName::HymnOfTheMaelstrom,internal_name:"Catalyst_HymnOfTheMaelstrom",weapon_type:WeaponType::Catalyst,weapon_sub_stat:Some(WeaponSubStatFamily::HP144),weapon_base:WeaponBaseATKFamily::ATK542,star:5,
 #[cfg(not(target_family="wasm"))]effect:None,#[cfg(not(target_family="wasm"))]name_locale:locale!(zh_cn: "漩流颂歌", en: "Hymn of the Maelstrom")};
 fn get_effect<A:Attribute>(_:&CharacterCommonData,c:&WeaponConfig)->Option<Box<dyn WeaponEffect<A>>>{let(stacks,boosted,on,hp)=match c{WeaponConfig::HymnOfTheMaelstrom{stacks,boosted,on_field,hp}=>(*stacks,*boosted,*on_field,*hp),_=>(0,false,true,0.0)};Some(Box::new(Effect{stacks,boosted,on,hp}))}
}
