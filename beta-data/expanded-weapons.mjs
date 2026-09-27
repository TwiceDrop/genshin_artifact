import data from './weapons-expanded-runtime.mjs';

const catalog=new Map(data.weapons.map(w=>[w.name,w]));
const bool=x=>typeof x==='boolean';
const pct=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const count=(x,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
const nativeRole=name=>name==='Vesna'||name==='Vodyanitsa';
const travelerRole=name=>/^(?:Aether|Manekina)(?:Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)$/.test(name||'');
// Marginal coverages determine overlap only when one state is absent or full.
// Two partial coverages need timing information; min(a,b) invents nesting.
function knownOverlap(a,b){
  if(a===0||b===0)return 0;
  if(a===1)return b;
  if(b===1)return a;
  throw Error('真语秘匣的两个状态均为部分覆盖，无法仅凭覆盖率确定重叠时长；请将其中一个状态设为完整覆盖或关闭。');
}
export const isExpandedWeapon=weapon=>catalog.has(weapon?.name);
export const expandedWeaponCatalog=Object.freeze(data.weapons.map(w=>Object.freeze({id:w.id,name:w.name,displayName:w.displayName,type:w.weaponType,rarity:w.rarity,maxRefine:w.refinements.length,availability:w.name==='PrizedIsshinBlade'?'quest-only':'catalog'})));

function config(name,old){
  const p=old||{};
  switch(name){
  case 'PrizedIsshinBlade': return null;
  case 'AthameArtis': return {burst_hit:p.burst_hit??(Number(p.rate)>0),secret_rite:p.secret_rite??p.magus??false,rate:p.rate??1};
  case 'MoonweaverDawn': return {energy_cost:p.energy_cost??p.max_energy??0};
  case 'SerenitysCall': return {reaction_active:p.reaction_active??(Number(p.rate)>0),moon_full:p.moon_full??p.full_moon??false,rate:p.rate??1};
  case 'LightbearingMoonshard': return {skill_active:p.skill_active??p.extra_active??false,rate:p.rate??1};
  case 'WhitelakeFrostfeather': return {stacks:p.stacks??p.stack??0,rate:p.rate??1};
  case 'ExaiphanesBlade': return {hit_active:p.hit_active??p.active??false,rate:p.rate??1,resonated_elements:p.resonated_elements??0};
  case 'AmberBead': return {stacks:p.stacks??p.stack??0};
  case 'NightweaversLookingGlass': return {skill_active:p.skill_active??p.northernmost_runo_active??false,lunar_bloom_active:p.lunar_bloom_active??p.crescent_verse_active??false,skill_rate:p.skill_rate??1,lunar_rate:p.lunar_rate??1};
  case 'ReliquaryOfTruth': return {skill_active:p.skill_active??p.false_secret_active??false,lunar_bloom_hit:p.lunar_bloom_hit??p.true_moon_active??false,skill_rate:p.skill_rate??1,lunar_rate:p.lunar_rate??1};
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
    if(p.stacks!==undefined&&!count(p.stacks,weapon.name==='AmberBead'?2:3))throw Error(`${w.displayName}叠层无效`);
    if(p.energy_cost!==undefined&&(!Number.isInteger(p.energy_cost)||p.energy_cost<0||p.energy_cost>100))throw Error(`${w.displayName}元素能量上限无效`);
    if(p.resonated_elements!==undefined&&(!Number.isInteger(p.resonated_elements)||p.resonated_elements<0||p.resonated_elements>7))throw Error(`${w.displayName}共鸣元素数无效`);
  }
  if(weapon.name==='ReliquaryOfTruth')knownOverlap(p.skill_active?p.skill_rate:0,p.lunar_bloom_hit?p.lunar_rate:0);
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
  const v=source.refinements[r],fx={source:w.name,sourceVersion:data.revision,averageCoverage:true,
    attackPercentage:0,hpPercentage:0,defensePercentage:0,elementalMastery:0,
    criticalRate:0,criticalDamage:0,burstBonus:0,burstCriticalDamage:0,allElementalBonus:0,
    bloomBonus:0,lunarBloomBonus:0,lunarCrystallizeBonus:0,lunarReactionCriticalDamage:0,stellarReactionCriticalDamage:0,
    teamEffects:[],directEnergy:null,unmodeled:[]};
  switch(w.name){
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
      const coverage=skill===1?lunar:lunar===1?skill:null;
      fx.teamEffects.push({kind:'reactionBonus',target:'nearby party',bloom:v[4],hyperbloom:v[5],burgeon:v[5],lunarBloom:v[6],coverage,coverageBounds:{min:Math.max(0,skill+lunar-1),max:Math.min(skill,lunar)},trigger:'both states'});
      if(coverage===null)fx.unmodeled.push('纺夜天镜两个部分覆盖状态的重叠时长未知');
    }
    break;
  }
  case 'ReliquaryOfTruth':{
    const skill=p.skill_active?p.skill_rate:0,lunar=p.lunar_bloom_hit?p.lunar_rate:0,overlap=knownOverlap(skill,lunar);
    fx.criticalRate=v[5];fx.elementalMastery=v[0]*(skill+.5*overlap);fx.criticalDamage=v[1]*(lunar+.5*overlap);break;
  }
  case 'DawningFrost':fx.elementalMastery=(p.charged_active?v[0]*p.charged_rate:0)+(p.skill_active?v[2]*p.skill_rate:0);break;
  case 'EtherlightSpindlelute':fx.elementalMastery=p.skill_active?v[0]*p.rate:0;break;
  case 'BlackmarrowLantern':fx.bloomBonus=v[0];fx.lunarBloomBonus=v[1]+(p.moon_full?v[2]:0);break;
  case 'NocturnesCurtainCall':fx.hpPercentage=[.1,.12,.14,.16,.18][r]+(p.lunar_active?v[0]*p.rate:0);fx.lunarReactionCriticalDamage=p.lunar_active?v[1]*p.rate:0;if(p.lunar_active)fx.directEnergy={amount:v[3],intervalSeconds:v[4],target:'wielder',trigger:'lunar reaction'};break;
  case 'AngelosHeptades':fx.attackPercentage=v[0];if(p.shield_active){const bonus=Number.isFinite(sourceAttack)?Math.min(sourceAttack/v[1]*v[2],v[3])*p.rate:null;fx.teamEffects.push({kind:'damageBonus',target:'active party member',amount:bonus,formula:{sourceStat:'attack',per:v[1],increment:v[2],cap:v[3],coverage:p.rate},hexereiOffFieldRatio:v[7],duration:v[4],trigger:'wielder creates shield'});fx.directEnergy={amount:v[5],intervalSeconds:v[6],target:'wielder',trigger:'wielder creates shield'};}break;
  }
  if(fx.lunarCrystallizeBonus)fx.unmodeled.push('月结晶反应乘区尚未接入');
  if(fx.lunarReactionCriticalDamage)fx.unmodeled.push('月曜反应专属暴伤乘区尚未接入');
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
  if(p.skill_active&&p.rate>0&&p.rate<1)throw Error('朏魄含光的部分覆盖需要月结晶专属增伤通道；原内核通用 BUFF 不能替代，请设为完整覆盖或关闭。');
  break;
 case 'WhitelakeFrostfeather':
  if(p.stacks===3&&p.rate>0&&p.rate<1)throw Error('白湖冬羽满3层时包含星烁反应专属暴伤，部分覆盖尚未校准；请使用完整覆盖、0覆盖或不足3层。');
  // The original core accepts fractional stacks; below three this is exactly
  // the ATK graph coefficient, without accidentally granting the 3-stack bonus.
  cfg.stack=p.stacks*p.rate;
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
  if(cfg.northernmost_runo_active&&cfg.crescent_verse_active)throw Error('纺夜天镜的双状态队友反应增益与重叠时长尚未校准，请关闭其中一个状态。');
  if(cfg.northernmost_runo_active&&p.skill_rate!==1){cfg.northernmost_runo_active=false;add('ElementalMastery','value',v[0]*p.skill_rate);}
  if(cfg.crescent_verse_active&&p.lunar_rate!==1){cfg.crescent_verse_active=false;add('ElementalMastery','value',v[2]*p.lunar_rate);}
  break;
 case 'ReliquaryOfTruth':{
  const skill=p.skill_active?p.skill_rate:0,lunar=p.lunar_bloom_hit?p.lunar_rate:0,overlap=knownOverlap(skill,lunar);
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
 return {weapon:{...w,params:cfg?{[w.name]:cfg}:'NoConfig'},buffs};
}
function publishedArguments(args,verified){
 const prepare=(character,weapon,buffs)=>{
  if(!isExpandedWeapon(weapon)||nativeRole(character?.name)||verified.has(character?.name))return {weapon,buffs};
  if(!character?.name)throw Error('新增武器的覆盖率换算缺少装备角色。');
  if(weapon.level!==90)throw Error('旧角色使用新增目录武器的1～89级白值尚未校准，请使用90级武器。');
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

// The published WASM has no base-ATK override. Old roles can use the rebuilt
// extension only after their kit parity has been verified against the release.
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
      if(oldRole&&!verified.has(role)&&weapons.some(w=>w.level!==90))throw Error('旧角色使用新增目录武器的1～89级白值尚未校准，请使用90级武器。');
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
        result.weapon_precision={levelCurve:'exact',sourceRevision:data.revision,oldRoleParity:nativeRole(role)||verified.has(role),characterCore:oldRole&&!verified.has(role)?'published':'extension'};
      }
      return result;
    };
  }});
  return Object.fromEntries(Object.keys(base).map(name=>[name,name==='TransformativeDamage'?base[name]:wrap(name)]));
}
