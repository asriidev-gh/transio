import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapDeepgramUtterances, speakerLabel } from './deepgram.js';

describe('mapDeepgramUtterances', () => {
  it('maps diarized utterances to speaker labels', () => {
    const segments = mapDeepgramUtterances([
      { start: 0, end: 1.5, transcript: ' Hi all ', speaker: 0 },
      { start: 1.6, end: 3, transcript: 'Hello', speaker: 2 },
      { start: 3, end: 4, transcript: '   ', speaker: 1 },
    ]);
    assert.equal(segments.length, 2);
    assert.equal(segments[0]!.speaker, 'Speaker A');
    assert.equal(segments[0]!.text, 'Hi all');
    assert.equal(segments[0]!.endMs, 1500);
    assert.equal(segments[1]!.speaker, 'Speaker C');
  });

  it('handles missing input and many speakers', () => {
    assert.deepEqual(mapDeepgramUtterances(undefined), []);
    assert.equal(speakerLabel(26), 'Speaker 27');
  });
});
