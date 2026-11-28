import { INEFFA_DEFAULT_SOURCE } from '../../../beta-data/direct-reaction-scope.mjs'
import { cryoDefaultSource } from '../../../beta-data/lumine-traveler-facade.mjs'
import { mityaDefaultSource } from '../../../beta-data/preview-7201-facade.mjs'
import { MIZUKI_STELLAR_TARGET, mizukiStellarTarget } from '../../../beta-data/strengthened-facade.mjs'
import { skillRows } from '@/algorithms/dsl-generator.mjs'

const rustSources = require.context('../../../mona_core/src/target_functions/target_functions', true, /\/(?!mod\.rs$)[^/]+\.rs$/)
const rustPathByName = new Map(rustSources.keys().map(path => [
    path.slice(path.lastIndexOf('/') + 1, -3).replaceAll('_', '').toLowerCase(),
    path,
]))

const verifiedSegments = {
    AloyDefault: [['Normal11', 'normal']],
    AmberDefault: [['Charged2', 'normal']],
    ClorindeDefault: [['E11', 'normal']],
    DionaDefault: [['QHeal', 'normal']],
    FurinaDefault: [['E2', 'normal']],
    GamingDefault: [['E1', 'normal']],
    IneffaDefault: [['VilkitaDischarge', 'normal'], ['TalentOverclocking', 'direct_moonelectro']],
    KamisatoAyatoDefault: [['ENormal1', 'normal']],
    KujouSaraDamage: [['Q1', 'normal']],
    LinneaDefault: [['EMega', 'direct_mooncrystallize']],
    LisaDefault: [['E1', 'normal']],
    MityaDefault: [['GradientStellar', 'direct_stellarconduct']],
    NeuvilletteDefault: [['Charged2', 'normal']],
    NingguangDefault: [['Charged1', 'normal']],
    NoelleDefault: [['Normal1', 'normal']],
    OroronDefault: [['Passive1', 'normal']],
    RazorDefault: [['Normal1', 'normal']],
    SandroneDefault: [['ChargedRayStellar', 'direct_stellarconduct']],
    SangonomiyaKokomiDefault: [['Normal1', 'normal']],
    SethosDefault: [['Charged3', 'normal']],
    ValeriyDefault: [['Mortar', 'normal']],
    YelanDefault: [['Q2', 'normal']],
    [MIZUKI_STELLAR_TARGET]: [['TalentStellarSwirl', 'direct_stellarswirl']],
}

const defaults = config => Object.fromEntries(config.map(({ name, default: value }) => [name, value]))

function adaptedSource(target, role) {
    switch (target.name) {
        case 'IneffaDefault': return INEFFA_DEFAULT_SOURCE
        case 'MityaDefault': return mityaDefaultSource(defaults(role.config).core_mode)
        case 'LumineCryoDefault': return cryoDefaultSource({ name: role.name, params: { [role.name]: defaults(role.config) } })
        case MIZUKI_STELLAR_TARGET: return mizukiStellarTarget({ name: target.name,
            params: { [target.name]: defaults(target.config) } }, { name: role.name }).dsl_source
        default: return ''
    }
}

export function defaultTargetPreview(target, role, skillNames) {
    const segments = verifiedSegments[target.name]
    const skills = segments ? skillRows(role, skillNames) : []
    const hits = segments?.map(([token, reaction]) => ({
        text: skills.find(skill => skill.token === token).text,
        reaction,
        count: 1,
    }))
    const source = adaptedSource(target, role)
    if (source) return { hits, source, language: 'MONA-DSL' }

    // VodyanitsaMaxHP is dispatched to MaxHP by the calculation interface.
    const name = target.name === 'VodyanitsaMaxHP' ? 'MaxHP' : target.name
    const path = rustPathByName.get(name.toLowerCase())
    return { hits, source: path ? rustSources(path) : '', language: 'Rust' }
}
