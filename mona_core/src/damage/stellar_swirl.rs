
// 7.1.0: direct Stellar Swirl flat increases follow the base and EM/reaction
// bonus factors, then receive resistance, CRIT and elevation.
// Formula research: https://keqingmains.com/misc/stellar-reaction-guide/
// 2026-09-23 worked explanation: https://www.taptap.cn/moment/851912127529616541
use crate::attribute::{Attribute,AttributeCommon,AttributeName};
use crate::common::{DamageResult,Element};use crate::enemies::Enemy;
pub fn calculate<A:Attribute>(a:&A,e:&Enemy,ratio:f64)->DamageResult{
 if ratio<0.0 {return DamageResult{non_critical:0.0,critical:0.0,expectation:0.0,is_heal:false,is_shield:false};}
 use AttributeName::*;
 let atk=a.get_atk();let em=a.get_em_all().max(0.0);let discipline=1.0+a.get_value(VesnaDiscipline)*0.1;
 let flat=a.get_value(StellarSwirlFlat);let base=atk*ratio*discipline;
 let crit=a.get_value(CriticalBase).clamp(0.0,1.0);let cd=a.get_value(CriticalDamageBase)+a.get_value(StellarSwirlCritDamage);
 let damage=(base*(1.0+(atk*0.00007).clamp(0.0,0.14)+a.get_value(StellarSwirlBaseBonus))*(1.0+6.0*em/(2000.0+em)+a.get_value(StellarSwirlBonus))+flat)*(1.0+a.get_value(StellarSwirlElevation))*e.get_resistance_ratio(Element::Anemo,a.get_value(ResMinusBase)+a.get_value(ResMinusAnemo));
 DamageResult{non_critical:damage,critical:damage*(1.0+cd),expectation:damage*(1.0+crit*cd),is_heal:false,is_shield:false}
}
