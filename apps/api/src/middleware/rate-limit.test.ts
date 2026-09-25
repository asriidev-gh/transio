import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import { request } from '../routes/test-helpers/request.js';
import { classifyRequest, userRateLimit } from './rate-limit.js';

describe('classifyRequest', () => {
  it('buckets routes by cost', () => {
    assert.equal(classifyRequest('POST', '/abc/process'), 'heavy');
    assert.equal(classifyRequest('POST', '/abc/audio'), 'heavy');
    assert.equal(classifyRequest('POST', '/abc/import-url'), 'heavy');
    assert.equal(classifyRequest('POST', '/abc/ask'), 'chat');
    assert.equal(classifyRequest('POST', '/voice'), 'chat');
    assert.equal(classifyRequest('POST', '/abc/notes-live'), 'live');
  });

  it('ignores cheap reads and other methods', () => {
    assert.equal(classifyRequest('GET', '/abc/process'), null);
    assert.equal(classifyRequest('GET', '/'), null);
    assert.equal(classifyRequest('PATCH', '/abc'), null);
    assert.equal(classifyRequest('POST', '/'), null);
  });
});

describe('userRateLimit', () => {
  it('returns 429 after the heavy limit and keeps users separate', async () => {
    const app = express();
    app.use((req, _res, next) => {
      const id = req.headers['x-user'];
      req.user = { id: typeof id === 'string' ? id : 'anon', email: null };
      next();
    });
    app.use(userRateLimit());
    app.post('/:id/process', (_req, res) => {
      res.json({ ok: true });
    });

    for (let i = 0; i < 20; i += 1) {
      const res = await request(app).post('/s1/process', undefined, { 'x-user': 'u1' });
      assert.equal(res.status, 200);
    }
    const blocked = await request(app).post('/s1/process', undefined, { 'x-user': 'u1' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error?.code, 'RATE_LIMITED');

    const other = await request(app).post('/s1/process', undefined, { 'x-user': 'u2' });
    assert.equal(other.status, 200);
  });
});
