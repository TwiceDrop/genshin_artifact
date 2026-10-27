use crate::attribute::Attribute;
use crate::common::{DamageResult, Element, SkillType};
use crate::common::reaction_type::TransformativeType;
use crate::damage::DamageAnalysis;
use crate::enemies::Enemy;

pub trait DamageBuilder {
    type Result;
    type AttributeType: Attribute;

    fn new() -> Self;

    fn add_atk_ratio(&mut self, key: &str, value: f64);

    fn add_def_ratio(&mut self, key: &str, value: f64);

    fn add_hp_ratio(&mut self, key: &str, value: f64);

    fn add_em_ratio(&mut self, key: &str, value: f64);

    fn add_extra_em(&mut self, key: &str, value: f64);

    fn add_extra_atk(&mut self, key: &str, value: f64);

    fn add_extra_def(&mut self, key: &str, value: f64);

    fn add_extra_hp(&mut self, key: &str, value: f64);

    fn add_extra_damage(&mut self, key: &str, value: f64);

    fn add_extra_critical(&mut self, key: &str, value: f64);

    fn add_extra_critical_damage(&mut self, key: &str, value: f64);

    fn add_extra_bonus(&mut self, key: &str, value: f64);

    fn add_extra_enhance_melt(&mut self, key: &str, value: f64);

    fn add_extra_enhance_vaporize(&mut self, key: &str, value: f64);

    fn add_extra_def_minus(&mut self, key: &str, value: f64);

    fn add_extra_def_penetration(&mut self, key: &str, value: f64);

    fn add_extra_res_minus(&mut self, key: &str, value: f64);

    fn add_direct_moonelectro_ratio(&mut self, key: &str, value: f64);

    fn add_direct_moonfall_ratio(&mut self, key: &str, value: f64);

    fn damage(
        &self,
        attribute: &Self::AttributeType,
        enemy: &Enemy,
        element: Element,
        skill_type: SkillType,
        character_level: usize,
        fumo: Option<Element>
    ) -> Self::Result;

    fn stellar_swirl(&self, attribute:&Self::AttributeType, enemy:&Enemy, ratio:f64, level:usize, skill:SkillType)->Self::Result;
    fn lunar_damage(&self,attribute:&Self::AttributeType,kind:crate::damage::reaction_parameters::LunarKind,direct:bool,scaled_base:f64,flat:f64,base_bonus:f64,reaction_bonus:f64,em:f64,cr:f64,cd:f64,resistance:f64)->DamageResult {
        crate::damage::reaction_parameters::lunar(attribute,kind,direct,scaled_base,flat,base_bonus,reaction_bonus,em,cr,cd,resistance)
    }
    fn stellar_conduct_damage(&self,attribute:&Self::AttributeType,skill_base:f64,coefficient:f64,base_bonus:f64,reaction_bonus:f64,em:f64,flat:f64,cr:f64,cd:f64,resistance:f64,elevation:f64)->DamageResult {
        crate::damage::reaction_parameters::stellar_conduct(attribute,skill_base,coefficient,base_bonus,reaction_bonus,em,flat,cr,cd,resistance,elevation)
    }
    fn heal(&self, attribute: &Self::AttributeType) -> Self::Result;

    fn shield(&self, attribute: &Self::AttributeType, element: Element) -> Self::Result;
}
