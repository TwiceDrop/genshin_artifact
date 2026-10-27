import fs from 'node:fs'
import {createRequire} from 'node:module'
import {bindings} from '../mona_wasm/pkg/bindings.js'
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js'
import * as extension from '../mona_wasm/extension/mona_extension.js'
import {createStellarSupportFacade} from '../beta-data/stellar-support-facade.mjs'
import {compareTheoreticalSetParity} from '../beta-data/theoretical-set-parity.mjs'

globalThis.module = {require: createRequire(import.meta.url)}
const file = path => new URL('../' + path, import.meta.url)
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file('mona_wasm/pkg/mona_wasm_bg.wasm'))),
    {'./mona_wasm_bg.js': bridge}).exports)
extension.initSync(fs.readFileSync(file('mona_wasm/extension/mona_extension_bg.wasm')))
const original = {CalculatorInterface: bindings.K2, CommonInterface: bindings.Ps}
const published = createStellarSupportFacade(original, original).facade
const mizuki = JSON.parse(fs.readFileSync(file('beta-data/mizuki-fixture.json'), 'utf8')).input
mizuki.skill = {index: 14, config: 'NoConfig'}
mizuki.weapon = {name: 'TheWidsith', level: 90, ascend: false, refine: 1,
    params: {TheWidsith: {t1_rate: 0, t2_rate: 0, t3_rate: 0}}}
mizuki.artifacts = []
mizuki.buffs = []
const sandrone = {
    character: {name: 'Sandrone', level: 90, ascend: false, constellation: 6,
        skill1: 9, skill2: 9, skill3: 9, params: {Sandrone: {stellar_base_active: true,
            em_conversion_active: true, c1_team_stellar: true, c6_elevate_active: true}}},
    weapon: {name: 'WasterGreatsword', level: 1, ascend: false, refine: 1, params: 'NoConfig'},
    skill: {index: 18, config: {Sandrone: {c2_ray_stacks: 0, prism_overcharge: false,
        burst_tactics_stacks: 0, stellarconduct_hits: 0}}},
    artifacts: [], buffs: [], enemy: null, artifact_config: null,
}
// WASM's panic hook prints a full stack even though the comparator captures
// the error; keep this diagnostic's output focused on the parity findings.
const writeError = console.error
let parity
try {
    console.error = () => {}
    parity = compareTheoreticalSetParity(published, extension, [
        {name: 'Mizuki talent direct Stellar Swirl', input: mizuki, field: 'direct_stellarswirl'},
        {name: 'Sandrone charged ray direct Stellar Swirl', input: sandrone, field: 'direct_stellarswirl'},
    ])
} finally { console.error = writeError }
console.log(JSON.stringify(parity, null, 2))
if (!parity.equal) process.exitCode = 1
