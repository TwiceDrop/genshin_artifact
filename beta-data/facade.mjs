import {VODYANITSA_SUPPORT_RULES} from './scoped-character-effect-rules.mjs';
import {evaluateEffectRule} from './effect-rule-engine.mjs';
// Existing characters keep the published core; Vodyanitsa uses the compiled extension.
import {prepareExtensionBuffs} from './extension-buffs.mjs';
import {normalizeSignatureWeapon} from './weapon-effects.mjs';
import {markReactionAvailability} from './reaction-availability.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const named=(name,config)=>({name,config:{[name]:config}});
const special=b=>b?.name?.startsWith('Vodyanitsa');
function guardVodyanitsaSong(input) {
 const x=clone(input),song=x.character?.params?.Vodyanitsa?.song_active===true;
 const prior=x.skill?.config?.Vodyanitsa||{};
 const active=song;
 x.skill.config={Vodyanitsa:{...prior,q_song_bonus:active}};
 return {input:x,status:{active,reason:active?null:'未配置遥久之歌状态'}};
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
  const check=(kind,value)=>{if(value&&!support[kind].includes(value))throw new Error(`新角色/专武扩展暂未适配：${kind} / ${value}。`);};
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
   if(b.lock||b.config?.[b.name]?.active===false||ids.has(b.name))continue;ids.add(b.name);
   const p=b.config?.[b.name]||{},hp=Number(p.hp),c=Number(p.constellation),level=Number(p.e_level);
   if(!Number.isFinite(hp)||hp<=0||hp>500000||!Number.isInteger(c)||c<0||c>6||!Number.isInteger(level)||level<1||level>15)throw Error('沃雅妮莎 BUFF 参数无效');
   const relevant=['Hydro','Cryo'].includes(element),ordinary=p.ordinary_mode!==false,on=p.on_field!==false;
   const id=b.name.slice('Vodyanitsa'.length);
   const add=(n,v)=>fresh.push(named(n,v));
   const rule=VODYANITSA_SUPPORT_RULES[b.name];
   if(rule){
    const parameters={...p,hp,constellation:c,e_level:level};
    let values;
    if(!['Vodyanitsa','Vesna'].includes(input.character?.name)&&(ordinary||['E','A1'].includes(id))&&['E','A1','A4','C2'].includes(id)){
     // Preserve elemental scope inside the native graph so mixed-skill objectives
     // evaluate each hit correctly instead of assuming a single Cryo target.
     values={};
     for(const e of ['Hydro','Cryo','Anemo'])for(const [key,value]of Object.entries(evaluateEffectRule(rule,parameters,{...input,effect_element:e,damage_scope:true,legacy_effect_graph:true}))){
      const scoped={ResMinusBase:'ResMinus'+e,ExtraDmgBase:'ExtraDmg'+e,CriticalDamageBase:'CriticalDamage'+e,StellarSwirlCritDamage:'StellarSwirlCritDamage',StellarConductCritDamage:'StellarConductCritDamage'}[key];
      if(!scoped)throw Error('未确认的沃雅妮莎元素属性：'+key);
      values[scoped]=(values[scoped]||0)+value;
     }
    }else values=evaluateEffectRule(rule,parameters,{...input,effect_element:element,damage_scope:damageScope});
    if(Object.keys(values).length)fresh.push({name:'ExtensionEffect',source_buff:b.name,config:{ExtensionEffect:{label:b.name,values}}});
   }
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
   const inputIndex=className==='DSLInterface'&&method==='run'?1:0;
   const isNew=extensionRole(args);let input=args[inputIndex];
   let songStatus=null;
   if(input?.character?.name==='Vodyanitsa'&&input.skill?.index===11){
    const guarded=guardVodyanitsaSong(input);args=[...args];args[inputIndex]=guarded.input;
    input=args[inputIndex];songStatus=guarded.status;
   }
   const annotateSong=result=>{if(songStatus&&className==='CalculatorInterface'&&method==='get_damage_analysis')result.q_song_status=songStatus;return result;};
   if(className==='TeamOptimizationWasm'&&input?.single_interfaces?.some(x=>x.character?.name==='Vodyanitsa'||hasSupport(x)))
    throw Error('当前版本尚未校准含沃雅妮莎的多人联合优化，请先使用单人配装。原队伍优化不受影响。');
   const engine=isNew?extension:original;
   if(isNew){args=normalizeExtension(args);input=args[inputIndex];if(input?.weapon)input.weapon=normalizeSignatureWeapon(input.weapon);validate(args);if(!engine[className]?.[method])throw Error('新角色/专武暂不支持此计算入口');}
   if(!hasSupport(input)) { const result=engine[className][method](...args);return className==='CalculatorInterface'&&method==='get_damage_analysis'&&isNew ? annotateSong(markReactionAvailability(result)) : result; }
   if(className==='CalculatorInterface'&&method==='get_damage_analysis') {
    const globalInput=supportInput(input,'None',false),base=engine[className][method](globalInput,args[1]);
    if(base.is_heal || base.is_shield)return annotateSong(isNew?markReactionAvailability(base):base);
    const scoped=supportInput(input,base.element,true),result=engine[className][method](scoped,args[1]);
    return annotateSong(isNew?markReactionAvailability(result):result);
   }
   if(className==='CommonInterface'&&method==='get_attribute')return engine[className][method](supportInput(input,'None',false));
   if(className==='CalculatorInterface'&&method==='get_transformative_damage') {
    const result=engine[className][method](supportInput(input,'None',false));
    const resistanceInput=clone(input);resistanceInput.buffs=resistanceInput.buffs.filter(b=>!special(b)||b.name==='VodyanitsaE'||b.name==='VodyanitsaC1'||b.name==='VodyanitsaSignature');
    for(const [element,key] of [['Hydro','swirl_hydro'],['Cryo','swirl_cryo']]) {
      const scoped=engine[className][method](supportInput(resistanceInput,element,true));if(key in result)result[key]=scoped[key];
    }
    return isNew?markReactionAvailability(result):result;
   }
   if(className==='DSLInterface'&&method==='run') {
    return engine[className][method](args[0],supportInput(input,input.character?.name==='Vodyanitsa'?'Hydro':'None'),...args.slice(2));
   }
   if(className==='OptimizeSingleWasm'||className==='BonusPerStat') {
    // Ordinary-mode support now writes element-specific native attributes.
    const vody=input.character?.name==='Vodyanitsa';
    return engine[className][method](supportInput(input,vody?'Hydro':'Cryo'),...args.slice(1));
   }
   throw Error('此入口的沃雅妮莎队友 BUFF 尚未校准，请使用伤害计算或已验证的单人配装。');
  };
 }});
 return Object.fromEntries(Object.keys(original).map(name=>[name,name==='TransformativeDamage'?original[name]:wrap(name)]));
}
