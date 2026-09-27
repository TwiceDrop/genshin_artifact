
// beta2 7.0.54 D48100502 preview kernel.
// Ordinary and direct stellar-swirl damage share native optimization and gain-curve evaluation.
use crate::attribute::{Attribute,AttributeName,AttributeCommon};
use crate::character::{CharacterConfig,CharacterName,CharacterStaticData};
use crate::character::character_common_data::CharacterCommonData;
use crate::character::character_sub_stat::CharacterSubStatFamily;
use crate::character::skill_config::CharacterSkillConfig;
use crate::character::traits::{CharacterTrait,CharacterSkillMap,CharacterSkillMapItem};
use crate::character::macros::{damage_enum,skill_map};
use crate::common::{ChangeAttribute,Element,SkillType,WeaponType};
use crate::common::i18n::locale;
use crate::damage::DamageContext;
use crate::damage::damage_builder::DamageBuilder;
use crate::target_functions::TargetFunction;
use crate::team::TeamQuantization;
use crate::weapon::weapon_common_data::WeaponCommonData;
pub struct VesnaSkillType{pub normal_dmg1:[f64;15],
pub normal_dmg2:[f64;15],
pub normal_dmg3:[f64;15],
pub normal_dmg4:[f64;15],
pub normal_dmg5:[f64;15],
pub normal_dmg6:[f64;15],
pub charged_dmg:[f64;15],
pub plunging_dmg1:[f64;15],
pub plunging_dmg2:[f64;15],
pub plunging_dmg3:[f64;15],
pub e_initial:[f64;15],
pub e_stage1:[f64;15],
pub e_stage2:[f64;15],
pub e_spirit2:[f64;15],
pub e_spirit2_stellar:[f64;15],
pub e_spirit3:[f64;15],
pub e_spirit3_stellar:[f64;15],
pub e_spirit3_final:[f64;15],
pub e_spirit3_final_stellar:[f64;15],
pub e_pinion:[f64;15],
pub q_spirit:[f64;15],
pub q_spirit_stellar:[f64;15],}
pub const SKILL:VesnaSkillType=VesnaSkillType{normal_dmg1:[0.4042,0.4371,0.47,0.517,0.5499,0.5875,0.6392,0.6909,0.7426,0.799,0.8554,0.9118,0.9682,1.0246,1.081],
normal_dmg2:[0.48676,0.52638,0.566,0.6226,0.66222,0.7075,0.76976,0.83202,0.89428,0.9622,1.03012,1.09804,1.16596,1.23388,1.3018],
normal_dmg3:[0.28079,0.303645,0.3265,0.35915,0.382005,0.408125,0.44404,0.479955,0.51587,0.55505,0.59423,0.63341,0.67259,0.71177,0.75095],
normal_dmg4:[0.59168,0.63984,0.688,0.7568,0.80496,0.86,0.93568,1.01136,1.08704,1.1696,1.25216,1.33472,1.41728,1.49984,1.5824],
normal_dmg5:[0.62436,0.67518,0.726,0.7986,0.84942,0.9075,0.98736,1.06722,1.14708,1.2342,1.32132,1.40844,1.49556,1.58268,1.6698],
normal_dmg6:[0.7224,0.7812,0.84,0.924,0.9828,1.05,1.1424,1.2348,1.3272,1.428,1.5288,1.6296,1.7304,1.8312,1.932],
charged_dmg:[1.33042,1.43871,1.547,1.7017,1.80999,1.93375,2.10392,2.27409,2.44426,2.6299,2.81554,3.00118,3.18682,3.37246,3.5581],
plunging_dmg1:[0.639324,0.691362,0.7434,0.81774,0.869778,0.92925,1.011024,1.092798,1.174572,1.26378,1.352988,1.442196,1.531404,1.620612,1.70982],
plunging_dmg2:[1.278377,1.382431,1.486485,1.635134,1.739187,1.858106,2.02162,2.185133,2.348646,2.527025,2.705403,2.883781,3.062159,3.240537,3.418915],
plunging_dmg3:[1.596762,1.726731,1.8567,2.04237,2.172339,2.320875,2.525112,2.729349,2.933586,3.15639,3.379194,3.601998,3.824802,4.047606,4.27041],
e_initial:[0.4,0.43,0.46,0.5,0.53,0.56,0.6,0.64,0.68,0.72,0.76,0.8,0.85,0.9,0.95],
e_stage1:[0.4,0.43,0.46,0.5,0.53,0.56,0.6,0.64,0.68,0.72,0.76,0.8,0.85,0.9,0.95],
e_stage2:[0.6,0.645,0.69,0.75,0.795,0.84,0.9,0.96,1.02,1.08,1.14,1.2,1.275,1.35,1.425],
e_spirit2:[1.12,1.204,1.288,1.4,1.484,1.568,1.68,1.792,1.904,2.016,2.128,2.24,2.38,2.52,2.66],
e_spirit2_stellar:[1.12,1.204,1.288,1.4,1.484,1.568,1.68,1.792,1.904,2.016,2.128,2.24,2.38,2.52,2.66],
e_spirit3:[0.448,0.4816,0.5152,0.56,0.5936,0.6272,0.672,0.7168,0.7616,0.8064,0.8512,0.896,0.952,1.008,1.064],
e_spirit3_stellar:[0.448,0.4816,0.5152,0.56,0.5936,0.6272,0.672,0.7168,0.7616,0.8064,0.8512,0.896,0.952,1.008,1.064],
e_spirit3_final:[1.568,1.6856,1.8032,1.96,2.0776,2.1952,2.352,2.5088,2.6656,2.8224,2.9792,3.136,3.332,3.528,3.724],
e_spirit3_final_stellar:[1.568,1.6856,1.8032,1.96,2.0776,2.1952,2.352,2.5088,2.6656,2.8224,2.9792,3.136,3.332,3.528,3.724],
e_pinion:[0.104,0.1118,0.1196,0.13,0.1378,0.1456,0.156,0.1664,0.1768,0.1872,0.1976,0.208,0.221,0.234,0.247],
q_spirit:[2.632,2.8294,3.0268,3.29,3.4874,3.6848,3.948,4.2112,4.4744,4.7376,5.0008,5.264,5.593,5.922,6.251],
q_spirit_stellar:[2.632,2.8294,3.0268,3.29,3.4874,3.6848,3.948,4.2112,4.4744,4.7376,5.0008,5.264,5.593,5.922,6.251],};
damage_enum!(VesnaDamageEnum Normal1 Normal2 Normal3 Normal4 Normal5 Normal6 Charged Plunging1 Plunging2 Plunging3 EInitial EStage1 EStage2 ESpirit2 ESpirit3 ESpirit3Final EPinion Burst C6Body C6Spirit);
pub struct Vesna;pub struct Effect{stance:bool,flat_inside:bool,c1:bool,c6:bool,a1:bool,c2:bool,c4:bool,a4:bool,radiance:bool,stacks:usize,ac:usize,other:usize}
impl<A:Attribute> ChangeAttribute<A> for Effect{fn change_attribute(&self,a:&mut A){
 let st=if !self.a1 {0}else if self.c2 && self.stance{6}else{self.stacks};
 a.set_value_by(AttributeName::VesnaStance,"巡风列装",if self.stance{1.0}else{0.0});
 a.set_value_by(AttributeName::VesnaRadiance,"辉映",if self.radiance{1.0}else{0.0});
 a.set_value_by(AttributeName::VesnaDiscipline,"整肃",st as f64);
 a.set_value_by(AttributeName::VesnaFlatInside,"定额与整肃乘区选项",if self.flat_inside{1.0}else{0.0});
 if self.c1 && self.stance {a.set_value_by(AttributeName::StellarSwirlBonus,"薇斯纳 C1",0.2);}
 if self.c6 {a.set_value_by(AttributeName::StellarSwirlElevation,"薇斯纳 C6",0.2);}
 if self.c2 && st==6 {a.add_atk_percentage("薇斯纳 C2·满层整肃",0.4);}
 if self.a4 && self.radiance {let m=if self.c4{3.0}else{1.0};a.add_atk_percentage("冬之凯风·冰风队友",0.06*m*self.ac as f64);a.set_value_by(AttributeName::ElementalMastery,"冬之凯风·其他元素",25.0*m*self.other as f64);}
}}
impl CharacterTrait for Vesna{
 const STATIC_DATA:CharacterStaticData=CharacterStaticData{name:CharacterName::Vesna,internal_name:"Vesna",element:Element::Anemo,hp:[1032,2678,3563,5332,5961,6858,7697,8603,9232,10147,10776,11701,12330,13262,14205],atk:[28,71,95,142,159,183,205,230,246,271,288,312,329,354,434],def:[57,147,196,294,328,378,424,474,508,559,593,644,679,730,782],sub_stat:CharacterSubStatFamily::CriticalRate192,weapon_type:WeaponType::Sword,star:5,name_locale:locale!(zh_cn: "薇斯纳", en: "薇斯纳"),skill_name1:locale!(zh_cn: "巡风剑舞", en: "巡风剑舞"),skill_name2:locale!(zh_cn: "操典·制胜有道", en: "操典·制胜有道"),skill_name3:locale!(zh_cn: "致礼·献予女皇陛下", en: "致礼·献予女皇陛下")};
 type SkillType=VesnaSkillType;const SKILL:Self::SkillType=SKILL;type DamageEnumType=VesnaDamageEnum;type RoleEnum=();
 #[cfg(not(target_family="wasm"))]const SKILL_MAP:CharacterSkillMap=CharacterSkillMap{skill1:skill_map!(VesnaDamageEnum Normal1 locale!(zh_cn: "Normal1", en: "Normal1") Normal2 locale!(zh_cn: "Normal2", en: "Normal2") Normal3 locale!(zh_cn: "Normal3", en: "Normal3") Normal4 locale!(zh_cn: "Normal4", en: "Normal4") Normal5 locale!(zh_cn: "Normal5", en: "Normal5") Normal6 locale!(zh_cn: "Normal6", en: "Normal6") Charged locale!(zh_cn: "Charged", en: "Charged") Plunging1 locale!(zh_cn: "Plunging1", en: "Plunging1") Plunging2 locale!(zh_cn: "Plunging2", en: "Plunging2") Plunging3 locale!(zh_cn: "Plunging3", en: "Plunging3")),skill2:skill_map!(VesnaDamageEnum EInitial locale!(zh_cn: "EInitial", en: "EInitial") EStage1 locale!(zh_cn: "EStage1", en: "EStage1") EStage2 locale!(zh_cn: "EStage2", en: "EStage2") ESpirit2 locale!(zh_cn: "ESpirit2", en: "ESpirit2") ESpirit3 locale!(zh_cn: "ESpirit3", en: "ESpirit3") ESpirit3Final locale!(zh_cn: "ESpirit3Final", en: "ESpirit3Final") EPinion locale!(zh_cn: "EPinion", en: "EPinion")),skill3:skill_map!(VesnaDamageEnum Burst locale!(zh_cn: "灵剑伤害", en: "灵剑伤害"))};
 fn damage_internal<D:DamageBuilder>(ctx:&DamageContext<'_,D::AttributeType>,s:usize,c:&CharacterSkillConfig,fumo:Option<Element>)->D::Result{
  let(s1,s2,s3)=ctx.character_common_data.get_3_skill();
  let stance=ctx.attribute.get_value(AttributeName::VesnaStance)>0.5;
  let stacks=ctx.attribute.get_value(AttributeName::VesnaDiscipline) as usize;
  let ratios=[SKILL.normal_dmg1[s1],SKILL.normal_dmg2[s1],SKILL.normal_dmg3[s1]*2.0,SKILL.normal_dmg4[s1],SKILL.normal_dmg5[s1],SKILL.normal_dmg6[s1],SKILL.charged_dmg[s1],SKILL.plunging_dmg1[s1],SKILL.plunging_dmg2[s1],SKILL.plunging_dmg3[s1],SKILL.e_initial[s2],SKILL.e_stage1[s2],SKILL.e_stage2[s2],SKILL.e_spirit2[s2],SKILL.e_spirit3[s2],SKILL.e_spirit3_final[s2],SKILL.e_pinion[s2],SKILL.q_spirit[s3],1.5,2.0];
  let spirit=matches!(s,13|14|15|17|19);let a1=if spirit && ctx.character_common_data.has_talent1 {1.0+0.1*stacks as f64}else{1.0};
  let mut b=D::new();let unlocked=if s>=18 && ctx.character_common_data.constellation<6 {0.0}else{1.0};b.add_atk_ratio("技能倍率 × 整肃（普通灵剑）",ratios[s]*a1*unlocked);
  let t=match s{0..=5=>SkillType::NormalAttack,6=>SkillType::ChargedAttack,7=>SkillType::PlungingAttackInAction,8|9=>SkillType::PlungingAttackOnGround,17=>SkillType::ElementalBurst,_=>SkillType::ElementalSkill};
  if s>=18 && ctx.character_common_data.constellation<6 {return b.stellar_swirl(ctx.attribute,ctx.enemy,-1.0,ctx.character_common_data.level,t);}
  if spirit && ctx.attribute.get_value(AttributeName::VesnaRadiance)>0.5 {
   return b.stellar_swirl(ctx.attribute,ctx.enemy,ratios[s]*unlocked,ctx.character_common_data.level,t);
  }
  let e=if s<10 && !stance{Element::Physical}else{Element::Anemo};
  b.damage(ctx.attribute,ctx.enemy,e,t,ctx.character_common_data.level,if stance{None}else{fumo})
 }
 fn new_effect<A:Attribute>(d:&CharacterCommonData,c:&CharacterConfig)->Option<Box<dyn ChangeAttribute<A>>>{
  let(r,st,ac,o,stance,flat_inside)=match c{CharacterConfig::Vesna{radiance,disciplinary_stacks,anemo_cryo_count,other_count,stance,flat_inside_discipline}=>(*radiance,*disciplinary_stacks,*anemo_cryo_count,*other_count,*stance,*flat_inside_discipline),_=>(false,0,1,0,false,false)};
  Some(Box::new(Effect{stance,flat_inside,c1:d.constellation>=1,c6:d.constellation>=6,a1:d.has_talent1,c2:d.constellation>=2&&d.has_talent1,c4:d.constellation>=4,a4:d.has_talent2,radiance:r,stacks:st.min(6),ac:ac.min(4),other:o.min(4)}))
 }
 fn get_target_function_by_role(_:usize,_:&TeamQuantization,_:&CharacterCommonData,_:&WeaponCommonData)->Box<dyn TargetFunction>{Box::new(crate::target_functions::target_functions::VesnaDefaultTargetFunction)}
}
