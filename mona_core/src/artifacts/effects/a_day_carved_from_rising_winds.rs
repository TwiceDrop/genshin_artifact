use crate::artifacts::artifact_trait::{ArtifactMetaData, ArtifactTrait};
use crate::artifacts::effect::ArtifactEffect;
use crate::artifacts::effect_config::ArtifactEffectConfig;
use crate::artifacts::ArtifactSetName;
use crate::attribute::{Attribute, AttributeCommon, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::i18n::locale;
use crate::common::item_config_type::{ItemConfig, ItemConfigType};

struct Effect { active_rate: f64, witch_lesson: bool }

impl<A: Attribute> ArtifactEffect<A> for Effect {
    fn effect2(&self, attribute: &mut A) {
        attribute.add_atk_percentage("风起之日2", 0.18);
    }

    fn effect4(&self, attribute: &mut A) {
        attribute.add_atk_percentage("风起之日4", 0.25 * self.active_rate);
        if self.witch_lesson {
            attribute.set_value_by(AttributeName::CriticalBase, "风起之日4·魔女的课业", 0.2 * self.active_rate);
        }
    }
}

pub struct ADayCarvedFromRisingWinds;

impl ArtifactTrait for ADayCarvedFromRisingWinds {
    fn create_effect<A: Attribute>(config: &ArtifactEffectConfig, _: &CharacterCommonData) -> Box<dyn ArtifactEffect<A>> {
        let config = &config.config_a_day_carved_from_rising_winds;
        Box::new(Effect { active_rate: config.rate.clamp(0.0, 1.0), witch_lesson: config.is_completed_witch_homework })
    }

    #[cfg(not(target_family = "wasm"))]
    const META_DATA: ArtifactMetaData = ArtifactMetaData {
        name: ArtifactSetName::ADayCarvedFromRisingWinds,
        name_mona: "ADayCarvedFromRisingWinds",
        name_locale: locale!(zh_cn: "风起之日", en: "A Day Carved From Rising Winds"),
        flower: Some(locale!(zh_cn: "风花的箴铭", en: "Windborne Flower's Spruchdichtung")),
        feather: Some(locale!(zh_cn: "晨光的明誓", en: "Dawn's Brilliant Oath")),
        sand: Some(locale!(zh_cn: "春律的片刻", en: "A Note in Spring's Leich")),
        goblet: Some(locale!(zh_cn: "未言的宴话", en: "Heldenepos's Unspoken Tale")),
        head: Some(locale!(zh_cn: "哀慕的恋歌", en: "Minnesang of Love and Lament")),
        star: (4, 5), effect1: None,
        effect2: Some(locale!(zh_cn: "攻击力提高18%。", en: "ATK +18%.")),
        effect3: None,
        effect4: Some(locale!(
            zh_cn: "普通攻击、重击、元素战技或元素爆发命中敌人后，获得持续6秒的「风与牧歌的眷怜」：攻击力提高25%。若装备者已完成「魔女的课业」，额外使其暴击率提升20%。装备者处于队伍后台时也能触发。",
            en: "After a Normal Attack, Charged Attack, Elemental Skill, or Elemental Burst hits, gain 25% ATK for 6s. Completing Witch's Homework also grants 20% CRIT Rate. Can trigger off field."
        )),
        effect5: None, internal_id: 15044,
    };

    #[cfg(not(target_family = "wasm"))]
    const CONFIG4: Option<&'static [ItemConfig]> = Some(&[
        ItemConfig { name: "rate", title: locale!(zh_cn: "命中触发后6秒覆盖率", en: "6s hit-trigger coverage"),
            config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 0.0 } },
        ItemConfig { name: "is_completed_witch_homework", title: locale!(zh_cn: "装备者已完成魔女的课业", en: "Wearer completed Witch's Homework"),
            config: ItemConfigType::Bool { default: false } },
    ]);
}
