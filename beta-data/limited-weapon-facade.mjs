import {isLimitedWeapon, normalizeLimitedWeapon, limitedWeaponEffects, bounded} from './limited-weapons.mjs';
import {isSignatureWeapon, normalizeSignatureWeapon, chrysalisEffects} from './weapon-effects.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const native=c=>['Vodyanitsa','Vesna'].includes(c?.name);
const freshNames=new Set(['NewBough','WintersHeavyHeart','BreezeborneRefrain']);
const supportName='BreezeborneRefrainSupport';
const named=(name,config)=>({name,config:{[name]:config}});
const zero={attack:0,em:0,stellar:0,recharge:0};

// Preserve the published character implementations. Only the three new weapons
// need an equivalent base-ATK carrier; existing weapons retain their native code.
export function createLimitedWeaponFacade(base, original, data, signatureData = {weapons: []}) {
    const catalog=new Map(data.weapons.map(w=>[w.name,w]));
    const signatureCatalog=new Map(signatureData.weapons.map(w=>[w.name,w]));
    const subCache=new Map();
    const passiveCache=new Map();
    function carrier(w) {
        const common={level:w.level,ascend:w.ascend,refine:w.refine};
        if(w.name==='BeyondTheChrysalis')return {...common,name:'Absolution',params:{Absolution:{stack:0}}};
        if(w.name==='HymnOfTheMaelstrom')return {...common,name:'AThousandFloatingDreams',params:{AThousandFloatingDreams:{same_count:0,diff_count:0}}};
        if(w.name==='NewBough')return {...common,name:'HereticsMoltenBlade',params:{HereticsMoltenBlade:{movement_rate:0}}};
        if(w.name==='WintersHeavyHeart')return {...common,name:'TheWidsith',params:{TheWidsith:{t1_rate:0,t2_rate:0,t3_rate:0}}};
        return {...common,name:'JadeVista',params:{JadeVista:{same_count:0,diff_count:0}}};
    }
    function carrierSub(w) {
        const c=carrier(w),key=`${c.name}:${w.level}:${w.ascend}`;
        if(!subCache.has(key)) {
            const a=original.CommonInterface.get_attribute({character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:'NoConfig'},weapon:c,artifacts:[],artifact_config:null,buffs:[]});
            const stat=['WintersHeavyHeart','BeyondTheChrysalis'].includes(w.name)?'critical_damage':w.name==='HymnOfTheMaelstrom'?'elemental_mastery':'critical';
            const value=a[stat]?.['武器副词条'];
            if(!Number.isFinite(value))throw Error('无法读取已发布内核的武器副词条');
            subCache.set(key,value);
        }
        return subCache.get(key);
    }
    function absolutionPassive(w) {
        if(!passiveCache.has(w.refine)) {
            const a=original.CommonInterface.get_attribute({character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:'NoConfig'},weapon:carrier(w),artifacts:[],artifact_config:null,buffs:[]});
            const value=a.critical_damage?.['赦罪被动'];
            if(!Number.isFinite(value))throw Error('无法读取旧内核武器的暴伤被动');
            passiveCache.set(w.refine,value);
        }
        return passiveCache.get(w.refine);
    }
    function signatureRow(w) {
        const row=signatureCatalog.get(w.name)?.levels.find(r=>r.level===w.level&&r.ascend===w.ascend);
        if(!row)throw Error('专武正式服等级数据缺失');
        return row;
    }
    function addSignatureEffects(x,w) {
        const row=signatureRow(w);
        x.weapon=carrier(w);
        // Both carriers have the exact published 1–90 base-ATK curve.
        // Undo their own passives and secondary stat before applying the new weapon.
        if(w.name==='BeyondTheChrysalis') {
            const effects=chrysalisEffects(w);
            x.buffs.push(named('CriticalDamage',{p:100*(row.subStat-carrierSub(w)+effects.criticalDamage-absolutionPassive(w))}));
            if(effects.stellarSwirlBonus)x.buffs.push(named('EnhanceStellarGlimmerReaction',{p:100*effects.stellarSwirlBonus}));
            return;
        }
        x.buffs.push(named('ElementalMastery',{value:-carrierSub(w)}));
        x.buffs.push(named('HPPercentage',{p:100*row.subStat}));
        const p=w.params.HymnOfTheMaelstrom,coef=.03+.01*w.refine,m=p.boosted?1.75:1;
        x.buffs.push(named('HealingBonus',{p:100*coef}));
        if(p.stacks)x.buffs.push(named('HPPercentage',{p:100*coef*p.stacks*m}));
        if(p.on_field&&p.stacks) {
            // A zero custom HP means the weapon uses its bearer's final HP,
            // including its own secondary stat and passive HP stacks.
            const hp=p.hp||Object.values(base.CommonInterface.get_attribute(x).hp).reduce((a,b)=>a+b,0);
            const attack=Math.min(Math.max(hp-40000,0)/1000*coef/10,2*coef)*p.stacks*m;
            if(attack)x.buffs.push(named('ATKPercentage',{p:100*attack}));
        }
    }
    function addEffects(x,e) {
        if(e.attack)x.buffs.push(named('ATKPercentage',{p:e.attack*100}));
        if(e.em)x.buffs.push(named('ElementalMastery',{value:e.em}));
        if(e.recharge)x.buffs.push(named('Recharge',{p:e.recharge*100}));
        if(e.stellar) {
            if(x.character?.name==='Vodyanitsa')x.buffs.push(named('VesnaSupport',{flat:0,bonus:e.stellar,crit_damage:0,elevation:0,anemo_res:0}));
            else {
                const existing=x.character?.name==='Vesna' && x.buffs.find(b=>b.name==='EnhanceStellarGlimmerReaction');
                if(existing) {
                    const current=existing.config?.EnhanceStellarGlimmerReaction?.p;
                    if(typeof current!=='number'||!Number.isFinite(current))throw Error('星烁反应增伤参数无效');
                    existing.config.EnhanceStellarGlimmerReaction.p=current+e.stellar*100;
                } else x.buffs.push(named('EnhanceStellarGlimmerReaction',{p:e.stellar*100}));
            }
        }
    }
    function supportBonus(buffs) {
        let value=0;
        for(const b of buffs||[])if(b.name===supportName) {
            const p=b.config?.[supportName]||{};
            bounded(p.refine,1,5,'队友柔风游弦精炼',true); bounded(p.rate,0,1,'队友柔风游弦覆盖率');
            value=Math.max(value,(.24+.06*(p.refine-1))*p.rate);
        }
        return value;
    }
    function prepare(input) {
        if(!input || typeof input!=='object')return input;
        if(Array.isArray(input.single_interfaces))return {...input,single_interfaces:input.single_interfaces.map(prepare)};
        const special=(input.buffs||[]).some(b=>b.name===supportName);
        if(!isLimitedWeapon(input.weapon)&&!isSignatureWeapon(input.weapon)&&!special)return input;
        const x=clone(input),w=isSignatureWeapon(x.weapon)?normalizeSignatureWeapon(x.weapon):normalizeLimitedWeapon(x.weapon);
        x.weapon=w; const sourceBuffs=x.buffs||[];
        const teamBonus=supportBonus(sourceBuffs);x.buffs=sourceBuffs.filter(b=>b.name!==supportName);
        const e=isLimitedWeapon(w)?limitedWeaponEffects(w):zero;
        if(!native(x.character)&&isSignatureWeapon(w)) {
            addSignatureEffects(x,w);
        } else if(!native(x.character)&&freshNames.has(w?.name)) {
            x.weapon=carrier(w);
            const own=catalog.get(w.name),row=own?.levels.find(r=>r.level===w.level&&r.ascend===w.ascend);
            if(!row)throw Error('新武器等级数据缺失');
            const remove=w.name==='WintersHeavyHeart'?'CriticalDamage':'Critical';
            const add=w.name==='BreezeborneRefrain'?'Critical':'CriticalDamage';
            x.buffs.push(named(remove,{p:-carrierSub(w)*100}),named(add,{p:row.subStat*100}));
            addEffects(x,e);
        } else if(!native(x.character)&&isLimitedWeapon(w)) {
            // The published core knows these ten weapons but not the new uptime
            // fields. Retain its native passives at full uptime and apply only
            // the difference; this also reaches optimization and stat gains.
            const p={...w.params[w.name]};
            for(const key of Object.keys(p))if(key==='rate'||(key.endsWith('_rate')&&key!=='movement_rate'))p[key]=1;
            // The original counterpoint always doubles the current movement.
            // Supply the independently captured movement through the delta.
            if(w.name==='ForgedByTheGoldenMelody')p.counterpoint_active=false;
            x.weapon={...w,params:{[w.name]:p}};
            const baseline=limitedWeaponEffects(x.weapon);
            addEffects(x,{attack:e.attack-baseline.attack,em:e.em-baseline.em,stellar:e.stellar-baseline.stellar,recharge:0});
        }
        // Same weapon effects do not stack. The bearer already has its own one.
        const self=w?.name==='BreezeborneRefrain'?e.stellar:0;
        if(teamBonus>self)addEffects(x,{...zero,stellar:teamBonus-self});
        return x;
    }
    const wrap=className=>new Proxy(base[className],{get(target,method) {
        const fn=Reflect.get(target,method);if(typeof fn!=='function')return fn;
        return (...args)=>{
            if(className==='DSLInterface'&&method==='run') {
                if(args[1]?.character?.name==='Vesna')throw Error('薇斯纳暂不支持 MONA-DSL，请使用薇斯纳的原生目标。');
                return fn(args[0],prepare(args[1]),...args.slice(2));
            }
            if(className==='CommonInterface'&&method==='get_artifacts_rank_by_character') {
                const w=isSignatureWeapon(args[1])?normalizeSignatureWeapon(args[1]):normalizeLimitedWeapon(args[1]);
                // This API ranks by the target's static scoring weights, not
                // damage; it has no buff input. Preserve the character and TF.
                return fn(args[0],!native(args[0])&&(freshNames.has(w?.name)||isSignatureWeapon(w))?carrier(w):w,...args.slice(2));
            }
            const input=args[0],out=prepare(input);
            const result=fn(out,...args.slice(1));
            if(isLimitedWeapon(input?.weapon)&&result&&typeof result==='object'&&!Array.isArray(result)&&['CommonInterface','CalculatorInterface'].includes(className))result.weapon_effects=limitedWeaponEffects(input.weapon);
            if(input?.weapon?.name==='BeyondTheChrysalis'&&result&&typeof result==='object'&&!Array.isArray(result)&&['CommonInterface','CalculatorInterface'].includes(className))result.weapon_effects=chrysalisEffects(input.weapon);
            return result;
        };
    }});
    return Object.fromEntries(Object.keys(base).map(name=>[name,name==='TransformativeDamage'?base[name]:wrap(name)]));
}
