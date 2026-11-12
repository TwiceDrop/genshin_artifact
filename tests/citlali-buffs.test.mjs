import test from 'node:test';
import assert from 'node:assert/strict';
import {api, named, sum} from '../beta-tools/runtime.mjs';
import {fixture, optimizer} from '../beta-tools/interface-audit-7108.mjs';
import {EXTENSION_BUFF_REGISTRY} from '../beta-data/extension-buffs.mjs';

const talent = (has_c2 = true, rate = 1) => named('CitlaliTalent1', {has_c2, rate});
const near = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const meltMultiplier = em => 1.5 * (1 + 25 * em / (9 * (em + 1400)));
const mastery = input => {
 const panel = api.CommonInterface.get_attribute(input);
 assert.ok(panel.elemental_mastery);
 return sum(panel.elemental_mastery);
};

const recipient = {
 character: {name: 'Kaeya', level: 90, ascend: false, constellation: 0, skill1: 9, skill2: 9, skill3: 9, params: 'NoConfig'},
 weapon: {name: 'DullBlade', level: 90, ascend: false, refine: 1, params: 'NoConfig'},
 skill: {index: 0, config: 'NoConfig'},
 artifacts: [], artifact_config: null, enemy: null, buffs: [],
};

test('Citlali Talent 1 C2 grants teammates 250 elemental mastery', () => {
 assert.equal(mastery({...recipient, buffs: [talent()]}) - mastery(recipient), 250);
});

test('C2 mastery follows coverage, disabling and same-source deduplication in both kernels', () => {
 for (const role of ['Kaeya', 'Vodyanitsa']) {
  const input = fixture(role), before = mastery(input);
  for (const [buffs, expected] of [
   [[talent(false)], 0], [[talent()], 250], [[talent(true, .5)], 125], [[talent(true, 0)], 0],
   [[{...talent(), lock: true}], 0], [[named('CitlaliTalent1', {has_c2: true, rate: 1, active: false})], 0],
   [[talent(), talent()], 250],
  ]) near(mastery({...input, buffs}) - before, expected);
 }
});

test('C2 retains Pyro/Hydro resistance reduction and only grants mastery to other characters', () => {
 for (const [hasC2, rate, expectedEM, expectedRes] of [[false, 1, 0, .2], [true, 1, 250, .4], [true, .5, 125, .2], [true, 0, 0, 0]]) {
  const [compiled] = EXTENSION_BUFF_REGISTRY.compile(talent(hasC2, rate), recipient);
  const values = compiled.config.ExtensionEffect.values;
  near(values.ElementalMastery ?? 0, expectedEM);
  near(values.ResMinusPyro, expectedRes);
  near(values.ResMinusHydro, expectedRes);
 }
 const self = fixture('Citlali'), before = mastery(self);
 self.character.constellation = 2;
 near(mastery(self) - before, 125);
 near(mastery({...self, buffs: [talent()]}) - mastery(self), 0);
 const [compiled] = EXTENSION_BUFF_REGISTRY.compile(talent(), self);
 assert.equal(compiled.config.ExtensionEffect.values.ElementalMastery, undefined);
 near(compiled.config.ExtensionEffect.values.ResMinusPyro, .4);
 near(compiled.config.ExtensionEffect.values.ResMinusHydro, .4);
});

test('C2 melt damage, DSL, optimization and stat gains include mastery without a manual buff', () => {
 const input = fixture('Kaeya');
 input.skill.index = 10;
 input.buffs = [talent()];
 const source = 'dmg hit = Kaeya.E1\nresult = hit.melt.e';
 input.target_function = {...input.target_function, use_dsl: true, dsl_source: source};
 const saved = structuredClone(input);
 const without = {...input, buffs: []};
 const hit = row => api.CalculatorInterface.get_damage_analysis(row, null);
 const base = hit(without), result = hit(input);
 const em = mastery(without) + 250;
 // Cryo-on-Pyro melt: independent expected reaction multiplier; this BUFF does not reduce Cryo RES.
 const expected = base.normal.expectation * meltMultiplier(em);
 near(sum(result.em), em);
 near(result.normal.expectation, base.normal.expectation);
 near(result.melt.expectation, expected);
 const manual = {...without, buffs: [named('ElementalMastery', {value: 250})]};
 near(hit(manual).melt.expectation, expected);
 const dsl = api.DSLInterface.run(source + '\nprint(result)', input, input.artifacts);
 assert.equal(dsl.is_error, false, dsl.error_msg);
 near(Number(dsl.output.trim().replace(/^MONA: /, '')), expected);
 const alt = {...structuredClone(input.artifacts[2]), id: 6, main_stat: ['ElementalMastery', 187]};
 const pool = [...input.artifacts, alt];
 const choices = [input, {...input, artifacts: input.artifacts.map(a => a.slot === 'Sand' ? alt : a)}].map(row => {
  const plain = hit({...row, buffs: []}), totalEM = mastery({...row, buffs: []}) + 250;
  return {sand: row.artifacts[2].id, value: plain.normal.expectation * meltMultiplier(totalEM)};
 }).sort((a, b) => b.value - a.value);
 for (const algorithm of ['Naive', 'AStar']) {
  const best = api.OptimizeSingleWasm.optimize({...optimizer(input), algorithm}, pool)[0];
  assert.equal(best.sand, choices[0].sand);
  near(best.value, choices[0].value);
 }
 const gain = api.BonusPerStat.bonus_per_stat({...input, tf: input.target_function, artifacts_config: null});
 near(gain.elemental_mastery[0], meltMultiplier(em + 23) / meltMultiplier(em) - 1);
 assert.deepEqual(input, saved);
});
