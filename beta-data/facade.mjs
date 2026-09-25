// Existing characters keep the published core; Vodyanitsa uses the compiled extension.
import {prepareExtensionBuffs} from './extension-buffs.mjs';
import {normalizeSignatureWeapon} from './weapon-effects.mjs';
import {markReactionAvailability} from './reaction-availability.mjs';
import {calculateStellarSwirlTeam} from './stellar-swirl-reaction.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const named=(name,config)=>({name,config:{[name]:config}});
const special=b=>b?.name?.startsWith('Vodyanitsa');
function guardVodyanitsaSong(input) {
 const x=clone(input),song=x.character?.params?.Vodyanitsa?.song_active===true;
 const prior=x.skill?.config?.Vodyanitsa||{};
 const confirmed=prior.q_song_bonus===true,active=song&&confirmed;
 x.skill.config={Vodyanitsa:{...prior,q_song_bonus:active}};
 return {input:x,status:{active,reason:active?null:!song?'未配置遥久之歌状态':'尚未手动确认歌声 Q 乘区'}};
}
export function withStellarSwirlTeam(result,input,calibrated=[]) {
  const context=input?.stellar_swirl_context;
  if(!context)return markReactionAvailability(result,calibrated);
  const configured=clone(context);
  const starA4=(input.buffs||[]).find(b=>b.name==='VodyanitsaA4'&&b.config?.VodyanitsaA4?.ordinary_mode===false);
  if(starA4){
   if(configured.vodyanitsaA4)throw Error('星扩散队伍中沃雅妮莎 A4 请只配置一个来源');
   if(!configured.a4RecipientId)throw Error('沃雅妮莎 A4 需要明确指定实际参与星扩散的受益角色 ID');
   const p=starA4.config.VodyanitsaA4;
   configured.vodyanitsaA4={hp:Number(p.hp),active:p.on_field!==false,
    coverage:Number(p.coverage??1),recipientId:configured.a4RecipientId};
  }
  const calculated=calculateStellarSwirlTeam(configured);
  result.stellarswirl_anemo=calculated.stellarswirl_anemo;
  result.stellarswirl_cryo=calculated.stellarswirl_cryo;
  result.stellar_swirl_team_model={formula_version:calculated.formula_version,
   trigger_id:configured.triggerId,vortex_multiplier:configured.vortexMultiplier,
   individual:calculated.individual};
  return markReactionAvailability(result,[...calibrated,'stellarswirl_anemo','stellarswirl_cryo']);
}
export function createFacade(original,extension,data,support,characters) {
 const extensionRole=args=>args.some(a=>a?.character?.name==='Vodyanitsa'||a?.name==='Vodyanitsa');
 const hasSupport=input=>(input?.buffs||[]).some(special);
 function normalizeExtension(args) {
  const out=clone(args).map(x=>x?.character?prepareExtensionBuffs(x):x);
  function walk(x){if(!x||typeof x!=='object')return;
   if(Array.isArray(x)&&x.length&&x.every(a=>a&&typeof a.set_name==='string')) {
    const slots=new Map();for(const a of x){if(!slots.has(a.set_name))slots.set(a.set_name,new Set());slots.get(a.set_name).add(a.slot);}
    // A set represented by a single possible slot can never trigger a set bonus.
    for(const a of x)if(!support.artifacts.includes(a.set_name)&&slots.get(a.set_name).size===1)a.set_name='Empty';
    return;
   }
   Object.values(x).forEach(walk);
  }walk(out);return out;
 }
 function validate(input,artifacts) {
  const check=(kind,value)=>{if(value&&!support[kind].includes(value))throw new Error(`7.1.04 新角色/专武扩展暂未适配：${kind} / ${value}。`);};
  function visit(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}
   if(x.character)check('characters',x.character.name);
   if(x.weapon)check('weapons',x.weapon.name);
   if(x.set_name)check('artifacts',x.set_name);
   if(x.buffs)x.buffs.forEach(b=>{if(!special(b))check('buffs',b.name)});
   Object.values(x).forEach(visit);
  }visit(input);visit(artifacts);
 }
 function supportInput(input,element,damageScope=true) {
  const out=clone(input),buffs=out.buffs||[],fresh=[];out.buffs=buffs.filter(b=>!special(b));
  const ids=new Set();
  for(const b of buffs.filter(special)) {
   if(ids.has(b.name))continue;ids.add(b.name);
   const p=b.config?.[b.name]||{},hp=Number(p.hp),c=Number(p.constellation),level=Number(p.e_level);
   if(!Number.isFinite(hp)||hp<=0||hp>500000||!Number.isInteger(c)||c<0||c>6||!Number.isInteger(level)||level<1||level>15)throw Error('沃雅妮莎 BUFF 参数无效');
   const relevant=['Hydro','Cryo'].includes(element),ordinary=p.ordinary_mode!==false,on=p.on_field!==false;
   const id=b.name.slice('Vodyanitsa'.length);
   const add=(n,v)=>fresh.push(named(n,v));
   if(id==='A1'&&element==='Anemo'&&damageScope)add('ResMinus',{p:35});
   if(id==='E'&&relevant&&damageScope)add('ResMinus',{p:data.character.skills.e_res_shred[level-1]*100});
   if(id==='A4'&&relevant&&ordinary&&on&&damageScope)add('BaseDmg',{value:Math.min(Math.max(hp-40000,0)*.14,3500)});
   if(id==='C1'&&c>=1)add('ATKFixed',{value:hp*.008});
   if(id==='C2'&&c>=2&&(on||c>=6)&&relevant&&ordinary&&damageScope)add('CriticalDamage',{p:50});
   if(id==='C6'&&c>=6){add('CustomElementalBonus',{element:'Hydro',p:60});add('CustomElementalBonus',{element:'Cryo',p:60});}
   if(id==='Signature'&&on) {
    const r=Number(p.refine),stacks=Number(p.stacks);
    if(!Number.isInteger(r)||r<1||r>5||!Number.isInteger(stacks)||stacks<0||stacks>3)throw Error('专武精炼或层数无效');
    const coef=.03+.01*r,m=p.boosted?1.75:1;
    add('ATKPercentage',{p:100*stacks*Math.min(Math.max(hp-40000,0)/1000*coef/10,2*coef)*m});
   }
  }
  out.buffs.push(...fresh);return prepareExtensionBuffs(out);
 }
 const wrap=(className)=>new Proxy(original[className],{get(target,method){
  const originalFn=Reflect.get(target,method);
  if(typeof originalFn!=='function')return originalFn;
  return(...args)=>{
   const isNew=extensionRole(args);let input=args[0];
   let songStatus=null;
   if(input?.character?.name==='Vodyanitsa'&&input.skill?.index===11){
    const guarded=guardVodyanitsaSong(input);args=[guarded.input,...args.slice(1)];
    input=args[0];songStatus=guarded.status;
   }
   const annotateSong=result=>{if(songStatus&&className==='CalculatorInterface'&&method==='get_damage_analysis')result.q_song_status=songStatus;return result;};
   if(input?.stellar_swirl_context&&!(className==='CalculatorInterface'&&method==='get_damage_analysis'))
    throw Error('星扩散队伍参与者合成目前仅接入单次伤害分析，不可用于 DSL、词条收益或配装。');
   if(className==='TeamOptimizationWasm'&&input?.single_interfaces?.some(x=>x.character?.name==='Vodyanitsa'||hasSupport(x)))
    throw Error('当前版本尚未校准含沃雅妮莎的多人联合优化，请先使用单人配装。原队伍优化不受影响。');
   const engine=isNew?extension:original;
   if(isNew){args=normalizeExtension(args);input=args[0];if(input?.weapon)input.weapon=normalizeSignatureWeapon(input.weapon);validate(args);if(!engine[className]?.[method])throw Error('新角色/专武暂不支持此计算入口');}
   if(!hasSupport(input)) { const result=engine[className][method](...args);return className==='CalculatorInterface'&&method==='get_damage_analysis'&&(isNew||input?.stellar_swirl_context) ? annotateSong(withStellarSwirlTeam(result,input)) : result; }
   if(className==='CalculatorInterface'&&method==='get_damage_analysis') {
    const globalInput=supportInput(input,'None',false),base=engine[className][method](globalInput,args[1]);
    if(base.is_heal || base.is_shield)return annotateSong(markReactionAvailability(base));
    const scoped=supportInput(input,base.element,true),result=engine[className][method](scoped,args[1]);
    return annotateSong(withStellarSwirlTeam(result,input));
   }
   if(className==='CommonInterface'&&method==='get_attribute')return engine[className][method](supportInput(input,'None',false));
   if(className==='CalculatorInterface'&&method==='get_transformative_damage') {
    const result=engine[className][method](supportInput(input,'None',false));
    const resistanceInput=clone(input);resistanceInput.buffs=resistanceInput.buffs.filter(b=>!special(b)||b.name==='VodyanitsaE'||b.name==='VodyanitsaC1'||b.name==='VodyanitsaSignature');
    for(const [element,key] of [['Hydro','swirl_hydro'],['Cryo','swirl_cryo']]) {
      const scoped=engine[className][method](supportInput(resistanceInput,element,true));if(key in result)result[key]=scoped[key];
    }
    return markReactionAvailability(result);
   }
   if(className==='OptimizeSingleWasm'||className==='BonusPerStat') {
    // The tested Skirk default rotation is all ordinary Cryo. Mixed reaction targets need native scoping.
    const target=input.target_function||input.tf;
    const vody=input.character?.name==='Vodyanitsa';
    if(!vody&&(input.character?.name!=='Skirk'||target?.name!=='SkirkDefault'||target?.use_dsl))throw Error('沃雅妮莎队友 BUFF 配装目前已验证丝柯克默认目标；其他混合反应目标待校准。');
    if(input.buffs.some(b=>special(b)&&b.config?.[b.name]?.ordinary_mode===false))throw Error('星扩散 BUFF 配装待校准，请先用普通水 / 冰模式。');
    return engine[className][method](supportInput(input,vody?'Hydro':'Cryo'),...args.slice(1));
   }
   throw Error('此入口的沃雅妮莎队友 BUFF 尚未校准，请使用伤害计算或已验证的单人配装。');
  };
 }});
 return Object.fromEntries(Object.keys(original).map(name=>[name,name==='TransformativeDamage'?original[name]:wrap(name)]));
}
