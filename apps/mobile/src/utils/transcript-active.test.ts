import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeSegmentIndex } from './transcript-active';

const segs = [{ startMs: 0 }, { startMs: 1000 }, { startMs: 2500 }, { startMs: 4000 }];

describe('activeSegmentIndex', () => {
  it('finds the last segment that has started', () => {
    assert.equal(activeSegmentIndex(segs, 0), 0);
    assert.equal(activeSegmentIndex(segs, 999), 0);
    assert.equal(activeSegmentIndex(segs, 1000), 1);
    assert.equal(activeSegmentIndex(segs, 3999), 2);
    assert.equal(activeSegmentIndex(segs, 999999), 3);
  });

  it('returns -1 for empty lists and times before the first segment', () => {
    assert.equal(activeSegmentIndex([], 500), -1);
    assert.equal(activeSegmentIndex([{ startMs: 500 }], 100), -1);
  });
});
