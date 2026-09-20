import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBearerToken } from './auth.js';

describe('parseBearerToken', () => {
  it('parses valid bearer headers', () => {
    assert.equal(parseBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
    assert.equal(parseBearerToken('bearer token123'), 'token123');
  });

  it('rejects missing or malformed headers', () => {
    assert.equal(parseBearerToken(undefined), null);
    assert.equal(parseBearerToken(''), null);
    assert.equal(parseBearerToken('Basic abc'), null);
    assert.equal(parseBearerToken('Bearer'), null);
    assert.equal(parseBearerToken('Bearer '), null);
  });
});
