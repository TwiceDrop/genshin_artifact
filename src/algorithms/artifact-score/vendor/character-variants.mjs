// Known roster aliases use miao-plugin ArtisMarkCfg's explicit default rule.
// Source: fbabcc0c0952c01212c8491b0af9ec3b252a4ba2; see docs/character-score-20261002.md.
const manekinaWeight = Object.freeze({ atk: 75, cpct: 100, cdmg: 100, dmg: 100, phy: 100 })
export const usefulAttr = Object.fromEntries(['奇偶·风', '奇偶·冰', '奇偶·草', '奇偶·雷', '奇偶·岩', '奇偶·水', '奇偶·火']
    .map(name => [name, manekinaWeight]))
