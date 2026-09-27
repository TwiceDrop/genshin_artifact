//! Snezhnaya battle-pass, forged and 7.1 limited four-star weapons.
//! Refinement and level source: beta-data/weapons-limited-71.json.
use crate::attribute::{Attribute, AttributeCommon, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::common::WeaponType;
#[cfg(not(target_family = "wasm"))]
use crate::common::item_config_type::{ItemConfig, ItemConfigType};
use crate::weapon::weapon_base_atk::WeaponBaseATKFamily;
use crate::weapon::weapon_common_data::WeaponCommonData;
use crate::weapon::weapon_effect::WeaponEffect;
use crate::weapon::weapon_static_data::WeaponStaticData;
use crate::weapon::weapon_sub_stat::WeaponSubStatFamily;
use crate::weapon::weapon_trait::WeaponTrait;
use crate::weapon::{WeaponConfig, WeaponName};

/// Values here are at refinement 1. These thirteen passives scale by 25% per
/// refinement, including Breezeborne Refrain's unconditional ER bonus.
struct SnezhnayaEffect {
    bonuses: Vec<(AttributeName, f64)>,
    label: &'static str,
}

impl<A: Attribute> WeaponEffect<A> for SnezhnayaEffect {
    fn apply(&self, data: &WeaponCommonData, attribute: &mut A) {
        let refinement = (data.refine.clamp(1, 5) as f64 + 3.0) / 4.0;
        for &(name, value) in &self.bonuses {
            if name == AttributeName::ATKPercentage {
                // ATKPercentage stores the computed flat contribution in this
                // graph. A percentage must create the ATKBase dependency.
                attribute.add_atk_percentage(self.label, value * refinement);
            } else {
                attribute.set_value_by(name, self.label, value * refinement);
            }
        }
        // Frostbreath and Song of the Vigil restore flat energy. Flat energy
        // does not increase Recharge or attack damage, so it is reported by UI.
    }
}

fn get_effect<A: Attribute>(name: WeaponName, config: &WeaponConfig, label: &'static str) -> Box<dyn WeaponEffect<A>> {
    use AttributeName::{ATKPercentage, ElementalMastery, StellarSwirlBonus};
    let mut bonuses = Vec::new();
    if name == WeaponName::BreezeborneRefrain {
        bonuses.push((AttributeName::Recharge, 0.20));
    }
    match (name, config) {
        (WeaponName::NewBough, WeaponConfig::NewBough { stacks, radiance, rate }) => {
            let amount = stacks.clamp(0.0, 3.0) * rate.clamp(0.0, 1.0);
            if *radiance {
                // Radiance replaces the ordinary ATK + EM form.
                bonuses.push((ATKPercentage, 0.06 * amount));
                bonuses.push((StellarSwirlBonus, 0.08 * amount));
            } else {
                bonuses.push((ATKPercentage, 0.04 * amount));
                bonuses.push((ElementalMastery, 20.0 * amount));
            }
        }
        (WeaponName::WintersHeavyHeart, WeaponConfig::WintersHeavyHeart { cryo_count, electro_count, radiance, rate }) => {
            // Party counts include the wielder, with at most four members.
            let cryo = (*cryo_count).min(4);
            let electro = (*electro_count).min(4 - cryo);
            let coverage = rate.clamp(0.0, 1.0);
            if *radiance {
                let count = (cryo + electro) as f64;
                bonuses.push((ElementalMastery, 20.0 * count * coverage));
                bonuses.push((StellarSwirlBonus, 0.06 * count * coverage));
            } else {
                bonuses.push((ElementalMastery, 24.0 * cryo as f64 * coverage));
                bonuses.push((ATKPercentage, 0.048 * electro as f64 * coverage));
            }
        }
        (WeaponName::BreezeborneRefrain, WeaponConfig::BreezeborneRefrain { rate }) => {
            bonuses.push((StellarSwirlBonus, 0.24 * rate.clamp(0.0, 1.0)));
        }
        (WeaponName::HereticsMoltenBlade, WeaponConfig::HereticsMoltenBlade { movement_rate, rate }) => {
            // Preserve the published calculator's effect-ratio convention:
            // 0 = inactive, 0.5 = minimum after E, 1 = full movement bonus.
            bonuses.push((ATKPercentage, 0.36 * movement_rate.clamp(0.0, 1.0) * rate.clamp(0.0, 1.0)));
        }
        (WeaponName::Emberwell, WeaponConfig::Emberwell { reaction_active, stellar_active, reaction_rate, stellar_rate }) => {
            if *reaction_active { bonuses.push((ATKPercentage, 0.16 * reaction_rate.clamp(0.0, 1.0))); }
            if *stellar_active { bonuses.push((StellarSwirlBonus, 0.16 * stellar_rate.clamp(0.0, 1.0))); }
        }
        (WeaponName::ForgedByTheGoldenMelody, WeaponConfig::ForgedByTheGoldenMelody { state, counterpoint_active, counterpoint_state, rate, counterpoint_rate }) => {
            let movements = [(ATKPercentage, 0.18), (ElementalMastery, 120.0), (StellarSwirlBonus, 0.28)];
            if let Some(&(attribute, value)) = movements.get(*state) {
                bonuses.push((attribute, value * rate.clamp(0.0, 1.0)));
            }
            if *counterpoint_active {
                // Counterpoint lasts 12s while the ordinary movement cycles
                // every 10s. 0 preserves old saves by following the current
                // movement; 1/2/3 explicitly retain ATK/EM/stellar counterpoint.
                let selected = if *counterpoint_state == 0 { *state } else { *counterpoint_state - 1 };
                if let Some(&(attribute, value)) = movements.get(selected) {
                    bonuses.push((attribute, value * counterpoint_rate.clamp(0.0, 1.0)));
                }
            }
        }
        (WeaponName::BladeOfAtonement, WeaponConfig::BladeOfAtonement { reaction_active, stellar_active, reaction_rate, stellar_rate }) => {
            if *reaction_active { bonuses.push((ElementalMastery, 64.0 * reaction_rate.clamp(0.0, 1.0))); }
            if *stellar_active { bonuses.push((ATKPercentage, 0.16 * stellar_rate.clamp(0.0, 1.0))); }
        }
        (WeaponName::Frostbreath, WeaponConfig::Frostbreath { active: true, rate, .. }) => {
            bonuses.push((ATKPercentage, 0.20 * rate.clamp(0.0, 1.0)));
        }
        (WeaponName::SongOfTheVigil, WeaponConfig::SongOfTheVigil { stellar_active: true, rate, .. }) => {
            bonuses.push((ATKPercentage, 0.20 * rate.clamp(0.0, 1.0)));
        }
        (WeaponName::ClashOfKings, WeaponConfig::ClashOfKings { active: true, rate }) => {
            bonuses.push((ATKPercentage, 0.20 * rate.clamp(0.0, 1.0)));
            bonuses.push((ElementalMastery, 100.0 * rate.clamp(0.0, 1.0)));
        }
        (WeaponName::EchoesOfTheHeart, WeaponConfig::EchoesOfTheHeart { reaction_active, stellar_active, reaction_rate, stellar_rate }) => {
            if *reaction_active { bonuses.push((ElementalMastery, 60.0 * reaction_rate.clamp(0.0, 1.0))); }
            if *stellar_active { bonuses.push((StellarSwirlBonus, 0.16 * stellar_rate.clamp(0.0, 1.0))); }
        }
        (WeaponName::JadeVista, WeaponConfig::JadeVista { same_count, diff_count, rate }) => {
            // Only the three teammates count; same-element EM takes priority.
            let same = (*same_count).min(3);
            let diff = (*diff_count).min(3 - same);
            bonuses.push((ElementalMastery, 64.0 * same as f64 * rate.clamp(0.0, 1.0)));
            bonuses.push((ATKPercentage, 0.12 * diff as f64 * rate.clamp(0.0, 1.0)));
        }
        (WeaponName::CovenantOfFrostAndSnow, WeaponConfig::CovenantOfFrostAndSnow { active: true, rate }) => {
            bonuses.push((ElementalMastery, 120.0 * rate.clamp(0.0, 1.0)));
        }
        _ => (),
    }
    Box::new(SnezhnayaEffect {
        bonuses,
        label,
    })
}

macro_rules! weapon {
    ($name:ident, $internal:literal, $kind:ident, $base:ident, $sub:ident, $zh:literal, $en:literal, $configs:expr) => {
        pub struct $name;
        impl WeaponTrait for $name {
            const META_DATA: WeaponStaticData = WeaponStaticData {
                name: WeaponName::$name,
                internal_name: $internal,
                weapon_type: WeaponType::$kind,
                weapon_sub_stat: Some(WeaponSubStatFamily::$sub),
                weapon_base: WeaponBaseATKFamily::$base,
                star: 4,
                #[cfg(not(target_family = "wasm"))]
                effect: None,
                #[cfg(not(target_family = "wasm"))]
                name_locale: crate::common::i18n::locale!(zh_cn: $zh, en: $en),
            };
            #[cfg(not(target_family = "wasm"))]
            const CONFIG_DATA: Option<&'static [ItemConfig]> = Some($configs);
            fn get_effect<A: Attribute>(_: &CharacterCommonData, config: &WeaponConfig) -> Option<Box<dyn WeaponEffect<A>>> {
                Some(get_effect(WeaponName::$name, config, $zh))
            }
        }
    };
}

#[cfg(not(target_family = "wasm"))]
const fn bool_config(name: &'static str, zh: &'static str, en: &'static str) -> ItemConfig {
    ItemConfig { name, title: crate::common::i18n::locale!(zh_cn: zh, en: en), config: ItemConfigType::Bool { default: true } }
}
#[cfg(not(target_family = "wasm"))]
const fn rate_config(name: &'static str) -> ItemConfig {
    ItemConfig { name, title: ItemConfig::DEFAULT_RATE_TITLE, config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 1.0 } }
}
#[cfg(not(target_family = "wasm"))]
const fn coverage_config(name: &'static str, zh: &'static str, en: &'static str) -> ItemConfig {
    ItemConfig { name, title: crate::common::i18n::locale!(zh_cn: zh, en: en), config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 1.0 } }
}
#[cfg(not(target_family = "wasm"))]
const fn count_config(name: &'static str, zh: &'static str, en: &'static str, default: i32) -> ItemConfig {
    ItemConfig { name, title: crate::common::i18n::locale!(zh_cn: zh, en: en), config: ItemConfigType::Int { min: 0, max: 4, default } }
}

weapon!(NewBough, "Sword_NewBough", Sword, ATK510, CriticalDamage120, "新枝", "New Bough", &[
    ItemConfig { name: "stacks", title: ItemConfig::DEFAULT_STACK_TITLE, config: ItemConfigType::Int { min: 0, max: 3, default: 0 } },
    ItemConfig { name: "radiance", title: crate::common::i18n::locale!(zh_cn: "队伍处于星烁辉耀状态", en: "Party is in Radiance"), config: ItemConfigType::Bool { default: false } },
    rate_config("rate"),
]);
weapon!(WintersHeavyHeart, "Catalyst_WintersHeavyHeart", Catalyst, ATK510, CriticalDamage120, "凝雪沉心", "Winter's Heavy Heart", &[
    count_config("cryo_count", "队伍冰元素人数（含装备者）", "Cryo members including wielder", 0),
    count_config("electro_count", "队伍雷元素人数（含装备者）", "Electro members including wielder", 0),
    ItemConfig { name: "radiance", title: crate::common::i18n::locale!(zh_cn: "队伍处于星烁辉耀状态", en: "Party is in Radiance"), config: ItemConfigType::Bool { default: false } },
    coverage_config("rate", "特效覆盖率", "Effect coverage"),
]);
weapon!(BreezeborneRefrain, "Bow_BreezeborneRefrain", Bow, ATK510, CriticalRate60, "柔风游弦", "Breezeborne Refrain", &[
    ItemConfig { name: "rate", title: ItemConfig::DEFAULT_RATE_TITLE, config: ItemConfigType::Float { min: 0.0, max: 1.0, default: 0.0 } },
]);
weapon!(HereticsMoltenBlade, "Sword_HereticsMoltenBlade", Sword, ATK510, CriticalRate60, "熔猎异端之刃", "Heretic's Molten Blade", &[
    rate_config("movement_rate"),
    coverage_config("rate", "攻击加成覆盖率", "ATK bonus coverage"),
]);
weapon!(Emberwell, "Sword_Emberwell", Sword, ATK510, EM36, "引火之源", "Emberwell", &[
    bool_config("reaction_active", "已触发元素反应", "Elemental reaction triggered"),
    coverage_config("reaction_rate", "元素反应效果覆盖率", "Reaction effect coverage"),
    bool_config("stellar_active", "已触发星烁反应", "Stellar reaction triggered"),
    coverage_config("stellar_rate", "星烁反应效果覆盖率", "Stellar reaction effect coverage"),
]);
weapon!(ForgedByTheGoldenMelody, "Claymore_GoldenMelody", Claymore, ATK510, CriticalRate60, "金律铸影", "Forged by the Golden Melody", &[
    ItemConfig { name: "state", title: crate::common::i18n::locale!(zh_cn: "当前乐章", en: "Current movement"), config: ItemConfigType::Option { options: "攻击力乐章,元素精通乐章,星烁反应乐章", default: 0 } },
    coverage_config("rate", "当前乐章覆盖率", "Current movement coverage"),
    bool_config("counterpoint_active", "已触发复调", "Counterpoint active"),
    ItemConfig { name: "counterpoint_state", title: crate::common::i18n::locale!(zh_cn: "复调乐章", en: "Counterpoint movement"), config: ItemConfigType::Option { options: "跟随当前乐章,攻击力乐章,元素精通乐章,星烁反应乐章", default: 0 } },
    coverage_config("counterpoint_rate", "复调覆盖率", "Counterpoint coverage"),
]);
weapon!(BladeOfAtonement, "Claymore_BladeOfAtonement", Claymore, ATK565, ATK60, "救赎之斩", "Blade of Atonement", &[
    bool_config("reaction_active", "已触发元素反应", "Elemental reaction triggered"),
    coverage_config("reaction_rate", "元素反应效果覆盖率", "Reaction effect coverage"),
    bool_config("stellar_active", "已触发星烁反应", "Stellar reaction triggered"),
    coverage_config("stellar_rate", "星烁反应效果覆盖率", "Stellar reaction effect coverage"),
]);
weapon!(Frostbreath, "Pole_Frostbreath", Polearm, ATK510, Recharge100, "寒息", "Frostbreath", &[
    bool_config("active", "被动效果已触发", "Passive active"),
    coverage_config("rate", "攻击加成覆盖率", "ATK bonus coverage"),
    coverage_config("energy_rate", "回能触发比例", "Energy trigger utilization"),
]);
weapon!(SongOfTheVigil, "Pole_SongOfTheVigil", Polearm, ATK565, EM24, "戍望谣歌", "Song of the Vigil", &[
    bool_config("stellar_active", "已触发星烁反应", "Stellar reaction triggered"),
    coverage_config("rate", "攻击加成覆盖率", "ATK bonus coverage"),
    coverage_config("energy_rate", "回能触发比例", "Energy trigger utilization"),
]);
weapon!(ClashOfKings, "Catalyst_ClashOfKings", Catalyst, ATK510, CriticalRate60, "群王局戏", "Clash of Kings", &[
    bool_config("active", "被动效果已触发", "Passive active"),
    coverage_config("rate", "特效覆盖率", "Effect coverage"),
]);
weapon!(EchoesOfTheHeart, "Catalyst_EchoesOfTheHeart", Catalyst, ATK565, ATK60, "寸心余响", "Echoes of the Heart", &[
    bool_config("reaction_active", "已触发元素反应", "Elemental reaction triggered"),
    coverage_config("reaction_rate", "元素反应效果覆盖率", "Reaction effect coverage"),
    bool_config("stellar_active", "已触发星烁反应", "Stellar reaction triggered"),
    coverage_config("stellar_rate", "星烁反应效果覆盖率", "Stellar reaction effect coverage"),
]);
weapon!(JadeVista, "Bow_JadeVista", Bow, ATK510, CriticalRate60, "悬黎千钧", "Jade Vista", &[
    count_config("same_count", "同元素队友数（不含装备者）", "Same-element teammates excluding wielder", 2),
    count_config("diff_count", "异元素队友数（不含装备者）", "Other-element teammates excluding wielder", 1),
    coverage_config("rate", "特效覆盖率", "Effect coverage"),
]);
weapon!(CovenantOfFrostAndSnow, "Bow_CovenantFrostSnow", Bow, ATK510, DEF113, "霜雪誓约", "Covenant of Frost and Snow", &[
    bool_config("active", "被动效果已触发", "Passive active"),
    coverage_config("rate", "精通加成覆盖率", "Elemental Mastery bonus coverage"),
]);
