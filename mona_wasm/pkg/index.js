import * as bridge from './mona_wasm_bg.js';
import { bindings } from './bindings.js';
import initExtension, * as extension from '../extension/mona_extension.js';
import { createBeta2 } from '../../beta-data/vesna-facade.mjs';
import { createFacade } from '../../beta-data/facade.mjs';
import { createLimitedWeaponFacade } from '../../beta-data/limited-weapon-facade.mjs';
import { createStrengthenedFacade } from '../../beta-data/strengthened-facade.mjs';
import { createStellarSupportFacade } from '../../beta-data/stellar-support-facade.mjs';
import weaponData from '../../beta-data/weapons-release-71.json';
import data from '../../beta-data/vodyanitsa.json';
import support from '../../beta-data/extension-support.json';
import characters from '../../src/assets/_gen_character.js';
const response = await fetch(new URL('./mona_wasm_bg.wasm?raw-wasm', import.meta.url));
if (!response.ok) throw new Error('Mona calculation core could not be loaded');
const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), { './mona_wasm_bg.js': bridge });
bindings.lI(instance.exports);
const extensionResponse = await fetch(new URL('../extension/mona_extension_bg.wasm?raw-wasm', import.meta.url));
if (!extensionResponse.ok) throw new Error('7.1.02 计算内核加载失败');
await initExtension(await extensionResponse.arrayBuffer());
const originalApi = {BonusPerStat:bindings.bd,CalcArtifactBestSet:bindings.uC,CalculatorInterface:bindings.K2,
CommonInterface:bindings.Ps,DSLInterface:bindings.ZB,OptimizeSingleWasm:bindings.E2,PotentialInterface:bindings.gF,
TeamOptimizationWasm:bindings.B8,TransformativeDamage:bindings.PX};
const baseApi = createFacade(originalApi,extension,data,support,characters);
const stellar = createStellarSupportFacade(createLimitedWeaponFacade(createBeta2(baseApi,extension,support),originalApi,weaponData),originalApi);
const api = createStrengthenedFacade(stellar.facade,stellar.transformStellarTarget);
export const {BonusPerStat,CalcArtifactBestSet,CalculatorInterface,CommonInterface,DSLInterface,OptimizeSingleWasm,PotentialInterface,TeamOptimizationWasm,TransformativeDamage}=api;
