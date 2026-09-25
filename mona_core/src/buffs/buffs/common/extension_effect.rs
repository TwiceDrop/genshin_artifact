use crate::attribute::{Attribute,AttributeName,AttributeCommon};
use crate::buffs::{Buff,BuffConfig};
use crate::buffs::buff::BuffMeta;
pub struct BuffExtensionEffect { label:String, values:std::collections::HashMap<AttributeName,f64> }
impl<A:Attribute> Buff<A> for BuffExtensionEffect {
 fn change_attribute(&self,a:&mut A) { for (name,value) in &self.values { if value.is_finite() { match name { AttributeName::ATKPercentage=>a.add_atk_percentage(&self.label,*value),AttributeName::HPPercentage=>a.add_hp_percentage(&self.label,*value),AttributeName::DEFPercentage=>a.add_def_percentage(&self.label,*value),_=>a.set_value_by(*name,&self.label,*value) } } } }
}
impl BuffMeta for BuffExtensionEffect {
 #[cfg(not(target_family="wasm"))]
 const META_DATA:crate::buffs::buff_meta::BuffMetaData=crate::buffs::buff_meta::BuffMetaData {
 name:crate::buffs::buff_name::BuffName::ExtensionEffect,
 name_locale:crate::common::i18n::locale!(zh_cn:"扩展队友增益",en:"Extension support"),
 image:crate::buffs::buff_meta::BuffImage::Misc("sword"),genre:crate::buffs::buff_meta::BuffGenre::Common,
 description:None,from:crate::buffs::buff_meta::BuffFrom::Common };
 fn create<A:Attribute>(c:&BuffConfig)->Box<dyn Buff<A>> {
 let (label,values)=match c {BuffConfig::ExtensionEffect{label,values}=>(label.clone(),values.clone()),_=>(String::new(),std::collections::HashMap::new())};
 Box::new(BuffExtensionEffect{label,values})
 }
}
