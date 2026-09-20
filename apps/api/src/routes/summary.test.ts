import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { FakeSummaryProvider } from '../providers/summary/index.js';
import { FakeTranscriptionProvider } from '../providers/transcription/index.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { InMemorySummaryRepository } from '../services/summaries/repository.js';
import { runSummaryJob } from '../services/summary/job.js';
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

function createSummaryTestApp() {
  const sessions = new InMemorySessionRepository();
  const transcripts = new InMemoryTranscriptRepository();
  const summaries = new InMemorySummaryRepository();
  const transcriptionProvider = new FakeTranscriptionProvider('Hello from the seminar.');
  const summaryProvider = new FakeSummaryProvider();
  const pendingJobs: Promise<void>[] = [];

  const app = createApp({
    authenticate: testAuthenticate,
    createSessionRepository: () => sessions,
    createTranscriptRepository: () => transcripts,
    createSummaryRepository: () => summaries,
    createTranscriptionProvider: () => transcriptionProvider,
    createSummaryProvider: () => summaryProvider,
    runTranscriptionJob: (sessionId, req) => {
      if (!req.user) return;
      pendingJobs.push(
        runTranscriptionJob(sessionId, {
          userId: req.user.id,
          sessions,
          transcripts,
          provider: transcriptionProvider,
          downloadAudio: async () => ({
            data: Buffer.from('fake-audio'),
            mimeType: 'audio/mp4',
          }),
        }),
      );
    },
    runSummaryJob: (sessionId, req) => {
      if (!req.user) return;
      pendingJobs.push(
        runSummaryJob(sessionId, {
          userId: req.user.id,
          sessions,
          transcripts,
          summaries,
          provider: summaryProvider,
        }),
      );
    },
  });

  return {
    app,
    sessions,
    transcripts,
    summaries,
    pendingJobs,
    async flushJobs() {
      await Promise.all(pendingJobs.splice(0, pendingJobs.length));
    },
  };
}

async function seedTranscribedSession(ctx: ReturnType<typeof createSummaryTestApp>) {
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
  await request(ctx.app).post(`/sessions/${id}/transcribe`, undefined, {
    Authorization: 'Bearer token-a',
  });
  await ctx.flushJobs();
  return id;
}

describe('summary API', () => {
  it('starts a summary job and saves structured summary', async () => {
    const ctx = createSummaryTestApp();
    const id = await seedTranscribedSession(ctx);

    const start = await request(ctx.app).post(`/sessions/${id}/summarize`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(start.status, 202);
    assert.equal((start.body.data as { status: string }).status, 'summarizing');

    await ctx.flushJobs();

    const summary = await request(ctx.app).get(`/sessions/${id}/summary`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(summary.status, 200);
    const data = summary.body.data as {
      overview: string;
      keyPoints: string[];
      topics: Array<{ title: string; summary: string }>;
    };
    assert.ok(data.overview.length > 0);
    assert.ok(data.keyPoints.length >= 1);
    assert.ok(data.topics.length >= 1);

    const status = await request(ctx.app).get(`/sessions/${id}/status`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(status.status, 200);
    const statusData = status.body.data as {
      status: string;
      hasTranscript: boolean;
      hasSummary: boolean;
    };
    assert.equal(statusData.status, 'completed');
    assert.equal(statusData.hasTranscript, true);
    assert.equal(statusData.hasSummary, true);
  });

  it('prevents another user from reading a summary', async () => {
    const ctx = createSummaryTestApp();
    const id = await seedTranscribedSession(ctx);
    await request(ctx.app).post(`/sessions/${id}/summarize`, undefined, {
      Authorization: 'Bearer token-a',
    });
    await ctx.flushJobs();

    const res = await request(ctx.app).get(`/sessions/${id}/summary`, {
      Authorization: 'Bearer token-b',
    });
    assert.equal(res.status, 404);
  });

  it('rejects summarization when transcript is missing', async () => {
    const ctx = createSummaryTestApp();
    const created = await request(ctx.app).post(
      '/sessions',
      { title: 'No transcript', sessionType: 'other' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(ctx.app).post(`/sessions/${id}/summarize`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  });

  it('marks session failed when summary provider throws', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const pendingJobs: Promise<void>[] = [];

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createSummaryRepository: () => summaries,
      createSummaryProvider: () => ({
        name: 'broken',
        async summarize() {
          throw new AppError('SUMMARY_ERROR', 'provider down', 502);
        },
      }),
      runSummaryJob: (sessionId, req) => {
        if (!req.user) return;
        pendingJobs.push(
          runSummaryJob(sessionId, {
            userId: req.user.id,
            sessions,
            transcripts,
            summaries,
            provider: {
              name: 'broken',
              async summarize() {
                throw new AppError('SUMMARY_ERROR', 'provider down', 502);
              },
            },
          }),
        );
      },
    });

    const created = await request(app).post(
      '/sessions',
      { title: 'Failing summary', sessionType: 'lecture' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    await transcripts.upsertForSession(id, 'Some transcript text', 'en');
    await request(app).patch(
      `/sessions/${id}`,
      { status: 'transcribed' },
      { Authorization: 'Bearer token-a' },
    );

    await request(app).post(`/sessions/${id}/summarize`, undefined, {
      Authorization: 'Bearer token-a',
    });
    await Promise.all(pendingJobs);

    const status = await request(app).get(`/sessions/${id}/status`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal((status.body.data as { status: string }).status, 'failed');
  });
});
