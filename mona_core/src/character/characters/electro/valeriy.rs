// V4 7.1.53 / 48845164. Source: https://gi.gachabase.net/characters/10000137/valeriy/beta/7.1.53/48845164?lang=chs
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
const S1:[[f64;13];15]=[[0.324839,0.29326,0.454175,1.00276,2.292,20.0,0.2432,0.7296,15.0,18.0,0.639324,1.278377,1.596762],[0.35128,0.31713,0.491142,1.08438,2.4639,20.0,0.26144,0.78432,15.0,18.0,0.691362,1.382431,1.726731],[0.37772,0.341,0.52811,1.166,2.6358,20.0,0.27968,0.83904,15.0,18.0,0.7434,1.486485,1.8567],[0.415492,0.3751,0.580921,1.2826,2.865,20.0,0.304,0.912,15.0,18.0,0.81774,1.635134,2.04237],[0.441932,0.39897,0.617889,1.36422,3.0369,20.0,0.32224,0.96672,15.0,18.0,0.869778,1.739187,2.172339],[0.47215,0.42625,0.660137,1.4575,3.2088,20.0,0.34048,1.02144,15.0,18.0,0.92925,1.858106,2.320875],[0.513699,0.46376,0.71823,1.58576,3.438,20.0,0.3648,1.0944,15.0,18.0,1.011024,2.02162,2.525112],[0.555248,0.50127,0.776322,1.71402,3.6672,20.0,0.38912,1.16736,15.0,18.0,1.092798,2.185133,2.729349],[0.596798,0.53878,0.834414,1.84228,3.8964,20.0,0.41344,1.24032,15.0,18.0,1.174572,2.348646,2.933586],[0.642124,0.5797,0.897787,1.9822,4.1256,20.0,0.43776,1.31328,15.0,18.0,1.26378,2.527025,3.15639],[0.68745,0.62062,0.96116,2.12212,4.3548,20.0,0.46208,1.38624,15.0,18.0,1.352988,2.705403,3.379194],[0.732777,0.66154,1.024533,2.26204,4.584,20.0,0.4864,1.4592,15.0,18.0,1.442196,2.883781,3.601998],[0.778103,0.70246,1.087907,2.40196,4.8705,20.0,0.5168,1.5504,15.0,18.0,1.531404,3.062159,3.824802],[0.82343,0.74338,1.15128,2.54188,5.157,20.0,0.5472,1.6416,15.0,18.0,1.620612,3.240537,4.047606],[0.868756,0.7843,1.214653,2.6818,5.4435,20.0,0.5776,1.7328,15.0,18.0,1.70982,3.418915,4.27041]];
const S2:[[f64;5];15]=[[1.66,2.08896,1309.6384,18.0,10.0],[1.7845,2.245632,1440.6204,18.0,10.0],[1.909,2.402304,1582.5176,18.0,10.0],[2.075,2.6112,1735.33,18.0,10.0],[2.1995,2.767872,1899.0575,18.0,10.0],[2.324,2.924544,2073.7002,18.0,10.0],[2.49,3.13344,2259.258,18.0,10.0],[2.656,3.342336,2455.7312,18.0,10.0],[2.822,3.551232,2663.1194,18.0,10.0],[2.988,3.760128,2881.4229,18.0,10.0],[3.154,3.969024,3110.6414,18.0,10.0],[3.32,4.17792,3350.7751,18.0,10.0],[3.5275,4.43904,3601.824,18.0,10.0],[3.735,4.70016,3863.788,18.0,10.0],[3.9425,4.96128,4136.6675,18.0,10.0]];
const S3:[[f64;5];15]=[[1.3512,0.3152,12.0,15.0,60.0],[1.45254,0.33884,12.0,15.0,60.0],[1.55388,0.36248,12.0,15.0,60.0],[1.689,0.394,12.0,15.0,60.0],[1.79034,0.41764,12.0,15.0,60.0],[1.89168,0.44128,12.0,15.0,60.0],[2.0268,0.4728,12.0,15.0,60.0],[2.16192,0.50432,12.0,15.0,60.0],[2.29704,0.53584,12.0,15.0,60.0],[2.43216,0.56736,12.0,15.0,60.0],[2.56728,0.59888,12.0,15.0,60.0],[2.7024,0.6304,12.0,15.0,60.0],[2.8713,0.6698,12.0,15.0,60.0],[3.0402,0.7092,12.0,15.0,60.0],[3.2091,0.7486,12.0,15.0,60.0]];
damage_enum!(ValeriyDamageEnum Normal1 Normal2 Normal3 Charged Mortar Plunging1 Plunging2 Plunging3 Skill Shield Burst Barrage);
pub struct Valeriy;
impl CharacterTrait for Valeriy{
const STATIC_DATA:CharacterStaticData=CharacterStaticData{name:CharacterName::Valeriy,internal_name:"Valeriy",element:Element::Electro,hp:[839,2155,2782,4167,4612,5305,5898,6591,7037,7729,8174,8867,9312,10005,10697],atk:[21,55,71,106,117,135,150,168,179,197,208,226,237,255,320],def:[59,151,195,293,324,373,414,463,494,543,574,623,654,703,752],sub_stat:CharacterSubStatFamily::ATK240,weapon_type:WeaponType::Sword,star:4,name_locale:locale!(zh_cn:"瓦列里",en:"Valeriy"),skill_name1:locale!(zh_cn:"近卫战法·盾剑攻斥",en:"近卫战法·盾剑攻斥"),skill_name2:locale!(zh_cn:"攻势防御·堡垒骤进",en:"攻势防御·堡垒骤进"),skill_name3:locale!(zh_cn:"火力焦点·雷霰急袭",en:"火力焦点·雷霰急袭")};
type SkillType=();const SKILL:()=();type DamageEnumType=ValeriyDamageEnum;type RoleEnum=();
#[cfg(not(target_family="wasm"))]const SKILL_MAP:CharacterSkillMap=CharacterSkillMap{skill1:None,skill2:None,skill3:None};

fn damage_internal<D:DamageBuilder>(ctx:&DamageContext<'_,D::AttributeType>,s:usize,_:&CharacterSkillConfig,fumo:Option<Element>)->D::Result{
 use AttributeName::*;let a=ctx.attribute;let c=ctx.character_common_data;let(s1,s2,s3)=c.get_3_skill();let mut b=D::new();
 if s==9{b.add_atk_ratio("蓄雷护盾",S2[s2][1]+if c.constellation>=2{a.get_value(ValeriyShieldOverflow)*0.08}else{0.0});b.add_extra_damage("护盾固定值",S2[s2][2]);return b.shield(a,Element::Electro);}
 let t=match s{0..=2=>SkillType::NormalAttack,3|4=>SkillType::ChargedAttack,5=>SkillType::PlungingAttackInAction,6|7=>SkillType::PlungingAttackOnGround,8=>SkillType::ElementalSkill,_=>SkillType::ElementalBurst};
 let ratio=match s{0..=4=>S1[s1][s],5..=7=>S1[s1][s+5],8=>S2[s2][0],10|11=>S3[s3][s-10],_=>unreachable!()};
 b.add_atk_ratio("技能倍率",ratio);if c.constellation>=6&&matches!(s,4|11){b.add_extra_bonus("瓦列里六命",1.0);}
 let e=if s<=3||matches!(s,5|6|7){Element::Physical}else{Element::Electro};
 b.damage(a,ctx.enemy,e,t,c.level,fumo)
}
fn new_effect<A:Attribute>(d:&CharacterCommonData,c:&CharacterConfig)->Option<Box<dyn ChangeAttribute<A>>>{
 let (radiance,dir,momentum,overflow,c2,c6,on)=match c{CharacterConfig::Valeriy{radiance,directive,momentum,shield_overflow,c2_active,c6_active,on_field}=>(*radiance,*directive,*momentum,*shield_overflow,*c2_active,*c6_active,*on_field),_=>unreachable!()};
 Some(Box::new(ValeriyEffect{radiance,dir,momentum:momentum.min(if d.constellation>=4{130}else{100}),overflow,c2:c2&&d.constellation>=2,c6:c6&&d.constellation>=6,on,a4:d.has_talent2,ordinary:S1[d.skill1][6],stellar:S1[d.skill1][7]}))
}
fn get_target_function_by_role(_:usize,_:&TeamQuantization,_:&CharacterCommonData,_:&WeaponCommonData)->Box<dyn TargetFunction>{Box::new(crate::target_functions::target_functions::ValeriyDefaultTargetFunction)}
}

struct ValeriyEffect{radiance:bool,dir:bool,momentum:usize,overflow:usize,c2:bool,c6:bool,on:bool,a4:bool,ordinary:f64,stellar:f64}
impl<A:Attribute> ChangeAttribute<A> for ValeriyEffect{fn change_attribute(&self,a:&mut A){use AttributeName::*;
 a.set_value_by(ValeriyShieldOverflow,"护盾溢出势能",self.overflow.min(20) as f64);
 if self.c2{a.set_value_by(ElementalMastery,"瓦列里二命",100.0);}
 if self.c6{a.set_value_by(CriticalElectro,"瓦列里六命",0.1);a.set_value_by(StellarConductCritDamageElectro,"瓦列里六命",0.4);}
 if self.dir&&self.on&&!self.radiance{let ratio=self.ordinary+if self.a4{0.003*self.momentum as f64}else{0.0};a.add_edge1(ATK,ExtraDmgElectro,Box::new(move|x,_|x*ratio),Box::new(move|g,_,_|(g*ratio,0.0)),"攻斥指令");}
}}
