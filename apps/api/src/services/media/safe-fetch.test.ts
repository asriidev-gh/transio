import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPrivateOrLocalIp } from './url-guard.js';
import { safeFetch, safeLookup } from './safe-fetch.js';

describe('isPrivateOrLocalIp (hardened)', () => {
  it('blocks private, reserved and mapped addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '169.254.169.254',
      '100.64.0.1',
      '198.18.0.5',
      '192.0.0.8',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      'fe80::1',
      'fec0::1',
      'fd12:3456::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '64:ff9b::7f00:1',
      '2002:7f00:1::1',
      'not-an-ip',
      '',
    ]) {
      assert.equal(isPrivateOrLocalIp(ip), true, ip);
    }
  });

  it('allows ordinary public addresses, including ones that merely start with fc or fd', () => {
    assert.equal(isPrivateOrLocalIp('8.8.8.8'), false);
    assert.equal(isPrivateOrLocalIp('93.184.216.34'), false);
    assert.equal(isPrivateOrLocalIp('2606:4700:4700::1111'), false);
    assert.equal(isPrivateOrLocalIp('fcbd::1'), true);
    assert.equal(isPrivateOrLocalIp('2a03:2880:f10c:83:face:b00c::25de'), false);
  });
});

describe('safeLookup', () => {
  it('refuses hostnames that resolve to loopback', async () => {
    const result = await new Promise<{ code?: string }>((resolve) => {
      safeLookup('localhost', { all: true }, (err) => resolve({ code: err?.code }));
    });
    assert.equal(result.code, 'EBLOCKED');
  });

  it('safeFetch rejects a loopback URL at connect time', async () => {
    await assert.rejects(() => safeFetch('http://localhost:9/x'));
  });
});
