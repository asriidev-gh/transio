import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import {
  deviceHashFromRequest,
  hashDeviceId,
  parseDeviceId,
  voiceConversationId,
} from './device.js';

describe('device ids', () => {
  it('accepts android-style ids and rejects junk', () => {
    assert.equal(parseDeviceId('9774d56d682e549c'), '9774d56d682e549c');
    assert.equal(parseDeviceId(' 9774d56d682e549c '), '9774d56d682e549c');
    assert.equal(parseDeviceId(['9774d56d682e549c']), '9774d56d682e549c');
    for (const bad of ['', 'short', 'has space in it', 'x'.repeat(200), 42, undefined, null]) {
      assert.equal(parseDeviceId(bad), null);
    }
  });

  it('hashes deterministically and never returns the raw id', () => {
    const a = hashDeviceId('9774d56d682e549c', 'secret-one');
    assert.equal(a, hashDeviceId('9774d56d682e549c', 'secret-one'));
    assert.notEqual(a, hashDeviceId('9774d56d682e549c', 'secret-two'));
    assert.notEqual(a, hashDeviceId('0000000000000000', 'secret-one'));
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.ok(!a.includes('9774d56d682e549c'));
  });

  it('reads the device hash from the request header', () => {
    const withHeader = { headers: { 'x-device-id': '9774d56d682e549c' } } as unknown as Request;
    const without = { headers: {} } as unknown as Request;
    assert.equal(
      deviceHashFromRequest(withHeader, 's'),
      hashDeviceId('9774d56d682e549c', 's'),
    );
    assert.equal(deviceHashFromRequest(without, 's'), null);
  });
});

describe('voiceConversationId', () => {
  it('uses the client conversation id when it is valid', () => {
    assert.equal(voiceConversationId('conv-1234abcd'), 'conv-1234abcd');
  });

  it('falls back to a half hour bucket for older app builds', () => {
    const t = Date.UTC(2026, 8, 25, 10, 5);
    const first = voiceConversationId(undefined, t);
    assert.match(first, /^auto:\d+$/);
    assert.equal(voiceConversationId('bad id', t + 10 * 60 * 1000), first);
    assert.notEqual(voiceConversationId(undefined, t + 60 * 60 * 1000), first);
  });
});
