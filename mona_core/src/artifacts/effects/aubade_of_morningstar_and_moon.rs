use crate::artifacts::artifact_trait::{ArtifactMetaData, ArtifactTrait};
use crate::artifacts::effect::ArtifactEffect;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::artifacts::ArtifactSetName;
use crate::attribute::{Attribute, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::i18n::locale;
use crate::common::item_config_type::{ItemConfig, ItemConfigType};

// The effect persists off field and for the first three seconds after taking the field.
// A static calculation therefore requires the caller to provide its actual coverage.
struct Effect { active_rate: f64, full_moon: bool }

impl<A: Attribute> ArtifactEffect<A> for Effect {
    fn effect2(&self, attribute: &mut A) {
        attribute.set_value_by(AttributeName::ElementalMastery, "晨星与月的晓歌2", 80.0);
    }

    fn effect4(&self, attribute: &mut A) {
        let bonus = (0.2 + if self.full_moon { 0.4 } else { 0.0 }) * self.active_rate;
        attribute.set_value_by(AttributeName::EnhanceMoonReaction, "晨星与月的晓歌4", bonus);
    }
}

pub struct AubadeOfMorningstarAndMoon;

impl ArtifactTrait for AubadeOfMorningstarAndMoon {
    fn create_effect<A: Attribute>(config: &ArtifactEffectConfig, _: &CharacterCommonData) -> Box<dyn ArtifactEffect<A>> {
        let config = &config.config_aubade_of_morningstar_and_moon;
        Box::new(Effect { active_rate: config.rate.clamp(0.0, 1.0), full_moon: config.is_ascendant_gleam })
    }

    #[cfg(not(target_family = "wasm"))]
    const META_DATA: ArtifactMetaData = ArtifactMetaData {
        name: ArtifactSetName::AubadeOfMorningstarAndMoon,
        name_mona: "AubadeOfMorningstarAndMoon",
        name_locale: locale!(zh_cn: "晨星与月的晓歌", en: "Aubade of Morningstar and Moon"),
        flower: Some(locale!(zh_cn: "献与月的华梦", en: "Moonlit Offering's Opulent Dream")),
        feather: Some(locale!(zh_cn: "献与月的离光", en: "Moonlit Offering's Parting Light")),
        sand: Some(locale!(zh_cn: "献与月的终时", en: "Moonlit Offering's Final Hour")),
        goblet: Some(locale!(zh_cn: "献与月的酹祭", en: "Moonlit Offering's Libation")),
        head: Some(locale!(zh_cn: "献与月的银冕", en: "Moonlit Offering's Silver Crown")),
        star: (4, 5), effect1: None,
        effect2: Some(locale!(zh_cn: "元素精通提高80点。", en: "Elemental Mastery +80.")),
        effect3: None,
        effect4: Some(locale!(
            zh_cn: "装备者处于队伍后台时，造成的月曜反应伤害提升20%；队伍的月兆等级至少为满辉时，造成的月曜反应伤害进一步提升40%。上述效果将在装备者位于场上3秒后移除。",
            en: "While off field, the wearer's Lunar Reaction DMG increases by 20%, with a further 40% at Full Moon. This effect expires after the wearer has been on field for 3s."
        )),
        effect5: None, internal_id: 15043,
    };

    #[cfg(not(target_family = "wasm"))]
    const CONFIG4: Option<&'static [ItemConfig]> = Some(&[
        ItemConfig { name: "rate", title: locale!(zh_cn: "后台或登场未满3秒的覆盖率", en: "Off-field or first 3s on-field coverage"),
            config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 0.0 } },
        ItemConfig { name: "is_ascendant_gleam", title: locale!(zh_cn: "队伍月兆至少满辉", en: "Team Moon Phase is Full Moon"),
            config: ItemConfigType::Bool { default: false } },
    ]);
}
