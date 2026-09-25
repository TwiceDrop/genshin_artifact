const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=require(path.join(root,'beta-data/weapons-expanded-release-71.json'));
const weaponFile=path.join(root,'src/assets/_gen_weapon.js');
const zhFile=path.join(root,'src/i18n/generated/zh-cn.json');
const enFile=path.join(root,'src/i18n/generated/en.json');
const raw=fs.readFileSync(weaponFile,'utf8');
const nl=raw.includes('\r\n')?'\r\n':'\n';
const weapons=JSON.parse(raw.slice(raw.indexOf('{')));
const zh=JSON.parse(fs.readFileSync(zhFile,'utf8'));
const en=JSON.parse(fs.readFileSync(enFile,'utf8'));
if(zh.length!==en.length)throw Error('Locale arrays differ');
const specs={
  AthameArtis:[['burst_hit','bool',false,'元素爆发命中','Elemental Burst hit'],['secret_rite','bool',false,'魔导·秘仪生效','Hexerei Secret Rite active'],['rate','float',1,'白昼之刃覆盖率','Blade of the Daylight Hours coverage']],
  MoonweaverDawn:[['energy_cost','int',0,'装备者元素能量上限（0 为未知）','Wielder Energy capacity (0 if unknown)',0,100]],
  SerenitysCall:[['reaction_active','bool',false,'已触发元素反应','Elemental reaction triggered'],['moon_full','bool',false,'月兆·满辉','Moonsign Ascendant Gleam'],['rate','float',1,'生命加成覆盖率','HP bonus coverage']],
  LightbearingMoonshard:[['skill_active','bool',false,'已施放元素战技','Elemental Skill used'],['rate','float',1,'月结晶加成覆盖率','Lunar-Crystallize coverage']],
  WhitelakeFrostfeather:[['stacks','float',0,'湖色的哀告层数','Lake-Hued Lament stacks',0,3],['rate','float',1,'叠层平均覆盖率','Stack coverage']],
  ExaiphanesBlade:[['hit_active','bool',false,'旅行者已命中敌人','Traveler hit an opponent'],['rate','float',1,'加攻覆盖率','ATK bonus coverage']],
  AmberBead:[['stacks','float',0,'普通攻击命中层数','Normal Attack hit stacks',0,2]],
  NightweaversLookingGlass:[['skill_active','bool',false,'战技造成水／草伤害','Skill dealt Hydro/Dendro damage'],['lunar_bloom_active','bool',false,'队友触发月绽放','Nearby teammate triggered Lunar-Bloom'],['skill_rate','float',1,'终北圣言覆盖率','Prayer of the Far North coverage'],['lunar_rate','float',1,'朔月诗篇覆盖率','New Moon Verse coverage']],
  ReliquaryOfTruth:[['skill_active','bool',false,'已施放元素战技','Elemental Skill used'],['lunar_bloom_hit','bool',false,'已造成月绽放伤害','Lunar-Bloom damage dealt'],['skill_rate','float',1,'伪言之秘覆盖率','Secret of Lies coverage'],['lunar_rate','float',1,'真识之月覆盖率','Moon of Truth coverage']],
  DawningFrost:[['charged_active','bool',false,'重击已命中','Charged Attack hit'],['skill_active','bool',false,'战技已命中','Elemental Skill hit'],['charged_rate','float',1,'重击效果覆盖率','Charged Attack effect coverage'],['skill_rate','float',1,'战技效果覆盖率','Skill effect coverage']],
  EtherlightSpindlelute:[['skill_active','bool',false,'已施放元素战技','Elemental Skill used'],['rate','float',1,'精通覆盖率','Elemental Mastery coverage']],
  BlackmarrowLantern:[['moon_full','bool',false,'月兆·满辉','Moonsign Ascendant Gleam']],
  NocturnesCurtainCall:[['lunar_active','bool',false,'已触发／造成月曜反应','Lunar reaction triggered or dealt'],['rate','float',1,'神酒效果覆盖率','Sacred Wine coverage']],
  AngelosHeptades:[['shield_active','bool',false,'装备者已创造护盾','Wielder created a Shield'],['rate','float',1,'先导之光覆盖率','Pathfinder’s Light coverage']],
};
const add=(a,b)=>{const i=zh.length;zh.push(a);en.push(b);return i;};
const created={};
const inactiveDefaults={
  SerenitysCall:['rate'],LightbearingMoonshard:['extra_active'],
  WhitelakeFrostfeather:['stack'],ExaiphanesBlade:['active','resonated_elements'],
  NightweaversLookingGlass:['northernmost_runo_active','crescent_verse_active'],
  ReliquaryOfTruth:['false_secret_active','true_moon_active'],
  EtherlightSpindlelute:['rate'],NocturnesCurtainCall:['sacred_wine_uptime'],
  AngelosHeptades:['shield_rate'],
};
const coverageControls={
  LightbearingMoonshard:[['rate','月结晶加成覆盖率','Lunar-Crystallize coverage']],
  WhitelakeFrostfeather:[['rate','叠层平均覆盖率','Stack coverage']],
  ExaiphanesBlade:[['rate','加攻覆盖率','ATK bonus coverage']],
  NightweaversLookingGlass:[['skill_rate','终北圣言覆盖率','Prayer of the Far North coverage'],['lunar_rate','朔月诗篇覆盖率','New Moon Verse coverage']],
  ReliquaryOfTruth:[['skill_rate','伪言之秘覆盖率','Secret of Lies coverage'],['lunar_rate','真识之月覆盖率','Moon of Truth coverage']],
};
let updated=false;
// The published UI already calls this weapon MoonweaverDawn. Remove the
// earlier duplicate spelling emitted by this script before canonicalization.
if(weapons.MoonweaversDawn){delete weapons.MoonweaversDawn;updated=true;}
for(const w of source.weapons){
  if(weapons[w.name]){
    const meta=weapons[w.name];
    if(w.name==='MoonweaverDawn'){
      const energy=meta.configs?.find(c=>c.name==='max_energy');
      if(energy&&(energy.type!=='int'||energy.max!==100)){
        energy.type='int';energy.min=0;energy.max=100;updated=true;
      }
    }
    if(w.name==='PrizedIsshinBlade'&&(meta.id!==w.id||meta.availability!=='quest-only'||meta.maxRefine!==1)){
      meta.id=w.id;meta.availability='quest-only';meta.maxRefine=1;updated=true;
    }
    for(const config of meta.configs||[])if(inactiveDefaults[w.name]?.includes(config.name)&&config.default!==0&&config.default!==false){
      config.default=config.type==='bool'?false:0;updated=true;
    }
    for(const [name,titleZh,titleEn] of coverageControls[w.name]||[])if(!meta.configs?.some(c=>c.name===name)){
      (meta.configs??=[]).push({name,title:add(titleZh,titleEn),type:'float',min:0,max:1,default:1});updated=true;
    }
    continue;
  }
  const desc=w.refinementDetails[0];
  const strip=s=>String(s||'').replace(/<[^>]*>/g,'');
  const quest=w.name==='PrizedIsshinBlade';
  const effect=add((quest?'任务限定；仅可精炼 1 阶。':'')+strip(desc.description),
    (quest?'Quest-only; refinement 1 only. ':'')+strip(desc.descriptionEnglish));
  const configs=(specs[w.name]||[]).map(([name,type,def,titleZh,titleEn,min,max])=>({name,title:add(titleZh,titleEn),type,
    ...(type==='bool'?{}:{min:min??0,max:max??1}),default:def}));
  weapons[w.name]={name:w.name,internalName:(w.weaponType==='Sword'?'Sword_':'Catalyst_')+w.name,
    nameLocale:add(w.displayName,w.englishName),id:w.id,star:w.rarity,type:w.weaponType,url:w.imageUrl,
    effect,configs:configs.length?configs:null,...(quest?{availability:'quest-only',maxRefine:1}:{})};
  created[w.name]=weapons[w.name];
}
if(Object.keys(created).length||updated){
  const output=raw.slice(0,raw.indexOf('{'))+JSON.stringify(weapons,null,2).replaceAll('\n',nl)+nl;
  fs.writeFileSync(weaponFile,output);
  const writeLocale=(file,values)=>fs.writeFileSync(file,JSON.stringify(values,null,2).replaceAll('\n',nl)+nl);
  writeLocale(zhFile,zh);writeLocale(enFile,en);
}
console.log(Object.keys(created).length+' weapon metadata records added');
