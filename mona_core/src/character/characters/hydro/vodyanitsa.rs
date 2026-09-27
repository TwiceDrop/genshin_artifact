
use crate::attribute::{Attribute,AttributeName,AttributeCommon};
use crate::character::{CharacterConfig,CharacterName,CharacterStaticData};
use crate::character::character_common_data::CharacterCommonData;
use crate::character::character_sub_stat::CharacterSubStatFamily;
use crate::character::skill_config::CharacterSkillConfig;
use crate::character::traits::{CharacterTrait,CharacterSkillMap,CharacterSkillMapItem};
use crate::character::macros::{damage_enum,skill_map};
use crate::common::{ChangeAttribute,Element,SkillType,WeaponType};
use crate::common::i18n::locale;
use crate::damage::{DamageContext};
use crate::damage::damage_builder::DamageBuilder;
use crate::target_functions::TargetFunction;
use crate::team::TeamQuantization;
use crate::weapon::weapon_common_data::WeaponCommonData;
pub struct VodyanitsaSkillType { pub normal_dmg1:[f64;15],
pub normal_dmg2:[f64;15],
pub normal_dmg3:[f64;15],
pub normal_dmg4:[f64;15],
pub charged_dmg:[f64;15],
pub plunging_dmg1:[f64;15],
pub plunging_dmg2:[f64;15],
pub plunging_dmg3:[f64;15],
pub e_initial_hp_ratio:[f64;15],
pub e_horn_hp_ratio:[f64;15],
pub e_heal_flat:[f64;15],
pub e_heal_hp_ratio:[f64;15],
pub e_res_shred:[f64;15],
pub q_hp_ratio:[f64;15],
pub q_song_bonus:[f64;15], }
pub const SKILL:VodyanitsaSkillType=VodyanitsaSkillType{normal_dmg1:[0.433848,0.466387,0.498925,0.54231,0.574849,0.607387,0.650772,0.694157,0.737542,0.780926,0.824311,0.867696,0.921927,0.976158,1.030389],
normal_dmg2:[0.40232,0.432494,0.462668,0.5029,0.533074,0.563248,0.60348,0.643712,0.683944,0.724176,0.764408,0.80464,0.85493,0.90522,0.95551],
normal_dmg3:[0.493016,0.529992,0.566968,0.61627,0.653246,0.690222,0.739524,0.788826,0.838127,0.887429,0.93673,0.986032,1.047659,1.109286,1.170913],
normal_dmg4:[0.655632,0.704804,0.753977,0.81954,0.868712,0.917885,0.983448,1.049011,1.114574,1.180138,1.245701,1.311264,1.393218,1.475172,1.557126],
charged_dmg:[1.2376,1.33042,1.42324,1.547,1.63982,1.73264,1.8564,1.98016,2.10392,2.22768,2.35144,2.4752,2.6299,2.7846,2.9393],
plunging_dmg1:[0.568288,0.614544,0.6608,0.72688,0.773136,0.826,0.898688,0.971376,1.044064,1.12336,1.202656,1.281952,1.361248,1.440544,1.51984],
plunging_dmg2:[1.136335,1.228828,1.32132,1.453452,1.545944,1.65165,1.796995,1.94234,2.087686,2.246244,2.404802,2.563361,2.721919,2.880478,3.039036],
plunging_dmg3:[1.419344,1.534872,1.6504,1.81544,1.930968,2.063,2.244544,2.426088,2.607632,2.80568,3.003728,3.201776,3.399824,3.597872,3.79592],
e_initial_hp_ratio:[0.03272,0.035174,0.037628,0.0409,0.043354,0.045808,0.04908,0.052352,0.055624,0.058896,0.062168,0.06544,0.06953,0.07362,0.07771],
e_horn_hp_ratio:[0.03272,0.035174,0.037628,0.0409,0.043354,0.045808,0.04908,0.052352,0.055624,0.058896,0.062168,0.06544,0.06953,0.07362,0.07771],
e_heal_flat:[269.62854,296.59515,325.80896,357.27,390.97824,426.93372,465.1364,505.5863,548.28345,593.2278,640.4193,689.8581,741.54407,795.4773,851.6577],
e_heal_hp_ratio:[0.028,0.0301,0.0322,0.035,0.0371,0.0392,0.042,0.0448,0.0476,0.0504,0.0532,0.056,0.0595,0.063,0.0665],
e_res_shred:[0.165,0.18,0.195,0.21,0.225,0.24,0.255,0.27,0.285,0.3,0.318,0.336,0.354,0.372,0.39],
q_hp_ratio:[0.456768,0.491026,0.525283,0.57096,0.605218,0.639475,0.685152,0.730829,0.776506,0.822182,0.867859,0.913536,0.970632,1.027728,1.084824],
q_song_bonus:[0.48,0.516,0.552,0.6,0.636,0.672,0.72,0.768,0.816,0.864,0.912,0.96,1.02,1.08,1.14],};
damage_enum!(VodyanitsaDamageEnum Normal1 Normal2 Normal3 Normal4 Charged Plunging1 Plunging2 Plunging3 EInitial EHorn EHeal Burst);
pub struct Vodyanitsa;
pub struct VodyanitsaEffect { pub e:bool,pub song:bool,pub ordinary:bool,pub c1:bool,pub c2:bool,pub c4:usize,pub c6:bool,pub on:bool,pub a4:bool,pub e_level:usize }
impl<A:Attribute> ChangeAttribute<A> for VodyanitsaEffect {
 fn change_attribute(&self,a:&mut A) {
  use AttributeName::*;
  if self.c4>0 {a.add_hp_percentage("沃雅妮莎 C4（测试服）",self.c4.min(3) as f64*0.2);}
  if self.e {a.set_value_by(ResMinusHydro,"沃雅妮莎 E",SKILL.e_res_shred[self.e_level]);a.set_value_by(ResMinusCryo,"沃雅妮莎 E",SKILL.e_res_shred[self.e_level]);}
  if self.a4 && self.song && self.ordinary && self.on {
   a.add_edge1(HP,ExtraDmgHydro,Box::new(|x,_|((x-40000.0).max(0.0)*0.14).min(3500.0)),Box::new(|g,x,_| (if x>40000.0 && x<65000.0 {g*0.14}else{0.0},0.0)),"十二弦的泪歌（单次有效）");
  }
  if self.c1 {a.add_edge1(HP,ATKFixed,Box::new(|x,_|x*0.008),Box::new(|g,_,_|(g*0.008,0.0)),"沃雅妮莎 C1");}
  if self.c2 && self.ordinary && (self.on || self.c6) {a.set_value_by(CriticalDamageHydro,"沃雅妮莎 C2",0.5);}
  if self.c6 && self.song {a.set_value_by(BonusHydro,"沃雅妮莎 C6",0.6);}
 }
}
impl CharacterTrait for Vodyanitsa {
 const STATIC_DATA:CharacterStaticData=CharacterStaticData {
 name:CharacterName::Vodyanitsa,internal_name:"Vodyanitsa",element:Element::Hydro,
 hp:[1154,2992,3981,5957,6660,7662,8599,9612,10315,11337,12040,13073,13776,14818,15871],atk:[8,22,29,43,48,56,62,70,75,82,87,95,100,108,132],def:[38,98,130,195,218,250,281,314,337,370,393,427,450,484,519],
 sub_stat:CharacterSubStatFamily::HP288,weapon_type:WeaponType::Catalyst,star:5,
 name_locale:locale!(zh_cn: "沃雅妮莎", en: "Vodyanitsa"),skill_name1:locale!(zh_cn: "普通攻击·水色咏叹", en: "普通攻击·水色咏叹"),skill_name2:locale!(zh_cn: "宣叙·晨声纷流", en: "宣叙·晨声纷流"),skill_name3:locale!(zh_cn: "终奏·伴尔沉沦", en: "终奏·伴尔沉沦")
 };
 type SkillType=VodyanitsaSkillType;const SKILL:Self::SkillType=SKILL;type DamageEnumType=VodyanitsaDamageEnum;type RoleEnum=();
 #[cfg(not(target_family="wasm"))]
 const SKILL_MAP:CharacterSkillMap=CharacterSkillMap{skill1:skill_map!(VodyanitsaDamageEnum Normal1 locale!(zh_cn: "Normal1", en: "Normal1") Normal2 locale!(zh_cn: "Normal2", en: "Normal2") Normal3 locale!(zh_cn: "Normal3", en: "Normal3") Normal4 locale!(zh_cn: "Normal4", en: "Normal4") Charged locale!(zh_cn: "Charged", en: "Charged") Plunging1 locale!(zh_cn: "Plunging1", en: "Plunging1") Plunging2 locale!(zh_cn: "Plunging2", en: "Plunging2") Plunging3 locale!(zh_cn: "Plunging3", en: "Plunging3")),skill2:skill_map!(VodyanitsaDamageEnum EInitial locale!(zh_cn: "施放伤害", en: "施放伤害") EHorn locale!(zh_cn: "角笛伤害", en: "角笛伤害") EHeal locale!(zh_cn: "单次治疗", en: "单次治疗")),skill3:skill_map!(VodyanitsaDamageEnum Burst locale!(zh_cn: "爆发伤害", en: "爆发伤害"))};
 fn damage_internal<D:DamageBuilder>(ctx:&DamageContext<'_,D::AttributeType>,s:usize,c:&CharacterSkillConfig,fumo:Option<Element>)->D::Result {
  let(s1,s2,s3)=ctx.character_common_data.get_3_skill();let(low,q)=match c {CharacterSkillConfig::Vodyanitsa{low_hp_heal,q_song_bonus}=>(*low_hp_heal,*q_song_bonus),_=>(false,false)};
  let values=[SKILL.normal_dmg1[s1],SKILL.normal_dmg2[s1],SKILL.normal_dmg3[s1],SKILL.normal_dmg4[s1],SKILL.charged_dmg[s1],SKILL.plunging_dmg1[s1],SKILL.plunging_dmg2[s1],SKILL.plunging_dmg3[s1],SKILL.e_initial_hp_ratio[s2],SKILL.e_horn_hp_ratio[s2],SKILL.e_heal_hp_ratio[s2],SKILL.q_hp_ratio[s3]];
  let mut b=D::new();
  if s==10 {let rate=if low && ctx.character_common_data.constellation>=4 {1.5}else{1.0};b.add_hp_ratio("技能倍率",values[s]*rate);b.add_extra_damage("固定治疗",SKILL.e_heal_flat[s2]*rate);return b.heal(ctx.attribute);}
  if s<8 {b.add_atk_ratio("技能倍率",values[s]);}else{b.add_hp_ratio("技能倍率",values[s]);}
  if s==11 && q {b.add_extra_bonus("歌声状态（测试服待校准）",SKILL.q_song_bonus[s3]);}
  let t=match s {0..=3=>SkillType::NormalAttack,4=>SkillType::ChargedAttack,5=>SkillType::PlungingAttackInAction,6|7=>SkillType::PlungingAttackOnGround,8|9=>SkillType::ElementalSkill,_=>SkillType::ElementalBurst};
  b.damage(ctx.attribute,ctx.enemy,Element::Hydro,t,ctx.character_common_data.level,fumo)
 }
 fn new_effect<A:Attribute>(d:&CharacterCommonData,c:&CharacterConfig)->Option<Box<dyn ChangeAttribute<A>>> {
  let(e,song,ordinary,c1,c2,c4,on)=match c {CharacterConfig::Vodyanitsa{e_active,song_active,ordinary_mode,c1_active,c2_active,c4_stacks,on_field}=>(*e_active,*song_active,*ordinary_mode,*c1_active,*c2_active,*c4_stacks,*on_field),_=>(false,false,true,false,false,0,true)};
  Some(Box::new(VodyanitsaEffect{e,song,ordinary,c1:c1&&d.constellation>=1,c2:c2&&d.constellation>=2,c4:if d.constellation>=4{c4}else{0},c6:d.constellation>=6,on,a4:d.has_talent2,e_level:d.skill2.min(14)}))
 }
 fn get_target_function_by_role(_:usize,_:&TeamQuantization,_:&CharacterCommonData,_:&WeaponCommonData)->Box<dyn TargetFunction>{Box::new(crate::target_functions::target_functions::VodyanitsaDefaultTargetFunction)}
}
