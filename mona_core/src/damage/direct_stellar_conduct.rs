// https://keqingmains.com/misc/stellar-reaction-guide/ ; V4 Mitya uses EM in place of ATK.
use crate::attribute::{Attribute,AttributeCommon,AttributeName};use crate::common::{DamageResult,Element,SkillType};use crate::enemies::Enemy;
pub fn calculate<A:Attribute>(a:&A,e:&Enemy,ratio:f64,independent:f64,base_bonus:f64,skill:SkillType)->DamageResult{use AttributeName::*;
 if ratio==0.0{return DamageResult{non_critical:0.0,critical:0.0,expectation:0.0,is_heal:false,is_shield:false};}
 let em=a.get_em_all().max(0.0);let k=1.0+a.get_value(StellarConductBaseMultiplier);
 let main=em*ratio*independent*k*(1.0+base_bonus+a.get_value(StellarConductBaseBonus))*(1.0+6.0*em/(2000.0+em)+a.get_value(EnhanceStellarSuperconduct));
 let flat=a.get_value(StellarConductFlat)+a.get_value(StellarConductFlatElectro);
 let n=(main+flat)*e.get_resistance_ratio(Element::Electro,a.get_value(ResMinusBase)+a.get_value(ResMinusElectro))*(1.0+a.get_value(StellarConductElevation));
 let cr=((a.get_value(CriticalBase)+a.get_value(CriticalAttacking)+a.get_value(CriticalElectro))+a.get_value(StellarConductCritRate)).clamp(0.0,1.0);let cd=(a.get_value(CriticalDamageBase)+a.get_value(CriticalDamageElectro))+a.get_value(StellarConductCritDamage)+a.get_value(StellarConductCritDamageElectro);
 DamageResult{non_critical:n,critical:n*(1.0+cd),expectation:n*(1.0+cr*cd),is_heal:false,is_shield:false}
}
