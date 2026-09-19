use crate::artifacts::Artifact;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::attribute::SimpleAttributeGraph2;
use crate::character::{Character, CharacterName};
use crate::character::character_common_data::CharacterCommonData;
use crate::character::characters::Vesna;
use crate::character::prelude::CharacterTrait;
use crate::character::skill_config::CharacterSkillConfig;
use crate::common::i18n::locale;
use crate::damage::{DamageContext, SimpleDamageBuilder};
use crate::enemies::Enemy;
use crate::target_functions::target_function::TargetFunctionMetaTrait;
use crate::target_functions::target_function_meta::{TargetFunctionFor, TargetFunctionMeta, TargetFunctionMetaImage};
use crate::target_functions::target_function_opt_config::TargetFunctionOptConfig;
use crate::target_functions::{TargetFunction, TargetFunctionConfig, TargetFunctionName};
use crate::team::TeamQuantization;
use crate::weapon::Weapon;
use crate::weapon::weapon_common_data::WeaponCommonData;

pub struct VesnaDefaultTargetFunction;

impl TargetFunction for VesnaDefaultTargetFunction {
    fn get_target_function_opt_config(&self) -> TargetFunctionOptConfig {
        unimplemented!()
    }

    fn get_default_artifact_config(&self, team_config: &TeamQuantization) -> ArtifactEffectConfig {
        Default::default()
    }

    fn target(&self, attribute: &SimpleAttributeGraph2, character: &Character<SimpleAttributeGraph2>, weapon: &Weapon<SimpleAttributeGraph2>, artifacts: &[&Artifact], enemy: &Enemy) -> f64 {
        let context = DamageContext {
            character_common_data: &character.common_data,
            enemy, attribute
        };

        type S = <Vesna as CharacterTrait>::DamageEnumType;
        let dmg_charged2 = Vesna::damage::<SimpleDamageBuilder>(
            &context,
            S::Burst,
            &CharacterSkillConfig::Vesna { stance:false,disciplinary_stacks:0 },
            None
        );

        dmg_charged2.normal.expectation
    }
}

impl TargetFunctionMetaTrait for VesnaDefaultTargetFunction {
    #[cfg(not(target_family = "wasm"))]
    const META_DATA: TargetFunctionMeta = TargetFunctionMeta {
        name: TargetFunctionName::VesnaDefault,
        name_locale: locale!(
            zh_cn: "薇斯纳-终奏（测试服）",
            en: "Vesna-Ordainer of Inexorable Judgment"
        ),
        description: locale!(
            zh_cn: "最大化单次元素爆发伤害（不含未校准的歌声乘区）",
            en: "DPS Vesna"
        ),
        tags: "",
        four: TargetFunctionFor::SomeWho(CharacterName::Vesna),
        image: TargetFunctionMetaImage::Avatar
    };

    fn create(character: &CharacterCommonData, weapon: &WeaponCommonData, config: &TargetFunctionConfig) -> Box<dyn TargetFunction> {
        Box::new(VesnaDefaultTargetFunction)
    }
}