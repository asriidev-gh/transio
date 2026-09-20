import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { FakeTranscriptionProvider } from '../providers/transcription/index.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { InMemoryTranscriptRepository } from '../services/transcripts/repository.js';
import { runTranscriptionJob } from '../services/transcription/job.js';
import { request } from './test-helpers/request.js';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function testAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.headers.authorization);
  if (token === 'token-a') {
    req.user = { id: USER_A, email: 'a@example.com' };
    req.accessToken = token;
    next();
    return;
  }
  if (token === 'token-b') {
    req.user = { id: USER_B, email: 'b@example.com' };
    req.accessToken = token;
    next();
    return;
  }
  next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
}

function createTranscriptionTestApp() {
  const sessions = new InMemorySessionRepository();
  const transcripts = new InMemoryTranscriptRepository();
  const provider = new FakeTranscriptionProvider('Hello from the seminar transcript.');
  const pendingJobs: Promise<void>[] = [];

  const app = createApp({
    authenticate: testAuthenticate,
    createSessionRepository: () => sessions,
    createTranscriptRepository: () => transcripts,
    createTranscriptionProvider: () => provider,
    runTranscriptionJob: (sessionId, req) => {
      if (!req.user) return;
      const job = runTranscriptionJob(sessionId, {
        userId: req.user.id,
        sessions,
        transcripts,
        provider,
        downloadAudio: async () => ({
          data: Buffer.from('fake-audio'),
          mimeType: 'audio/mp4',
        }),
      });
      pendingJobs.push(job);
    },
  });

  return {
    app,
    sessions,
    transcripts,
    pendingJobs,
    async flushJobs() {
      await Promise.all(pendingJobs.splice(0, pendingJobs.length));
    },
  };
}

describe('transcription API', () => {
  it('starts a transcription job and saves transcript text', async () => {
    const ctx = createTranscriptionTestApp();
    const created = await request(ctx.app).post(
      '/sessions',
      { title: 'Talk', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    await request(ctx.app).patch(
      `/sessions/${id}`,
      { audioPath: `${USER_A}/${id}/audio.m4a`, status: 'uploaded' },
      { Authorization: 'Bearer token-a' },
    );

    const start = await request(ctx.app).post(`/sessions/${id}/transcribe`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(start.status, 202);
    assert.equal((start.body.data as { status: string }).status, 'transcribing');

    await ctx.flushJobs();

    const transcript = await request(ctx.app).get(`/sessions/${id}/transcript`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(transcript.status, 200);
    assert.equal(
      (transcript.body.data as { text: string }).text,
      'Hello from the seminar transcript.',
    );

    const status = await request(ctx.app).get(`/sessions/${id}/status`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(status.status, 200);
    const statusData = status.body.data as {
      status: string;
      hasAudio: boolean;
      hasTranscript: boolean;
    };
    assert.equal(statusData.status, 'transcribed');
    assert.equal(statusData.hasAudio, true);
    assert.equal(statusData.hasTranscript, true);
  });

  it('prevents another user from reading a transcript', async () => {
    const ctx = createTranscriptionTestApp();
    const created = await request(ctx.app).post(
      '/sessions',
      { title: 'Private talk', sessionType: 'meeting' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    await request(ctx.app).patch(
      `/sessions/${id}`,
      { audioPath: `${USER_A}/${id}/audio.m4a`, status: 'uploaded' },
      { Authorization: 'Bearer token-a' },
    );
    await request(ctx.app).post(`/sessions/${id}/transcribe`, undefined, {
      Authorization: 'Bearer token-a',
    });
    await ctx.flushJobs();

    const res = await request(ctx.app).get(`/sessions/${id}/transcript`, {
      Authorization: 'Bearer token-b',
    });
    assert.equal(res.status, 404);
  });

  it('rejects transcription when audio is missing', async () => {
    const ctx = createTranscriptionTestApp();
    const created = await request(ctx.app).post(
      '/sessions',
      { title: 'No audio', sessionType: 'other' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(ctx.app).post(`/sessions/${id}/transcribe`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  });

  it('marks session failed when provider throws', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const pendingJobs: Promise<void>[] = [];

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createTranscriptionProvider: () => ({
        name: 'broken',
        async transcribe() {
          throw new AppError('TRANSCRIPTION_ERROR', 'provider down', 502);
        },
      }),
      runTranscriptionJob: (sessionId, req) => {
        if (!req.user) return;
        pendingJobs.push(
          runTranscriptionJob(sessionId, {
            userId: req.user.id,
            sessions,
            transcripts,
            provider: {
              name: 'broken',
              async transcribe() {
                throw new AppError('TRANSCRIPTION_ERROR', 'provider down', 502);
              },
            },
            downloadAudio: async () => ({
              data: Buffer.from('x'),
              mimeType: 'audio/mp4',
            }),
          }),
        );
      },
    });

    const created = await request(app).post(
      '/sessions',
      { title: 'Failing', sessionType: 'lecture' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    await request(app).patch(
      `/sessions/${id}`,
      { audioPath: `${USER_A}/${id}/audio.m4a`, status: 'uploaded' },
      { Authorization: 'Bearer token-a' },
    );
    await request(app).post(`/sessions/${id}/transcribe`, undefined, {
      Authorization: 'Bearer token-a',
    });
    await Promise.all(pendingJobs);

    const status = await request(app).get(`/sessions/${id}/status`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal((status.body.data as { status: string }).status, 'failed');
  });
});
