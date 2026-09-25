import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import express from 'express';
import { resetEnvCache } from '../lib/env.js';
import { request } from '../routes/test-helpers/request.js';
import { uploadGate, uploadsInFlight } from './upload-gate.js';

describe('uploadGate', () => {
  afterEach(() => {
    delete process.env.MAX_CONCURRENT_UPLOADS;
    resetEnvCache();
  });

  it('lets requests through and releases the slot when they finish', async () => {
    const app = express();
    app.post('/up', uploadGate(), (_req, res) => {
      res.json({ ok: true });
    });
    const res = await request(app).post('/up');
    assert.equal(res.status, 200);
    await new Promise((r) => setImmediate(r));
    assert.equal(uploadsInFlight(), 0);
  });

  it('answers 503 when all upload slots are busy', async () => {
    process.env.MAX_CONCURRENT_UPLOADS = '1';
    resetEnvCache();
    let release!: () => void;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const app = express();
    app.post('/up', uploadGate(), async (_req, res) => {
      await held;
      res.json({ ok: true });
    });

    const first = request(app).post('/up');
    await new Promise((r) => setTimeout(r, 30));
    const second = await request(app).post('/up');
    assert.equal(second.status, 503);
    assert.equal(second.body.error?.code, 'SERVER_BUSY');

    release();
    assert.equal((await first).status, 200);
  });
});
