/* tslint:disable */
/* eslint-disable */
/**
*/
export class BonusPerStat {
  free(): void;
/**
* @param {any} val
* @returns {any}
*/
  static bonus_per_stat(val: any): any;
}
/**
*/
export class CalcArtifactBestSet {
  free(): void;
/**
* @param {any} args
* @returns {any}
*/
  static calc_artifact_best_set(args: any): any;
}
/**
*/
export class CalculatorInterface {
  free(): void;
/**
* @param {any} value
* @param {any} fumo
* @returns {any}
*/
  static get_damage_analysis(value: any, fumo: any): any;
/**
* @param {any} value
* @returns {TransformativeDamage}
*/
  static get_transformative_damage(value: any): TransformativeDamage;
}
/**
*/
export class CommonInterface {
  free(): void;
/**
* @param {any} val
* @returns {any}
*/
  static get_attribute(val: any): any;
/**
* @param {any} character
* @param {any} weapon
* @param {any} tf
* @param {any} artifacts
* @returns {any}
*/
  static get_artifacts_rank_by_character(character: any, weapon: any, tf: any, artifacts: any): any;
}
/**
*/
export class DSLInterface {
  free(): void;
/**
* @param {string} source
* @param {any} damage_env
* @param {any} artifacts
* @returns {any}
*/
  static run(source: string, damage_env: any, artifacts: any): any;
}
/**
*/
export class OptimizeSingleWasm {
  free(): void;
/**
* @param {any} val
* @param {any} artifacts
* @returns {any}
*/
  static optimize(val: any, artifacts: any): any;
}
/**
*/
export class PotentialInterface {
  free(): void;
/**
* @param {any} artifacts
* @param {any} pf_interface
* @returns {any}
*/
  static get_potential(artifacts: any, pf_interface: any): any;
}
/**
*/
export class TeamOptimizationWasm {
  free(): void;
/**
* @param {any} val
* @param {any} artifacts
* @returns {any}
*/
  static optimize_team2(val: any, artifacts: any): any;
}
/**
*/
export class TransformativeDamage {
  free(): void;
/**
*/
  bloom: number;
/**
*/
  burgeon: number;
/**
*/
  burning: number;
/**
*/
  crystallize: number;
/**
*/
  electro_charged: number;
/**
*/
  hyperbloom: number;
/**
*/
  overload: number;
/**
*/
  shatter: number;
/**
*/
  superconduct: number;
/**
*/
  swirl_cryo: number;
/**
*/
  swirl_electro: number;
/**
*/
  swirl_hydro: number;
/**
*/
  swirl_pyro: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly dslinterface_run: (a: number, b: number, c: number, d: number) => number;
  readonly __wbg_dslinterface_free: (a: number) => void;
  readonly calculatorinterface_get_damage_analysis: (a: number, b: number) => number;
  readonly calculatorinterface_get_transformative_damage: (a: number) => number;
  readonly __wbg_calculatorinterface_free: (a: number) => void;
  readonly commoninterface_get_attribute: (a: number) => number;
  readonly commoninterface_get_artifacts_rank_by_character: (a: number, b: number, c: number, d: number) => number;
  readonly bonusperstat_bonus_per_stat: (a: number) => number;
  readonly calcartifactbestset_calc_artifact_best_set: (a: number) => number;
  readonly __wbg_commoninterface_free: (a: number) => void;
  readonly __wbg_bonusperstat_free: (a: number) => void;
  readonly __wbg_calcartifactbestset_free: (a: number) => void;
  readonly optimizesinglewasm_optimize: (a: number, b: number) => number;
  readonly teamoptimizationwasm_optimize_team2: (a: number, b: number) => number;
  readonly potentialinterface_get_potential: (a: number, b: number) => number;
  readonly __wbg_optimizesinglewasm_free: (a: number) => void;
  readonly __wbg_teamoptimizationwasm_free: (a: number) => void;
  readonly __wbg_potentialinterface_free: (a: number) => void;
  readonly __wbg_transformativedamage_free: (a: number) => void;
  readonly __wbg_get_transformativedamage_swirl_cryo: (a: number) => number;
  readonly __wbg_set_transformativedamage_swirl_cryo: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_swirl_hydro: (a: number) => number;
  readonly __wbg_set_transformativedamage_swirl_hydro: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_swirl_pyro: (a: number) => number;
  readonly __wbg_set_transformativedamage_swirl_pyro: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_swirl_electro: (a: number) => number;
  readonly __wbg_set_transformativedamage_swirl_electro: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_overload: (a: number) => number;
  readonly __wbg_set_transformativedamage_overload: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_electro_charged: (a: number) => number;
  readonly __wbg_set_transformativedamage_electro_charged: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_shatter: (a: number) => number;
  readonly __wbg_set_transformativedamage_shatter: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_superconduct: (a: number) => number;
  readonly __wbg_set_transformativedamage_superconduct: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_bloom: (a: number) => number;
  readonly __wbg_set_transformativedamage_bloom: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_hyperbloom: (a: number) => number;
  readonly __wbg_set_transformativedamage_hyperbloom: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_burgeon: (a: number) => number;
  readonly __wbg_set_transformativedamage_burgeon: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_burning: (a: number) => number;
  readonly __wbg_set_transformativedamage_burning: (a: number, b: number) => void;
  readonly __wbg_get_transformativedamage_crystallize: (a: number) => number;
  readonly __wbg_set_transformativedamage_crystallize: (a: number, b: number) => void;
  readonly __wbindgen_export_0: (a: number, b: number) => number;
  readonly __wbindgen_export_1: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_3: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
