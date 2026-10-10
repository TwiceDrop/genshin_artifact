import data from './weapons-expanded-runtime.mjs';
import silverLight from './silver-light-runtime.mjs';

const catalog=new Map([...data.weapons,silverLight].map(w=>[w.name,w]));
const bool=x=>typeof x==='boolean';
const pct=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const count=(x,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
const nativeRole=name=>name==='Vesna'||name==='Vodyanitsa';
const travelerRole=name=>/^(?:Aether|Lumine|Manekina)(?:Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)$/.test(name||'');
// Marginal coverages determine overlap only when one state is absent or full.
// Two partial coverages need timing information; min(a,b) invents nesting.
export function knownOverlap(a,b,provided){
 const lo=Math.max(0,a+b-1),hi=Math.min(a,b);
 if(provided!==undefined&&provided!==-1){
  if(!pct(provided)||provided<lo-1e-9||provided>hi+1e-9)throw Error(`两状态同时生效比例须在 ${lo}～${hi} 之间`);
  return provided;
 }
 if(Math.abs(lo-hi)<1e-12)return hi;
 throw Error('两个状态均为部分覆盖，请填写同时生效比例；不能仅凭各自覆盖率推算重叠。');
}
const effect=(label,values,source_buff)=>({name:'ExtensionEffect',...(source_buff?{source_buff}:{}),config:{ExtensionEffect:{label,values}}});
export const isExpandedWeapon=weapon=>catalog.has(weapon?.name);
export const expandedWeaponCatalog=Object.freeze([...catalog.values()].map(w=>Object.freeze({id:w.id,name:w.name,displayName:w.displayName,type:w.weaponType,rarity:w.rarity,maxRefine:w.refinements.length,availability:w.name==='PrizedIsshinBlade'?'quest-only':'catalog'})));

function config(name,old){
  const p=old||{};
  switch(name){
  case 'SilverLight': return {stacks:p.stacks??0};
  case 'PrizedIsshinBlade': return null;
  case 'AthameArtis': return {burst_hit:p.burst_hit??(Number(p.rate)>0),secret_rite:p.secret_rite??p.magus??false,rate:p.rate??1};
  case 'MoonweaverDawn': return {energy_cost:p.energy_cost??p.max_energy??0};
  case 'SerenitysCall': return {reaction_active:p.reaction_active??(Number(p.rate)>0),moon_full:p.moon_full??p.full_moon??false,rate:p.rate??1};
  case 'LightbearingMoonshard': return {skill_active:p.skill_active??p.extra_active??false,rate:p.rate??1};
  case 'WhitelakeFrostfeather': return {stacks:p.stacks??p.stack??0,rate:p.rate??1};
  case 'ExaiphanesBlade': return {hit_active:p.hit_active??p.active??false,rate:p.rate??1,resonated_elements:p.resonated_elements??0};
  case 'AmberBead': return {stacks:p.stacks??p.stack??0};
  case 'NightweaversLookingGlass': return {skill_active:p.skill_active??p.northernmost_runo_active??false,lunar_bloom_active:p.lunar_bloom_active??p.crescent_verse_active??false,skill_rate:p.skill_rate??1,lunar_rate:p.lunar_rate??1,overlap_rate:p.overlap_rate??-1};
  case 'ReliquaryOfTruth': return {skill_active:p.skill_active??p.false_secret_active??false,lunar_bloom_hit:p.lunar_bloom_hit??p.true_moon_active??false,skill_rate:p.skill_rate??1,lunar_rate:p.lunar_rate??1,overlap_rate:p.overlap_rate??-1};
  case 'DawningFrost': return {charged_active:p.charged_active??(Number(p.rate_charged)>0),skill_active:p.skill_active??(Number(p.rate_skill)>0),charged_rate:p.charged_rate??p.rate_charged??1,skill_rate:p.skill_rate??p.rate_skill??1};
  case 'EtherlightSpindlelute': return {skill_active:p.skill_active??(Number(p.rate)>0),rate:p.rate??1};
  case 'BlackmarrowLantern': return {moon_full:p.moon_full??(p.moon_state===2)};
  case 'NocturnesCurtainCall': return {lunar_active:p.lunar_active??(Number(p.sacred_wine_uptime)>0),rate:p.rate??p.sacred_wine_uptime??1};
  case 'AngelosHeptades': return {shield_active:p.shield_active??(Number(p.shield_rate)>0),rate:p.rate??p.shield_rate??1};
  default: throw Error('Unknown expanded weapon '+name);
  }
}

export function normalizeExpandedWeapon(weapon){
  if(!isExpandedWeapon(weapon))return weapon;
  const w=catalog.get(weapon.name);
  if(!Number.isInteger(weapon.level)||weapon.level<1||weapon.level>90)throw Error(`${w.displayName}等级应为1～90`);
  if(!Number.isInteger(weapon.refine)||weapon.refine<1||weapon.refine>w.refinements.length)throw Error(`${w.displayName}精炼应为1～${w.refinements.length}`);
  if(typeof weapon.ascend!=='boolean'||weapon.ascend&&![20,40,50,60,70,80].includes(weapon.level))throw Error(`${w.displayName}突破状态无效`);
  const p=config(weapon.name,weapon.params?.[weapon.name]);
  if(p){
    for(const [key,value]of Object.entries(p)){
      if(['rate','skill_rate','lunar_rate','charged_rate'].includes(key)&&!pct(value))throw Error(`${w.displayName} ${key} 覆盖率应为0～1`);
      if((key.endsWith('_active')||key.endsWith('_hit')||['secret_rite','moon_full'].includes(key))&&!bool(value))throw Error(`${w.displayName} ${key} 开关无效`);
    }
    if(p.stacks!==undefined&&!count(p.stacks,['AmberBead','SilverLight'].includes(weapon.name)?2:3))throw Error(`${w.displayName}叠层无效`);
    if(p.energy_cost!==undefined&&(!Number.isInteger(p.energy_cost)||p.energy_cost<0||p.energy_cost>100))throw Error(`${w.displayName}元素能量上限无效`);
    if(p.resonated_elements!==undefined&&(!Number.isInteger(p.resonated_elements)||p.resonated_elements<0||p.resonated_elements>7))throw Error(`${w.displayName}共鸣元素数无效`);
  }
  if(weapon.name==='ReliquaryOfTruth')knownOverlap(p.skill_active?p.skill_rate:0,p.lunar_bloom_hit?p.lunar_rate:0,p.overlap_rate);
  if(weapon.name==='NightweaversLookingGlass')knownOverlap(p.skill_active?p.skill_rate:0,p.lunar_bloom_active?p.lunar_rate:0,p.overlap_rate);
  return {...weapon,params:p?{[weapon.name]:p}:'NoConfig'};
}

export function expandedWeaponStats(weapon){
  const w=normalizeExpandedWeapon(weapon);
  if(!isExpandedWeapon(w))return null;
  const row=catalog.get(w.name).levels.find(x=>x.level===w.level&&x.ascend===w.ascend);
  if(!row)throw Error('武器等级数据缺失：'+w.name);
  return {attack:row.attack,secondaryStat:catalog.get(w.name).secondaryStat,subStat:row.subStat,attackRaw:row.attackRaw,subStatRaw:row.subStatRaw};
}

export function expandedWeaponEffects(weapon,{characterName,sourceAttack}={}){
  const w=normalizeExpandedWeapon(weapon);
  if(!isExpandedWeapon(w))return null;
  const source=catalog.get(w.name),r=w.refine-1,p=w.params?.[w.name]||{};
  const v=source.refinements[r],fx={source:w.name,sourceVersion:source.revision??data.revision,averageCoverage:true,
    attackPercentage:0,hpPercentage:0,defensePercentage:0,elementalMastery:0,
    criticalRate:0,criticalDamage:0,burstBonus:0,burstCriticalDamage:0,allElementalBonus:0,
    bloomBonus:0,lunarBloomBonus:0,lunarCrystallizeBonus:0,lunarReactionCriticalDamage:0,stellarReactionCriticalDamage:0,
    teamEffects:[],directEnergy:null,unmodeled:[]};
  switch(w.name){
  case 'SilverLight':fx.elementalMastery=v[0]*p.stacks;break;
  case 'PrizedIsshinBlade':fx.allDamageBonus=-.5;fx.unmodeled.push('每8秒一次的范围伤害与治疗需轮转模型');break;
  case 'AthameArtis':{
    fx.burstCriticalDamage=v[0];const m=p.secret_rite?1.75:1;
    if(p.burst_hit){fx.attackPercentage=v[2]*m*p.rate;fx.teamEffects.push({kind:'attackPercentage',target:'other active party member',amount:v[3]*m*p.rate,duration:3,trigger:'burst hit'});}
    break;
  }
  case 'MoonweaverDawn':fx.burstBonus=v[0]+(p.energy_cost>0&&p.energy_cost<=40?v[2]:p.energy_cost>0&&p.energy_cost<=60?v[1]:0);break;
  case 'SerenitysCall':fx.hpPercentage=p.reaction_active?(v[0]+(p.moon_full?v[2]:0))*p.rate:0;break;
  case 'LightbearingMoonshard':fx.defensePercentage=[.2,.25,.3,.35,.4][r];fx.lunarCrystallizeBonus=p.skill_active?v[0]*p.rate:0;break;
  case 'WhitelakeFrostfeather':fx.attackPercentage=v[1]*p.stacks*p.rate;fx.stellarReactionCriticalDamage=p.stacks>=3?v[4]*p.rate:0;if(p.stacks>=3)fx.directEnergy={amount:v[0],intervalSeconds:v[5],target:'wielder',trigger:'stellar reaction'};break;
  case 'ExaiphanesBlade':if(travelerRole(characterName)){
    fx.criticalDamage=w.refine>=2?v[2]*p.resonated_elements:0;
    if(p.hit_active){fx.attackPercentage=v[0]*p.rate;fx.directEnergy={amount:v[3],intervalSeconds:v[4],target:'wielder',trigger:'hit'};}
  }break;
  case 'AmberBead':fx.allElementalBonus=v[0]*p.stacks;break;
  case 'NightweaversLookingGlass':{
    const skill=p.skill_active?p.skill_rate:0,lunar=p.lunar_bloom_active?p.lunar_rate:0;
    fx.elementalMastery=v[0]*skill+v[2]*lunar;
    if(skill>0&&lunar>0){
      const coverage=knownOverlap(skill,lunar,p.overlap_rate);
      fx.teamEffects.push({kind:'reactionBonus',target:'nearby party',bloom:v[4],hyperbloom:v[5],burgeon:v[5],lunarBloom:v[6],coverage,coverageBounds:{min:Math.max(0,skill+lunar-1),max:Math.min(skill,lunar)},trigger:'both states'});
      
    }
    break;
  }
  case 'ReliquaryOfTruth':{
    const skill=p.skill_active?p.skill_rate:0,lunar=p.lunar_bloom_hit?p.lunar_rate:0,overlap=knownOverlap(skill,lunar,p.overlap_rate);
    fx.criticalRate=v[5];fx.elementalMastery=v[0]*(skill+.5*overlap);fx.criticalDamage=v[1]*(lunar+.5*overlap);break;
  }
  case 'DawningFrost':fx.elementalMastery=(p.charged_active?v[0]*p.charged_rate:0)+(p.skill_active?v[2]*p.skill_rate:0);break;
  case 'EtherlightSpindlelute':fx.elementalMastery=p.skill_active?v[0]*p.rate:0;break;
  case 'BlackmarrowLantern':fx.bloomBonus=v[0];fx.lunarBloomBonus=v[1]+(p.moon_full?v[2]:0);break;
  case 'NocturnesCurtainCall':fx.hpPercentage=[.1,.12,.14,.16,.18][r]+(p.lunar_active?v[0]*p.rate:0);fx.lunarReactionCriticalDamage=p.lunar_active?v[1]*p.rate:0;if(p.lunar_active)fx.directEnergy={amount:v[3],intervalSeconds:v[4],target:'wielder',trigger:'lunar reaction'};break;
  case 'AngelosHeptades':fx.attackPercentage=v[0];if(p.shield_active){const bonus=Number.isFinite(sourceAttack)?Math.min(sourceAttack/v[1]*v[2],v[3])*p.rate:null;fx.teamEffects.push({kind:'damageBonus',target:'active party member',amount:bonus,formula:{sourceStat:'attack',per:v[1],increment:v[2],cap:v[3],coverage:p.rate},hexereiOffFieldRatio:v[7],duration:v[4],trigger:'wielder creates shield'});fx.directEnergy={amount:v[5],intervalSeconds:v[6],target:'wielder',trigger:'wielder creates shield'};}break;
  }

  if(fx.teamEffects.length)fx.unmodeled.push('队友效果必须由队伍效果求值层施加');
  return fx;
}

function normalizeArguments(args){
  const walk=value=>{
    if(Array.isArray(value))return value.map(walk);
    if(!value||typeof value!=='object')return value;
    if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)return value;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return value;
    if(isExpandedWeapon(value)&&Object.hasOwn(value,'level'))return normalizeExpandedWeapon(value);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v)]));
  };
  return args.map(walk);
}


// The release core already implements these weapons at level 90. Translate the
// UI's newer switch names back to that core instead of replacing an old character.
function publishedWeapon(w,characterName){
 const p=w.params?.[w.name]||{},v=catalog.get(w.name).refinements[w.refine-1],buffs=[];
 if(w.name==='SilverLight'){
  // The Flute has the same 510/ATK90 stat family and no panel passive.
  // Keep both old and extension characters on their existing character core.
  const stats=expandedWeaponStats(w),fx=expandedWeaponEffects(w,{characterName});
  buffs.push(effect('翦霞照水',{
   ATKBase:stats.attack-510,ATKPercentage:stats.subStat-.413,
   ElementalMastery:fx.elementalMastery,
  }));
  return {weapon:{...w,name:'TheFlute',level:90,ascend:false,params:'NoConfig'},buffs};
 }
 const add=(name,key,value)=>{if(value)buffs.push({name,config:{[name]:{[key]:value}},source:'weapon-coverage',source_effect:w.name+':'+name});};
 const cfg={
  PrizedIsshinBlade:null,
  AthameArtis:{rate:p.burst_hit?p.rate:0,magus:p.secret_rite},
  MoonweaverDawn:{max_energy:p.energy_cost},
  SerenitysCall:{rate:p.reaction_active?p.rate:0,full_moon:p.moon_full},
  LightbearingMoonshard:{extra_active:p.skill_active&&p.rate>0},
  WhitelakeFrostfeather:{stack:p.stacks},
  ExaiphanesBlade:{active:travelerRole(characterName)&&p.hit_active,resonated_elements:travelerRole(characterName)?p.resonated_elements:0},
  AmberBead:{stack:p.stacks},
  NightweaversLookingGlass:{northernmost_runo_active:p.skill_active&&p.skill_rate>0,crescent_verse_active:p.lunar_bloom_active&&p.lunar_rate>0},
  ReliquaryOfTruth:{false_secret_active:p.skill_active,true_moon_active:p.lunar_bloom_hit},
  DawningFrost:{rate_charged:p.charged_active?p.charged_rate:0,rate_skill:p.skill_active?p.skill_rate:0},
  EtherlightSpindlelute:{rate:p.skill_active?p.rate:0},
  BlackmarrowLantern:{moon_state:p.moon_full?2:0},
  NocturnesCurtainCall:{sacred_wine_uptime:p.lunar_active?p.rate:0},
  AngelosHeptades:{shield_rate:p.shield_active?p.rate:0},
 }[w.name];
 switch(w.name){
 case 'LightbearingMoonshard':
  cfg.extra_active=false;
  if(p.skill_active)buffs.push(effect('朏魄含光·覆盖率',{EnhanceMoonCrystallize:v[0]*p.rate}));
  break;
 case 'WhitelakeFrostfeather':
  cfg.stack=0;
  add('ATKPercentage','p',v[1]*p.stacks*p.rate*100);
  if(p.stacks===3)buffs.push(effect('白湖冬羽·满层覆盖率',{StellarConductCritDamage:v[4]*p.rate,StellarSwirlCritDamage:v[4]*p.rate}));
  break;
 case 'ExaiphanesBlade':
  // Published factory f1480 excludes AetherCryo despite accepting the other
  // travelers and Manekina forms. Rebuild both passives consistently instead
  // of relying on that character whitelist for the full-coverage case.
  cfg.active=false;cfg.resonated_elements=0;
  if(travelerRole(characterName)){
   if(p.hit_active)add('ATKPercentage','p',v[0]*p.rate*100);
   if(w.refine>=2)add('CriticalDamage','p',v[2]*p.resonated_elements*100);
  }
  break;
 case 'NightweaversLookingGlass':
  cfg.northernmost_runo_active=false;cfg.crescent_verse_active=false;
  add('ElementalMastery','value',v[0]*(p.skill_active?p.skill_rate:0)+v[2]*(p.lunar_bloom_active?p.lunar_rate:0));
  {const overlap=knownOverlap(p.skill_active?p.skill_rate:0,p.lunar_bloom_active?p.lunar_rate:0,p.overlap_rate);
   if(overlap)buffs.push(effect('纺夜天镜·双状态',{EnhanceBloom:v[4]*overlap,EnhanceHyperbloom:v[5]*overlap,EnhanceBurgeon:v[5]*overlap,EnhanceMoonbloom:v[6]*overlap},'NightweaversLookingGlass'));}
  break;
 case 'ReliquaryOfTruth':{
  const skill=p.skill_active?p.skill_rate:0,lunar=p.lunar_bloom_hit?p.lunar_rate:0,overlap=knownOverlap(skill,lunar,p.overlap_rate);
  // Retain permanent CRIT Rate in the weapon. Recreate only the two conditional
  // stats through the same attribute graph used by damage and optimization.
  if((p.skill_active&&skill!==1)||(p.lunar_bloom_hit&&lunar!==1)){
   cfg.false_secret_active=false;cfg.true_moon_active=false;
   add('ElementalMastery','value',v[0]*(skill+.5*overlap));
   add('CriticalDamage','p',v[1]*(lunar+.5*overlap)*100);
  }
  break;
 }
 }
 const source=catalog.get(w.name),actual=source.levels.find(row=>row.level===w.level&&row.ascend===w.ascend),reference=source.levels.find(row=>row.level===90&&!row.ascend);
 if(w.level!==90){
  const attribute={Critical:'CriticalBase',CriticalDamage:'CriticalDamageBase',ATKPercentage:'ATKPercentage',ElementalMastery:'ElementalMastery',Recharge:'Recharge',HPPercentage:'HPPercentage',DEFPercentage:'DEFPercentage'}[source.secondaryStat];
  if(!attribute)throw Error('武器副属性未建立精确映射：'+source.secondaryStat);
  buffs.push(effect(w.name+'·等级校正',{ATKBase:actual.attack-reference.attack,[attribute]:actual.subStat-reference.subStat}));
 }
 return {weapon:{...w,level:90,ascend:false,params:cfg?{[w.name]:cfg}:'NoConfig'},buffs};
}
function publishedArguments(args,verified){
 const prepare=(character,weapon,buffs)=>{
  if(weapon?.name==='SilverLight'){
   const result=publishedWeapon(weapon,character?.name);
   return {weapon:result.weapon,buffs:[...(buffs||[]),...result.buffs]};
  }
  if(!isExpandedWeapon(weapon)||verified.has(character?.name))return {weapon,buffs};
  if(nativeRole(character?.name)){
   const fx=expandedWeaponEffects(weapon,{characterName:character.name});
   // These native weapon implementations have permanent stats only; inject scoped passives.
   if(weapon.name==='LightbearingMoonshard'&&fx.lunarCrystallizeBonus)return {weapon,buffs:[...(buffs||[]),effect('朏魄含光·月结晶',{EnhanceMoonCrystallize:fx.lunarCrystallizeBonus})]};
   if(weapon.name==='NocturnesCurtainCall'&&fx.lunarReactionCriticalDamage)return {weapon,buffs:[...(buffs||[]),effect('帷间夜曲·月曜暴伤',{CriticalDamageMoonReaction:fx.lunarReactionCriticalDamage})]};
   if(!['NightweaversLookingGlass','ReliquaryOfTruth'].includes(weapon.name))return {weapon,buffs};
   const p=weapon.params[weapon.name];
   const extra=[];
   if(fx.elementalMastery)extra.push(effect('武器·双状态精通',{ElementalMastery:fx.elementalMastery}));
   if(fx.criticalDamage)extra.push(effect('武器·双状态暴伤',{CriticalDamageBase:fx.criticalDamage}));
   for(const e of fx.teamEffects)if(e.kind==='reactionBonus'&&e.coverage)extra.push(effect('纺夜天镜·双状态',{
    EnhanceBloom:e.bloom*e.coverage,EnhanceHyperbloom:e.hyperbloom*e.coverage,
    EnhanceBurgeon:e.burgeon*e.coverage,EnhanceMoonbloom:e.lunarBloom*e.coverage},'NightweaversLookingGlass'));
   // Keep permanent CR and real level in the extension; replace both conditional states.
   const params={...p,skill_active:false,lunar_bloom_active:false,lunar_bloom_hit:false,skill_rate:0,lunar_rate:0,overlap_rate:0};
   return {weapon:{...weapon,params:{[weapon.name]:params}},buffs:[...(buffs||[]),...extra]};
  }
  if(!character?.name)throw Error('新增武器的覆盖率换算缺少装备角色。');

  const result=publishedWeapon(weapon,character.name);
  return {weapon:result.weapon,buffs:result.buffs.length?[...(buffs||[]),...result.buffs]:buffs};
 };
 const walk=x=>{
  if(Array.isArray(x))return x.map(walk);
  if(!x||typeof x!=='object'||ArrayBuffer.isView(x)||x instanceof ArrayBuffer)return x;
  const prototype=Object.getPrototypeOf(x);if(prototype!==Object.prototype&&prototype!==null)return x;
  const result=Object.fromEntries(Object.entries(x).map(([k,v])=>[k,walk(v)]));
  if(x.character&&x.weapon)Object.assign(result,prepare(x.character,x.weapon,result.buffs));
  // Legacy multi-character optimizer uses parallel arrays instead of inputs.
  if(Array.isArray(x.characters)&&Array.isArray(x.weapons)){
   const rows=x.weapons.map((weapon,i)=>prepare(x.characters[i],weapon,result.buffs?.[i]));
   result.weapons=rows.map(row=>row.weapon);result.buffs=rows.map(row=>row.buffs||[]);
  }
  return result;
 };
 return args.map(walk);
}

// Legacy level corrections use the calibrated base-ATK bridge; kits stay native.
export function createExpandedWeaponsFacade(base,original,extension,{verifiedOldRoles=[]}={}){
  const verified=new Set(verifiedOldRoles);
  const wrap=className=>new Proxy(base[className]||{}, {get(target,method){
    const fn=Reflect.get(target,method);
    if(typeof fn!=='function')return fn;
    return (...args)=>{
      const prepared=normalizeArguments(args);
      const inputs=prepared.filter(x=>x&&typeof x==='object');
      const weapons=[];
      const collect=x=>{if(Array.isArray(x))return x.forEach(collect);if(!x||typeof x!=='object'||ArrayBuffer.isView(x)||x instanceof ArrayBuffer)return;
        if(isExpandedWeapon(x)&&Object.hasOwn(x,'level'))weapons.push(x);
        else Object.values(x).forEach(collect);};
      inputs.forEach(collect);
      if(!weapons.length)return fn(...args);
      const role=prepared[0]?.character?.name||prepared[0]?.name||prepared[1]?.character?.name;
      const oldRole=role&&!nativeRole(role);

      const engine=oldRole&&verified.has(role)?extension:base;
      let callArgs=engine===extension?prepared:publishedArguments(prepared,verified);
      // This interface has positional character/weapon arguments and no BUFF
      // slot. Translating only object-shaped inputs leaves new config names in
      // the old serde enum; applying a synthetic BUFF here would drop it.
      if(className==='CommonInterface'&&method==='get_artifacts_rank_by_character'&&oldRole&&!verified.has(role)&&isExpandedWeapon(prepared[1])){
        const translated=publishedWeapon(prepared[1],role);
        if(translated.buffs.length)throw Error('此武器效果需要属性 BUFF 补偿，静态圣遗物评分不接收 BUFF；请使用实际单人配装。');
        callArgs=[prepared[0],translated.weapon,...prepared.slice(2)];
      }
      const result=engine[className]?.[method](...callArgs);
      if(result&&typeof result==='object'&&!Array.isArray(result)&&weapons.length===1){
        const attackValues=result.atk&&typeof result.atk==='object'?Object.values(result.atk):[];
        const sourceAttack=attackValues.length&&attackValues.every(Number.isFinite)?attackValues.reduce((sum,value)=>sum+value,0):undefined;
        const effect=expandedWeaponEffects(weapons[0],{characterName:role,sourceAttack});
        if(['CommonInterface','CalculatorInterface'].includes(className))result.weapon_effects=effect;
        result.weapon_precision={levelCurve:'exact',sourceRevision:catalog.get(weapons[0].name).revision??data.revision,oldRoleParity:nativeRole(role)||verified.has(role),characterCore:oldRole&&!verified.has(role)?'published':'extension'};
      }
      return result;
    };
  }});
  return Object.fromEntries(Object.keys(base).map(name=>[name,name==='TransformativeDamage'?base[name]:wrap(name)]));
}
