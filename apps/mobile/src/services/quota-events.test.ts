import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyQuotaError,
  publishIfQuotaBlocked,
  subscribeQuotaBlocked,
  type QuotaBlock,
} from './quota-events';

describe('quota events', () => {
  it('classifies quota refusals and ignores other errors', () => {
    assert.equal(classifyQuotaError('QUOTA_EXCEEDED_FREE'), 'paywall');
    assert.equal(classifyQuotaError('QUOTA_EXCEEDED_DAILY'), 'daily');
    assert.equal(classifyQuotaError('SERVICE_PAUSED'), 'paused');
    assert.equal(classifyQuotaError('DEVICE_ALREADY_CLAIMED'), 'device');
    assert.equal(classifyQuotaError('NOT_FOUND'), null);
    assert.equal(classifyQuotaError(''), null);
  });

  it('notifies subscribers only for quota refusals, and stops after unsubscribe', () => {
    const seen: QuotaBlock[] = [];
    const unsubscribe = subscribeQuotaBlocked((block) => seen.push(block));

    publishIfQuotaBlocked('VALIDATION_ERROR', 'nope');
    publishIfQuotaBlocked('QUOTA_EXCEEDED_FREE', 'Unlock Pro to continue.');
    assert.deepEqual(seen, [{ kind: 'paywall', message: 'Unlock Pro to continue.' }]);

    unsubscribe();
    publishIfQuotaBlocked('QUOTA_EXCEEDED_DAILY', 'Tomorrow.');
    assert.equal(seen.length, 1);
  });
});
