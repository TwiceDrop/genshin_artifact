// Displayed affixes from the reported rounding failure; no user identifiers.
// Set identity is synthetic, so this fixture can run against public characters.
export function roundingBuild(set_name='BlizzardStrayer') {
    const slots=['Flower','Feather','Sand','Goblet','Head']
    const mains=[['HPFixed',4780],['ATKFixed',311],['ElementalMastery',187],['ATKPercentage',.466],['CriticalDamage',.622]]
    const subs=[
        [['CriticalRate',.093],['ElementalMastery',40],['CriticalDamage',.194],['DEFFixed',21]],
        [['DEFFixed',21],['CriticalRate',.202],['Recharge',.045],['ATKPercentage',.047]],
        [['CriticalRate',.132],['CriticalDamage',.148],['DEFFixed',42],['HPFixed',239]],
        [['CriticalRate',.086],['DEFFixed',42],['CriticalDamage',.194],['HPFixed',269]],
        [['ElementalMastery',35],['CriticalRate',.066],['DEFPercentage',.073],['ATKPercentage',.146]],
    ]
    return slots.map((slot,i)=>({id:i+1,slot,set_name,star:5,level:20,main_stat:mains[i],sub_stats:subs[i]}))
}

export function latestRoundingBuild(set_name='BlizzardStrayer') {
    const build=roundingBuild(set_name)
    build[1].sub_stats=[['DEFFixed',39],['CriticalRate',.097],['CriticalDamage',.187],['Recharge',.052]]
    build[2].main_stat=['ATKPercentage',.466]
    build[2].sub_stats=[['ATKFixed',33],['CriticalDamage',.062],['ElementalMastery',63],['CriticalRate',.101]]
    return build
}
