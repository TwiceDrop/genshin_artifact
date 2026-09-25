use lazy_static::lazy_static;
use mona::attribute::{Attribute, AttributeName, SimpleAttributeGraph2, AttributeCommon};
use mona::character::CharacterName;
use crate::error::runtime_error::RuntimeError;

lazy_static! {
    static ref LIST: Vec<&'static str> = vec![
        "recharge",
        "atk",
        "def",
        "hp",
        "em",
        "em_all",
        "crit0",
        "cd0",
        "heal",
        "stellar_swirl_bonus",
        "stellar_swirl_flat",
        "stellar_swirl_base_bonus",
        "stellar_swirl_crit_damage",
        "stellar_swirl_elevation",
        "vesna_discipline"
    ];
}

pub fn is_valid_prop_name(name: &str) -> bool {
    LIST.iter().position(|x| *x == name).is_some()
}

pub fn get_prop_value(attribute: &SimpleAttributeGraph2, name: &str) -> Result<f64, RuntimeError> {
    let v = match name {
        "recharge" => attribute.get_value(AttributeName::Recharge),
        "atk" => attribute.get_atk(),
        "def" => attribute.get_def(),
        "hp" => attribute.get_hp(),
        "em" => attribute.get_value(AttributeName::ElementalMastery),
        "em_all" => attribute.get_em_all(),
        "crit0" => attribute.get_value(AttributeName::CriticalBase),
        "cd0" => attribute.get_value(AttributeName::CriticalDamageBase),
        "heal" => attribute.get_value(AttributeName::HealingBonus),
        "stellar_swirl_bonus" => attribute.get_value(AttributeName::StellarSwirlBonus),
        "stellar_swirl_flat" => attribute.get_value(AttributeName::StellarSwirlFlat),
        "stellar_swirl_base_bonus" => attribute.get_value(AttributeName::StellarSwirlBaseBonus),
        "stellar_swirl_crit_damage" => attribute.get_value(AttributeName::StellarSwirlCritDamage),
        "stellar_swirl_elevation" => attribute.get_value(AttributeName::StellarSwirlElevation),
        "vesna_discipline" => attribute.get_value(AttributeName::VesnaDiscipline),
        _ => panic!("prop name not exist")
    };

    Ok(v)
}

#[derive(Debug)]
pub struct MonaObjectPropConfig {
    pub character_name: CharacterName,
    pub var_name: String,
    pub prop_name: String,
}
