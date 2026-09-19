// Existing characters keep the published core; Vodyanitsa uses the compiled extension.
import {normalizeSignatureWeapon} from './weapon-effects.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const stripUncalibrated=result=>{for(const k of Object.keys(result))if(/stellar|moon/i.test(k))delete result[k];return result;};
const named=(name,config)=>({name,config:{[name]:config}});
const special=b=>b?.name?.startsWith('Vodyanitsa');
export function createFacade(original,extension,data,support,characters) {
 const extensionRole=args=>args.some(a=>a?.character?.name==='Vodyanitsa'||a?.name==='Vodyanitsa');
 const hasSupport=input=>(input?.buffs||[]).some(special);
 function normalizeExtension(args) {
  const out=clone(args);
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
  const check=(kind,value)=>{if(value&&!support[kind].includes(value))throw new Error(`7.1.01 beta1 新角色/专武扩展暂未适配：${kind} / ${value}。`);};
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
   if(id==='A4'&&relevant&&ordinary&&damageScope)add('BaseDmg',{value:Math.min(Math.max(hp-40000,0)*.14,3500)});
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
  out.buffs.push(...fresh);return out;
 }
 const wrap=(className)=>new Proxy(original[className],{get(target,method){
  const originalFn=Reflect.get(target,method);
  if(typeof originalFn!=='function')return originalFn;
  return(...args)=>{
   const isNew=extensionRole(args);let input=args[0];
   if(!isNew&&input?.weapon?.name==='HymnOfTheMaelstrom')throw Error('漩流颂歌装备计算目前支持沃雅妮莎；为其他前台角色计算加攻，请添加「漩流颂歌」BUFF并填写来源最终生命。');
   if(className==='TeamOptimizationWasm'&&input?.single_interfaces?.some(x=>x.character?.name==='Vodyanitsa'||hasSupport(x)))
    throw Error('beta1 尚未校准含沃雅妮莎的多人联合优化，请先使用单人配装。原队伍优化不受影响。');
   const engine=isNew?extension:original;
   if(isNew){args=normalizeExtension(args);input=args[0];if(input?.weapon)input.weapon=normalizeSignatureWeapon(input.weapon);validate(args);if(!engine[className]?.[method])throw Error('新角色/专武暂不支持此计算入口');}
   if(!hasSupport(input)) { const result=engine[className][method](...args);return isNew && className==='CalculatorInterface' ? stripUncalibrated(result) : result; }
   if(className==='CalculatorInterface'&&method==='get_damage_analysis') {
    const globalInput=supportInput(input,'None',false),base=engine[className][method](globalInput,args[1]);
    if(base.is_heal || base.is_shield)return stripUncalibrated(base);
    const scoped=supportInput(input,base.element,true),result=engine[className][method](scoped,args[1]);
    return stripUncalibrated(result);
   }
   if(className==='CommonInterface'&&method==='get_attribute')return engine[className][method](supportInput(input,'None',false));
   if(className==='CalculatorInterface'&&method==='get_transformative_damage') {
    const result=engine[className][method](supportInput(input,'None',false));
    const resistanceInput=clone(input);resistanceInput.buffs=resistanceInput.buffs.filter(b=>!special(b)||b.name==='VodyanitsaE'||b.name==='VodyanitsaC1'||b.name==='VodyanitsaSignature');
    for(const [element,key] of [['Hydro','swirl_hydro'],['Cryo','swirl_cryo']]) {
      const scoped=engine[className][method](supportInput(resistanceInput,element,true));if(key in result)result[key]=scoped[key];
    }
    return stripUncalibrated(result);
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
