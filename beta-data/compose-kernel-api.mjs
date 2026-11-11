// The one place that wraps the three kernels in the adapter layers.
// The browser entry (mona_wasm/pkg/index.js) and the Node entry (beta-tools/runtime-7106.mjs)
// only load the kernels and data, then call composeKernelApi; change wrapping order here only.
import {withLegacyEnemyBridge} from './enemy-interface.mjs';
import {withLegacyEffectBridge} from './legacy-effect-bridge.mjs';
import {createFacade} from './facade.mjs';
import {createBeta2} from './vesna-facade.mjs';
import {createLimitedWeaponFacade} from './limited-weapon-facade.mjs';
import {createStellarSupportFacade} from './stellar-support-facade.mjs';
import {createStrengthenedFacade} from './strengthened-facade.mjs';
import {createPreview7201Facade} from './preview-7201-facade.mjs';
import {createExpandedWeaponsFacade} from './expanded-weapons.mjs';
import {withHybridTeamOptimization} from './hybrid-team-optimizer.mjs';
import {withLumineTraveler} from './lumine-traveler-facade.mjs';
import {withLunarDamageContexts} from './lunar-context-facade.mjs';
import {withDirectReactionScope} from './direct-reaction-scope.mjs';
import {withInterfaceContracts} from './interface-contracts.mjs';

export function originalApiFromBindings(bindings) {
    return {BonusPerStat:bindings.bd,CalcArtifactBestSet:bindings.uC,CalculatorInterface:bindings.K2,
        CommonInterface:bindings.Ps,DSLInterface:bindings.ZB,OptimizeSingleWasm:bindings.E2,PotentialInterface:bindings.gF,
        TeamOptimizationWasm:bindings.B8,TransformativeDamage:bindings.PX};
}

// core: exports of the effect-bridge kernel instance; extension: the initialised extension kernel module.
export function composeKernelApi({rawOriginal, core, extension, data}) {
    const original = withLegacyEffectBridge(withLegacyEnemyBridge(rawOriginal, core), core);
    const base = createFacade(original, extension, data.vodyanitsa, data.support, data.characters);
    const stellar = createStellarSupportFacade(createLimitedWeaponFacade(createBeta2(base, extension, data.support), original, data.weapons, data.signatureWeapons), original);
    const strengthened = createStrengthenedFacade(stellar.facade, stellar.transformStellarTarget);
    const api = withInterfaceContracts(withDirectReactionScope(withLunarDamageContexts(withLumineTraveler(withHybridTeamOptimization(
        createExpandedWeaponsFacade(createPreview7201Facade(strengthened, extension), original, extension))))));
    return {api, original};
}
