// Formula version: 7.1.0 release, with the individual/party split documented at
// https://keqingmains.com/misc/stellar-reaction-guide/ and
// https://www.taptap.cn/moment/851912127529616541 (2026-09-23).
// Callers must supply real Anemo/Cryo application participants. Vodyanitsa is
// Hydro and cannot create or contribute a Stellar Swirl by herself.

const FIELDS = ['non_critical', 'critical', 'expectation'];
const WEIGHTS = [0.6, 0.3, 0.05, 0.05];
const requireNumber = (value, name, min = 0) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
        throw Error(`${name} 必须是有限数字且不小于 ${min}`);
    return value;
};
const optional = (value, name, min = 0) => requireNumber(value ?? 0, name, min);
const damage = values => ({...values, is_heal: false, is_shield: false});

export function vodyanitsaStellarExtra(hp, active = true, coverage = 1) {
    requireNumber(hp, '沃雅妮莎最终生命');
    const rate = requireNumber(coverage, '沃雅妮莎星扩散支援覆盖率');
    if (rate > 1) throw Error('沃雅妮莎星扩散支援覆盖率不可超过 1');
    return active ? Math.min(Math.max(hp - 40000, 0) * 0.26, 6500) * rate : 0;
}

export function calculateStellarSwirlIndividual({
    levelMultiplier, reactionMultiplier, elementalMastery = 0,
    baseIncrease = 0, reactionBonus = 0, extraIncrease = 0,
    resistanceMultiplier = 1, criticalRate = 0, criticalDamage = 0,
    elevation = 0,
}) {
    const level = requireNumber(levelMultiplier, '角色等级反应系数');
    const reaction = requireNumber(reactionMultiplier, '星扩散反应倍率');
    const em = requireNumber(elementalMastery, '元素精通');
    const base = optional(baseIncrease, '星扩散基础提升');
    const bonus = optional(reactionBonus, '星扩散增伤');
    const extra = optional(extraIncrease, '星扩散额外提升');
    const resistance = requireNumber(resistanceMultiplier, '对应元素抗性倍率');
    const critRate = requireNumber(criticalRate, '星扩散暴击率');
    const critDamage = requireNumber(criticalDamage, '星扩散暴击伤害');
    const elevate = optional(elevation, '星扩散擢升');
    if (critRate > 1) throw Error('星扩散暴击率不可超过 1');
    // The flat increase is outside both the base-increase and EM/reaction-bonus
    // factors, but inside RES, CRIT and elevation.
    const raw = level * reaction * (1 + base) * (1 + 6 * em / (em + 2000) + bonus) + extra;
    const nonCritical = raw * resistance * (1 + elevate);
    return damage({
        non_critical: nonCritical,
        critical: nonCritical * (1 + critDamage),
        expectation: nonCritical * (1 + critRate * critDamage),
    });
}

function validateParticipants(participants) {
    if (!Array.isArray(participants) || participants.length < 2 || participants.length > 4)
        throw Error('星扩散合成需要 2～4 名明确的冰/风附着参与者');
    const ids = new Set();
    for (const participant of participants) {
        if (typeof participant?.id !== 'string' || !participant.id || ids.has(participant.id))
            throw Error('星扩散参与者 ID 缺失或重复');
        ids.add(participant.id);
        if (!['Anemo', 'Cryo'].includes(participant.element))
            throw Error('星扩散参与者必须实际施加冰或风；沃雅妮莎不能单独产生星扩散');
        for (const field of FIELDS)
            requireNumber(participant.damage?.[field], `参与者 ${participant.id} 的 ${field}`);
    }
    if (!participants.some(x => x.element === 'Anemo') || !participants.some(x => x.element === 'Cryo'))
        throw Error('星扩散队伍须明确至少一名挂风与一名挂冰的参与者');
}

function weighted(field, ordered) {
    return ordered.reduce((total, participant, index) =>
        total + WEIGHTS[index] * participant.damage[field], 0);
}
const descending = field => (a, b) => b.damage[field] - a.damage[field];

export function composeStellarSwirlAnemo(participants, triggerId) {
    validateParticipants(participants);
    const trigger = participants.find(x => x.id === triggerId);
    if (!trigger || trigger.element !== 'Anemo')
        throw Error('星扩·风须指定实际触发冰扩散的风角色');
    return damage(Object.fromEntries(FIELDS.map(field => [field,
        weighted(field, [trigger, ...participants.filter(x => x !== trigger).sort(descending(field))])])));
}

export function composeStellarSwirlCryo(participants) {
    validateParticipants(participants);
    return damage(Object.fromEntries(FIELDS.map(field => {
        const cryo = participants.filter(x => x.element === 'Cryo').sort(descending(field));
        const anemo = participants.filter(x => x.element === 'Anemo').sort(descending(field));
        const primary = [cryo[0], anemo[0]];
        const remaining = participants.filter(x => !primary.includes(x)).sort(descending(field));
        return [field, weighted(field, [...primary, ...remaining])];
    })));
}

export function calculateStellarSwirlTeam({participants, triggerId, vortexMultiplier,
    vodyanitsaA4 = null}) {
    if (![2, 3].includes(vortexMultiplier))
        throw Error('星扩·冰风涡倍率须明确为 2 或 3');
    if (!Array.isArray(participants)) throw Error('星扩散参与者未配置');
    let supportRecipient = null, supportExtra = 0;
    if (vodyanitsaA4) {
        supportRecipient = vodyanitsaA4.recipientId;
        if (!participants.some(x => x.id === supportRecipient))
            throw Error('沃雅妮莎 A4 必须指定实际参与冰/风附着的受益角色');
        supportExtra = vodyanitsaStellarExtra(
            vodyanitsaA4.hp, vodyanitsaA4.active === true,
            vodyanitsaA4.coverage ?? 1);
    }
    const individual = (reactionMultiplier, resistanceKey) => participants.map(p => ({
        id:p.id, element:p.element,
        damage:calculateStellarSwirlIndividual({
            levelMultiplier:p.levelMultiplier,
            reactionMultiplier,
            elementalMastery:p.elementalMastery ?? 0,
            baseIncrease:p.baseIncrease ?? 0,
            reactionBonus:p.reactionBonus ?? 0,
            extraIncrease:(p.extraIncrease ?? 0) + (p.id === supportRecipient ? supportExtra : 0),
            resistanceMultiplier:p[resistanceKey],
            criticalRate:p.criticalRate ?? 0,
            criticalDamage:p.criticalDamage ?? 0,
            elevation:p.elevation ?? 0,
        }),
    }));
    const anemo = individual(0.75, 'anemoResistanceMultiplier');
    const cryo = individual(vortexMultiplier, 'cryoResistanceMultiplier');
    return {
        stellarswirl_anemo:composeStellarSwirlAnemo(anemo, triggerId),
        stellarswirl_cryo:composeStellarSwirlCryo(cryo),
        individual:{anemo, cryo},
        formula_version:'7.1.0-reaction-contributions',
    };
}
