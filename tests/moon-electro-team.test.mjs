import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMoonElectroStrike} from '../beta-data/moon-electro-team.mjs';

const active = {converterActive: true, stormCloudActive: true, dualAuraActive: true};
const member = (source, element, nonCritical, critical = nonCritical, criticalRate = 0) =>
    ({source, element, nonCritical, critical, criticalRate});

test('original field example: 7096 + 6264/2 + 4620/12 = 10613', () => {
    // The article measured Lisa, Yae and Kokomi as three surviving sources.
    const result = evaluateMoonElectroStrike({...active, participants: [
        member('Lisa', 'Electro', 7096),
        member('Yae', 'Electro', 6264),
        member('Kokomi', 'Hydro', 4620),
    ]});
    assert.equal(result.status, 'calibrated');
    assert.equal(result.nonCritical, 10613);
    assert.equal(result.expectation, 10613);
    assert.equal(evaluateMoonElectroStrike({...active, participants: [
        member('Lisa', 'Electro', 7096), member('Kokomi', 'Hydro', 4620),
    ]}).expectation, 9406);
    assert.equal(evaluateMoonElectroStrike({...active, participants: [
        member('Yae', 'Electro', 6264), member('Kokomi', 'Hydro', 4620),
    ]}).expectation, 8574);
    assert.equal(evaluateMoonElectroStrike({...active, participants: [
        member('Lisa', 'Electro', 7096), member('Yae', 'Electro', 6264),
        member('Kokomi', 'Hydro', 4620), member('Fourth', 'Hydro', 1200),
    ]}).expectation, 10713);
});

test('sorts after each critical outcome before assigning weights', () => {
    const result = evaluateMoonElectroStrike({...active, participants: [
        member('Hydro', 'Hydro', 100, 200, .5),
        member('Electro', 'Electro', 90, 180, .5),
    ]});
    assert.equal(result.nonCritical, 145);
    assert.equal(result.allCritical, 290);
    assert.equal(result.expectation, (145 + 245 + 230 + 290) / 4);
});

test('requires explicit conversion, cloud, dual aura and distinct participating sources', () => {
    const participants = [member('Vodyanitsa', 'Hydro', 100), member('Ineffa', 'Electro', 90)];
    assert.equal(evaluateMoonElectroStrike({participants}).status, 'condition-not-met');
    assert.equal(evaluateMoonElectroStrike({...active, dualAuraActive: false, participants}).status, 'condition-not-met');
    assert.throws(() => evaluateMoonElectroStrike({...active, participants: [participants[0], participants[0]]}), /唯一/);
    assert.throws(() => evaluateMoonElectroStrike({...active, participants: [participants[0], member('Other', 'Hydro', 90)]}), /水、雷/);
});
