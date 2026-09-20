import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../app.js';
import { request } from './test-helpers/request.js';

describe('GET /health', () => {
  it('returns ok health payload', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data?.status, 'ok');
    assert.equal(res.body.data?.service, 'sessionai-api');
    assert.equal(typeof res.body.data?.timestamp, 'string');
    assert.equal(typeof res.body.data?.supabaseConfigured, 'boolean');
  });

  it('returns 404 for unknown routes', async () => {
    const app = createApp();
    const res = await request(app).get('/does-not-exist');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'NOT_FOUND');
  });
});
