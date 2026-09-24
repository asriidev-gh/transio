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
import { runProcessingPipeline } from '../services/processing/job.js';
import { InMemoryTranscriptRepository } from '../services/transcripts/repository.js';
import { request } from './test-helpers/request.js';

const USER_A = '11111111-1111-1111-1111-111111111111';

function testAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.headers.authorization);
  if (token === 'token-a') {
    req.user = { id: USER_A, email: 'a@example.com' };
    req.accessToken = token;
    next();
    return;
  }
  next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
}

describe('process API', () => {
  it('runs end-to-end process from uploaded audio to transcribed (summary opt-in)', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const transcriptionProvider = new FakeTranscriptionProvider('End-to-end transcript.');
    const summaryProvider = new FakeSummaryProvider();
    const pendingJobs: Promise<void>[] = [];

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createSummaryRepository: () => summaries,
      createTranscriptionProvider: () => transcriptionProvider,
      createSummaryProvider: () => summaryProvider,
      runProcessJob: (sessionId, req) => {
        if (!req.user) return;
        pendingJobs.push(
          runProcessingPipeline(sessionId, {
            userId: req.user.id,
            sessions,
            transcripts,
            summaries,
            transcriptionProvider,
            summaryProvider,
            downloadAudio: async () => ({
              data: Buffer.from('fake-audio'),
              mimeType: 'audio/mp4',
            }),
          }),
        );
      },
    });

    const created = await request(app).post(
      '/sessions',
      { title: 'E2E', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    await request(app).patch(
      `/sessions/${id}`,
      { audioPath: `${USER_A}/${id}/audio.m4a`, status: 'uploaded' },
      { Authorization: 'Bearer token-a' },
    );

    const start = await request(app).post(`/sessions/${id}/process`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(start.status, 202);
    assert.equal((start.body.data as { status: string }).status, 'transcribing');
    assert.equal((start.body.data as { stage: string }).stage, 'transcribe');

    await Promise.all(pendingJobs);

    const status = await request(app).get(`/sessions/${id}/status`, {
      Authorization: 'Bearer token-a',
    });
    const statusData = status.body.data as {
      status: string;
      hasTranscript: boolean;
      hasSummary: boolean;
    };
    assert.equal(statusData.status, 'transcribed');
    assert.equal(statusData.hasTranscript, true);
    assert.equal(statusData.hasSummary, false);

    const summary = await request(app).get(`/sessions/${id}/summary`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(summary.status, 404);
  });

  it('rejects process when audio is missing', async () => {
    const sessions = new InMemorySessionRepository();
    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => new InMemoryTranscriptRepository(),
      createSummaryRepository: () => new InMemorySummaryRepository(),
      createTranscriptionProvider: () => new FakeTranscriptionProvider(),
      createSummaryProvider: () => new FakeSummaryProvider(),
      runProcessJob: () => undefined,
    });

    const created = await request(app).post(
      '/sessions',
      { title: 'No audio', sessionType: 'other' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).post(`/sessions/${id}/process`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  });

  it('returns transcribed when transcript already exists (summary opt-in)', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    let transcribed = false;

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createSummaryRepository: () => summaries,
      createTranscriptionProvider: () => ({
        name: 'should-not-run',
        async transcribe() {
          transcribed = true;
          return { text: 'nope', language: 'en' };
        },
      }),
      createSummaryProvider: () => new FakeSummaryProvider(),
      runProcessJob: () => {
        throw new Error('process job should not run when transcript exists');
      },
    });

    const created = await request(app).post(
      '/sessions',
      { title: 'Resume', sessionType: 'meeting' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    await request(app).patch(
      `/sessions/${id}`,
      { audioPath: `${USER_A}/${id}/audio.m4a`, status: 'transcribed' },
      { Authorization: 'Bearer token-a' },
    );
    await transcripts.upsertForSession(id, 'Already transcribed text', 'en');

    const start = await request(app).post(`/sessions/${id}/process`, undefined, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(start.status, 200);
    assert.equal((start.body.data as { status: string }).status, 'transcribed');
    assert.equal((start.body.data as { stage: string }).stage, 'done');
    assert.equal(transcribed, false);

    const status = await request(app).get(`/sessions/${id}/status`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal((status.body.data as { status: string }).status, 'transcribed');
    assert.equal((status.body.data as { hasSummary: boolean }).hasSummary, false);
  });
});
