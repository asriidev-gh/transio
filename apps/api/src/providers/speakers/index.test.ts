import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeSpeakerLabelProvider, labelSegmentsBestEffort } from './index.js';

describe('speaker labeling', () => {
  it('fake provider alternates Host and Participant', async () => {
    const provider = new FakeSpeakerLabelProvider();
    const labeled = await provider.label({
      title: 'Test',
      segments: [
        { startMs: 0, endMs: 1000, text: 'Hello', speaker: 'Speaker A' },
        { startMs: 1200, endMs: 2000, text: 'Hi', speaker: 'Speaker B' },
      ],
    });
    assert.equal(labeled[0]?.speaker, 'Host');
    assert.equal(labeled[1]?.speaker, 'Participant');
  });

  it('best effort returns original segments when provider is null', async () => {
    const segments = [{ startMs: 0, endMs: 500, text: 'Only', speaker: 'Speaker A' }];
    const result = await labelSegmentsBestEffort({ title: 'T', segments }, null);
    assert.equal(result[0]?.speaker, 'Speaker A');
  });
});
