import data from './weapons-expanded-runtime.mjs';

const catalog=new Map(data.weapons.map(w=>[w.name,w]));
const bool=x=>typeof x==='boolean';
const pct=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const count=(x,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
const nativeRole=name=>name==='Vesna'||name==='Vodyanitsa';
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
  case 'ExaiphanesBlade':if(characterName==='AetherAnemo'){
    fx.criticalDamage=w.refine>=2?v[2]*p.resonated_elements:0;
    if(p.hit_active){fx.attackPercentage=v[0]*p.rate;fx.directEnergy={amount:v[3],intervalSeconds:v[4],target:'wielder',trigger:'hit'};}
  }break;
  case 'AmberBead':fx.allElementalBonus=v[0]*p.stacks;break;
  case 'NightweaversLookingGlass':fx.elementalMastery=(p.skill_active?v[0]*p.skill_rate:0)+(p.lunar_bloom_active?v[2]*p.lunar_rate:0);if(p.skill_active&&p.lunar_bloom_active)fx.teamEffects.push({kind:'reactionBonus',target:'nearby party',bloom:v[4],hyperbloom:v[5],burgeon:v[5],lunarBloom:v[6],coverage:Math.min(p.skill_rate,p.lunar_rate),trigger:'both states'});break;
  case 'ReliquaryOfTruth':fx.criticalRate=v[5];fx.elementalMastery=p.skill_active?v[0]*(p.skill_rate+.5*(p.lunar_bloom_hit?Math.min(p.skill_rate,p.lunar_rate):0)):0;fx.criticalDamage=p.lunar_bloom_hit?v[1]*(p.lunar_rate+.5*(p.skill_active?Math.min(p.skill_rate,p.lunar_rate):0)):0;break;
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
      if(role&&!nativeRole(role)&&!verified.has(role))throw Error(`${role} 装备新目录武器尚未通过发布内核与扩展内核一致性校验；不能保证白值与技能结果准确。`);
      const engine=role&&!nativeRole(role)?extension:base;
      const result=engine[className]?.[method](...prepared);
      if(result&&typeof result==='object'&&!Array.isArray(result)&&weapons.length===1){
        const attackValues=result.atk&&typeof result.atk==='object'?Object.values(result.atk):[];
        const sourceAttack=attackValues.length&&attackValues.every(Number.isFinite)?attackValues.reduce((sum,value)=>sum+value,0):undefined;
        const effect=expandedWeaponEffects(weapons[0],{characterName:role,sourceAttack});
        if(['CommonInterface','CalculatorInterface'].includes(className))result.weapon_effects=effect;
        result.weapon_precision={levelCurve:'exact',sourceRevision:data.revision,oldRoleParity:nativeRole(role)||verified.has(role)};
      }
      return result;
    };
  }});
  return Object.fromEntries(Object.keys(base).map(name=>[name,name==='TransformativeDamage'?base[name]:wrap(name)]));
}
