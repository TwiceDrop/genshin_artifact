use crate::artifacts::Artifact;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::attribute::SimpleAttributeGraph2;
use crate::character::{Character, CharacterName};
use crate::character::character_common_data::CharacterCommonData;
use crate::character::characters::Vodyanitsa;
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

pub struct VodyanitsaDefaultTargetFunction;

impl TargetFunction for VodyanitsaDefaultTargetFunction {
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

        type S = <Vodyanitsa as CharacterTrait>::DamageEnumType;
        let dmg_charged2 = Vodyanitsa::damage::<SimpleDamageBuilder>(
            &context,
            S::Burst,
            &CharacterSkillConfig::Vodyanitsa { low_hp_heal:false,q_song_bonus:false },
            None
        );

        dmg_charged2.normal.expectation
    }
}

impl TargetFunctionMetaTrait for VodyanitsaDefaultTargetFunction {
    #[cfg(not(target_family = "wasm"))]
    const META_DATA: TargetFunctionMeta = TargetFunctionMeta {
        name: TargetFunctionName::VodyanitsaDefault,
        name_locale: locale!(
            zh_cn: "沃雅妮莎-终奏（测试服）",
            en: "Vodyanitsa-Ordainer of Inexorable Judgment"
        ),
        description: locale!(
            zh_cn: "最大化单次元素爆发伤害（不含未校准的歌声乘区）",
            en: "DPS Vodyanitsa"
        ),
        tags: "",
        four: TargetFunctionFor::SomeWho(CharacterName::Vodyanitsa),
        image: TargetFunctionMetaImage::Avatar
    };

    fn create(character: &CharacterCommonData, weapon: &WeaponCommonData, config: &TargetFunctionConfig) -> Box<dyn TargetFunction> {
        Box::new(VodyanitsaDefaultTargetFunction)
    }
}