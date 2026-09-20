import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapWhisperSegments } from './index.js';

describe('mapWhisperSegments', () => {
  it('maps timed segments and rotates speakers after long pauses', () => {
    const segments = mapWhisperSegments([
      { start: 0, end: 1.2, text: ' Hello' },
      { start: 1.3, end: 2.0, text: ' there' },
      { start: 4.0, end: 5.0, text: ' Next turn' },
    ]);

    assert.equal(segments.length, 3);
    const first = segments[0]!;
    const second = segments[1]!;
    const third = segments[2]!;
    assert.equal(first.speaker, 'Speaker A');
    assert.equal(first.startMs, 0);
    assert.equal(first.endMs, 1200);
    assert.equal(first.text, 'Hello');
    assert.equal(second.speaker, 'Speaker A');
    assert.equal(third.speaker, 'Speaker B');
    assert.equal(third.text, 'Next turn');
  });

  it('returns empty for missing input', () => {
    assert.deepEqual(mapWhisperSegments(undefined), []);
    assert.deepEqual(mapWhisperSegments([]), []);
  });
});
