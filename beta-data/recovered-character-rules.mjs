// Recovered from the published kernel, with the same source-panel ownership.
// See docs/recovered-character-rules.md for functions, tables and trigger scope.
const IANSAN_ATK_CAP = Object.freeze([330,370,410,450,490,530,570,610,650,690,730,770,810,850,890]);
const NICOLE_ATK_RATIO = Object.freeze([.0825,.09,.0975,.105,.1125,.12,.1275,.135,.1425,.15,.159,.168,.177,.186,.195]);
const NICOLE_ATK_CAP = Object.freeze([330,360,390,420,450,480,510,540,570,600,636,672,708,744,780]);
const numeric = (p,key,fallback,min,max,integer=false) => {
    const value = p[key] === undefined ? fallback : p[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        throw Error('BUFF 参数无效：' + key);
    }
    return value;
};
const flag = (p,key,fallback=false) => {
    const value = p[key] === undefined ? fallback : p[key];
    if (typeof value !== 'boolean') throw Error('BUFF 开关无效：' + key);
    return value;
};
const recipientOnField = (p,input) => {
    const name = input?.character?.name;
    const candidates = [p.recipient_on_field, input?.team_effects?.recipient_on_field,
        input?.team_effects?.on_field, input?.character?.params?.[name]?.on_field];
    for (const value of candidates) {
        if (value === undefined) continue;
        if (typeof value !== 'boolean') throw Error('BUFF 受益者前后台参数无效');
        return value;
    }
    // As with other manual BUFFs, inclusion confirms eligibility unless explicit.
    return true;
};

export const RECOVERED_CHARACTER_RULES = Object.freeze({
    IansanTalent2: (p,input) => {
        const nightsoul = numeric(p,'nightsoul',42,0,42);
        const atk = numeric(p,'atk',2000,0,5000);
        const level = numeric(p,'skill_level',10,1,15,true);
        const offFieldBuff = flag(p,'off_field_buff');
        const trainingBuff = flag(p,'training_buff');
        if (!recipientOnField(p,input)) return {};
        const ratio = nightsoul < 42 ? nightsoul * .005 : .27;
        return {
            ATKFixed: Math.min(atk * ratio, IANSAN_ATK_CAP[level - 1]),
            ...(offFieldBuff ? {ATKPercentage: .3} : {}),
            ...(trainingBuff ? {BonusBase: .25} : {}),
        };
    },
    NicoleE: p => {
        const atk = numeric(p,'nicole_atk',4000,0,4000);
        const level = numeric(p,'e_level',10,1,15,true);
        const ascended = flag(p,'ascended',true);
        const c2 = flag(p,'c2');
        return {ATKFixed: Math.min(atk * NICOLE_ATK_RATIO[level - 1], NICOLE_ATK_CAP[level - 1])
            + (ascended ? 300 : 0) + (c2 ? 300 : 0)};
    },
});
