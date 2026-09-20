import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDuration, formatDurationHuman, formatSessionDate } from './format.js';

describe('formatDuration', () => {
  it('formats zero and simple values', () => {
    assert.equal(formatDuration(0), '00:00:00');
    assert.equal(formatDuration(65), '00:01:05');
    assert.equal(formatDuration(3723), '01:02:03');
  });

  it('handles invalid input', () => {
    assert.equal(formatDuration(-1), '00:00:00');
    assert.equal(formatDuration(Number.NaN), '00:00:00');
  });
});

describe('formatDurationHuman', () => {
  it('formats common durations', () => {
    assert.equal(formatDurationHuman(null), '—');
    assert.equal(formatDurationHuman(45), '45s');
    assert.equal(formatDurationHuman(90), '1m');
    assert.equal(formatDurationHuman(3720), '1h 2m');
  });
});

describe('formatSessionDate', () => {
  it('formats iso dates', () => {
    assert.equal(formatSessionDate('2026-09-20T12:00:00.000Z'), 'Sep 20, 2026');
  });
});
