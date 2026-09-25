import {normalizeSignatureWeapon, chrysalisEffects} from './weapon-effects.mjs';
import {isLimitedWeapon, limitedWeaponEffects, LIMITED_WEAPONS} from './limited-weapons.mjs';
import {withStellarSwirlTeam} from './facade.mjs';
const clone=x=>JSON.parse(JSON.stringify(x)),named=(name,config)=>({name,config:{[name]:config}});
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
export function createBeta2(base,extension,support){
 const supported=new Set([...support.artifacts,'ScarletProof','HeartOfTheFurnace']);
 const nativeBuffs=new Set([...support.buffs,'VesnaSupport']);
 function prepare(raw,candidates){
  const x=clone(raw),c=x.character;
  if(c?.name==='Vesna'){
   c.params={Vesna:{stance:false,radiance:false,disciplinary_stacks:0,anemo_cryo_count:1,other_count:0,flat_inside_discipline:false,...(c.params?.Vesna||{})}};
   const p=c.params.Vesna;
   if(p.anemo_cryo_count<1||p.other_count<0||p.anemo_cryo_count+p.other_count>4)throw Error('冰/风角色数需包含薇斯纳，队伍总人数不能超过4。');
   if(p.disciplinary_stacks<0||p.disciplinary_stacks>6)throw Error('整肃层数应为0～6');
  }
  if(x.weapon)x.weapon=normalizeSignatureWeapon(x.weapon);
  if(x.weapon&&!support.weapons.includes(x.weapon.name)&&x.weapon.name!=='BeyondTheChrysalis')throw Error('薇斯纳扩展暂不支持这把武器：'+x.weapon.name);
  for(const t of [x.target_function,x.tf])if(t&&!t.use_dsl&&t.name!=='VesnaDefault'&&!t.name.startsWith('Common'))throw Error('请为薇斯纳选择「灵剑·爆发」目标。');
  const buffs=[],state={flat:0,base:0,bonus:0,crit_damage:0,elevation:0,anemo_res:0},seen=new Set();
  for(const b of x.buffs||[]){
   if(seen.has(b.name))continue;seen.add(b.name);
   if(b.name.startsWith('Vodyanitsa')){
    const p=b.config?.[b.name]||{},hp=Number(p.hp),co=Number(p.constellation),id=b.name.slice(10),star=p.ordinary_mode===false,on=p.on_field!==false;
    if(!Number.isFinite(hp)||hp<=0||hp>500000||!Number.isInteger(co)||co<0||co>6)throw Error('沃雅妮莎 BUFF 的生命或命座无效');
    if(id==='A1')state.anemo_res=Math.max(state.anemo_res,.35);
    if(id==='A4'&&star&&on)state.flat=Math.max(state.flat,Math.min(Math.max(hp-40000,0)*.26,6500));
    if(id==='C1'&&co>=1)buffs.push(named('ATKFixed',{value:hp*.008}));
    if(id==='C2'&&co>=2&&star&&(on||co>=6))state.crit_damage=Math.max(state.crit_damage,.6);
    if(id==='C6'&&co>=6)state.elevation=Math.max(state.elevation,.25);
    if(id==='Signature'&&on){const r=Number(p.refine),n=Number(p.stacks);if(!Number.isInteger(r)||r<1||r>5||!Number.isInteger(n)||n<0||n>3)throw Error('队友专武精炼/层数无效');const k=.03+.01*r;buffs.push(named('ATKPercentage',{p:100*Math.min(Math.max(hp-40000,0)/1000*k/10,k*2)*n*(p.boosted?1.75:1)}));}
   }else if(b.name==='EnhanceStellarGlimmerReaction')state.bonus+=Number(b.config?.[b.name]?.p||0)/100;
   else if(b.name==='ElevateStellarGlimmerReaction')state.elevation+=Number(b.config?.[b.name]?.p||0)/100;
   else if(nativeBuffs.has(b.name))buffs.push(b);
   else throw Error('薇斯纳扩展暂不支持此 BUFF：'+b.name);
  }
  const displayedState={...state};
  for(const buff of buffs)if(buff.name==='VesnaSupport')for(const key of Object.keys(displayedState))displayedState[key]+=Number(buff.config?.VesnaSupport?.[key]||0);
  buffs.push(named('VesnaSupport',state));x.buffs=buffs;
  function normalizeArtifacts(arts){const counts={};for(const a of arts)counts[a.set_name]=(counts[a.set_name]||0)+1;return arts.map(a=>{if(supported.has(a.set_name))return a;if(counts[a.set_name]===1)return {...a,set_name:'Empty'};throw Error('薇斯纳暂未适配该套装效果：'+a.set_name+'。请先使用血红之证或已支持的套装。');});}
  if(x.artifacts)x.artifacts=normalizeArtifacts(x.artifacts);
  let normalizedCandidates;
  if(candidates){
   const slots=new Map();for(const a of candidates){if(!slots.has(a.set_name))slots.set(a.set_name,new Set());slots.get(a.set_name).add(a.slot);}
   normalizedCandidates=clone(candidates).map(a=>{
    if(supported.has(a.set_name))return a;
    if(slots.get(a.set_name).size===1)return {...a,set_name:'Empty'};
    throw Error('薇斯纳候选中存在未适配的可成套圣遗物：'+a.set_name);
   });
  }
  return {x,candidates:normalizedCandidates,state:displayedState};
 }
 const wrap=(className)=>new Proxy(base[className]||{}, {get(target,method){if(typeof target[method]!=='function'&&typeof extension[className]?.[method]!=='function')return target[method];return (...args)=>{
 const input=args[0];
  if(className==='DSLInterface'&&method==='run'&&args[1]?.character?.name==='Vesna'){
   const {x}=prepare(args[1]);
   if(!extension.DSLInterface?.run)throw Error('薇斯纳 DSL 扩展入口尚未构建');
   return extension.DSLInterface.run(args[0],x,args[2]);
  }
  if(className==='CommonInterface'&&method==='get_artifacts_rank_by_character'&&input?.name==='Vesna'){
   throw Error('薇斯纳的静态评分权重尚未实现，请使用单人配装的实际伤害目标。');
  }
  if(className==='TeamOptimizationWasm'&&input?.single_interfaces?.some(x=>x.character?.name==='Vesna'))throw Error('薇斯纳暂不支持多人联合配装，请使用单人计算。');
  if(input?.character?.name!=='Vesna')return target[method](...args);
  if(className==='TeamOptimizationWasm')throw Error('薇斯纳暂不支持多人联合配装，请使用单人计算。');
  const {x,candidates,state}=prepare(input,className==='OptimizeSingleWasm'?args[1]:undefined);
  if(className==='OptimizeSingleWasm'&&(!candidates?.length||new Set(candidates.map(a=>a.slot)).size<5))throw Error('薇斯纳已支持套装的候选不足五个部位，请导入装备或调整筛选。');
  if(!extension[className]?.[method])throw Error('薇斯纳暂不支持此入口：'+className+'.'+String(method));
  const r=extension[className][method](x,...(className==='OptimizeSingleWasm'?[candidates]:args.slice(1)));
  if(x.weapon?.name==='BeyondTheChrysalis'&&['CommonInterface','CalculatorInterface'].includes(className))r.weapon_effects=chrysalisEffects(x.weapon);
  if(className==='CalculatorInterface'&&method==='get_damage_analysis'){
   const p=x.character.params.Vesna,idx=x.skill.index;
   const direct=p.radiance&&[13,14,15,17,19].includes(idx);
   if(direct){
    r.direct_stellarswirl=r.normal;r.normal={critical:0,non_critical:0,expectation:0,is_heal:false,is_shield:false};
    const atk=sum(r.atk),em=sum(r.em),co=x.character.constellation;
    const stacks=co>=2&&p.stance?6:p.disciplinary_stacks;
    r.direct_stellarswirl_base_compose={'星耀祝礼':Math.min(atk*.00007,.14),'队友星扩散基础增益':state.base};
    r.direct_stellarswirl_compose={'精通':6*em/(2000+em),'队友':state.bonus};
    if(x.weapon.name==='BeyondTheChrysalis')r.direct_stellarswirl_compose['蝶变']=chrysalisEffects(x.weapon).stellarSwirlBonus;
    if(isLimitedWeapon(x.weapon))r.direct_stellarswirl_compose[LIMITED_WEAPONS[x.weapon.name].label]=limitedWeaponEffects(x.weapon).stellar;
    for(const [set,key,value]of [['ScarletProof','config_scarlet_proof',.4],['HeartOfTheFurnace','config_heart_of_the_furnace',.5]])if(x.artifacts.filter(a=>a.set_name===set).length>=4)r.direct_stellarswirl_compose[set]=value*(x.artifact_config?.[key]?.rate??0);
    if(co>=1&&p.stance)r.direct_stellarswirl_compose['薇斯纳一命']=.2;
    r.critical_stellarswirl={};r.critical_damage_stellarswirl={'队友星伤暴伤':state.crit_damage};
    r.direct_stellarswirl_extra_fixed={'队友定额加值':state.flat};
    r.elevate_stellarswirl_compose={'薇斯纳六命':co>=6?.2:0,'队友':state.elevation};
    r.beta2_model={revision:'7.1.0 D48145775',discipline:stacks,flat_order:'after_base_and_em'};
   }
   return withStellarSwirlTeam(r,x,direct?['direct_stellarswirl']:[]);
  }
  return r;
 };}});
 return Object.fromEntries(Object.keys(base).map(name=>[name,name==='TransformativeDamage'?base[name]:wrap(name)]));
}
