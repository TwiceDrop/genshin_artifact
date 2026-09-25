// This evaluates one reaction Moon-Charged lightning strike from explicit
// surviving Hydro/Electro aura sources. It does not infer aura ownership from
// team membership or turn an ordinary Hydro skill into character Moon damage.
// Source: 幕陵, 月感电机制实测, https://www.gamersky.com/handbook/202507/1970668.shtml
const CONTRIBUTION_WEIGHTS = Object.freeze([1, 1 / 2, 1 / 12, 1 / 12]);

function weightedDamage(values) {
    const sorted = [...values].sort((a, b) => b - a);
    return sorted.reduce((total, damage, index) => total + damage * CONTRIBUTION_WEIGHTS[index], 0);
}

function validateParticipants(participants) {
    if (!Array.isArray(participants) || participants.length < 2 || participants.length > 4)
        throw new Error('月感电雷击需要 2～4 个仍有附着的水／雷来源');
    const ids = new Set();
    for (const participant of participants) {
        if (!participant || typeof participant.source !== 'string' || !participant.source.trim() || ids.has(participant.source))
            throw new Error('月感电参与来源必须唯一且有名称');
        ids.add(participant.source);
        if (!['Hydro', 'Electro'].includes(participant.element))
            throw new Error('月感电参与者只能是水或雷元素附着来源');
        for (const key of ['nonCritical', 'critical', 'criticalRate'])
            if (!Number.isFinite(participant[key])) throw new Error(`月感电 ${key} 必须是有限数值`);
        if (participant.nonCritical < 0 || participant.critical < participant.nonCritical ||
            participant.criticalRate < 0 || participant.criticalRate > 1)
            throw new Error('月感电贡献或暴击率越界');
    }
    if (!participants.some(p => p.element === 'Hydro') || !participants.some(p => p.element === 'Electro'))
        throw new Error('月感电需要水、雷两种附着来源');
}

export function evaluateMoonElectroStrike({converterActive, stormCloudActive, dualAuraActive, participants} = {}) {
    if (!converterActive || !stormCloudActive || !dualAuraActive)
        return {status: 'condition-not-met', reason: '需明确月感电转换、雷暴云和目标水雷共存状态'};
    validateParticipants(participants);
    const nonCritical = weightedDamage(participants.map(p => p.nonCritical));
    const allCritical = weightedDamage(participants.map(p => p.critical));
    let expectation = 0;
    for (let mask = 0; mask < 1 << participants.length; mask++) {
        let probability = 1;
        const damage = participants.map((participant, index) => {
            const critical = !!(mask & 1 << index);
            probability *= critical ? participant.criticalRate : 1 - participant.criticalRate;
            return critical ? participant.critical : participant.nonCritical;
        });
        expectation += probability * weightedDamage(damage);
    }
    return {status: 'calibrated', nonCritical, allCritical, expectation,
        sourceCount: participants.length};
}
