// Extend the published character core without replacing its existing kits.
const clone = x => JSON.parse(JSON.stringify(x));
const sum = x => Object.values(x || {}).reduce((a, b) => a + b, 0);
const named = (name, config) => ({name, config: {[name]: config}});
const native = x => ['Vesna', 'Vodyanitsa'].includes(x?.character?.name);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const finite = (x, label, max = 100000) => {
    if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > max) throw Error(label + '无效');
    return x;
};
const SOURCE = {
    Qiqi: 'https://gi.gachabase.net/characters/10000035/qiqi/release?lang=en',
    Diona: 'https://gi.gachabase.net/characters/10000039/diona/release?lang=en',
    Sandrone: 'https://gi.gachabase.net/characters/10000133/sandrone/release?lang=en',
    Vesna: 'https://gi.gachabase.net/characters/10000143/vesna/release?lang=en',
};
export const STELLAR_SUPPORT_SOURCES = SOURCE;
export const SANDRONE_STELLAR_TARGET = 'SandroneStellarSwirl';
// Independently extracted from the public skill parameter arrays. The UI sends
// the final talent level minus one; constellation levels are not added again.
export const SANDRONE_STELLAR_RATIOS = {
    charged: [1.2255,1.32525,1.425,1.5675,1.66725,1.78125,1.938,2.09475,2.2515,2.4225,2.5935,2.7645,2.9355,3.1065,3.2775],
    skill: [.324,.3483,.3726,.405,.4293,.4536,.486,.5184,.5508,.5832,.6156,.648,.6885,.729,.7695],
    burst: [3.308,3.5561,3.8042,4.135,4.3831,4.6312,4.962,5.2928,5.6236,5.9544,6.2852,6.616,7.0295,7.443,7.8565],
    c4: 1.875, c6: 1.2,
};
const SANDRONE_SKILLS = [
    {index:18, original:5, name:'ChargedRayStellar', label:'重击冷凝射线·星扩散'},
    {index:19, original:11, name:'SkillPrismStellar', label:'棱晶弹·星扩散'},
    {index:20, original:14, name:'BurstBeamStellar', label:'聚能光束·星扩散'},
    {index:21, original:15, name:'C4Resonator', label:'四命棱晶谐振炮·星扩散'},
    {index:22, original:17, name:'C6ClusterStellar', label:'六命集束射线·星扩散（单段）'},
];
function sandroneRatio(input, index) {
    const c=input.character, p=input.skill?.config?.Sandrone || {}, table=SANDRONE_STELLAR_RATIOS;
    for(const key of ['skill1','skill2','skill3']) if(!Number.isInteger(c[key]) || c[key]<0 || c[key]>14) throw Error('桑多涅天赋等级应为1～15');
    const unlocked=c.level>20 || (c.level===20 && c.ascend);
    if(index===18)return table.charged[c.skill1];
    if(index===19)return table.skill[c.skill2] * (p.prism_overcharge && unlocked ? 4 : 1);
    if(index===20)return table.burst[c.skill3] * (1 + (unlocked ? clamp(finite(p.burst_tactics_stacks ?? 0,'改进战术层数',10),0,10) * .1 : 0));
    if(index===21)return c.constellation>=4 ? table.c4 : 0;
    if(index===22)return c.constellation>=6 ? table.c6 : 0;
    throw Error('未知桑多涅星扩散技能');
}

export function stellarSupportState(input) {
    const state = {bonus: 0, flat: 0, base: 0, baseSources: {}, labels: {}};
    const seen = new Set();
    for (const b of input?.buffs || []) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        const p = b.config?.[b.name] || {};
        if (b.name === 'QiqiTalent2StellarConduct') {
            state.bonus += .5;
            state.labels['七七·七宝奉真：星扩散'] = .5;
        }
        if (b.name === 'SandroneC1') {
            state.bonus += .3;
            state.labels['桑多涅一命：星扩散'] = .3;
        }
        if (b.name === 'QiqiC6StellarConduct' && input.character?.name !== 'Qiqi')
            state.flat += finite(p.atk, '七七来源攻击力') * 6;
        if (b.name === 'SandroneTalent1') {
            const amount = Math.min(finite(p.atk, '桑多涅来源攻击力') * .00007, .14);
            state.base += amount;
            state.baseSources['桑多涅·星耀祝礼：星扩散'] = amount;
        }
        if (b.name === 'VesnaTalent1' && input.character?.name !== 'Vesna') {
            const amount = Math.min(finite(p.atk, '薇斯纳来源最终攻击力') * .00007, .14)
                * finite(p.coverage ?? 1, '薇斯纳星耀祝礼覆盖率', 1);
            state.base += amount;
            state.baseSources['薇斯纳·星耀祝礼：星扩散'] = amount;
        }
    }
    if(input?.character?.name==='Sandrone' && input.character.constellation>=1 && input.character.params?.Sandrone?.c1_team_stellar!==false) {
        state.bonus += .3;
        state.labels['桑多涅一命：星扩散（自身）'] = .3;
    }
    return state;
}

export function createStellarSupportFacade(base, original) {
    const levelCache = new Map();
    // The published reaction table is the authority for all supported levels.
    // A neutral Kaeya input has no EM, Stellar bonuses, or resistance changes.
    function anemoReactionBase(level) {
        if (!levelCache.has(level)) {
            const input = {character: {name: 'Kaeya', level, ascend: false, constellation: 0,
                skill1: 0, skill2: 0, skill3: 0, params: 'NoConfig'},
                weapon: {name: 'DullBlade', level: 1, ascend: false, refine: 1, params: 'NoConfig'},
                skill: {index: 0, config: 'NoConfig'}, artifacts: [], artifact_config: null, buffs: [], enemy: null};
            const result = original.CalculatorInterface.get_damage_analysis(input, 'Cryo');
            const raw = result.stellarswirl_anemo?.non_critical / .9;
            if (!Number.isFinite(raw) || raw <= 0) throw Error('星扩散等级基础伤害读取失败');
            levelCache.set(level, raw);
        }
        return levelCache.get(level);
    }
    function addStarBonus(input, bonus) {
        if (!bonus) return;
        if (input.character.name === 'Vodyanitsa') {
            input.buffs.push(named('VesnaSupport', {flat: 0, bonus, crit_damage: 0, elevation: 0, anemo_res: 0}));
        } else if (input.character.name === 'Vesna') {
            const existing = input.buffs.find(b => b.name === 'EnhanceStellarGlimmerReaction');
            if (existing) existing.config.EnhanceStellarGlimmerReaction.p += bonus * 100;
            else input.buffs.push(named('EnhanceStellarGlimmerReaction', {p: bonus * 100}));
        } else {
            // These two native attributes cancel in Stellar-Conduct only.
            // Both are evaluated afresh for every optimization candidate.
            input.buffs.push(named('EnhanceStellarGlimmerReaction', {p: bonus * 100}));
            input.buffs.push(named('CynoC2StellarConduct', {stack: -bonus * 10}));
        }
    }
    function prepare(input) {
        if (Array.isArray(input?.single_interfaces)) return {...input, single_interfaces: input.single_interfaces.map(prepare)};
        if (!input?.character) return input;
        const state = stellarSupportState(input);
        const sandrone=input.character.name==='Sandrone';
        const synthetic = input.buffs?.some(b => b.name === 'VesnaTalent1');
        if (!state.bonus && !state.flat && !state.base && !sandrone && !synthetic) return input;
        const x = clone(input); x.buffs ||= [];
        if (native(x)) {
            // The extension has no published Qiqi/Sandrone buff enums.
            x.buffs = x.buffs.filter(b => !['QiqiTalent2StellarConduct', 'QiqiC6StellarConduct', 'SandroneC1', 'SandroneTalent1', 'VesnaTalent1'].includes(b.name));
            if (state.flat || state.base) x.buffs.push(named('VesnaSupport', {flat: state.flat, base: state.base, bonus: 0, crit_damage: 0, elevation: 0, anemo_res: 0}));
        }
        addStarBonus(x, state.bonus);
        if (!native(x)) x.buffs = x.buffs.filter(b => b.name !== 'VesnaTalent1');
        if (state.base && !native(x)) {
            // Odette's native mode-2 talent has exactly the same .007/100 ATK,
            // 14% cap and Stellar-Swirl-only scope. Preserve all existing buffs.
            for (const b of input.buffs || []) if (['SandroneTalent1', 'VesnaTalent1'].includes(b.name)) {
                if (b.name === 'VesnaTalent1') {
                    const p = b.config?.VesnaTalent1 || {};
                    const atk = Math.min(finite(p.atk, '薇斯纳来源最终攻击力'), 2000)
                        * finite(p.coverage ?? 1, '薇斯纳星耀祝礼覆盖率', 1);
                    x.buffs.push(named('OdetteTalent1', {atk, radiance_mode: 2}));
                } else x.buffs.push(named('OdetteTalent1', {atk: b.config.SandroneTalent1.atk, radiance_mode: 2}));
            }
        }
        if(sandrone) {
            const p=x.character.params?.Sandrone || {};
            if(p.stellar_base_active!==false && !x.__stellar_dynamic_target) {
                const panel=base.CommonInterface.get_attribute(x);
                x.buffs.push(named('OdetteTalent1',{atk:sum(panel.atk),radiance_mode:2}));
            }
            if(x.character.constellation>=6 && p.c6_elevate_active!==false) {
                x.character.params.Sandrone.c6_elevate_active=false;
                x.buffs.push(named('ElevateStellarGlimmerReaction',{p:20}));
            }
        }
        if(native(x)) {
            const merged={flat:0,base:0,bonus:0,crit_damage:0,elevation:0,anemo_res:0};
            let count=0;
            for(const b of x.buffs)if(b.name==='VesnaSupport') {count++;for(const key of Object.keys(merged))merged[key]+=Number(b.config?.VesnaSupport?.[key] || 0);}
            if(count) {x.buffs=x.buffs.filter(b=>b.name!=='VesnaSupport');x.buffs.push(named('VesnaSupport',merged));}
        }
        return x;
    }
    function relabel(result, state) {
        const generic = 'BUFF: 星烁反应伤害加成', counter = 'BUFF: 赛诺「令仪·引谒归灵」（辉映·星超导）';
        if (state.bonus && result.direct_stellarswirl_compose) {
            result.direct_stellarswirl_compose[generic] = (result.direct_stellarswirl_compose[generic] ?? 0) - state.bonus;
            if (Math.abs(result.direct_stellarswirl_compose[generic]) < 1e-12) delete result.direct_stellarswirl_compose[generic];
            Object.assign(result.direct_stellarswirl_compose, state.labels);
            if (result.direct_stellarconduct_compose) {
                result.direct_stellarconduct_compose[generic] = (result.direct_stellarconduct_compose[generic] ?? 0) - state.bonus;
                result.direct_stellarconduct_compose[counter] = (result.direct_stellarconduct_compose[counter] ?? 0) + state.bonus;
                for (const key of [generic, counter]) if (Math.abs(result.direct_stellarconduct_compose[key]) < 1e-12) delete result.direct_stellarconduct_compose[key];
            }
        }
        if (state.base && result.direct_stellarswirl_base_compose) {
            const key = 'BUFF: 奥黛塔「星耀祝礼·银晓之舞」';
            result.direct_stellarswirl_base_compose[key] = (result.direct_stellarswirl_base_compose[key] ?? 0) - state.base;
            if (Math.abs(result.direct_stellarswirl_base_compose[key]) < 1e-12) delete result.direct_stellarswirl_base_compose[key];
            Object.assign(result.direct_stellarswirl_base_compose, state.baseSources);
        }
        return result;
    }
    function applyFlat(input, result, flat) {
        if (!flat || !result.direct_stellarswirl) return result;
        const raw = sum(input.character.name==='YumemizukiMizuki' ? result.em : result.atk) * sum(result.direct_stellarswirl_ratio)
            + sum(result.direct_stellarswirl_extra_damage) + sum(result.direct_stellarswirl_extra_fixed);
        if (raw <= 0) throw Error('无法确定该直接星扩散技能的基础伤害，不能加入七七六命。');
        for (const key of ['non_critical', 'critical', 'expectation']) result.direct_stellarswirl[key] *= (raw + flat) / raw;
        result.direct_stellarswirl_extra_fixed['七七六命·洞玄：直接星扩散'] = flat;
        return result;
    }
    function withoutReactionFlat(input) {
        const x=clone(input);
        x.buffs=(x.buffs || []).filter(b=>b.name!=='YumemizukiMizukiC1');
        return x;
    }
    function sandroneDamage(input, fumo) {
        const descriptor=SANDRONE_SKILLS.find(s=>s.index===input.skill?.index);
        const referenceInput=clone(input); referenceInput.skill.index=descriptor.original;
        const result=base.CalculatorInterface.get_damage_analysis(prepare(referenceInput),fumo);
        const cleanInput=withoutReactionFlat(referenceInput);
        const reference=base.CalculatorInterface.get_damage_analysis(prepare(cleanInput),fumo);
        const ratio=sandroneRatio(input,descriptor.index), state=stellarSupportState(input);
        const rawReaction=anemoReactionBase(input.character.level) / .75 * reference.stellarswirl_reaction_cryo_base_multiplier * reference.stellarswirl_vortex_coefficient;
        const unit=reference.stellarswirl_cryo?.non_critical / rawReaction;
        if(!Number.isFinite(unit) || rawReaction<=0)throw Error('桑多涅星扩散反应乘区无效');
        const flat=sum(reference.direct_stellarswirl_extra_fixed)+state.flat;
        const raw=sum(reference.atk)*ratio+sum(reference.direct_stellarswirl_extra_damage)+(ratio>0?flat:0);
        const critical=clamp(sum(reference.critical)+sum(reference.critical_stellarswirl),0,1);
        const c2=descriptor.index===18 && input.character.constellation>=2 ? .4+.2*clamp(finite(input.skill.config?.Sandrone?.c2_ray_stacks ?? 0,'冷凝射线暴伤层数',3),0,3) : 0;
        const cd=sum(reference.critical_damage)+sum(reference.critical_damage_stellarswirl)+c2;
        const nonCritical=raw*unit;
        result.normal={critical:0,non_critical:0,expectation:0,is_heal:false,is_shield:false};
        delete result.melt; delete result.direct_stellarconduct;
        result.direct_stellarswirl={non_critical:nonCritical,critical:nonCritical*(1+cd),expectation:nonCritical*(1+critical*cd),is_heal:false,is_shield:false};
        result.atk_ratio={};result.em_ratio={};
        result.direct_stellarswirl_ratio={[descriptor.label]:ratio};
        if(c2)result.critical_damage_stellarswirl['桑多涅二命·冷凝射线']=c2;
        if(state.flat && ratio>0)result.direct_stellarswirl_extra_fixed['七七六命·洞玄：直接星扩散']=state.flat;
        const ownBase=input.character.params?.Sandrone?.stellar_base_active!==false?Math.min(sum(result.atk)*.00007,.14):0;
        relabel(result,state);
        if(ownBase) {
            const key='BUFF: 奥黛塔「星耀祝礼·银晓之舞」';
            result.direct_stellarswirl_base_compose[key]=(result.direct_stellarswirl_base_compose[key] || 0)-ownBase;
            if(Math.abs(result.direct_stellarswirl_base_compose[key])<1e-12)delete result.direct_stellarswirl_base_compose[key];
            result.direct_stellarswirl_base_compose['桑多涅·星耀祝礼（自身）']=ownBase;
        }
        result.stellar_support_model={character:'Sandrone',skill:descriptor.index,source:SOURCE.Sandrone};
        return result;
    }
    function adjustStellarSupportDsl(source, input) {
        const state = stellarSupportState(input);
        if (!state.flat || native(input)) return {source, input};
        // Only the generated, audited two direct-Mizuki targets are rewritten.
        if (!/^dmg hit = YumemizukiMizuki\.(TalentStellarSwirl|C1StellarSwirl)\nresult = hit\.direct_stellarswirl\.e$/.test(source)) {
            if (/^dmg hit = YumemizukiMizuki\.(TalentStellarSwirl|C1StellarSwirl)\nresult = hit\.stellarswirl_(anemo|cryo)\.e$/.test(source)) return {source, input};
            throw Error('七七六命星扩散加值暂不支持此自定义DSL；请选瑞希的直接星扩散目标。');
        }
        const x = clone(input);
        x.character.params.YumemizukiMizuki.c1_reaction_active = false;
        // C1's separate reaction-flat bucket is outside the EM bonus bucket.
        // Removing it leaves direct talent damage intact and gives an exact,
        // candidate-dependent unit multiplier, including any other direct flat.
        x.buffs = (x.buffs || []).filter(b => b.name !== 'YumemizukiMizukiC1');
        const raw = anemoReactionBase(x.character.level);
        return {input: x, source: source + `\nresult = result + ${state.flat} * hit.stellarswirl_anemo.e / ${raw}`};
    }
    function sandroneTarget(input, key) {
        const target=input[key];
        if(target?.name!==SANDRONE_STELLAR_TARGET)return input;
        if(input.character.name!=='Sandrone')throw Error('桑多涅星扩散目标仅适用于桑多涅');
        if(target.use_dsl)throw Error('桑多涅星扩散新技能暂不支持自定义DSL，请使用内置星扩散目标');
        const p=target.params?.[SANDRONE_STELLAR_TARGET] || {}, mode=p.mode ?? 0;
        if(!Number.isInteger(mode) || mode<0 || mode>4)throw Error('桑多涅星扩散目标类型无效');
        if(mode===3 && input.character.constellation<4)throw Error('四命星扩散目标需要解锁桑多涅四命');
        if(mode===4 && input.character.constellation<6)throw Error('六命星扩散目标需要解锁桑多涅六命');
        const x=withoutReactionFlat(input), descriptor=SANDRONE_SKILLS[mode];
        x.skill={index:descriptor.index,config:{Sandrone:{c2_ray_stacks:finite(p.c2_ray_stacks ?? 0,'冷凝射线暴伤层数',3),
            prism_overcharge:p.prism_overcharge===true,burst_tactics_stacks:finite(p.burst_tactics_stacks ?? 0,'改进战术层数',10),stellarconduct_hits:0}}};
        const ratio=sandroneRatio(x,descriptor.index), state=stellarSupportState(x);
        // Let the original core evaluate candidate-dependent EM, weapon and
        // artifact effects. Own ATK-to-base scaling stays a live DSL expression.
        x.__stellar_dynamic_target=true;
        const refInput=clone(x); refInput.skill.index=descriptor.original;
        const reference=base.CalculatorInterface.get_damage_analysis(prepare(refInput),null);
        const rawReaction=anemoReactionBase(x.character.level) / .75 * reference.stellarswirl_reaction_cryo_base_multiplier * reference.stellarswirl_vortex_coefficient;
        const baseFromTeam=sum(reference.direct_stellarswirl_base_compose);
        const ownBase=x.character.params?.Sandrone?.stellar_base_active!==false;
        const c2=mode===0 && x.character.constellation>=2 ? .4 + .2*x.skill.config.Sandrone.c2_ray_stacks : 0;
        const starCrit=sum(reference.critical_stellarswirl);
        const rawFlat=sum(reference.direct_stellarswirl_extra_fixed)+sum(reference.direct_stellarswirl_extra_damage)+state.flat;
        const config=x.skill.config.Sandrone;
        const skillConfig=`{c2_ray_stacks: ${config.c2_ray_stacks}, prism_overcharge: ${config.prism_overcharge}, burst_tactics_stacks: ${config.burst_tactics_stacks}, stellarconduct_hits: 0}`;
        let source=`dmg hit = Sandrone.${descriptor.name}(${skillConfig})\nprop attack = Sandrone.atk\nprop critical = Sandrone.crit0\nresult = (hit.stellarswirl_cryo.e + hit.stellarswirl_cryo.n * min(1, max(0, critical + ${starCrit})) * ${c2}) * (attack * ${ratio} + ${rawFlat}) / ${rawReaction}`;
        if(ownBase)source+=`\nresult = result * (1 + ${baseFromTeam} + min(attack * 0.00007, 0.14)) / (1 + ${baseFromTeam})`;
        x[key]={name:'SandroneDefault',params:'NoConfig',use_dsl:true,dsl_source:source};
        return x;
    }
    function transformStellarTarget(input) {
        if (Array.isArray(input?.single_interfaces)) return {...input, single_interfaces: input.single_interfaces.map(transformStellarTarget)};
        if (!input?.character) return input;
        let x = input;
        for (const key of ['target_function', 'tf']) {
            if(x[key]?.name===SANDRONE_STELLAR_TARGET) {x=sandroneTarget(x,key);continue;}
            if(!x[key]?.use_dsl)continue;
            const adjusted = adjustStellarSupportDsl(x[key].dsl_source, x);
            x = {...adjusted.input, [key]: {...x[key], dsl_source: adjusted.source}};
        }
        return x;
    }
    const facade = Object.fromEntries(Object.entries(base).map(([className, Class]) => [className, className === 'TransformativeDamage' ? Class : new Proxy(Class, {get(target, method) {
        const fn = Reflect.get(target, method); if (typeof fn !== 'function') return fn;
        return (...args) => {
            if (className === 'DSLInterface' && method === 'run') {
                if (stellarSupportState(args[1]).flat && !native(args[1])) throw Error('七七六命星扩散加值暂不支持自定义DSL，请使用瑞希的直接星扩散目标。');
                return fn(args[0], prepare(args[1]), ...args.slice(2));
            }
            const hasSandroneTarget=x=>x?.target_function?.name===SANDRONE_STELLAR_TARGET || x?.tf?.name===SANDRONE_STELLAR_TARGET || x?.single_interfaces?.some(hasSandroneTarget);
            if(className==='CalcArtifactBestSet' && hasSandroneTarget(args[0]))throw Error('桑多涅星扩散目标暂不支持理论套装排行，请使用实际库存配装。');
            if(className==='CommonInterface' && method==='get_artifacts_rank_by_character' && args[2]?.name===SANDRONE_STELLAR_TARGET)throw Error('桑多涅星扩散目标按实际伤害配装，请使用单人配装。');
            if(hasSandroneTarget(args[0]))args[0]=transformStellarTarget(args[0]);
            if (Array.isArray(args[0]?.single_interfaces)) return fn(prepare(args[0]), ...args.slice(1));
            if (!args[0]?.character) return fn(...args);
            const input = args[0], state = stellarSupportState(input);
            if(className==='CalculatorInterface' && method==='get_damage_analysis' && input.character.name==='Sandrone' && SANDRONE_SKILLS.some(s=>s.index===input.skill?.index))return sandroneDamage(input,args[1]);
            const prepared = prepare(input);
            const result = fn(prepared, ...args.slice(1));
            if (className === 'CalculatorInterface' && method === 'get_damage_analysis' && !native(input))
                return applyFlat(input, relabel(result, state), state.flat);
            return result;
        };
    }})]));
    return {facade, transformStellarTarget, adjustStellarSupportDsl, anemoReactionBase};
}
