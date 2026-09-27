use crate::artifacts::artifact_trait::{ArtifactMetaData, ArtifactTrait};
use crate::artifacts::effect::ArtifactEffect;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::artifacts::ArtifactSetName;
use crate::attribute::{Attribute, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::{Element, i18n::locale};
use crate::common::item_config_type::{ItemConfig, ItemConfigType};

struct Effect {
    active_rate: f64,
    witch_lesson: bool,
    magister: bool,
    wearer_element: Element,
    on_field_element: Option<Element>,
}

impl<A: Attribute> ArtifactEffect<A> for Effect {
    fn effect2(&self, attribute: &mut A) {
        attribute.set_value_by(AttributeName::Recharge, "天之美赐2", 0.2);
    }

    fn effect4(&self, attribute: &mut A) {
        if !self.witch_lesson || self.active_rate == 0.0 { return; }
        let bonus = (if self.magister { 0.4 } else { 0.2 }) * self.active_rate;
        attribute.set_value_by(AttributeName::bonus_name_by_element(self.wearer_element), "天之美赐4", bonus);
        if self.magister {
            if let Some(element) = self.on_field_element {
                if element != self.wearer_element {
                    attribute.set_value_by(AttributeName::bonus_name_by_element(element), "天之美赐4·当前场上元素", bonus);
                }
            }
        }
    }
}

pub struct HeavensGift;

impl ArtifactTrait for HeavensGift {
    fn create_effect<A: Attribute>(config: &ArtifactEffectConfig, character: &CharacterCommonData) -> Box<dyn ArtifactEffect<A>> {
        let config = &config.config_heavens_gift;
        // The numeric option deliberately has 0 = unset; no second element is inferred.
        let on_field_element = match config.on_field_element {
            1 => Some(Element::Electro), 2 => Some(Element::Pyro), 3 => Some(Element::Cryo),
            4 => Some(Element::Dendro), 5 => Some(Element::Geo), 6 => Some(Element::Anemo),
            7 => Some(Element::Hydro), _ => None,
        };
        Box::new(Effect {
            active_rate: config.rate.clamp(0.0, 1.0),
            witch_lesson: config.is_completed_witch_homework,
            magister: config.is_secret_arts,
            wearer_element: character.static_data.element,
            on_field_element,
        })
    }

    #[cfg(not(target_family = "wasm"))]
    const META_DATA: ArtifactMetaData = ArtifactMetaData {
        name: ArtifactSetName::HeavensGift,
        name_mona: "HeavensGift",
        name_locale: locale!(zh_cn: "天之美赐", en: "Celestial Gift"),
        flower: Some(locale!(zh_cn: "天授之馨", en: "Fragrance Bestowed by Heaven")),
        feather: Some(locale!(zh_cn: "天授之殁", en: "Demise Bestowed by Heaven")),
        sand: Some(locale!(zh_cn: "天授之令", en: "Decree Bestowed by Heaven")),
        goblet: Some(locale!(zh_cn: "天授之禄", en: "Bounty Bestowed by Heaven")),
        head: Some(locale!(zh_cn: "天授之冕", en: "Crown Bestowed by Heaven")),
        star: (4, 5), effect1: None,
        effect2: Some(locale!(zh_cn: "元素充能效率提高20%。", en: "Energy Recharge +20%.")),
        effect3: None,
        effect4: Some(locale!(
            zh_cn: "完成魔女的课业的装备者施放元素战技后，队伍获得其对应元素20%伤害加成，持续20秒；拥有「魔导·秘仪」时，改为装备者及当前场上角色各自对应元素40%伤害加成，同元素不叠加。后台可触发，同名套装不叠加。",
            en: "After a wearer who completed Witch's Homework uses an Elemental Skill, the team gains 20% of the wearer's Elemental DMG Bonus for 20s. With Hexerei: Secret Rite, the wearer and current active character's elements instead gain 40% each, without stacking identical elements. Can trigger off field; identical sets do not stack."
        )),
        effect5: None, internal_id: 15045,
    };

    #[cfg(not(target_family = "wasm"))]
    const CONFIG4: Option<&'static [ItemConfig]> = Some(&[
        ItemConfig { name: "rate", title: locale!(zh_cn: "施放战技后20秒覆盖率", en: "20s post-Skill coverage"),
            config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 0.0 } },
        ItemConfig { name: "is_completed_witch_homework", title: locale!(zh_cn: "装备者已完成魔女的课业", en: "Wearer completed Witch's Homework"),
            config: ItemConfigType::Bool { default: false } },
        ItemConfig { name: "is_secret_arts", title: locale!(zh_cn: "队伍拥有魔导·秘仪", en: "Team has Hexerei: Secret Rite"),
            config: ItemConfigType::Bool { default: false } },
        ItemConfig { name: "on_field_element", title: locale!(zh_cn: "当前场上角色元素", en: "Current active character's element"),
            config: ItemConfigType::Option { options: "未设置,雷,火,冰,草,岩,风,水", default: 0 } },
    ]);
}
