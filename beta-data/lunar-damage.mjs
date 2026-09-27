import {lunarParameters,reactionResistance} from './reaction-parameter-rules.mjs';
// Lunar reaction and direct-skill damage are separate ownership models.
// Formulas supplied for the 7.1 calibration; see docs/lunar-damage-model.md.
const CRYSTALLIZE_WEIGHTS = Object.freeze([0.6, 0.3, 0.05, 0.05]);
const KINDS = Object.freeze({
    'lunar-electro': {coefficient: 3, element: 'Electro', tag: 'direct-lunar-electro'},
    'lunar-crystallize': {coefficient: 1.6, element: 'Geo', tag: 'direct-lunar-crystallize'},
    'lunar-bloom': {coefficient: 1, element: 'Dendro', tag: 'direct-lunar-bloom'},
});

function object(value, label, keys) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error(label + '必须是对象');
    for (const key of Object.keys(value)) if (!keys.includes(key)) throw Error(label + '含未知参数：' + key);
    return value;
}
function number(value, label, minimum = 0, maximum = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw Error(label + '应为有效数值，范围为 ' + minimum + '～' + maximum);
    }
    return value;
}
function identifier(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) throw Error(label + '必须是非空字符串');
    return value;
}
function output(value, label) {
    if (!Number.isFinite(value)) throw Error(label + '超出可计算范围');
    return value;
}
function stats(value, label) {
    return {
        id: identifier(value.id, label + '.id'),
        em: number(value.em, label + '.em'),
        critRate: number(value.critRate, label + '.critRate', 0, 1),
        critDamage: number(value.critDamage, label + '.critDamage'),
    };
}
const supplied = (value, fallback) => value === undefined ? fallback : value;
const EFFECT_TAGS = ['reaction-lunar-electro', 'direct-lunar-electro', 'reaction-lunar-crystallize', 'direct-lunar-crystallize', 'direct-lunar-bloom'];
function taggedMultiplier(value, multiplierKey, tagsKey, requiredTag, label) {
    const multiplier = number(supplied(value[multiplierKey], 1), label + '.' + multiplierKey);
    const tags = supplied(value[tagsKey], []);
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !EFFECT_TAGS.includes(tag))) {
        throw Error(label + '.' + tagsKey + '仅接受明确的反应型/直伤型月曜标签');
    }
    if (multiplier !== 1 && !tags.includes(requiredTag)) {
        throw Error(label + '.' + multiplierKey + '未明确适用于当前伤害类型：' + requiredTag);
    }
    return multiplier;
}
function effects(value, label, tag) {
    return {
        baseBonus: number(supplied(value.baseBonus, 0), label + '.baseBonus', -1),
        lunarBonus: number(supplied(value.lunarBonus, 0), label + '.lunarBonus', -1),
        lunarIndependentMultiplier: taggedMultiplier(value, 'lunarIndependentMultiplier', 'lunarIndependentTags', tag, label),
        flatBonus: number(supplied(value.flatBonus, 0), label + '.flatBonus'),
        elevation: number(supplied(value.elevation, 0), label + '.elevation', -1),
    };
}
function damageBranch(base, em, effect, resistance) {
    const main = base * (1 + effect.baseBonus)
        * (1 + 6 * em / (em + 2000) + effect.lunarBonus)
        * effect.lunarIndependentMultiplier;
    return output((main + effect.flatBonus) * resistance * (1 + effect.elevation), '月曜伤害');
}
function triplet(nonCritical, critRate, critDamage) {
    const critical = output(nonCritical * (1 + critDamage), '月曜暴击伤害');
    const expectation = output(nonCritical * (1 + critRate * critDamage), '月曜期望伤害');
    return {non_critical: nonCritical, critical, expectation, n: nonCritical, c: critical, e: expectation};
}
function rankContributions(participants, mask) {
    const ranked = participants.map((p, index) => ({
        id: p.id,
        is_critical: Boolean(mask & (1 << index)),
        damage: mask & (1 << index) ? p.critical : p.non_critical,
    })).sort((a, b) => b.damage - a.damage);
    let damage = 0;
    for (let rank = 0; rank < ranked.length; rank++) {
        const item = ranked[rank];
        item.weight = CRYSTALLIZE_WEIGHTS[rank];
        item.weighted_damage = item.damage * item.weight;
        damage += item.weighted_damage;
    }
    return {damage: output(damage, '月笼谐奏伤害'), ranked};
}

/**
 * One Moonward/Lunar Crystallize hit from the recorded Hydro/Geo contributors.
 * Enumerates all independent critical outcomes before sorting their actual damage.
 * The three-hit result is an expectation, not a guaranteed critical total.
 */
export const calculateLunarCrystallizeTeam=input=>calculateLunarTeam(input,'lunar-crystallize');
export const calculateLunarElectroTeam=input=>calculateLunarTeam(input,'lunar-electro');
function calculateLunarTeam(input,kind) {
    const reaction=KINDS[kind],secondElement=reaction.element;
    object(input, '月曜多人参数', ['participants', 'baseBonus', 'resistanceMultiplier', 'resistanceBeforeBuffs']);
    // A final multiplier excludes any further shred; raw resistance allows BUFF consumption.
    if (!Array.isArray(input.participants) || input.participants.length < 2 || input.participants.length > 4) {
        throw Error('月曜反应须提供实际参与反应的 2～4 名 Hydro/'+secondElement+' 角色');
    }
    const baseBonus = number(supplied(input.baseBonus, 0), 'baseBonus', -1);
    const usedIds = new Set();
    const participants = input.participants.map((participant, index) => {
        const label = 'participants[' + index + ']';
        object(participant, label, ['id', 'element', 'levelBase', 'em', 'critRate', 'critDamage',
            'lunarBonus', 'lunarIndependentMultiplier', 'lunarIndependentTags', 'flatBonus', 'elevation', 'buffs', 'recipientOnField']);
        const p = stats(participant, label);
        if (usedIds.has(p.id)) throw Error('月曜贡献角色重复：' + p.id);
        usedIds.add(p.id);
        if (!['Hydro', secondElement].includes(participant.element)) throw Error(label + '.element 必须为 Hydro 或 '+secondElement);
        const levelBase = number(participant.levelBase, label + '.levelBase');
        if (levelBase === 0) throw Error(label + '.levelBase 必须大于零');
        const effect = effects({...participant, baseBonus}, label, 'reaction-'+kind);
        const added=lunarParameters(kind,participant.buffs,{ownerId:p.id,recipientOnField:participant.recipientOnField,direct:false});
        p.critRate=Math.max(0,Math.min(1,p.critRate+added.critRate));
        p.critDamage=number(p.critDamage+added.critDamage,label+'.finalCritDamage');
        effect.elevation=number(effect.elevation+added.elevation,label+'.finalElevation',-1);
        effect.lunarBonus+=added.reactionBonus;
        effect.baseBonus+=added.baseBonus;
        effect.flatBonus+=added.flatBonus;
        const resistance=reactionResistance(input.resistanceMultiplier,input.resistanceBeforeBuffs,added.resMinus);
        const nonCritical = damageBranch(levelBase * reaction.coefficient * number(added.multiplier,'月曜倍率'), p.em, effect, resistance);
        return {...p, element: participant.element, levelBase, enabled_by_buffs:added.enabled, ...effect,
            ...triplet(nonCritical, p.critRate, p.critDamage)};
    });
    if (!participants.some(p => p.element === 'Hydro') || !participants.some(p => p.element === secondElement)) {
        throw Error('月曜反应实际参与者必须同时包含 Hydro 与 '+secondElement);
    }
    let expectation = 0;
    const criticalStates = [];
    for (let mask = 0; mask < (1 << participants.length); mask++) {
        let probability = 1;
        for (let index = 0; index < participants.length; index++) {
            const rate = participants[index].critRate;
            probability *= mask & (1 << index) ? rate : 1 - rate;
        }
        const state = rankContributions(participants, mask);
        expectation += probability * state.damage;
        criticalStates.push({mask, probability, ...state});
    }
    output(expectation, '月笼谐奏期望伤害');
    const nonCritical = criticalStates[0].damage;
    const critical = criticalStates[criticalStates.length - 1].damage;
    return {
        kind: 'reaction-'+kind, element: secondElement, baseBonus,
        non_critical: nonCritical, critical, expectation,
        n: nonCritical, c: critical, e: expectation,
        participants, weights: [...CRYSTALLIZE_WEIGHTS], critical_states: criticalStates,
        ...(kind==='lunar-crystallize'?{three_hit_expectation: output(3 * expectation, '三枚月笼期望总伤害')}:{}),
    };
}

/**
 * Direct Lunar skill damage always uses one owner's EM, CR and CD.
 * A nontrivial skill-independent multiplier needs an explicit direct-Lunar tag.
 * Ordinary elemental damage bonuses and enemy defence are deliberately absent.
 */
export function calculateDirectLunarDamage(input) {
    object(input, '直伤月曜参数', ['kind', 'owner', 'scalingStat', 'skillMultiplier', 'baseBonus', 'lunarBonus',
        'skillIndependentMultiplier', 'skillIndependentTags', 'lunarIndependentMultiplier', 'lunarIndependentTags',
        'flatBonus', 'elevation', 'resistanceMultiplier', 'resistanceBeforeBuffs', 'buffs']);
    const kind = Object.hasOwn(KINDS, input.kind) ? KINDS[input.kind] : null;
    if (!kind) throw Error('直伤月曜类型必须为 lunar-electro、lunar-crystallize 或 lunar-bloom');
    object(input.owner, 'owner', ['id', 'em', 'critRate', 'critDamage', 'recipientOnField']);
    const owner = stats(input.owner, 'owner');
    const scalingStat = number(input.scalingStat, 'scalingStat');
    const skillMultiplier = number(input.skillMultiplier, 'skillMultiplier');
    const independent = taggedMultiplier(input, 'skillIndependentMultiplier', 'skillIndependentTags', kind.tag, '直伤月曜');
    // Resolve resistance after source BUFFs have been collected.
    const effect = effects(input, '直伤月曜', kind.tag);
    const added=lunarParameters(input.kind,input.buffs,{ownerId:owner.id,recipientOnField:input.owner.recipientOnField});
    owner.critRate=Math.max(0,Math.min(1,owner.critRate+added.critRate));
    owner.critDamage=number(owner.critDamage+added.critDamage,'最终月曜暴伤');
    effect.elevation=number(effect.elevation+added.elevation,'最终月曜擢升',-1);
    effect.lunarBonus+=added.reactionBonus;
    effect.baseBonus+=added.baseBonus;
    effect.flatBonus+=added.flatBonus;
    const resistance=reactionResistance(input.resistanceMultiplier,input.resistanceBeforeBuffs,added.resMinus);
    const base = scalingStat * skillMultiplier * kind.coefficient * independent * number(added.multiplier,'月曜倍率');
    const nonCritical = damageBranch(base, owner.em, effect, resistance);
    return {
        kind: input.kind, element: kind.element, owner: {...owner},
        coefficient: kind.coefficient, enabled_by_buffs:added.enabled,
        ...triplet(nonCritical, owner.critRate, owner.critDamage),
    };
}
