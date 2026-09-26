import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateTranscriptionMinutes,
  transcriptionEstimatePhrase,
  transcriptionEstimateSentence,
} from './transcription-estimate.js';

describe('estimateTranscriptionMinutes', () => {
  it('returns null without a duration', () => {
    assert.equal(estimateTranscriptionMinutes(null), null);
    assert.equal(estimateTranscriptionMinutes(0), null);
  });

  it('estimates Whisper from recording length', () => {
    assert.deepEqual(estimateTranscriptionMinutes(5 * 60, 50), { low: 1, high: 1 });
    assert.deepEqual(estimateTranscriptionMinutes(30 * 60, 50), { low: 3, high: 5 });
  });

  it('estimates Deepgram faster for a long recording', () => {
    assert.deepEqual(estimateTranscriptionMinutes(67 * 60 + 25, 200), { low: 4, high: 7 });
  });
});

describe('transcriptionEstimatePhrase', () => {
  it('uses a range when the bounds differ', () => {
    assert.equal(transcriptionEstimatePhrase(67 * 60 + 25, 200), 'about 4–7 minutes');
    assert.equal(transcriptionEstimatePhrase(5 * 60, 50), 'about 1 minute');
  });

  it('builds a full sentence', () => {
    assert.equal(
      transcriptionEstimateSentence(30 * 60, 50),
      'Transcription usually finishes in about 3–5 minutes.',
    );
  });
});
