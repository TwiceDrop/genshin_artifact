import characters from '../assets/_gen_character.js'
import buffs from '../assets/_gen_buff.js'
import {MOONLIGHT_SETS, prepareLunarEquipmentBuffs} from '../../beta-data/lunar-equipment-rules.mjs'

const nightsoul = new Set([
    'Kachina', 'Mualani', 'Kinich', 'Xilonen', 'Chasca', 'Ororon', 'Citlali', 'Mavuika',
    'Iansan', 'Varesa', 'Ifa', 'AetherPyro', 'LuminePyro',
])
const hexerei = new Set([
    'Albedo', 'Durin', 'Fischl', 'Klee', 'Lohen', 'Mona', 'Nicole', 'Prune',
    'Razor', 'Sucrose', 'Varka', 'Venti',
])
const moonsign = new Set([
    'Aino', 'Columbina', 'Flins', 'Illuga', 'Ineffa', 'Jahoda', 'Lauma', 'Linnea', 'Nefer', 'Zibai',
])
const aubadeWearers = new Set(['Columbina', 'Ineffa', 'Linnea'])
const plungeWearers = new Set(['Varesa', 'Xiao', 'Gaming', 'Xianyun'])
const troupeWearers = new Set(['Fischl', 'Furina', 'YaeMiko'])
const whimsyWearers = new Set(['Arlecchino', 'Clorinde'])
const huskWearers = new Set([
    'Albedo', 'AratakiItto', 'Chiori', 'Gorou', 'Illuga', 'Kachina',
    'Linnea', 'Noelle', 'Xilonen', 'Yunjin', 'Zibai',
])
// Native character BUFF IDs begin with the owner ID. The two generic Traveler
// passives have no source element unless the caller supplies a specific owner.
const characterIds = Object.keys(characters).sort((a, b) => b.length - a.length)
const buffOwners = new Map(Object.values(buffs).filter(buff => buff.genre === 'Character')
    .map(buff => [buff.name, characterIds.find(id => buff.name.startsWith(id))]))
const fieldElements = ['None', 'Electro', 'Pyro', 'Cryo', 'Dendro', 'Geo', 'Anemo', 'Hydro']

function moonlightConfigs(level, buffs) {
    // An explicitly configured teammate set already owns the shared bonus.
    // Use the kernel's own preparation to cover both raw and compiled BUFFs.
    const teammateSets = prepareLunarEquipmentBuffs(buffs.filter(buff =>
        MOONLIGHT_SETS.includes(buff.name === 'ExtensionEffect' ? buff.source_buff : buff.name)))
    const shared = teammateSets.some(buff => {
        const values = buff.config.ExtensionEffect.values
        return values.EnhanceMoonReaction > 0 || values.ElementalMastery > 0
    })
    const sharedSerenade = shared && teammateSets.some(buff => buff.source_buff === 'SpinMoonSerenade')
    const bonus = Number(level > 0 && !shared)
    return {
        config_realm_mirror_night: {moon_state: level, moon_reaction_bonus: bonus},
        config_spin_moon_serenade: {moon_state: sharedSerenade ? 0 : level, moon_reaction_bonus: bonus},
    }
}

export function singleSearchArtifactConfig(manual, character, activeBuffs, linkedSources = []) {
    const element = characters[character].element
    const owners = new Map(linkedSources.map(source => [source.sourceId, source.characterName]))
    const sourceCharacters = new Set(activeBuffs.map(buff =>
        owners.get(buff.source_id) ?? buff.source_character ?? buffOwners.get(buff.source_buff ?? buff.name)))
    const sourceElements = new Set([...sourceCharacters].map(name => characters[name]?.element))
    const teammateElements = [...sourceCharacters]
        .filter(name => name !== character && characters[name]?.element)
        .map(name => characters[name].element)
    const sameElementCount = teammateElements.filter(teammate => teammate === element).length
    const differentElementCount = teammateElements.length - sameElementCount
    const party = new Set([character, ...sourceCharacters])
    const partyElements = new Set([element, ...sourceElements])
    const moonLevel = Math.min(2, [...party].filter(name => moonsign.has(name)).length)
    const night = Number(nightsoul.has(character))
    const magic = hexerei.has(character)
    const superconduct = (element === 'Electro' && sourceElements.has('Cryo'))
        || (element === 'Cryo' && sourceElements.has('Electro'))
    const hunterActive = character === 'Neuvillette' || character === 'Wriothesley' || sourceCharacters.has('Furina')
    const naviaCoverage = Number(character === 'Navia')

    return {
        ...manual,
        config_crimson_witch_of_flames: {level: 1.5},
        config_thundersoother: {rate: Number(partyElements.has('Electro'))},
        config_lavawalker: {rate: Number(partyElements.has('Pyro'))},
        config_noblesse_oblige: {rate: 1},
        ...(element === 'Geo' && {config_archaic_petra: {...manual.config_archaic_petra, rate: 1}}),
        ...(character === 'KamisatoAyaka' && {config_blizzard_strayer: {critical_bonus: 0.4}}),
        config_heart_of_depth: {rate: 1},
        config_tenacity_of_the_millelith: {rate: 1},
        ...(character === 'Eula' && {config_pale_flame: {avg_level: 2, full_rate: 1}}),
        ...(character === 'Yoimiya' && {config_shimenawas_reminiscence: {rate: 1}}),
        ...(huskWearers.has(character) && {config_husk_of_opulent_dreams: {level: 4}}),
        ...(character === 'Xiao' && {config_vermillion_hereafter: {rate_q: 1, stack: 4}}),
        config_deepwood_memories: {rate: Number(element === 'Dendro')},
        config_gilded_dreams: {
            same_count: Math.min(3, sameElementCount), diff_count: Math.min(3, differentElementCount),
            rate: Number(teammateElements.length > 0),
        },
        config_marechaussee_hunter: {stack: hunterActive ? 3 : 0},
        config_golden_troupe: {rate: Number(troupeWearers.has(character))},
        config_nighttime_whispers_in_the_echoing_woods: {rate1: naviaCoverage, rate2: naviaCoverage},
        config_fragment_of_harmonic_whimsy: {level: whimsyWearers.has(character) ? 3 : 0},
        config_unfinished_reverie: {rate: Number(partyElements.has('Pyro') && partyElements.has('Dendro'))},
        ...(plungeWearers.has(character) && {config_long_nights_oath: {level: 5}}),
        ...(character === 'Skirk' && {config_finale_of_the_deep_galleries: {rate1: 1, rate2: 1}}),
        ...moonlightConfigs(moonLevel, activeBuffs),
        config_aubade_of_morningstar_and_moon: {rate: Number(aubadeWearers.has(character)), is_ascendant_gleam: moonLevel === 2},
        config_a_day_carved_from_rising_winds: {rate: Number(magic), is_completed_witch_homework: magic},
        config_obsidian_codex: {set2_rate: night, set4_rate: night},
        config_heavens_gift: {rate: Number(magic), is_completed_witch_homework: magic,
            is_secret_arts: magic, on_field_element: magic ? fieldElements.indexOf(element) : 0},
        config_disenchantment_in_deep_shadow: {rate: Number(superconduct)},
        config_scarlet_proof: {rate: Number(element === 'Anemo' && sourceElements.has('Cryo'))},
        config_heart_of_the_furnace: {rate: 1},
    }
}
