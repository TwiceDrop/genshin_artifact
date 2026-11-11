import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// The page loads mona_wasm/pkg/index.js and the tests load beta-tools/runtime.mjs.
// Both must take their wrapping order from compose-kernel-api.mjs, so a test that passes
// through the Node entry also covers what the page runs.
const entries = {browser: 'mona_wasm/pkg/index.js', node: 'beta-tools/runtime.mjs'}
const wrappers = ['createFacade', 'createBeta2', 'createLimitedWeaponFacade', 'createStellarSupportFacade',
    'createStrengthenedFacade', 'createPreview7201Facade', 'createExpandedWeaponsFacade', 'withHybridTeamOptimization',
    'withLumineTraveler', 'withLunarDamageContexts', 'withDirectReactionScope', 'withInterfaceContracts',
    'withLegacyEnemyBridge', 'withLegacyEffectBridge']

for (const [name, file] of Object.entries(entries)) {
    test(`${name} entry builds its API through composeKernelApi only`, () => {
        const source = fs.readFileSync(file, 'utf8')
        assert.match(source, /import \{[^}]*composeKernelApi[^}]*\} from '[./]+beta-data\/compose-kernel-api\.mjs'/)
        assert.match(source, /composeKernelApi\(\{/)
        for (const wrapper of wrappers) assert.ok(!source.includes(wrapper), `${file} applies ${wrapper} itself`)
    })
}
