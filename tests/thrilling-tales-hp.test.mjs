import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {api, original, sum} from '../beta-tools/runtime.mjs';
import {fixture, optimizer} from '../beta-tools/interface-audit-7108.mjs';

const near = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const weapon = (level = 90, refine = 5) => ({name: 'ThrillingTalesOfDragonSlayers', level, ascend: false, refine, params: 'NoConfig'});
const input = role => {
 const x = fixture(role);
 x.weapon = weapon();
 x.artifacts = [];
 x.skill.index = 8;
 if (role === 'Vodyanitsa') Object.assign(x.character.params.Vodyanitsa, {e_active: false, song_active: false, ordinary_mode: true});
 return x;
};

test('level 90 Thrilling Tales grants 35.2% HP in published and extension calculation paths', () => {
 for (const [engine, role] of [[original, 'Neuvillette'], [api, 'Neuvillette'], [api, 'Vodyanitsa']]) {
  const x = input(role);
  for (const [level, expected] of [[80, .321], [90, .352]]) for (const refine of [1, 5]) {
   const p = engine.CommonInterface.get_attribute({...x, weapon: weapon(level, refine)});
   near(p.hp['武器副词条'], p.hp['角色基础生命'] * expected);
   if (level === 90) near(p.atk['武器基础攻击'], 401);
  }
 }
});

test('corrected weapon HP reaches damage, DSL, optimization and stat gains in both paths', () => {
 for (const role of ['Neuvillette', 'Vodyanitsa']) {
  const x = input(role), baseline = {...x, weapon: weapon(80)};
  const before = api.CommonInterface.get_attribute(baseline), baseHP = before.hp['角色基础生命'];
  const expectedHP = sum(before.hp) + baseHP * (.352 - .321);
  near(sum(api.CommonInterface.get_attribute(x).hp), expectedHP);
  const oldHit = api.CalculatorInterface.get_damage_analysis(baseline, null);
  const hit = api.CalculatorInterface.get_damage_analysis(x, null);
  near(hit.normal.expectation, oldHit.normal.expectation * expectedHP / sum(before.hp));
  const source = `prop hp = ${role}.hp\nresult = hp`;
  const dsl = api.DSLInterface.run(source + '\nprint(result)', x, []);
  assert.equal(dsl.is_error, false, dsl.error_msg);
  near(Number(dsl.output.trim().replace(/^MONA: /, '')), expectedHP);

  // Synthetic candidates: 50% HP and 1000 flat HP versus another 10% HP on the sands.
  const gear = ['Flower', 'Feather', 'Sand', 'Goblet', 'Head'].map((slot, i) => ({id: i + 1, set_name: 'GladiatorsFinale', slot, level: 20, star: 5,
   main_stat: i === 0 ? ['HPFixed', 1000] : i === 1 ? ['ATKFixed', 100] : ['HPPercentage', i === 2 ? .1 : .2], sub_stats: []}));
  const alt = {...structuredClone(gear[2]), id: 6, main_stat: ['HPPercentage', .2]};
  const target = {name: 'MaxHP', params: 'NoConfig', use_dsl: false, dsl_source: ''};
  const y = {...x, artifacts: gear, target_function: target};
  const saved = structuredClone(y), pool = [...gear, alt];
  for (const useDsl of [false, true]) for (const algorithm of ['Naive', 'AStar']) {
   const best = api.OptimizeSingleWasm.optimize({...optimizer(y), algorithm, target_function: {...target, use_dsl: useDsl, dsl_source: source}}, pool)[0];
   assert.equal(best.sand, 6);
   near(best.value, expectedHP + baseHP * .6 + 1000);
  }
  const gain = api.BonusPerStat.bonus_per_stat({...y, tf: target, artifacts_config: null});
  near(gain.hp_percentage[0], baseHP * .058 / (expectedHP + baseHP * .5 + 1000));
  assert.deepEqual(y, saved);
 }
});

test('HP90 weapons retain 41.3% and the original release WASM remains unchanged', () => {
 for (const role of ['Neuvillette', 'Vodyanitsa']) {
  const x = input(role);
  x.weapon = {...weapon(), name: 'PrototypeAmber'};
  const p = api.CommonInterface.get_attribute(x);
  near(p.hp['武器副词条'], p.hp['角色基础生命'] * .413);
 }
 const bytes = readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm', import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'), 'fa42077784f9556dd312743bc1327bd475970c53146e4867191f3cad63005b90');
});
