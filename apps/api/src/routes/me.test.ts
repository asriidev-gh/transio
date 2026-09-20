import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../app.js';
import { request } from '../routes/test-helpers/request.js';

describe('GET /me', () => {
  it('rejects requests without a bearer token', async () => {
    const app = createApp();
    const res = await request(app).get('/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'UNAUTHORIZED');
  });

  it('rejects malformed authorization headers', async () => {
    const app = createApp();
    const res = await request(app).get('/me', { Authorization: 'Basic nope' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'UNAUTHORIZED');
  });
});
