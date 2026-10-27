const fs=require('fs'),path=require('path');process.chdir(path.resolve(__dirname,'..'));
if(path.basename(process.cwd())!=='beta2')throw Error('beta2 only');
const read=p=>fs.readFileSync(p,'utf8'),put=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)},edit=(p,a,b)=>{let s=read(p);if(!s.includes(a))throw Error('Missing '+p+' '+a);put(p,s.replace(a,b))},append=(p,s)=>fs.appendFileSync(p,s);
edit('mona_core/src/attribute/attribute_name.rs','pub enum AttributeName {',`pub enum AttributeName {
 VesnaStance, VesnaRadiance, VesnaDiscipline, VesnaFlatInside,
 StellarSwirlBonus, StellarSwirlFlat, StellarSwirlCritDamage, StellarSwirlElevation,`);
append('mona_core/src/damage/mod.rs','\npub mod stellar_swirl;\n');
put('mona_core/src/damage/stellar_swirl.rs',`
// 7.0.54 / D48100502 preview. The user-selectable flat/discipline ordering is unverified.
use crate::attribute::{Attribute,AttributeCommon,AttributeName};
use crate::common::{DamageResult,Element};use crate::enemies::Enemy;
pub fn calculate<A:Attribute>(a:&A,e:&Enemy,ratio:f64)->DamageResult{
 use AttributeName::*;
 let atk=a.get_atk();let em=a.get_em_all().max(0.0);let discipline=1.0+a.get_value(VesnaDiscipline)*0.1;
 let flat=a.get_value(StellarSwirlFlat);let base=if a.get_value(VesnaFlatInside)>0.5{(atk*ratio+flat)*discipline}else{atk*ratio*discipline+flat};
 let crit=a.get_value(CriticalBase).clamp(0.0,1.0);let cd=a.get_value(CriticalDamageBase)+a.get_value(StellarSwirlCritDamage);
 let damage=base*(1.0+(atk*0.00007).clamp(0.0,0.14))*(1.0+6.0*em/(2000.0+em)+a.get_value(StellarSwirlBonus))*(1.0+a.get_value(StellarSwirlElevation))*e.get_resistance_ratio(Element::Anemo,a.get_value(ResMinusBase)+a.get_value(ResMinusAnemo));
 DamageResult{non_critical:damage,critical:damage*(1.0+cd),expectation:damage*(1.0+crit*cd),is_heal:false,is_shield:false}
}
`);
edit('mona_core/src/damage/damage_builder.rs','    fn heal(',`    fn stellar_swirl(&self, attribute:&Self::AttributeType, enemy:&Enemy, ratio:f64, level:usize, skill:SkillType)->Self::Result;
    fn heal(`);
for(const file of ['simple_damage_builder.rs','complicated_damage_builder.rs']){
 edit('mona_core/src/damage/'+file,'    fn heal(',`    fn stellar_swirl(&self, attribute:&Self::AttributeType, enemy:&Enemy, ratio:f64, level:usize, skill:SkillType)->Self::Result {
      let mut result=self.damage(attribute,enemy,Element::Anemo,skill,level,None);
      result.normal=crate::damage::stellar_swirl::calculate(attribute,enemy,ratio);
      result.melt=None;result.vaporize=None;result.spread=None;result.aggravate=None;
      ${file.startsWith('complicated')?'result.moonfall=None;result.moonelectro=None;result.direct_moonelectro=None;result.bonus.clear();result.def_minus.clear();result.def_penetration.clear();':''}
      result
    }
    fn heal(`);
}
edit('mona_core/src/character/character_config.rs','other_count: usize },','other_count: usize, #[serde(default)] flat_inside_discipline: bool },');
let v=read('mona_core/src/character/characters/anemo/vesna.rs');
v=v.replace('pub struct Effect{c2:','pub struct Effect{stance:bool,flat_inside:bool,c1:bool,c6:bool,a1:bool,c2:');
v=v.replace('fn change_attribute(&self,a:&mut A){',`fn change_attribute(&self,a:&mut A){
 let st=if !self.a1 {0}else if self.c2 && self.stance{6}else{self.stacks};
 a.set_value_by(AttributeName::VesnaStance,"巡风列装",if self.stance{1.0}else{0.0});
 a.set_value_by(AttributeName::VesnaRadiance,"辉映",if self.radiance{1.0}else{0.0});
 a.set_value_by(AttributeName::VesnaDiscipline,"整肃",st as f64);
 a.set_value_by(AttributeName::VesnaFlatInside,"定额与整肃乘区选项",if self.flat_inside{1.0}else{0.0});
 if self.c1 && self.stance {a.set_value_by(AttributeName::StellarSwirlBonus,"薇斯纳 C1",0.2);}
 if self.c6 {a.set_value_by(AttributeName::StellarSwirlElevation,"薇斯纳 C6",0.2);}`);
v=v.replace('self.c2 && self.stacks==6','self.c2 && st==6');
v=v.replace('let(stance,stacks)=match c{CharacterSkillConfig::Vesna{stance,disciplinary_stacks}=>(*stance,(*disciplinary_stacks).min(6)),_=>(false,0)};',`let stance=ctx.attribute.get_value(AttributeName::VesnaStance)>0.5;
  let stacks=ctx.attribute.get_value(AttributeName::VesnaDiscipline) as usize;`);
v=v.replace('let e=if s<10',`if spirit && ctx.attribute.get_value(AttributeName::VesnaRadiance)>0.5 {
   return b.stellar_swirl(ctx.attribute,ctx.enemy,ratios[s]*unlocked,ctx.character_common_data.level,t);
  }
  let e=if s<10`);
v=v.replace('let(r,st,ac,o)=match c{CharacterConfig::Vesna{radiance,disciplinary_stacks,anemo_cryo_count,other_count,..}=>(*radiance,*disciplinary_stacks,*anemo_cryo_count,*other_count),_=>(false,0,1,0)};',`let(r,st,ac,o,stance,flat_inside)=match c{CharacterConfig::Vesna{radiance,disciplinary_stacks,anemo_cryo_count,other_count,stance,flat_inside_discipline}=>(*radiance,*disciplinary_stacks,*anemo_cryo_count,*other_count,*stance,*flat_inside_discipline),_=>(false,0,1,0,false,false)};`);
v=v.replace('Effect{c2:d.constellation','Effect{stance,flat_inside,c1:d.constellation>=1,c6:d.constellation>=6,a1:d.has_talent1,c2:d.constellation');
v=v.replace('// Isolated 7.0.54 D48100502 research kernel. Ordinary damage only.','// beta2 7.0.54 D48100502 preview kernel.').replace('// Stellar-converted entries are dispatched by the lab adapter, never this ordinary branch.','// Ordinary and direct stellar-swirl damage share native optimization and gain-curve evaluation.');
put('mona_core/src/character/characters/anemo/vesna.rs',v);
edit('mona_core/src/weapon/weapon_config.rs','BeyondTheChrysalis { loyal_wind: bool, on_field: bool },','BeyondTheChrysalis { loyal_wind: bool, #[serde(default)] rebel_wind: bool, on_field: bool },');
let w=read('mona_core/src/weapon/weapons/swords/beyond_the_chrysalis.rs').replace('Effect{active:bool}','Effect{active:bool,star:bool}');
w=w.replace('if self.active{','if self.star{a.set_value_by(AttributeName::StellarSwirlBonus,"蝶变·叛弃之风",0.27+0.09*d.refine as f64);}if self.active{');
w=w.replace('let active=match c{WeaponConfig::BeyondTheChrysalis{loyal_wind,on_field}=>*loyal_wind&&*on_field,_=>false};Some(Box::new(Effect{active}))','let(active,star)=match c{WeaponConfig::BeyondTheChrysalis{loyal_wind,rebel_wind,on_field}=>(*loyal_wind&&*on_field,*rebel_wind&&*on_field),_=>(false,false)};Some(Box::new(Effect{active,star}))');put('mona_core/src/weapon/weapons/swords/beyond_the_chrysalis.rs',w);
// Private normalized support node. User-facing buffs remain grouped by source character.
edit('mona_core/src/buffs/buff_name.rs','pub enum BuffName {','pub enum BuffName {\n    VesnaSupport,');
edit('mona_core/src/buffs/buff_config.rs','pub enum BuffConfig {','pub enum BuffConfig {\n    VesnaSupport { flat: f64, bonus: f64, crit_damage: f64, elevation: f64, anemo_res: f64 },');
append('mona_core/src/buffs/buffs/common/mod.rs','\npub mod vesna_support;pub use vesna_support::BuffVesnaSupport;\n');
put('mona_core/src/buffs/buffs/common/vesna_support.rs',`
use crate::attribute::{Attribute,AttributeName};use crate::buffs::{Buff,BuffConfig};use crate::buffs::buff::BuffMeta;
pub struct BuffVesnaSupport{flat:f64,bonus:f64,cd:f64,elev:f64,res:f64}
impl<A:Attribute> Buff<A> for BuffVesnaSupport{fn change_attribute(&self,a:&mut A){use AttributeName::*;a.set_value_by(StellarSwirlFlat,"队友星伤定额加值",self.flat);a.set_value_by(StellarSwirlBonus,"队友星伤增益",self.bonus);a.set_value_by(StellarSwirlCritDamage,"队友星伤暴伤",self.cd);a.set_value_by(StellarSwirlElevation,"队友星伤擢升",self.elev);a.set_value_by(ResMinusAnemo,"流荡风旋减风抗",self.res);}}
impl BuffMeta for BuffVesnaSupport{
#[cfg(not(target_family="wasm"))]const META_DATA:crate::buffs::buff_meta::BuffMetaData=crate::buffs::buff_meta::BuffMetaData{name:crate::buffs::buff_name::BuffName::VesnaSupport,name_locale:crate::common::i18n::locale!(zh_cn:"薇斯纳队友增益",en:"Vesna support"),image:crate::buffs::buff_meta::BuffImage::Misc("sword"),genre:crate::buffs::buff_meta::BuffGenre::Common,description:None,from:crate::buffs::buff_meta::BuffFrom::Common};
fn create<A:Attribute>(c:&BuffConfig)->Box<dyn Buff<A>>{let(flat,bonus,cd,elev,res)=match c{BuffConfig::VesnaSupport{flat,bonus,crit_damage,elevation,anemo_res}=>(*flat,*bonus,*crit_damage,*elevation,*anemo_res),_=>(0.0,0.0,0.0,0.0,0.0)};Box::new(BuffVesnaSupport{flat,bonus,cd,elev,res})}}
`);
// Actual native set identities, so optimization counts four pieces per candidate.
for(const [name,snake,atk2,em2,atk4,crit4,star4]of [['ScarletProof','scarlet_proof',.18,0,0,.16,.4],['HeartOfTheFurnace','heart_of_the_furnace',0,80,.12,0,.5]]){
 edit('mona_core/src/artifacts/artifact.rs','pub enum ArtifactSetName {',`pub enum ArtifactSetName {\n    ${name},`);
 append('mona_core/src/artifacts/effects/mod.rs',`\npub mod ${snake};pub use ${snake}::${name};\n`);
 edit('mona_core/src/artifacts/effect_config.rs','pub struct ArtifactEffectConfig {',`pub struct ArtifactEffectConfig {\n    #[serde(default)] pub config_${snake}:ConfigRate,`);
 edit('mona_core/src/artifacts/effect_config.rs','pub struct ArtifactConfigInterface {',`pub struct ArtifactConfigInterface {\n    pub config_${snake}:Option<ConfigRate>,`);
 edit('mona_core/src/artifacts/effect_config.rs','        ArtifactEffectConfig {',`        ArtifactEffectConfig {\n            config_${snake}:self.config_${snake}.unwrap_or_default(),`);
 put('mona_core/src/artifacts/effects/'+snake+'.rs',`
 use crate::attribute::{Attribute,AttributeName,AttributeCommon};use crate::artifacts::artifact_trait::{ArtifactMetaData,ArtifactTrait};use crate::artifacts::effect::ArtifactEffect;use crate::artifacts::effect_config::ArtifactEffectConfig;use crate::character::character_common_data::CharacterCommonData;
 pub struct ${name};pub struct Effect{rate:f64}
 impl<A:Attribute> ArtifactEffect<A> for Effect{fn effect2(&self,a:&mut A){a.add_atk_percentage("${name}2",${atk2});a.set_value_by(AttributeName::ElementalMastery,"${name}2",${em2}.0);}fn effect4(&self,a:&mut A){a.add_atk_percentage("${name}4",${atk4}*self.rate);a.set_value_by(AttributeName::CriticalBase,"${name}4",${crit4}*self.rate);a.set_value_by(AttributeName::StellarSwirlBonus,"${name}4",${star4}*self.rate);}}
 impl ArtifactTrait for ${name}{fn create_effect<A:Attribute>(c:&ArtifactEffectConfig,_:&CharacterCommonData)->Box<dyn ArtifactEffect<A>>{Box::new(Effect{rate:c.config_${snake}.rate.clamp(0.0,1.0)}))}
 #[cfg(not(target_family="wasm"))]const META_DATA:ArtifactMetaData=ArtifactMetaData{name:crate::artifacts::ArtifactSetName::${name},name_mona:"${snake}",name_locale:crate::common::i18n::locale!(zh_cn:"${name}",en:"${name}"),flower:None,feather:None,sand:None,goblet:None,head:None,star:(4,5),effect1:None,effect2:None,effect3:None,effect4:None,effect5:None,internal_id:0};}
 `.replace(/(?<=[,(])0(?=[*);])/g,'0.0'));
}
const pkg=JSON.parse(read('package.json'));pkg.version='5.30.0-beta2';pkg.scripts['test:beta2']='node beta-tools/smoke-beta2.mjs';put('package.json',JSON.stringify(pkg,null,2));
const lock=JSON.parse(read('package-lock.json'));lock.version=pkg.version;if(lock.packages?.[''])lock.packages[''].version=pkg.version;put('package-lock.json',JSON.stringify(lock,null,2));
for(const p of ['.env.development.yaml','script/start-local.mjs','server/local.mjs','mona_wasm/pkg/index.js'])put(p,read(p).replaceAll('beta1','beta2').replaceAll('4178','4182'));
put('启动beta2.bat',read('启动beta1.bat').replaceAll('beta1','beta2').replaceAll('4178','4182'));
put('启动莫娜.bat',read('启动beta2.bat'));
console.log('beta2 native upgrade written');
