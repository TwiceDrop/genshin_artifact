use crate::artifacts::{ArtifactSetName, effect_config::ArtifactEffectConfig};
use crate::attribute::{Attribute, AttributeName, SimpleAttributeGraph2};
use crate::character::{CharacterName, character_common_data::CharacterCommonData};

fn wearer(name: CharacterName) -> CharacterCommonData {
    CharacterCommonData::new(name, 90, true, 0, 10, 10, 10)
}

fn value(attribute: &SimpleAttributeGraph2, name: AttributeName) -> f64 {
    attribute.get_value(name)
}

fn close(actual: f64, expected: f64) {
    assert!((actual - expected).abs() < 1e-10, "{actual} != {expected}");
}

#[test]
fn aubade_requires_active_coverage_and_scales_only_lunar_reactions() {
    let mut config = ArtifactEffectConfig::default();
    config.config_aubade_of_morningstar_and_moon.is_ascendant_gleam = true;
    let common = wearer(CharacterName::Vesna);
    let mut attribute = SimpleAttributeGraph2::default();
    let effect = ArtifactSetName::AubadeOfMorningstarAndMoon.create_effect::<SimpleAttributeGraph2>(&config, &common);
    effect.effect2(&mut attribute);
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::ElementalMastery), 80.0);
    close(value(&attribute, AttributeName::EnhanceMoonReaction), 0.0);
    config.config_aubade_of_morningstar_and_moon.rate = 0.5;
    let effect = ArtifactSetName::AubadeOfMorningstarAndMoon.create_effect::<SimpleAttributeGraph2>(&config, &common);
    let mut attribute = SimpleAttributeGraph2::default();
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::EnhanceMoonReaction), 0.3);
}

#[test]
fn rising_winds_crit_requires_completed_witch_homework() {
    let mut config = ArtifactEffectConfig::default();
    config.config_a_day_carved_from_rising_winds.rate = 0.5;
    let common = wearer(CharacterName::Vesna);
    let mut attribute = SimpleAttributeGraph2::default();
    attribute.set_value_to(AttributeName::ATKBase, "测试基础攻击", 1000.0);
    let effect = ArtifactSetName::ADayCarvedFromRisingWinds.create_effect::<SimpleAttributeGraph2>(&config, &common);
    effect.effect2(&mut attribute);
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::ATKPercentage), 305.0);
    close(value(&attribute, AttributeName::CriticalBase), 0.05);
    config.config_a_day_carved_from_rising_winds.is_completed_witch_homework = true;
    let effect = ArtifactSetName::ADayCarvedFromRisingWinds.create_effect::<SimpleAttributeGraph2>(&config, &common);
    let mut attribute = SimpleAttributeGraph2::default();
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::CriticalBase), 0.15);
}

#[test]
fn heavens_gift_deduplicates_the_same_element() {
    let mut config = ArtifactEffectConfig::default();
    config.config_heavens_gift.rate = 1.0;
    config.config_heavens_gift.is_completed_witch_homework = true;
    config.config_heavens_gift.is_secret_arts = true;
    config.config_heavens_gift.on_field_element = 7; // Hydro, same as wearer.
    let common = wearer(CharacterName::Vodyanitsa);
    let effect = ArtifactSetName::HeavensGift.create_effect::<SimpleAttributeGraph2>(&config, &common);
    let mut attribute = SimpleAttributeGraph2::default();
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::BonusHydro), 0.4);
    config.config_heavens_gift.on_field_element = 6; // Anemo.
    let effect = ArtifactSetName::HeavensGift.create_effect::<SimpleAttributeGraph2>(&config, &common);
    let mut attribute = SimpleAttributeGraph2::default();
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::BonusHydro), 0.4);
    close(value(&attribute, AttributeName::BonusAnemo), 0.4);
}

#[test]
fn deep_shadow_keeps_superconduct_and_stellar_superconduct_separate() {
    let mut config = ArtifactEffectConfig::default();
    config.config_disenchantment_in_deep_shadow.rate = 0.5;
    let common = wearer(CharacterName::Vesna);
    let effect = ArtifactSetName::DisenchantmentInDeepShadow.create_effect::<SimpleAttributeGraph2>(&config, &common);
    let mut attribute = SimpleAttributeGraph2::default();
    effect.effect4(&mut attribute);
    close(value(&attribute, AttributeName::EnhanceSuperconduct), 0.8);
    close(value(&attribute, AttributeName::EnhanceStellarSuperconduct), 0.4);
    close(value(&attribute, AttributeName::CriticalAttacking), 0.08);
    close(value(&attribute, AttributeName::StellarSwirlBonus), 0.0);
}
