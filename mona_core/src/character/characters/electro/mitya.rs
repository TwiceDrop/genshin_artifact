// V4 7.1.53 / 48845164. Source: https://gi.gachabase.net/characters/10000136/mitya/beta/7.1.53/48845164?lang=chs
use crate::attribute::{Attribute,AttributeName,AttributeCommon};
use crate::character::{CharacterConfig,CharacterName,CharacterStaticData};
use crate::character::character_common_data::CharacterCommonData;
use crate::character::character_sub_stat::CharacterSubStatFamily;
use crate::character::skill_config::CharacterSkillConfig;
use crate::character::traits::{CharacterTrait,CharacterSkillMap};
use crate::character::macros::damage_enum;
use crate::common::{ChangeAttribute,Element,SkillType,WeaponType};
use crate::common::i18n::locale;
use crate::damage::DamageContext;
use crate::damage::damage_builder::DamageBuilder;
use crate::target_functions::TargetFunction;
use crate::team::TeamQuantization;
use crate::weapon::weapon_common_data::WeaponCommonData;
const S1:[[f64;10];15]=[[0.587984,0.483008,0.690224,1.3688,50.0,0.568288,1.136335,1.419344,1.68,2.24],[0.632083,0.519234,0.741991,1.47146,50.0,0.614544,1.228828,1.534872,1.806,2.408],[0.676182,0.555459,0.793758,1.57412,50.0,0.6608,1.32132,1.6504,1.932,2.576],[0.73498,0.60376,0.86278,1.711,50.0,0.72688,1.453452,1.81544,2.1,2.8],[0.779079,0.639986,0.914547,1.81366,50.0,0.773136,1.545944,1.930968,2.226,2.968],[0.823178,0.676211,0.966314,1.91632,50.0,0.826,1.65165,2.063,2.352,3.136],[0.881976,0.724512,1.035336,2.0532,50.0,0.898688,1.796995,2.244544,2.52,3.36],[0.940774,0.772813,1.104358,2.19008,50.0,0.971376,1.94234,2.426088,2.688,3.584],[0.999573,0.821114,1.173381,2.32696,50.0,1.044064,2.087686,2.607632,2.856,3.808],[1.058371,0.869414,1.242403,2.46384,50.0,1.12336,2.246244,2.80568,3.024,4.032],[1.11717,0.917715,1.311426,2.60072,50.0,1.202656,2.404802,3.003728,3.192,4.256],[1.175968,0.966016,1.380448,2.7376,50.0,1.281952,2.563361,3.201776,3.36,4.48],[1.249466,1.026392,1.466726,2.9087,50.0,1.361248,2.721919,3.399824,3.57,4.76],[1.322964,1.086768,1.553004,3.0798,50.0,1.440544,2.880478,3.597872,3.78,5.04],[1.396462,1.147144,1.639282,3.2509,50.0,1.51984,3.039036,3.79592,3.99,5.32]];
const S2:[[f64;7];15]=[[0.9072,1.296,0.72,0.8,0.92,25.0,18.0],[0.97524,1.3932,0.774,0.86,0.989,25.0,18.0],[1.04328,1.4904,0.828,0.92,1.058,25.0,18.0],[1.134,1.62,0.9,1.0,1.15,25.0,18.0],[1.20204,1.7172,0.954,1.06,1.219,25.0,18.0],[1.27008,1.8144,1.008,1.12,1.288,25.0,18.0],[1.3608,1.944,1.08,1.2,1.38,25.0,18.0],[1.45152,2.0736,1.152,1.28,1.472,25.0,18.0],[1.54224,2.2032,1.224,1.36,1.564,25.0,18.0],[1.63296,2.3328,1.296,1.44,1.656,25.0,18.0],[1.72368,2.4624,1.368,1.52,1.748,25.0,18.0],[1.8144,2.592,1.44,1.6,1.84,25.0,18.0],[1.9278,2.754,1.53,1.7,1.955,25.0,18.0],[2.0412,2.916,1.62,1.8,2.07,25.0,18.0],[2.1546,3.078,1.71,1.9,2.185,25.0,18.0]];
const S3:[[f64;5];15]=[[3.336,6.672,3.0,15.0,60.0],[3.5862,7.1724,3.0,15.0,60.0],[3.8364,7.6728,3.0,15.0,60.0],[4.17,8.34,3.0,15.0,60.0],[4.4202,8.8404,3.0,15.0,60.0],[4.6704,9.3408,3.0,15.0,60.0],[5.004,10.008,3.0,15.0,60.0],[5.3376,10.6752,3.0,15.0,60.0],[5.6712,11.3424,3.0,15.0,60.0],[6.0048,12.0096,3.0,15.0,60.0],[6.3384,12.6768,3.0,15.0,60.0],[6.672,13.344,3.0,15.0,60.0],[7.089,14.178,3.0,15.0,60.0],[7.506,15.012,3.0,15.0,60.0],[7.923,15.846,3.0,15.0,60.0]];
damage_enum!(MityaDamageEnum Normal1 Normal2 Normal3 Charged Plunging1 Plunging2 Plunging3 Gradient GradientStellar Tap Hold Steady OverflowStellar DetonationStellar Burst C4Stellar);
pub struct Mitya;
impl CharacterTrait for Mitya{
const STATIC_DATA:CharacterStaticData=CharacterStaticData{name:CharacterName::Mitya,internal_name:"Mitya",element:Element::Electro,hp:[906,2349,3126,4677,5229,6016,6752,7547,8098,8901,9453,10264,10816,11634,12460],atk:[20,53,71,106,118,136,153,171,183,201,214,232,245,263,322],def:[62,160,213,318,356,409,459,514,551,606,643,698,736,792,848],sub_stat:CharacterSubStatFamily::CriticalDamage384,weapon_type:WeaponType::Catalyst,star:5,name_locale:locale!(zh_cn:"米提亚",en:"Mitya"),skill_name1:locale!(zh_cn:"链式反应",en:"链式反应"),skill_name2:locale!(zh_cn:"律定·变量侦测",en:"律定·变量侦测"),skill_name3:locale!(zh_cn:"解析·递变之理",en:"解析·递变之理")};
type SkillType=();const SKILL:()=();type DamageEnumType=MityaDamageEnum;type RoleEnum=();
#[cfg(not(target_family="wasm"))]const SKILL_MAP:CharacterSkillMap=CharacterSkillMap{skill1:None,skill2:None,skill3:None};

fn damage_internal<D:DamageBuilder>(ctx:&DamageContext<'_,D::AttributeType>,s:usize,_:&CharacterSkillConfig,fumo:Option<Element>)->D::Result{
 use AttributeName::*;let a=ctx.attribute;let c=ctx.character_common_data;let (s1,s2,s3)=c.get_3_skill();let core=a.get_value(MityaCoreMode);let steady=core==1.0;let beacons=a.get_value(MityaBeacons);let mut b=D::new();
 let t=match s{0..=2=>SkillType::NormalAttack,3|7|8=>SkillType::ChargedAttack,4=>SkillType::PlungingAttackInAction,5|6=>SkillType::PlungingAttackOnGround,14=>SkillType::ElementalBurst,15=>SkillType::NoneType,_=>SkillType::ElementalSkill};
 if matches!(s,8|12|13|15){
  let enabled=match s{8=>core==2.0&&beacons>=1.0,12|13=>steady,15=>core>0.0&&c.constellation>=4,_=>false};
  let ratio=if !enabled{0.0}else{match s{8=>S1[s1][9],12=>S2[s2][3],13=>S2[s2][4]*beacons,15=>3.0,_=>0.0}};
  let independent=if c.constellation>=6&&steady&&matches!(s,12|13|15){1.15}else{1.0};
  b.add_em_ratio("技能倍率",ratio*independent);
  let base_bonus=(a.get_em_all().max(0.0)*0.00028).min(0.14);
  return b.direct_stellar_conduct(a,ctx.enemy,ratio,independent,base_bonus,c.level,t);
 }
 let ratio=match s{0..=3=>S1[s1][s],4..=6=>S1[s1][s+1],7=>if core==2.0&&beacons>=1.0{S1[s1][8]}else{0.0},9=>S2[s2][0],10=>S2[s2][1],11=>if steady{S2[s2][2]}else{0.0},14=>S3[s3][0],_=>unreachable!()};
 let multiplier=if c.constellation>=6&&s==11{1.15}else{1.0};b.add_atk_ratio("技能倍率",ratio*multiplier);if s==14{b.add_em_ratio("元素精通倍率",S3[s3][1]);}
 b.damage(a,ctx.enemy,Element::Electro,t,c.level,fumo)
}
fn new_effect<A:Attribute>(d:&CharacterCommonData,c:&CharacterConfig)->Option<Box<dyn ChangeAttribute<A>>>{
 let (mode,beacons,crit,on,field,hits)=match c{CharacterConfig::Mitya{core_mode,beacons,crit_stacks,on_field,polestar,field_hits}=>(*core_mode,*beacons,*crit_stacks,*on_field,*polestar,*field_hits),_=>unreachable!()};
 Some(Box::new(MityaEffect{mode,beacons:beacons.min(if d.constellation>=1{5}else{4}),crit,on,field,hits,c:d.constellation,a1:d.has_talent1,a4:d.has_talent2}))
}
fn get_target_function_by_role(_:usize,_:&TeamQuantization,_:&CharacterCommonData,_:&WeaponCommonData)->Box<dyn TargetFunction>{Box::new(crate::target_functions::target_functions::MityaDefaultTargetFunction)}
}

struct MityaEffect{mode:usize,beacons:usize,crit:usize,on:bool,field:bool,hits:usize,c:i32,a1:bool,a4:bool}
impl<A:Attribute> ChangeAttribute<A> for MityaEffect{fn change_attribute(&self,a:&mut A){use AttributeName::*;
 a.set_value_by(MityaCoreMode,"侦测炉心",self.mode as f64);a.set_value_by(MityaBeacons,"递变信标",self.beacons as f64);a.set_value_by(ElementalMastery,"米提亚基础精通",100.0);
 if self.a1&&self.mode==1{a.set_value_by(ElementalMastery,"基准承压测验",30.0*self.beacons as f64);}
 if self.a4{a.set_value_by(CriticalBase,"超限易爆试剂",0.05*self.crit.min(4) as f64);}
 if self.c>=1&&self.mode>0&&self.on{a.set_value_by(CriticalDamageBase,"米提亚一命",0.4);}
 if self.c>=2&&self.mode>0{if self.field{a.set_value_by(ResMinusElectro,"米提亚二命",0.2);a.set_value_by(ResMinusCryo,"米提亚二命",0.2);}let em=if self.mode==1{123.0}else if self.on{234.0}else{0.0};a.set_value_by(ElementalMastery,"米提亚二命",em);}
 if self.c>=6{a.set_value_by(StellarConductElevation,"米提亚六命",0.2);}
 if self.field{let k=if self.hits==0{1.0}else{1.4+0.05*self.hits.min(12) as f64};a.set_value_by(StellarConductBaseMultiplier,"极星辉域",k-1.0);a.set_value_by(BonusElectro,"极星辉域",0.2*k);a.set_value_by(BonusCryo,"极星辉域",0.2*k);a.set_value_by(ResMinusPhysical,"极星辉域",0.4);}
}}
