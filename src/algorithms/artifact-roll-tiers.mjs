import { ROLLS } from './artifact-score/rules.mjs'

// Exact lower-rarity tiers from genshin-optimizer/libs/gi/stats/Data/Artifacts/artifact_sub.json.
// Keep five-star values shared with the optimizer. Round only after combining rolls.
export const tiersByStar = {
    1: {
        HPFixed: [23.9,29.88], ATKFixed: [1.56,1.95], DEFFixed: [1.85,2.31],
        HPPercentage: [.0117,.0146], ATKPercentage: [.0117,.0146], DEFPercentage: [.0146,.0182],
        CriticalRate: [.0078,.0097], CriticalDamage: [.0155,.0194], ElementalMastery: [4.66,5.83], Recharge: [.013,.0162],
    },
    2: {
        HPFixed: [50.19,60.95,71.7], ATKFixed: [3.27,3.97,4.67], DEFFixed: [3.89,4.72,5.56],
        HPPercentage: [.0163,.0198,.0233], ATKPercentage: [.0163,.0198,.0233], DEFPercentage: [.0204,.0248,.0291],
        CriticalRate: [.0109,.0132,.0155], CriticalDamage: [.0218,.0264,.0311], ElementalMastery: [6.53,7.93,9.33], Recharge: [.0181,.022,.0259],
    },
    3: {
        HPFixed: [100.38,114.72,129.06,143.4], ATKFixed: [6.54,7.47,8.4,9.34], DEFFixed: [7.78,8.89,10,11.11],
        HPPercentage: [.0245,.028,.0315,.035], ATKPercentage: [.0245,.028,.0315,.035], DEFPercentage: [.0306,.035,.0393,.0437],
        CriticalRate: [.0163,.0186,.021,.0233], CriticalDamage: [.0326,.0373,.042,.0466],
        ElementalMastery: [9.79,11.19,12.59,13.99], Recharge: [.0272,.0311,.035,.0389],
    },
    4: {
        HPFixed: [167.3,191.2,215.1,239], ATKFixed: [10.89,12.45,14,15.56], DEFFixed: [12.96,14.82,16.67,18.52],
        HPPercentage: [.0326,.0373,.042,.0466], ATKPercentage: [.0326,.0373,.042,.0466], DEFPercentage: [.0408,.0466,.0525,.0583],
        CriticalRate: [.0218,.0249,.028,.0311], CriticalDamage: [.0435,.0497,.056,.0622],
        ElementalMastery: [13.06,14.92,16.79,18.65], Recharge: [.0363,.0414,.0466,.0518],
    },
    5: ROLLS,
}
