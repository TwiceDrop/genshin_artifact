//! Published sword/catalyst catalog additions. Conditional uptime is supplied
//! by the saved weapon config; energy restoration is reported by the facade.
use crate::attribute::{Attribute, AttributeCommon, AttributeName};
use crate::character::character_common_data::CharacterCommonData;
use crate::character::CharacterName;
use crate::common::i18n::locale;
use crate::common::WeaponType;
use crate::weapon::weapon_base_atk::WeaponBaseATKFamily;
use crate::weapon::weapon_common_data::WeaponCommonData;
use crate::weapon::weapon_effect::WeaponEffect;
use crate::weapon::weapon_static_data::WeaponStaticData;
use crate::weapon::weapon_sub_stat::WeaponSubStatFamily;
use crate::weapon::weapon_trait::WeaponTrait;
use crate::weapon::{WeaponConfig, WeaponName};

struct ExpandedEffect {
    name: WeaponName,
    label: &'static str,
    active: bool,
    other_active: bool,
    special: bool,
    rate: f64,
    other_rate: f64,
    stacks: f64,
    resonated_elements: f64,
    traveler: bool,
}

impl ExpandedEffect {
    fn new(name: WeaponName, label: &'static str, character: &CharacterCommonData, config: &WeaponConfig) -> Self {
        let mut e=Self{name,label,active:false,other_active:false,special:false,rate:1.0,other_rate:1.0,stacks:0.0,resonated_elements:0.0,traveler:character.name==CharacterName::AetherAnemo};
        match (name,config) {
            (WeaponName::AthameArtis,WeaponConfig::AthameArtis{burst_hit,secret_rite,rate})=>{e.active=*burst_hit;e.special=*secret_rite;e.rate=*rate;},
            (WeaponName::MoonweaverDawn,WeaponConfig::MoonweaverDawn{energy_cost})=>e.stacks=*energy_cost as f64,
            (WeaponName::SerenitysCall,WeaponConfig::SerenitysCall{reaction_active,moon_full,rate})=>{e.active=*reaction_active;e.special=*moon_full;e.rate=*rate;},
            (WeaponName::LightbearingMoonshard,WeaponConfig::LightbearingMoonshard{skill_active,rate})=>{e.active=*skill_active;e.rate=*rate;},
            (WeaponName::WhitelakeFrostfeather,WeaponConfig::WhitelakeFrostfeather{stacks,rate})=>{e.stacks=*stacks;e.rate=*rate;},
            (WeaponName::ExaiphanesBlade,WeaponConfig::ExaiphanesBlade{hit_active,rate,resonated_elements})=>{e.active=*hit_active;e.rate=*rate;e.resonated_elements=(*resonated_elements).clamp(0,7) as f64;},
            (WeaponName::AmberBead,WeaponConfig::AmberBead{stacks})=>e.stacks=*stacks,
            (WeaponName::NightweaversLookingGlass,WeaponConfig::NightweaversLookingGlass{skill_active,lunar_bloom_active,skill_rate,lunar_rate})=>{e.active=*skill_active;e.other_active=*lunar_bloom_active;e.rate=*skill_rate;e.other_rate=*lunar_rate;},
            (WeaponName::ReliquaryOfTruth,WeaponConfig::ReliquaryOfTruth{skill_active,lunar_bloom_hit,skill_rate,lunar_rate})=>{e.active=*skill_active;e.other_active=*lunar_bloom_hit;e.rate=*skill_rate;e.other_rate=*lunar_rate;},
            (WeaponName::DawningFrost,WeaponConfig::DawningFrost{charged_active,skill_active,charged_rate,skill_rate})=>{e.active=*charged_active;e.other_active=*skill_active;e.rate=*charged_rate;e.other_rate=*skill_rate;},
            (WeaponName::EtherlightSpindlelute,WeaponConfig::EtherlightSpindlelute{skill_active,rate})=>{e.active=*skill_active;e.rate=*rate;},
            (WeaponName::BlackmarrowLantern,WeaponConfig::BlackmarrowLantern{moon_full})=>e.special=*moon_full,
            (WeaponName::NocturnesCurtainCall,WeaponConfig::NocturnesCurtainCall{lunar_active,rate})=>{e.active=*lunar_active;e.rate=*rate;},
            (WeaponName::AngelosHeptades,WeaponConfig::AngelosHeptades{shield_active,rate})=>{e.active=*shield_active;e.rate=*rate;},
            _=>(),
        }
        e.rate=e.rate.clamp(0.0,1.0);e.other_rate=e.other_rate.clamp(0.0,1.0);
        e
    }
}
fn at<const N:usize>(values:[f64;N],refine:i32)->f64 {values[(refine.clamp(1,N as i32)-1) as usize]}

impl<A:Attribute> WeaponEffect<A> for ExpandedEffect {
    fn apply(&self, data:&WeaponCommonData, a:&mut A) {
        use AttributeName::*;
        let r=data.refine;
        match self.name {
            WeaponName::PrizedIsshinBlade=>a.set_value_by(BonusBase,self.label,-0.5),
            WeaponName::AthameArtis=>{
                a.set_value_by(CriticalDamageElementalBurst,self.label,at([0.16,0.20,0.24,0.28,0.32],r));
                if self.active {a.add_atk_percentage(self.label,at([0.20,0.25,0.30,0.35,0.40],r)*if self.special{1.75}else{1.0}*self.rate);}
            },
            WeaponName::MoonweaverDawn=>{
                let mut bonus=at([0.20,0.25,0.30,0.35,0.40],r);
                if self.stacks>0.0&&self.stacks<=40.0{bonus+=at([0.28,0.35,0.42,0.49,0.56],r)}
                else if self.stacks>0.0&&self.stacks<=60.0{bonus+=at([0.16,0.20,0.24,0.28,0.32],r)}
                a.set_value_by(BonusElementalBurst,self.label,bonus);
            },
            WeaponName::SerenitysCall=>if self.active{a.add_hp_percentage(self.label,at([0.16,0.20,0.24,0.28,0.32],r)*(1.0+if self.special{1.0}else{0.0})*self.rate);},
            WeaponName::LightbearingMoonshard=>a.add_def_percentage(self.label,at([0.20,0.25,0.30,0.35,0.40],r)),
            WeaponName::WhitelakeFrostfeather=>{
                let stacks=self.stacks.clamp(0.0,3.0);
                a.add_atk_percentage(self.label,at([0.08,0.10,0.12,0.14,0.16],r)*stacks*self.rate);
                if stacks>=3.0 {a.set_value_by(StellarSwirlCritDamage,self.label,at([0.50,0.65,0.80,0.95,1.10],r)*self.rate);}
            },
            WeaponName::ExaiphanesBlade=>if self.traveler{
                if self.active{a.add_atk_percentage(self.label,at([0.16,0.20,0.24,0.32,0.40],r)*self.rate);}
                if r>=2{a.set_value_by(CriticalDamageBase,"星锋剑·共鸣元素",0.06*self.resonated_elements);}
            },
            WeaponName::AmberBead=>a.add_elemental_bonus(self.label,at([0.06,0.075,0.09,0.105,0.12],r)*self.stacks.clamp(0.0,2.0)),
            WeaponName::NightweaversLookingGlass=>{
                let em=at([60.0,75.0,90.0,105.0,120.0],r);
                if self.active{a.set_value_by(ElementalMastery,self.label,em*self.rate);}
                if self.other_active{a.set_value_by(ElementalMastery,"纺夜天镜·朔月诗篇",em*self.other_rate);}
            },
            WeaponName::ReliquaryOfTruth=>{
                a.set_value_by(CriticalBase,self.label,at([0.08,0.10,0.12,0.14,0.16],r));
                let overlap=if self.active&&self.other_active{self.rate.min(self.other_rate)}else{0.0};
                if self.active{a.set_value_by(ElementalMastery,self.label,at([80.0,100.0,120.0,140.0,160.0],r)*(self.rate+0.5*overlap));}
                if self.other_active{a.set_value_by(CriticalDamageBase,"真语秘匣·真识之月",at([0.24,0.30,0.36,0.42,0.48],r)*(self.other_rate+0.5*overlap));}
            },
            WeaponName::DawningFrost=>{
                if self.active{a.set_value_by(ElementalMastery,self.label,at([72.0,90.0,108.0,126.0,144.0],r)*self.rate);}
                if self.other_active{a.set_value_by(ElementalMastery,"霜辰·战技",at([48.0,60.0,72.0,84.0,96.0],r)*self.other_rate);}
            },
            WeaponName::EtherlightSpindlelute=>if self.active{a.set_value_by(ElementalMastery,self.label,at([100.0,125.0,150.0,175.0,200.0],r)*self.rate);},
            WeaponName::BlackmarrowLantern=>{
                a.set_value_by(EnhanceBloom,self.label,at([0.48,0.60,0.72,0.84,0.96],r));
                a.set_value_by(EnhanceMoonfall,self.label,at([0.12,0.15,0.18,0.21,0.24],r)*(if self.special{2.0}else{1.0}));
            },
            WeaponName::NocturnesCurtainCall=>{
                a.add_hp_percentage(self.label,at([0.10,0.12,0.14,0.16,0.18],r));
                if self.active{a.add_hp_percentage("帷间夜曲·神酒",at([0.14,0.16,0.18,0.20,0.22],r)*self.rate);}
            },
            WeaponName::AngelosHeptades=>a.add_atk_percentage(self.label,at([0.12,0.15,0.18,0.21,0.24],r)),
            _=>(),
        }
    }
}

macro_rules! weapon {
    ($name:ident,$internal:literal,$kind:ident,$base:ident,$sub:ident,$star:literal,$zh:literal,$en:literal)=>{
        pub struct $name;
        impl WeaponTrait for $name {
            const META_DATA:WeaponStaticData=WeaponStaticData{name:WeaponName::$name,internal_name:$internal,
                weapon_type:WeaponType::$kind,weapon_sub_stat:Some(WeaponSubStatFamily::$sub),
                weapon_base:WeaponBaseATKFamily::$base,star:$star,
                #[cfg(not(target_family="wasm"))]effect:None,
                #[cfg(not(target_family="wasm"))]name_locale:locale!(zh_cn:$zh,en:$en)};
            fn get_effect<A:Attribute>(character:&CharacterCommonData,config:&WeaponConfig)->Option<Box<dyn WeaponEffect<A>>>{
                Some(Box::new(ExpandedEffect::new(WeaponName::$name,$zh,character,config)))
            }
        }
    }
}
weapon!(PrizedIsshinBlade,"Sword_Isshin_Prized",Sword,ATK510,ATK90,4,"「一心传」名刀","Prized Isshin Blade");
weapon!(AthameArtis,"AthameArtis",Sword,ATK608,CriticalRate72,5,"黑蚀","Athame Artis");
weapon!(MoonweaverDawn,"Sword_Pale",Sword,ATK565,ATK60,4,"织月者的曙色","Moonweaver's Dawn");
weapon!(SerenitysCall,"Sword_Silence",Sword,ATK454,Recharge133,4,"谧音吹哨","Serenity's Call");
weapon!(LightbearingMoonshard,"Sword_Moonshard",Sword,ATK542,CriticalDamage192,5,"朏魄含光","Lightbearing Moonshard");
weapon!(WhitelakeFrostfeather,"Sword_WhitelakeFrostfeather",Sword,ATK674,CriticalRate48,5,"白湖冬羽","Whitelake Frostfeather");
weapon!(ExaiphanesBlade,"Sword_ExaiphanesBlade",Sword,ATK608,CriticalRate72,5,"星锋剑","Exaiphanes Blade");
weapon!(AmberBead,"Catalyst_Amber",Catalyst,ATK401,EM31,3,"琥珀玥","Amber Bead");
weapon!(NightweaversLookingGlass,"Catalyst_Linnunrata",Catalyst,ATK542,EM58,5,"纺夜天镜","Nightweaver's Looking Glass");
weapon!(ReliquaryOfTruth,"Catalyst_Tulaytullah",Catalyst,ATK542,CriticalDamage192,5,"真语秘匣","Reliquary of Truth");
weapon!(DawningFrost,"Catalyst_DawningFrost",Catalyst,ATK510,CriticalDamage120,4,"霜辰","Dawning Frost");
weapon!(EtherlightSpindlelute,"Catalyst_Natlan_Aether",Catalyst,ATK510,Recharge100,4,"天光的纺琴","Etherlight Spindlelute");
weapon!(BlackmarrowLantern,"Catalyst_Craftable_Natlan",Catalyst,ATK454,EM48,4,"乌髓孑灯","Blackmarrow Lantern");
weapon!(NocturnesCurtainCall,"Catalyst_Nocturne",Catalyst,ATK542,CriticalDamage192,5,"帷间夜曲","Nocturne's Curtain Call");
weapon!(AngelosHeptades,"AngelosHeptades",Catalyst,ATK741,ATK36,5,"尘光七谕","Angelos' Heptades");
