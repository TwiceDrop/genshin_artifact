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
// Work on DSL tokens rather than substituting whole target strings. This
// preserves user formulas, comments, and quoted text while allowing several
// direct Stellar hits in the same expression.
function dslTokens(source) {
    const tokens=[];
    for(let i=0;i<source.length;) {
        const start=i, c=source[i];
        if(/\s/.test(c)) {i++;continue;}
        if(source.startsWith('//',i)) {i=source.indexOf('\n',i+2);if(i<0)i=source.length;continue;}
        if(source.startsWith('/*',i)) {const end=source.indexOf('*/',i+2);i=end<0?source.length:end+2;continue;}
        if(c==='"') {i++;while(i<source.length){if(source[i++]==='\\')i++;else if(source[i-1]==='"')break;}tokens.push({value:source.slice(start,i),start,end:i,type:'string'});continue;}
        if(/[A-Za-z_]/.test(c)){i++;while(i<source.length&&/[A-Za-z_0-9]/.test(source[i]))i++;tokens.push({value:source.slice(start,i),start,end:i,type:'id'});continue;}
        if(/[0-9]/.test(c)){i++;while(i<source.length&&/[0-9.]/.test(source[i]))i++;tokens.push({value:source.slice(start,i),start,end:i,type:'number'});continue;}
        i++;tokens.push({value:c,start,end:i,type:'symbol'});
    }
    return tokens;
}
function dslDamageBindings(tokens) {
    const bindings=new Map();
    for(let i=0;i+5<tokens.length;i++) {
        const t=tokens;
        if(t[i].value!=='dmg'||t[i+1].type!=='id'||t[i+2].value!=='='||t[i+3].type!=='id'||t[i+4].value!=='.'||t[i+5].type!=='id')continue;
        const config={};let j=i+6;
        const synthetic=t[i+3].value==='Sandrone'&&SANDRONE_SKILLS.some(s=>s.name===t[i+5].value);
        if(synthetic&&t[j]?.value==='('&&t[j+1]?.value==='{') {
            j+=2;
            while(t[j]&&t[j].value!=='}') {
                const key=t[j++];if(key.type!=='id'||t[j++]?.value!==':')throw Error('星扩散技能参数格式无效');
                let sign=1;if(t[j]?.value==='-'){sign=-1;j++;}
                const value=t[j++];if(!value)throw Error('星扩散技能参数缺少数值');
                if(value.type==='number')config[key.value]=sign*Number(value.value);
                else if(sign===1&&['true','false'].includes(value.value))config[key.value]=value.value==='true';
                else throw Error('星扩散技能参数必须为固定数值或布尔值');
                if(t[j]?.value===',')j++;
                else if(t[j]?.value!=='}')throw Error('星扩散技能参数分隔符无效');
            }
        }
        bindings.set(t[i+1].value,{character:t[i+3].value,skill:t[i+5].value,config});
    }
    return bindings;
}
const DSL_DAMAGE_FIELDS={e:'e',expect:'e',expectation:'e',c:'c',crit:'c',critical:'c',n:'n',non_crit:'n',non_critical:'n'};
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
        const skillBase = sum(input.character.name==='YumemizukiMizuki' ? result.em : result.atk)
            * sum(result.direct_stellarswirl_ratio) + sum(result.direct_stellarswirl_extra_damage);
        const existingFlat = sum(result.direct_stellarswirl_extra_fixed);
        if (existingFlat) throw Error('直接星扩散已有未核对的定额加值，不能重复加入七七六命。');
        const amplified = skillBase * (1 + sum(result.direct_stellarswirl_base_compose))
            * (1 + sum(result.direct_stellarswirl_compose));
        if (amplified <= 0) throw Error('无法确定该直接星扩散技能的基础伤害，不能加入七七六命。');
        // The published hit already includes RES, CRIT and elevation. Adding
        // the flat after base/EM bonuses therefore scales by the amplified
        // pre-resistance amount, not the raw skill multiplier.
        for (const key of ['non_critical', 'critical', 'expectation'])
            result.direct_stellarswirl[key] *= (amplified + flat) / amplified;
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
        const coreFlat=sum(reference.direct_stellarswirl_extra_fixed)+sum(reference.direct_stellarswirl_extra_damage);
        if(coreFlat)throw Error('桑多涅直接星扩散含未核对的基础加值，无法安全计算。');
        const flat=ratio>0?state.flat:0;
        const raw=sum(reference.atk)*ratio;
        const baseFactor=1+sum(reference.direct_stellarswirl_base_compose);
        const bonusFactor=1+sum(reference.direct_stellarswirl_compose);
        if(baseFactor<=0||bonusFactor<=0)throw Error('桑多涅星扩散增益乘区无效');
        const postFactor=unit/(baseFactor*bonusFactor);
        const critical=clamp(sum(reference.critical)+sum(reference.critical_stellarswirl),0,1);
        const c2=descriptor.index===18 && input.character.constellation>=2 ? .4+.2*clamp(finite(input.skill.config?.Sandrone?.c2_ray_stacks ?? 0,'冷凝射线暴伤层数',3),0,3) : 0;
        const cd=sum(reference.critical_damage)+sum(reference.critical_damage_stellarswirl)+c2;
        const nonCritical=raw*unit+flat*postFactor;
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
        if(native(input))return {source,input};
        const tokens=dslTokens(source),bindings=dslDamageBindings(tokens),replacements=[],props=[];
        const references=[];
        for(let i=0;i+4<tokens.length;i++)if(tokens[i].type==='id'&&tokens[i+1].value==='.'&&tokens[i+3].value==='.'&&tokens[i+2].type==='id'&&tokens[i+4].type==='id')
            references.push({name:tokens[i].value,kind:tokens[i+2].value,field:tokens[i+4].value,start:tokens[i].start,end:tokens[i+4].end});
        const direct=references.filter(r=>r.kind==='direct_stellarswirl');
        if(!direct.length)return {source,input};
        const reactionFlat=(input.buffs||[]).some(b=>b.name==='YumemizukiMizukiC1')||
            (input.character.name==='YumemizukiMizuki'&&input.character.params?.YumemizukiMizuki?.c1_reaction_active);
        if(reactionFlat&&references.some(r=>r.kind==='stellarswirl_anemo'||r.kind==='stellarswirl_cryo'))
            throw Error('该 DSL 同时引用直接与反应星扩散；瑞希一命反应定额加值无法在当前内核中逐项保留。');
        const x=reactionFlat?withoutReactionFlat(input):clone(input);
        if(reactionFlat&&x.character.name==='YumemizukiMizuki')
            x.character.params.YumemizukiMizuki.c1_reaction_active=false;
        const synthetic=new Map();
        let mizukiPostFactor;
        for(const r of direct) {
            const field=DSL_DAMAGE_FIELDS[r.field];
            if(!field)throw Error('直接星扩散 DSL 字段无效：'+r.field);
            const binding=bindings.get(r.name);
            if(!binding)throw Error('直接星扩散 DSL 缺少 dmg 声明：'+r.name);
            let expression;
            const descriptor=binding.character==='Sandrone'&&SANDRONE_SKILLS.find(s=>s.name===binding.skill);
            if(descriptor) {
                x.__stellar_dynamic_target=true;
                if(!synthetic.has(r.name)) {
                    let attack=`__stellar_attack_${r.name}`;
                    while(tokens.some(t=>t.type==='id'&&t.value===attack))attack+='_';
                    synthetic.set(r.name,{attack,config:sandroneConfig(binding.config),descriptor});
                    props.push(`prop ${attack} = Sandrone.atk`);
                }
                const s=synthetic.get(r.name);
                expression=sandroneExpression(x,s.descriptor,s.config,r.name,s.attack,field);
            } else if(binding.character==='YumemizukiMizuki'&&['TalentStellarSwirl','C1StellarSwirl'].includes(binding.skill)) {
                expression=source.slice(r.start,r.end);
                if(state.flat){
                    if(mizukiPostFactor===undefined){
                        const reference=base.CalculatorInterface.get_damage_analysis(prepare(x),null);
                        const coreFlat=sum(reference.direct_stellarswirl_extra_fixed);
                        if(coreFlat)throw Error('瑞希直接星扩散含未核对的定额加值，不能用于七七六命 DSL。');
                        const factors=(1+sum(reference.direct_stellarswirl_base_compose))
                            *(1+sum(reference.direct_stellarswirl_compose));
                        if(factors<=0)throw Error('瑞希星扩散增益乘区无效');
                        mizukiPostFactor=reference.stellarswirl_anemo.non_critical
                            /anemoReactionBase(x.character.level)/factors;
                    }
                    // The reaction's crit/expectation-to-noncrit ratio remains
                    // live for each candidate; only RES/elevation is fixed by
                    // the enemy and the configured support state.
                    expression=`(${expression} + ${state.flat*mizukiPostFactor} * ${r.name}.stellarswirl_anemo.${field} / max(0.000000000001, ${r.name}.stellarswirl_anemo.n))`;
                }
            } else if(state.flat) {
                throw Error('七七六命定额加值尚不能用于此直接星扩散技能：'+binding.character+'.'+binding.skill);
            } else continue;
            replacements.push({start:r.start,end:r.end,expression});
        }
        let transformed=source;
        for(const r of replacements.sort((a,b)=>b.start-a.start))transformed=transformed.slice(0,r.start)+r.expression+transformed.slice(r.end);
        if(props.length)transformed+='\n'+props.join('\n');
        return {source:transformed,input:x};
    }
    function sandroneConfig(p) {
        return {c2_ray_stacks:finite(p.c2_ray_stacks ?? 0,'冷凝射线暴伤层数',3),
            prism_overcharge:p.prism_overcharge===true,
            burst_tactics_stacks:finite(p.burst_tactics_stacks ?? 0,'改进战术层数',10),stellarconduct_hits:0};
    }
    function sandroneExpression(input, descriptor, config, hit, attack, field) {
        if(input.character.name!=='Sandrone')throw Error('桑多涅星扩散技能仅适用于桑多涅');
        if(descriptor.index===21 && input.character.constellation<4)throw Error('四命星扩散目标需要解锁桑多涅四命');
        if(descriptor.index===22 && input.character.constellation<6)throw Error('六命星扩散目标需要解锁桑多涅六命');
        const x=clone(input);
        x.skill={index:descriptor.index,config:{Sandrone:config}};
        x.__stellar_dynamic_target=true;
        const refInput=clone(x);refInput.skill.index=descriptor.original;
        const reference=base.CalculatorInterface.get_damage_analysis(prepare(refInput),null);
        const ratio=sandroneRatio(x,descriptor.index), state=stellarSupportState(x);
        const rawReaction=anemoReactionBase(x.character.level)/.75*reference.stellarswirl_reaction_cryo_base_multiplier*reference.stellarswirl_vortex_coefficient;
        if(!Number.isFinite(rawReaction)||rawReaction<=0)throw Error('桑多涅星扩散反应乘区无效');
        const coreFlat=sum(reference.direct_stellarswirl_extra_fixed)+sum(reference.direct_stellarswirl_extra_damage);
        if(coreFlat)throw Error('桑多涅直接星扩散含无法随装备重新计算的基础伤害加值，当前内核无法安全配装。');
        const baseFromTeam=sum(reference.direct_stellarswirl_base_compose);
        const bonusFactor=1+sum(reference.direct_stellarswirl_compose);
        if(1+baseFromTeam<=0||bonusFactor<=0)throw Error('桑多涅星扩散增益乘区无效');
        const postFactor=reference.stellarswirl_cryo.non_critical
            /rawReaction/(1+baseFromTeam)/bonusFactor;
        const c2=descriptor.index===18&&x.character.constellation>=2?.4+.2*config.c2_ray_stacks:0;
        const react=k=>`${hit}.stellarswirl_cryo.${k}`;
        const liveCrit=`min(1, max(0, (${react('e')} - ${react('n')}) / max(0.000000000001, ${react('c')} - ${react('n')})))`;
        const reaction=field==='c'?`(${react('c')} + ${react('n')} * ${c2})`:
            field==='n'?react('n'):`(${react('e')} + ${react('n')} * ${liveCrit} * ${c2})`;
        let expression=`${reaction} * (${attack} * ${ratio}) / ${rawReaction}`;
        if(x.character.params?.Sandrone?.stellar_base_active!==false)
            expression=`(${expression}) * (1 + ${baseFromTeam} + min(${attack} * 0.00007, 0.14)) / (1 + ${baseFromTeam})`;
        if(state.flat&&ratio>0)
            expression=`(${expression} + ${state.flat*postFactor} * (${reaction}) / max(0.000000000001, ${react('n')}))`;
        return expression;
    }
    function sandroneTarget(input, key) {
        const target=input[key];
        if(target?.name!==SANDRONE_STELLAR_TARGET)return input;
        if(target.use_dsl)return {...input,[key]:{...target,name:'SandroneDefault',params:'NoConfig'}};
        const p=target.params?.[SANDRONE_STELLAR_TARGET] || {}, mode=p.mode ?? 0;
        if(!Number.isInteger(mode) || mode<0 || mode>4)throw Error('桑多涅星扩散目标类型无效');
        const descriptor=SANDRONE_SKILLS[mode], config=sandroneConfig(p);
        const x=withoutReactionFlat(input);
        x.__stellar_dynamic_target=true;
        const skillConfig=`{c2_ray_stacks: ${config.c2_ray_stacks}, prism_overcharge: ${config.prism_overcharge}, burst_tactics_stacks: ${config.burst_tactics_stacks}, stellarconduct_hits: 0}`;
        const expression=sandroneExpression(x,descriptor,config,'hit','attack','e');
        x[key]={name:'SandroneDefault',params:'NoConfig',use_dsl:true,
            dsl_source:`dmg hit = Sandrone.${descriptor.name}(${skillConfig})\nprop attack = Sandrone.atk\nresult = ${expression}`};
        return x;
    }
    function transformStellarTarget(input) {
        if (Array.isArray(input?.single_interfaces)) return {...input, single_interfaces: input.single_interfaces.map(transformStellarTarget)};
        if (!input?.character) return input;
        let x = input;
        for (const key of ['target_function', 'tf']) {
            if(x[key]?.name===SANDRONE_STELLAR_TARGET) {
                const custom=x[key].use_dsl;
                x=sandroneTarget(x,key);
                if(!custom)continue;
            }
            if(!x[key]?.use_dsl||x[key].__stellar_adjusted)continue;
            const adjusted = adjustStellarSupportDsl(x[key].dsl_source, x);
            x = {...adjusted.input, [key]: {...x[key], dsl_source: adjusted.source,__stellar_adjusted:true}};
        }
        return x;
    }
    const facade = Object.fromEntries(Object.entries(base).map(([className, Class]) => [className, className === 'TransformativeDamage' ? Class : new Proxy(Class, {get(target, method) {
        const fn = Reflect.get(target, method); if (typeof fn !== 'function') return fn;
        return (...args) => {
            if (className === 'DSLInterface' && method === 'run') {
                // The playground passes artifacts as the third argument rather
                // than inside its damage environment. The reference analysis
                // used to compile Stellar skills must see those same pieces.
                const adjusted=adjustStellarSupportDsl(args[0],{...args[1],artifacts:args[2]||[]});
                return fn(adjusted.source,prepare(adjusted.input),...args.slice(2));
            }
            const hasSandroneTarget=x=>x?.target_function?.name===SANDRONE_STELLAR_TARGET || x?.tf?.name===SANDRONE_STELLAR_TARGET || x?.single_interfaces?.some(hasSandroneTarget);
            const hasCustomDsl=x=>x?.target_function?.use_dsl||x?.tf?.use_dsl||x?.single_interfaces?.some(hasCustomDsl);
            if(className==='CalcArtifactBestSet' && hasSandroneTarget(args[0]))throw Error('桑多涅星扩散目标暂不支持理论套装排行，请使用实际库存配装。');
            if(className==='CommonInterface' && method==='get_artifacts_rank_by_character' && args[2]?.name===SANDRONE_STELLAR_TARGET)throw Error('桑多涅星扩散目标按实际伤害配装，请使用单人配装。');
            if(hasSandroneTarget(args[0])||hasCustomDsl(args[0]))args[0]=transformStellarTarget(args[0]);
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
