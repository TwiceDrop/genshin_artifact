use std::collections::HashMap;
use mona::damage::transformative_damage::TransformativeDamage;
use mona_dsl::compile_complete_source;
use mona_dsl::object::damage::{MonaObjectDamage, MonaObjectDamageNumber, MonaObjectTransformativeDamage};
use mona_dsl::object::mona_object::{MonaObject, MonaObjectEnum};
use mona_dsl::vm::env::MonaEnv;
use mona_dsl::vm::stream::StringOutputStream;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
#[serde(untagged)]
enum Binding {
    Number(f64),
    Damage { damage: HashMap<String, MonaObjectDamageNumber> },
    Transformative { transformative: TransformativeDamage },
}

#[derive(Serialize)]
struct Evaluation {
    result: Option<f64>,
    output: String,
}

#[wasm_bindgen]
pub struct SegmentExpression(MonaEnv);

#[wasm_bindgen]
impl SegmentExpression {
    #[wasm_bindgen(constructor)]
    pub fn new(source: &str) -> Result<SegmentExpression, String> {
        compile_complete_source(source).map(|code| Self(MonaEnv::new(code)))
    }

    pub fn evaluate(&mut self, values: JsValue, require_result: bool) -> Result<JsValue, String> {
        let values: HashMap<String, Binding> = serde_wasm_bindgen::from_value(values)
            .map_err(|error| error.to_string())?;
        let env = &mut self.0;
        env.clear_local_state();
        env.stack.clear();
        env.set_ostream(Box::new(StringOutputStream::new()));
        for (name, binding) in values {
            let value = match binding {
                Binding::Number(value) => MonaObject::new_number(value),
                Binding::Damage { damage } => MonaObject {
                    data: MonaObjectEnum::Damage(MonaObjectDamage { results: damage }),
                },
                Binding::Transformative { transformative } => MonaObject {
                    data: MonaObjectEnum::TransformativeDamage(MonaObjectTransformativeDamage { damage: transformative }),
                },
            };
            env.namespace.insert(name, value);
        }
        env.execute().map_err(|error| error.to_string())?;
        let result = if require_result {
            let value = env.namespace.map.get("result").ok_or("missing result")?;
            let score = value.borrow().assert_number().map_err(|error| error.to_string())?;
            if !score.is_finite() {
                return Err("result must be finite".into());
            }
            Some(score)
        } else {
            None
        };
        let output = env.ostream.as_any().downcast_ref::<StringOutputStream>().unwrap().get_string();
        serde_wasm_bindgen::to_value(&Evaluation { result, output }).map_err(|error| error.to_string())
    }
}

fn main() {}
