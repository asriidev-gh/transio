import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localAudioStorageKey } from '../utils/local-audio-key.js';

describe('localAudioStorageKey', () => {
  it('namespaces session ids', () => {
    assert.equal(
      localAudioStorageKey('11111111-1111-1111-1111-111111111111'),
      'sessionai:local-audio:11111111-1111-1111-1111-111111111111',
    );
  });
});
