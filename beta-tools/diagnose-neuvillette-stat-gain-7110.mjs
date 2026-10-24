import fs from 'node:fs';
import assert from 'node:assert/strict';
import {api, sum} from './runtime-7106.mjs';
import {fixture, weapon} from './interface-audit-7108.mjs';
import {computeCurve, createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';

// Synthetic input only. Match the three visible panel values, not an account build.
const x = fixture('Neuvillette', 'NeuvilletteDefault');
x.skill.index = 4;
x.weapon = weapon('TomeOfTheEternalFlow');
x.artifacts.forEach(a => { a.set_name = 'MarechausseeHunter'; a.sub_stats = []; });
x.artifacts[2].main_stat = ['HPPercentage', .466];
x.artifacts[3].main_stat = ['HydroBonus', .466];
x.artifacts[4].main_stat = ['CriticalDamage', .622];
x.artifact_config = {config_marechaussee_hunter: {stack: 3}};
const initialPanel = api.CommonInterface.get_attribute(x);
x.artifacts[0].sub_stats = [
  ['HPPercentage', (35613.375 - sum(initialPanel.hp)) / 14695],
  ['CriticalRate', 1.006 - sum(initialPanel.critical)],
  ['CriticalDamage', 3.227 - sum(initialPanel.critical_damage)],
];
x.artifacts[1].sub_stats = [['ATKFixed', 1075 - sum(initialPanel.atk)]];
x.artifacts[3].sub_stats = [['DEFFixed', 674.02 - sum(initialPanel.def)]];
const stats = ['CriticalRate', 'CriticalDamage', 'HPPercentage'];
const old = api.BonusPerStat.bonus_per_stat({...x, tf: x.target_function, artifacts_config: x.artifact_config});
const max = createDamageEvaluator(api, x, 'normal', null, stats, 'max');
const baseline = max.evaluate({});
const panel = max.panel({});
const keys = {CriticalRate:'critical_rate', CriticalDamage:'critical_damage', HPPercentage:'hp_percentage'};
const directFive = Object.fromEntries(stats.map(key => [key, max.evaluate({[key]:5}) / baseline - 1]));
const ordinaryFive = Object.fromEntries(stats.map(key => [key, old[keys[key]][4] ?? 0]));
for (const key of stats) assert.ok(Math.abs(directFive[key] - ordinaryFive[key]) < 1e-9, `${key}: old/direct mismatch`);
assert.ok(Math.abs(directFive.CriticalRate) < 1e-12);
const average = createDamageEvaluator(api, x, 'normal', null, stats, 'average');
const resultAverage = computeCurve(average.evaluate, {stats, tier:'average', maxRolls:20});
const resultMax = computeCurve(max.evaluate, {stats, tier:'max', maxRolls:20});
assert.ok(resultAverage.points[20].allocation.HPPercentage > 0);
assert.ok(resultMax.points[20].allocation.HPPercentage > 0);

const fixedHpInput = structuredClone(x);
fixedHpInput.character.constellation = 2;
const fixedHpStats = ['CriticalRate', 'CriticalDamage', 'HPFixed'];
const fixedHpEval = createDamageEvaluator(api, fixedHpInput, 'normal', null, fixedHpStats, 'average');
const fixedHpResult = computeCurve(fixedHpEval.evaluate, {stats:fixedHpStats, tier:'average', maxRolls:20});
assert.equal(fixedHpResult.points[20].allocation.CriticalDamage, 20);
assert.ok(Math.abs(fixedHpEval.panel(fixedHpResult.points[20].allocation).critical_damage - 4.547) < 1e-12);

// The three selected options confirmed by the user during this investigation.
const uiStats = stats;
const uiEval = createDamageEvaluator(api, x, 'normal', null, uiStats, 'average');
const uiResult = computeCurve(uiEval.evaluate, {stats:uiStats, tier:'average', maxRolls:20});
assert.equal(uiResult.points[20].allocation.HPPercentage, resultAverage.points[20].allocation.HPPercentage);
assert.equal(uiResult.points[20].allocation.CriticalDamage, resultAverage.points[20].allocation.CriticalDamage);
const c2 = structuredClone(x);
c2.character.constellation = 2;
const c2Eval = createDamageEvaluator(api, c2, 'normal', null, uiStats, 'average');
const c2Result = computeCurve(c2Eval.evaluate, {stats:uiStats, tier:'average', maxRolls:20});
const c2Old = api.BonusPerStat.bonus_per_stat({...c2, tf:c2.target_function, artifacts_config:c2.artifact_config});
assert.equal(c2Result.points[20].allocation.HPPercentage, 20);
assert.ok(Math.abs(c2Old.critical_damage[4] - .39 / (1 + 3.227 + .42)) < 1e-9);

// Exercise the per-point panel call made by stat_gain.worker.js as well.
const workerEval = createDamageEvaluator(api, c2, 'normal', 'None', uiStats, 'average');
const workerPoints = [];
const workerResult = computeCurve(workerEval.evaluate, {stats:uiStats, tier:'average', maxRolls:20}, point => {
  workerPoints.push({...point, panel:workerEval.panel(point.allocation)});
});
assert.equal(workerResult.points[20].allocation.HPPercentage, 20);
assert.ok(Math.abs(workerPoints[20].panel.hp - (35613.375 + 20 * .04975 * 14695)) < 1e-8);
const screenshotValues = {hp:.05037433267697866, hp_percentage:.14359380429403293, critical_damage:.10071013557133655};
for (const [key, value] of Object.entries(screenshotValues)) assert.ok(Math.abs(c2Old[key][5] - value) < 1e-9, `screenshot sixth point ${key}`);

const report = {
  scope: '7.1.10 public WASM; synthetic input; five targeted checks; no browser interaction',
  input: x,
  checks: [
    {name:'same charged-attack objective, highest rolls, crit over cap, existing HP% substat carrier', panel, directFive, ordinaryFive, pass:true},
    {name:'HP percent selected in full 0-20 enumeration, both tiers', average:{point:resultAverage.points[20], evaluations:resultAverage.evaluations, panel:average.panel(resultAverage.points[20].allocation)}, max:{point:resultMax.points[20], evaluations:resultMax.evaluations}, pass:true},
    {name:'same C2 charged attack with HPFixed rather than HPPercentage selected', stats:fixedHpStats, point:fixedHpResult.points[20], panel:fixedHpEval.panel(fixedHpResult.points[20].allocation), pass:true},
    {name:'user-confirmed CR/CD/HP% selection, C0 and C2 charged attacks', stats:uiStats, c0:{point:uiResult.points[20], evaluations:uiResult.evaluations}, c2:{point:c2Result.points[20], evaluations:c2Result.evaluations, oldCdFiveGain:c2Old.critical_damage[4], oldCriticalRate:c2Old.critical_rate}, pass:true},
    {name:'per-point panel callback and screenshot tooltip index 5 (sixth roll)', point:workerPoints[20], evaluations:workerResult.evaluations, screenshotSixth:Object.fromEntries(Object.keys(screenshotValues).map(key=>[key,c2Old[key][5]])), pass:true},
  ],
  screenshotInference: {
    tooltipIndex: 5,
    rollsAtTooltipIndex: 6,
    hpForPureHpScaling: 299 * 6 / 0.05037433267697866,
    hpBase: 0.14359380429403293 / 0.05037433267697866 * 299 / .058,
    critFactorDenominator: .078 * 6 / 0.10071013557133655,
    warning: 'The screenshot inference assumes ordinary Neuvillette HP-scaling damage; it is not a recovered user configuration.',
  },
};
fs.mkdirSync('.build-target/stat-gain-neuvillette-7110', {recursive:true});
fs.writeFileSync('.build-target/stat-gain-neuvillette-7110/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  checks:report.checks.map(check=>({name:check.name, pass:check.pass})),
  c2Optimal:c2Result.points[20],
  c2Panel:workerPoints[20].panel,
  screenshotSixth:report.checks[4].screenshotSixth,
  oldCriticalRate:c2Old.critical_rate,
  screenshotInference:report.screenshotInference,
}, null, 2));
