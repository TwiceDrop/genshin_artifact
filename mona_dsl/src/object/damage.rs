use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use mona::common::DamageResult;
use mona::damage::transformative_damage::TransformativeDamage;
use crate::error::runtime_error::{RuntimeError, RuntimeErrorEnum};
use crate::object::mona_object::{MonaObject, MonaObjectEnum, MonaObjectTrait};

pub struct MonaObjectDamage {
    pub results: HashMap<String, MonaObjectDamageNumber>,
}

impl MonaObjectTrait for MonaObjectDamage {
    fn access(&self, key: &MonaObject) -> Result<Rc<RefCell<MonaObject>>, RuntimeError> {
        let k = match &key.data {
            MonaObjectEnum::String(x) => x.value.clone(),
            _ => {
                return Err(RuntimeError::new(RuntimeErrorEnum::NotSupported, &format!("cannot access `Damage` object with type `{}`", key.get_type())));
            }
        };

        let name = match k.as_str() {
            "n" => "normal",
            "m" => "melt",
            "v" => "vaporize",
            name => name,
        };
        let result = self.results.get(name).ok_or_else(|| {
            RuntimeError::new(RuntimeErrorEnum::DamageNotFound, &format!("damage {} not exist", name))
        })?;

        let obj = MonaObject {
            data: MonaObjectEnum::DamageNumber(*result)
        };

        Ok(Rc::new(RefCell::new(obj)))
    }
}

#[derive(Clone, Copy, Debug, serde::Deserialize)]
pub struct MonaObjectDamageNumber {
    #[serde(alias = "expectation")]
    pub expect: f64,
    pub critical: f64,
    pub non_critical: f64
}

impl MonaObjectDamageNumber {
    pub fn from_damage_result(r: &DamageResult) -> Self {
        Self {
            expect: r.expectation,
            critical: r.critical,
            non_critical: r.non_critical
        }
    }
}

impl MonaObjectTrait for MonaObjectDamageNumber {
    fn access(&self, key: &MonaObject) -> Result<Rc<RefCell<MonaObject>>, RuntimeError> {
        let k = match &key.data {
            MonaObjectEnum::String(x) => x.value.clone(),
            _ => {
                return Err(RuntimeError::new(RuntimeErrorEnum::NotSupported, &format!("cannot access `DamageNumber` object with type `{}`", key.get_type())));
            }
        };

        let value = match k.as_str() {
            "expect" | "expectation" | "e" => self.expect,
            "critical" | "crit" | "c" => self.critical,
            "non_critical" | "non_crit" | "n" => self.non_critical,
            x => {
                return Err(RuntimeError::new(RuntimeErrorEnum::DamageNotFound, &format!("damage value `{}` not exist", x)))
            }
        };

        let obj = MonaObject::new_number(value);
        Ok(Rc::new(RefCell::new(obj)))
    }
}

pub struct MonaObjectTransformativeDamage {
    pub damage: TransformativeDamage
}

impl MonaObjectTrait for MonaObjectTransformativeDamage {
    fn access(&self, key: &MonaObject) -> Result<Rc<RefCell<MonaObject>>, RuntimeError> {
        let k = match &key.data {
            MonaObjectEnum::String(x) => x.value.clone(),
            _ => {
                return Err(RuntimeError::new(RuntimeErrorEnum::NotSupported, &format!("cannot access `TransformativeDamage` object with type `{}`", key.get_type())));
            }
        };

        let value = match k.as_str() {
            "swirl_cryo" => self.damage.swirl_cryo,
            "swirl_pyro" => self.damage.swirl_pyro,
            "swirl_hydro" => self.damage.swirl_hydro,
            "swirl_electro" => self.damage.swirl_electro,
            "overload" => self.damage.overload,
            "electro_charged" => self.damage.electro_charged,
            "shatter" => self.damage.shatter,
            "superconduct" | "super_conduct" => self.damage.superconduct,
            "bloom" => self.damage.bloom,
            "burgeon" => self.damage.burgeon,
            "hyperbloom" => self.damage.hyperbloom,
            "crystallize" => self.damage.crystallize,
            "burning" => self.damage.burning,
            x => {
                return Err(RuntimeError::new(RuntimeErrorEnum::NotSupported, &format!("`TransformativeDamage` doesn't have prop name `{}`", x)));
            }
        };

        let obj = MonaObject::new_number(value);
        Ok(Rc::new(RefCell::new(obj)))
    }
}
