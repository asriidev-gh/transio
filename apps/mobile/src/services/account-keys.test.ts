import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldClearKeyAfterDeletion } from './account-keys';

describe('shouldClearKeyAfterDeletion', () => {
  it('keeps the usage counters and wipes everything else', () => {
    assert.equal(shouldClearKeyAfterDeletion('smart-transcriber-entitlements-v3'), false);
    assert.equal(shouldClearKeyAfterDeletion('sessionai:appearance'), true);
    assert.equal(shouldClearKeyAfterDeletion('sb-abc-auth-token'), true);
    assert.equal(shouldClearKeyAfterDeletion('sessionai:local-audio:123'), true);
  });
});
