import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../app.js';
import { resetEnvCache } from '../lib/env.js';
import { request } from './test-helpers/request.js';

describe('GET /limits', () => {
  it('reports Whisper limits by default and larger Deepgram limits', async () => {
    const prev = process.env.TRANSCRIPTION_PROVIDER;
    try {
      delete process.env.TRANSCRIPTION_PROVIDER;
      resetEnvCache();
      const a = await request(createApp()).get('/limits');
      assert.equal(a.status, 200);
      const whisper = a.body.data as { maxUploadMb: number; maxAudioMinutes: number };
      assert.equal(whisper.maxAudioMinutes, 51);
      assert.equal(typeof whisper.maxUploadMb, 'number');

      process.env.TRANSCRIPTION_PROVIDER = 'deepgram';
      resetEnvCache();
      const b = await request(createApp()).get('/limits');
      const dg = b.body.data as { maxAudioMinutes: number };
      assert.ok(dg.maxAudioMinutes > 200);
    } finally {
      if (prev === undefined) delete process.env.TRANSCRIPTION_PROVIDER;
      else process.env.TRANSCRIPTION_PROVIDER = prev;
      resetEnvCache();
    }
  });
});
