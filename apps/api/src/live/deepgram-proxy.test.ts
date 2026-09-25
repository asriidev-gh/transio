import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { __test } from './deepgram-proxy.js';

describe('deepgram-proxy mapDeepgramMessage', () => {
  it('maps final Results to transcript events', () => {
    const mapped = __test.mapDeepgramMessage(
      JSON.stringify({
        type: 'Results',
        is_final: true,
        start: 1.2,
        duration: 0.8,
        channel: {
          alternatives: [{ transcript: 'hello there' }],
        },
      }),
    );
    assert.deepEqual(mapped, {
      type: 'transcript',
      text: 'hello there',
      isFinal: true,
      speechFinal: false,
      start: 1.2,
      duration: 0.8,
    });
  });

  it('skips empty transcripts', () => {
    const mapped = __test.mapDeepgramMessage(
      JSON.stringify({
        type: 'Results',
        is_final: false,
        channel: { alternatives: [{ transcript: '' }] },
      }),
    );
    assert.equal(mapped, null);
  });

  it('maps Deepgram Error type', () => {
    const mapped = __test.mapDeepgramMessage(JSON.stringify({ type: 'Error' }));
    assert.equal(mapped?.type, 'error');
  });

  it('resolves Tagalog language aliases', () => {
    assert.equal(__test.resolveLiveLanguage(null), 'tl');
    assert.equal(__test.resolveLiveLanguage('fil'), 'tl');
    assert.equal(__test.resolveLiveLanguage('tagalog'), 'tl');
    assert.equal(__test.resolveLiveLanguage('en'), 'en');
    assert.equal(__test.resolveLiveLanguage('english'), 'en');
    assert.equal(__test.resolveLiveLanguage('zh'), 'zh');
    assert.equal(__test.resolveLiveLanguage('chinese'), 'zh');
    assert.equal(__test.resolveLiveLanguage('auto'), 'multi');
    assert.equal(__test.resolveLiveLanguage('multi'), 'multi');
  });
});

describe('live stream slots', () => {
  it('limits concurrent streams per user and frees slots on release', () => {
    assert.equal(__test.acquireLiveSlot('u-slots', 2), true);
    assert.equal(__test.acquireLiveSlot('u-slots', 2), true);
    assert.equal(__test.acquireLiveSlot('u-slots', 2), false);
    assert.equal(__test.acquireLiveSlot('someone-else', 2), true);

    __test.releaseLiveSlot('u-slots');
    assert.equal(__test.acquireLiveSlot('u-slots', 2), true);

    __test.releaseLiveSlot('u-slots');
    __test.releaseLiveSlot('u-slots');
    __test.releaseLiveSlot('someone-else');
  });
});
