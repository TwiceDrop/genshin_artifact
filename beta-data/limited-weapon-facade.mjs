import {isLimitedWeapon, normalizeLimitedWeapon, limitedWeaponEffects, bounded} from './limited-weapons.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const native=c=>['Vodyanitsa','Vesna'].includes(c?.name);
const freshNames=new Set(['NewBough','WintersHeavyHeart','BreezeborneRefrain']);
const supportName='BreezeborneRefrainSupport';
const named=(name,config)=>({name,config:{[name]:config}});
const zero={attack:0,em:0,stellar:0,recharge:0};

// Preserve the published character implementations. Only the three new weapons
// need an equivalent base-ATK carrier; existing weapons retain their native code.
export function createLimitedWeaponFacade(base, original, data) {
    const catalog=new Map(data.weapons.map(w=>[w.name,w]));
    const subCache=new Map();
    function carrier(w) {
        const common={level:w.level,ascend:w.ascend,refine:w.refine};
        if(w.name==='NewBough')return {...common,name:'HereticsMoltenBlade',params:{HereticsMoltenBlade:{movement_rate:0}}};
        if(w.name==='WintersHeavyHeart')return {...common,name:'TheWidsith',params:{TheWidsith:{t1_rate:0,t2_rate:0,t3_rate:0}}};
        return {...common,name:'JadeVista',params:{JadeVista:{same_count:0,diff_count:0}}};
    }
    function carrierSub(w) {
        const c=carrier(w),key=`${c.name}:${w.level}:${w.ascend}`;
        if(!subCache.has(key)) {
            const a=original.CommonInterface.get_attribute({character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:'NoConfig'},weapon:c,artifacts:[],artifact_config:null,buffs:[]});
            const stat=w.name==='WintersHeavyHeart'?'critical_damage':'critical';
            const value=a[stat]?.['武器副词条'];
            if(!Number.isFinite(value))throw Error('无法读取已发布内核的武器副词条');
            subCache.set(key,value);
        }
        return subCache.get(key);
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
        if(!isLimitedWeapon(input.weapon)&&!special)return input;
        const x=clone(input),w=normalizeLimitedWeapon(x.weapon);
        x.weapon=w; const sourceBuffs=x.buffs||[];
        const teamBonus=supportBonus(sourceBuffs);x.buffs=sourceBuffs.filter(b=>b.name!==supportName);
        const e=isLimitedWeapon(w)?limitedWeaponEffects(w):zero;
        if(!native(x.character)&&freshNames.has(w?.name)) {
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
                const w=normalizeLimitedWeapon(args[1]);
                // This API ranks by the target's static scoring weights, not
                // damage; it has no buff input. Preserve the character and TF.
                return fn(args[0],!native(args[0])&&freshNames.has(w?.name)?carrier(w):w,...args.slice(2));
            }
            const input=args[0],out=prepare(input);
            const result=fn(out,...args.slice(1));
            if(isLimitedWeapon(input?.weapon)&&result&&typeof result==='object'&&!Array.isArray(result)&&['CommonInterface','CalculatorInterface'].includes(className))result.weapon_effects=limitedWeaponEffects(input.weapon);
            return result;
        };
    }});
    return Object.fromEntries(Object.keys(base).map(name=>[name,name==='TransformativeDamage'?base[name]:wrap(name)]));
}
