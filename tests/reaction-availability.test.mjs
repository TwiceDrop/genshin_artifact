import test from 'node:test';
import assert from 'node:assert/strict';
import {markReactionAvailability} from '../beta-data/reaction-availability.mjs';

test('uncalibrated new reactions keep an explicit status without a misleading number', () => {
    const result = markReactionAvailability({normal:{expectation:125},moonfall:{expectation:1000},direct_stellarswirl:{expectation:0}});
    assert.equal(result.normal.expectation,125);
    assert.equal(result.moonfall,undefined);
    assert.equal(result.direct_stellarswirl,undefined);
    assert.equal(result.reaction_availability.moonfall.status,'uncalibrated');
    assert.equal(result.reaction_availability.direct_stellarswirl.status,'uncalibrated');
    assert.equal(result.reaction_availability.moonelectro,undefined);
});

test('a separately calibrated reaction retains its damage', () => {
    const result = markReactionAvailability({direct_stellarswirl:{expectation:230}},['direct_stellarswirl']);
    assert.equal(result.direct_stellarswirl.expectation,230);
    assert.equal(result.reaction_availability.direct_stellarswirl.status,'calibrated');
});
