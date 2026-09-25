use crate::artifacts::artifact_trait::{ArtifactMetaData, ArtifactTrait};
use crate::artifacts::effect::ArtifactEffect;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::artifacts::ArtifactSetName;
use crate::attribute::{Attribute, AttributeCommon, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::i18n::locale;
use crate::common::item_config_type::{ItemConfig, ItemConfigType};

struct Effect { enemy_affected_rate: f64 }

impl<A: Attribute> ArtifactEffect<A> for Effect {
    fn effect2(&self, attribute: &mut A) {
        attribute.add_atk_percentage("影中沉凝的幻灭2", 0.18);
    }

    fn effect4(&self, attribute: &mut A) {
        attribute.set_value_by(AttributeName::EnhanceSuperconduct, "影中沉凝的幻灭4·超导", 0.8);
        attribute.set_value_by(AttributeName::EnhanceStellarSuperconduct, "影中沉凝的幻灭4·星超导", 0.4);
        attribute.set_value_by(AttributeName::CriticalAttacking, "影中沉凝的幻灭4·受影响敌人", 0.16 * self.enemy_affected_rate);
    }
}

pub struct DisenchantmentInDeepShadow;

impl ArtifactTrait for DisenchantmentInDeepShadow {
    fn create_effect<A: Attribute>(config: &ArtifactEffectConfig, _: &CharacterCommonData) -> Box<dyn ArtifactEffect<A>> {
        Box::new(Effect { enemy_affected_rate: config.config_disenchantment_in_deep_shadow.rate.clamp(0.0, 1.0) })
    }

    #[cfg(not(target_family = "wasm"))]
    const META_DATA: ArtifactMetaData = ArtifactMetaData {
        name: ArtifactSetName::DisenchantmentInDeepShadow,
        name_mona: "DisenchantmentInDeepShadow",
        name_locale: locale!(zh_cn: "影中沉凝的幻灭", en: "Disenchantment in Deep Shadow"),
        flower: Some(locale!(zh_cn: "止于荣礼的缎彩", en: "Streamers of Ceremony's End")),
        feather: Some(locale!(zh_cn: "止于妙想成型的锋毫", en: "Quill of Realized Whim")),
        sand: Some(locale!(zh_cn: "止于宏伟梦醒的时刻", en: "Hour of Grand Awakening")),
        goblet: Some(locale!(zh_cn: "止于祝庆的喝礼", en: "Toast of Celebration's End")),
        head: Some(locale!(zh_cn: "止于阔步跌坠的灵摆", en: "Pendulum of Faltered Stride")),
        star: (4, 5), effect1: None,
        effect2: Some(locale!(zh_cn: "攻击力提高18%。", en: "ATK +18%.")),
        effect3: None,
        effect4: Some(locale!(
            zh_cn: "超导反应造成的伤害提升80%，星超导反应造成的伤害提升40%；装备者攻击受到超导或星超导反应影响的敌人时，本次攻击的暴击率提高16%。",
            en: "Superconduct Reaction DMG +80% and Stellar Superconduct Reaction DMG +40%. Attacks against enemies affected by either reaction gain 16% CRIT Rate for that hit."
        )),
        effect5: None, internal_id: 15046,
    };

    #[cfg(not(target_family = "wasm"))]
    const CONFIG4: Option<&'static [ItemConfig]> = Some(&[
        ItemConfig { name: "rate", title: locale!(zh_cn: "目标受超导或星超导影响的覆盖率", en: "Enemy affected by Superconduct or Stellar Superconduct"),
            config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 0.0 } },
    ]);
}
