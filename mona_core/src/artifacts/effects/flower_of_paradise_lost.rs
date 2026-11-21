use crate::artifacts::artifact_trait::{ArtifactMetaData, ArtifactTrait};
use crate::artifacts::ArtifactSetName;
use crate::artifacts::effect::ArtifactEffect;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::attribute::{Attribute, AttributeCommon, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::item_config_type::{ItemConfig, ItemConfigType};

pub struct FlowerOfParadiseLostEffect {
    pub stack: f64,
}

impl<A: Attribute> ArtifactEffect<A> for FlowerOfParadiseLostEffect {
    fn effect2(&self, attribute: &mut A) {
        attribute.set_value_by(AttributeName::ElementalMastery, "乐园遗落之花2", 80.0);
    }

    fn effect4(&self, attribute: &mut A) {
        let multiplier = 1.0 + 0.25 * self.stack;
        for reaction in [AttributeName::EnhanceBloom, AttributeName::EnhanceBurgeon, AttributeName::EnhanceHyperbloom] {
            attribute.set_value_by(reaction, "乐园遗落之花4", 0.4 * multiplier);
        }
        attribute.set_value_by(AttributeName::EnhanceMoonbloom, "乐园遗落之花4", 0.1 * multiplier);
    }
}

pub struct FlowerOfParadiseLost;

impl ArtifactTrait for FlowerOfParadiseLost {
    fn create_effect<A: Attribute>(config: &ArtifactEffectConfig, character_common_data: &CharacterCommonData) -> Box<dyn ArtifactEffect<A>> {
        Box::new(FlowerOfParadiseLostEffect {
            stack: config.config_flower_of_paradise_lost.stack,
        })
    }

    #[cfg(not(target_family = "wasm"))]
    const META_DATA: ArtifactMetaData = ArtifactMetaData {
        name: ArtifactSetName::FlowerOfParadiseLost,
        name_mona: "FlowerOfParadiseLost",
        name_locale: crate::common::i18n::locale!(
            zh_cn: "乐园遗落之花",
            en: "Flower of Paradise Lost",
        ),
        flower: Some(crate::common::i18n::locale!(
            zh_cn: "月女的华彩",
            en: "Moon Maiden's Myriad",
        )),
        feather: Some(crate::common::i18n::locale!(
            zh_cn: "谢落的筵席",
            en: "Wilting Feast",
        )),
        sand: Some(crate::common::i18n::locale!(
            zh_cn: "凝结的时刻",
            en: "A Moment Congealed",
        )),
        goblet: Some(crate::common::i18n::locale!(
            zh_cn: "守秘的魔瓶",
            en: "Secret-Keeper's Magic Bottle",
        )),
        head: Some(crate::common::i18n::locale!(
            zh_cn: "紫晶的花冠",
            en: "Amethyst Crown",
        )),
        star: (4, 5),
        effect1: None,
        effect2: Some(crate::common::i18n::locale!(
            zh_cn: "元素精通提高80点。",
            en: "Elemental Mastery +80",
        )),
        effect3: None,
        effect4: Some(crate::common::i18n::locale!(
            zh_cn: "装备者的绽放、超绽放和烈绽放反应伤害提升40%，月绽放反应伤害提升10%。装备者每次触发上述任一反应时，这两项加成分别额外提升10和2.5个百分点，持续10秒，最多叠加4层，每秒最多触发一次。装备者在后台时也能触发。",
            en: "The wearer gains 40% Bloom, Hyperbloom, and Burgeon DMG Bonus and 10% Lunar-Bloom DMG Bonus. Triggering any of these reactions adds 10 and 2.5 percentage points to the respective bonuses for 10s. Up to 4 stacks, once per second. This can trigger while the wearer is off-field.",
        )),
        effect5: None,
        internal_id: 15028,
    };

    #[cfg(not(target_family = "wasm"))]
    const CONFIG4: Option<&'static [ItemConfig]> = Some(&[
        ItemConfig {
            name: "stack",
            title: crate::common::i18n::locale!(
                zh_cn: "效果等效层数",
                en: "Equivalent Stack",
            ),
            config: ItemConfigType::Float { min: 0.0, max: 4.0, default: 4.0 },
        }
    ]);
}
