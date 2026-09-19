const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
if(path.basename(root)!=='beta1') throw Error('Only run in beta1');
const data=require('../beta-data/vodyanitsa.json'),skills=data.character.skills;
const put=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s)};
const edit=(p,from,to)=>{const s=fs.readFileSync(path.join(root,p),'utf8');if(!s.includes(from))throw Error(p+' anchor missing');put(p,s.replace(from,to))};
const append=(p,s)=>fs.appendFileSync(path.join(root,p),s);
edit('mona_core/src/character/character_name.rs','pub enum CharacterName {','pub enum CharacterName {\n    Vodyanitsa,');
edit('mona_core/src/character/character_config.rs','pub enum CharacterConfig {','pub enum CharacterConfig {\n    Vodyanitsa { e_active: bool, song_active: bool, ordinary_mode: bool, c1_active: bool, c2_active: bool, c4_stacks: usize, on_field: bool },');
edit('mona_core/src/character/skill_config.rs','pub enum CharacterSkillConfig {','pub enum CharacterSkillConfig {\n    Vodyanitsa { low_hp_heal: bool, q_song_bonus: bool },');
append('mona_core/src/character/characters/hydro/mod.rs','\npub mod vodyanitsa;\npub use vodyanitsa::Vodyanitsa;\n');
edit('mona_core/src/target_functions/target_function_name.rs','pub enum TargetFunctionName {','pub enum TargetFunctionName {\n    VodyanitsaDefault,');
append('mona_core/src/target_functions/target_functions/hydro/mod.rs','\npub mod vodyanitsa_default;\npub use vodyanitsa_default::VodyanitsaDefaultTargetFunction;\n');
edit('mona_core/src/weapon/weapon_name.rs','pub enum WeaponName {','pub enum WeaponName {\n    HymnOfTheMaelstrom,');
edit('mona_core/src/weapon/weapon_config.rs','pub enum WeaponConfig {','pub enum WeaponConfig {\n    HymnOfTheMaelstrom { stacks: usize, boosted: bool, on_field: bool },');
append('mona_core/src/weapon/weapons/catalysts/mod.rs','\npub mod hymn_of_the_maelstrom;\npub use hymn_of_the_maelstrom::HymnOfTheMaelstrom;\n');
const names=['Normal1','Normal2','Normal3','Normal4','Charged','Plunging1','Plunging2','Plunging3','EInitial','EHorn','EHeal','Burst'];
const skillnames=['normal_dmg1','normal_dmg2','normal_dmg3','normal_dmg4','charged_dmg','plunging_dmg1','plunging_dmg2','plunging_dmg3','e_initial_hp_ratio','e_horn_hp_ratio','e_heal_hp_ratio','q_hp_ratio'];
const rustFloat=n=>Number.isInteger(n)?n+'.0':String(n);
const locale=(zh,en=zh)=>`locale!(zh_cn: ${JSON.stringify(zh)}, en: ${JSON.stringify(en)})`;
put('mona_core/src/character/characters/hydro/vodyanitsa.rs',`
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
pub struct VodyanitsaSkillType { ${Object.keys(skills).map(k=>`pub ${k}:[f64;15],`).join('\n')} }
pub const SKILL:VodyanitsaSkillType=VodyanitsaSkillType{${Object.entries(skills).map(([k,v])=>`${k}:[${v.map(rustFloat)}],`).join('\n')}};
damage_enum!(VodyanitsaDamageEnum ${names.join(' ')});
pub struct Vodyanitsa;
pub struct VodyanitsaEffect { pub e:bool,pub song:bool,pub ordinary:bool,pub c1:bool,pub c2:bool,pub c4:usize,pub c6:bool,pub on:bool,pub a4:bool,pub e_level:usize }
impl<A:Attribute> ChangeAttribute<A> for VodyanitsaEffect {
 fn change_attribute(&self,a:&mut A) {
  use AttributeName::*;
  if self.c4>0 {a.add_hp_percentage("沃雅妮莎 C4（测试服）",self.c4.min(3) as f64*0.2);}
  if self.e {a.set_value_by(ResMinusHydro,"沃雅妮莎 E",SKILL.e_res_shred[self.e_level]);a.set_value_by(ResMinusCryo,"沃雅妮莎 E",SKILL.e_res_shred[self.e_level]);}
  if self.a4 && self.song && self.ordinary {
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
 hp:[${data.character.roundedCoreStats.hp}],atk:[${data.character.roundedCoreStats.atk}],def:[${data.character.roundedCoreStats.def}],
 sub_stat:CharacterSubStatFamily::HP288,weapon_type:WeaponType::Catalyst,star:5,
 name_locale:${locale('沃雅妮莎','Vodyanitsa')},skill_name1:${locale('普通攻击·水色咏叹')},skill_name2:${locale('宣叙·晨声纷流')},skill_name3:${locale('终奏·伴尔沉沦')}
 };
 type SkillType=VodyanitsaSkillType;const SKILL:Self::SkillType=SKILL;type DamageEnumType=VodyanitsaDamageEnum;type RoleEnum=();
 #[cfg(not(target_family="wasm"))]
 const SKILL_MAP:CharacterSkillMap=CharacterSkillMap{skill1:skill_map!(VodyanitsaDamageEnum ${names.slice(0,8).map(n=>n+' '+locale(n)).join(' ')}),skill2:skill_map!(VodyanitsaDamageEnum EInitial ${locale('施放伤害')} EHorn ${locale('角笛伤害')} EHeal ${locale('单次治疗')}),skill3:skill_map!(VodyanitsaDamageEnum Burst ${locale('爆发伤害')})};
 fn damage_internal<D:DamageBuilder>(ctx:&DamageContext<'_,D::AttributeType>,s:usize,c:&CharacterSkillConfig,fumo:Option<Element>)->D::Result {
  let(s1,s2,s3)=ctx.character_common_data.get_3_skill();let(low,q)=match c {CharacterSkillConfig::Vodyanitsa{low_hp_heal,q_song_bonus}=>(*low_hp_heal,*q_song_bonus),_=>(false,false)};
  let values=[${skillnames.map((k,i)=>`SKILL.${k}[${i<8?'s1':i<11?'s2':'s3'}]`).join(',')}];
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
`);
let tf=fs.readFileSync(path.join(root,'mona_core/src/target_functions/target_functions/hydro/neuvillette_default.rs'),'utf8').replaceAll('Neuvillette','Vodyanitsa').replace('S::Charged2','S::Burst').replace('&CharacterSkillConfig::Vodyanitsa { talent1_stack: 3 }','&CharacterSkillConfig::Vodyanitsa { low_hp_heal:false,q_song_bonus:false }').replace('那维莱特-谕告的潮音','沃雅妮莎-终奏（测试服）').replace('那维莱特伤害','最大化单次元素爆发伤害（不含未校准的歌声乘区）');
put('mona_core/src/target_functions/target_functions/hydro/vodyanitsa_default.rs',tf);
put('mona_core/src/weapon/weapons/catalysts/hymn_of_the_maelstrom.rs',`
use crate::attribute::{Attribute,AttributeName,AttributeCommon};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::WeaponType;
use crate::weapon::weapon_base_atk::WeaponBaseATKFamily;
use crate::weapon::weapon_sub_stat::WeaponSubStatFamily;
use crate::weapon::weapon_common_data::WeaponCommonData;
use crate::weapon::weapon_effect::WeaponEffect;
use crate::weapon::weapon_static_data::WeaponStaticData;
use crate::weapon::weapon_trait::WeaponTrait;
use crate::weapon::{WeaponConfig,WeaponName};
pub struct HymnOfTheMaelstrom;pub struct Effect{stacks:usize,boosted:bool,on:bool}
impl<A:Attribute> WeaponEffect<A> for Effect {
 fn apply(&self,d:&WeaponCommonData,a:&mut A){use AttributeName::*;let p=0.03+d.refine as f64*0.01;let m=if self.boosted{1.75}else{1.0};let n=self.stacks.min(3) as f64;
 a.set_value_by(HealingBonus,"漩流颂歌·治疗",p);a.add_hp_percentage("漩流颂歌·生命",p*m*n);
 if self.on{a.add_edge2(HP,ATKBase,ATKPercentage,Box::new(move|h,b|(((h-40000.0).max(0.0)/1000.0)*(p/10.0)).min(p*2.0)*m*n*b),Box::new(move|g,h,b|(if h>40000.0&&h<60000.0{g*b*p/10000.0*m*n}else{0.0},g*(((h-40000.0).max(0.0)/1000.0)*(p/10.0)).min(p*2.0)*m*n)),"漩流颂歌·场上加攻");}
 }
}
impl WeaponTrait for HymnOfTheMaelstrom {
 const META_DATA:WeaponStaticData=WeaponStaticData{name:WeaponName::HymnOfTheMaelstrom,internal_name:"Catalyst_HymnOfTheMaelstrom",weapon_type:WeaponType::Catalyst,weapon_sub_stat:Some(WeaponSubStatFamily::HP144),weapon_base:WeaponBaseATKFamily::ATK542,star:5,
 #[cfg(not(target_family="wasm"))]effect:None,#[cfg(not(target_family="wasm"))]name_locale:${locale('漩流颂歌','Hymn of the Maelstrom')}};
 fn get_effect<A:Attribute>(_:&CharacterCommonData,c:&WeaponConfig)->Option<Box<dyn WeaponEffect<A>>>{let(stacks,boosted,on)=match c{WeaponConfig::HymnOfTheMaelstrom{stacks,boosted,on_field}=>(*stacks,*boosted,*on_field),_=>(0,false,true)};Some(Box::new(Effect{stacks,boosted,on}))}
}
`);
