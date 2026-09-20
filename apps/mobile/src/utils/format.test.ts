import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDuration } from './format.js';

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
