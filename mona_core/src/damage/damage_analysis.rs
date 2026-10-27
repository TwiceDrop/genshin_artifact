use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use crate::common::{DamageResult, Element};

#[derive(Debug)]
#[derive(Serialize, Deserialize)]
pub struct DamageAnalysis {
    #[serde(skip_serializing_if="Option::is_none")]
    pub stellar_detail: Option<StellarDamageAnalysis>,
    pub atk: HashMap<String, f64>,
    pub atk_ratio: HashMap<String, f64>,
    pub hp: HashMap<String, f64>,
    pub hp_ratio: HashMap<String, f64>,
    pub def: HashMap<String, f64>,
    pub def_ratio: HashMap<String, f64>,
    pub em: HashMap<String, f64>,
    pub em_ratio: HashMap<String, f64>,
    pub extra_damage: HashMap<String, f64>,
    pub bonus: HashMap<String, f64>,
    pub critical: HashMap<String, f64>,
    pub critical_damage: HashMap<String, f64>,
    pub melt_enhance: HashMap<String, f64>,
    pub vaporize_enhance: HashMap<String, f64>,
    pub healing_bonus: HashMap<String, f64>,
    pub shield_strength: HashMap<String, f64>,
    pub spread_compose: HashMap<String, f64>,
    pub aggravate_compose: HashMap<String, f64>,
    pub moonelectro_base_compose: HashMap<String, f64>, // 月感电基础伤害提升组成
    pub direct_moonelectro_compose: HashMap<String, f64>, // 直伤月感电增伤组成
    pub direct_moonelectro_ratio: HashMap<String, f64>, // 直伤月感电倍率组成
    pub enhance_moon_reaction_compose: HashMap<String, f64>, // 月曜反应通用增伤组成

    pub def_minus: HashMap<String, f64>,
    pub def_penetration: HashMap<String, f64>,
    pub res_minus: HashMap<String, f64>,

    pub element: Element,
    pub is_heal: bool,
    pub is_shield: bool,

    pub normal: DamageResult,
    pub melt: Option<DamageResult>,
    pub vaporize: Option<DamageResult>,
    pub spread: Option<DamageResult>,
    pub aggravate: Option<DamageResult>,
    pub direct_moonelectro: Option<DamageResult>, // 直伤月感电
}

pub struct HealAnalysis {
    pub atk: HashMap<String, f64>,
    pub atk_ratio: HashMap<String, f64>,
    pub hp: HashMap<String, f64>,
    pub hp_ratio: HashMap<String, f64>,
    pub def: HashMap<String, f64>,
    pub def_ratio: HashMap<String, f64>,
    pub extra_damage: HashMap<String, f64>,
}

// #[derive(Debug)]
// #[derive(Serialize, Deserialize)]
// pub struct DamageAnalysis {
//     pub atk: HashMap<String, f64>,
//     pub atk_ratio: HashMap<String, f64>,
//     pub hp: HashMap<String, f64>,
//     pub hp_ratio: HashMap<String, f64>,
//     pub def: HashMap<String, f64>,
//     pub def_ratio: HashMap<String, f64>,
//     pub extra_damage: HashMap<String, f64>,
//     pub bonus: HashMap<String, f64>,
//     pub critical: HashMap<String, f64>,
//     pub critical_damage: HashMap<String, f64>,
//
//     pub def_minus: HashMap<String, f64>,
//     pub res_minus: HashMap<String, f64>,
//
//     pub result: DamageResult,
// }
// Source compositions for the same direct Stellar formula used by the damage builder.
#[derive(Debug, Serialize, Deserialize)]
pub struct StellarDamageAnalysis {
    pub element: Element,
    pub scaling_name: String,
    pub scaling: HashMap<String,f64>,
    pub ratio: HashMap<String,f64>,
    pub extra_base: HashMap<String,f64>,
    pub independent: HashMap<String,f64>,
    pub base_multiplier: HashMap<String,f64>,
    pub base_bonus: HashMap<String,f64>,
    pub bonus: HashMap<String,f64>,
    pub flat: HashMap<String,f64>,
    pub critical: HashMap<String,f64>,
    pub critical_damage: HashMap<String,f64>,
    pub reaction_critical: HashMap<String,f64>,
    pub reaction_critical_damage: HashMap<String,f64>,
    pub res_minus: HashMap<String,f64>,
    pub elevation: HashMap<String,f64>,
    pub universal_elevation: HashMap<String,f64>,
    pub final_multiplier: HashMap<String,f64>,
    pub active: bool,
}
