import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { FakeSummaryProvider } from '../providers/summary/index.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { InMemorySummaryRepository } from '../services/summaries/repository.js';
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

describe('notes routes', () => {
  it('merges live notes chunks', async () => {
    const sessions = new InMemorySessionRepository();
    const summaries = new InMemorySummaryRepository();
    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createSummaryRepository: () => summaries,
      createSummaryProvider: () => new FakeSummaryProvider(),
    });

    const created = await request(app).post(
      '/sessions',
      {
        title: 'Live notes session',
        sessionType: 'meeting',
        captureMode: 'live_notes',
      },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(created.status, 201);
    const session = created.body.data as { id: string; captureMode: string };
    assert.equal(session.captureMode, 'live_notes');

    const res = await request(app).post(
      `/sessions/${session.id}/notes-live`,
      { text: 'We should ship onboarding next week.' },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(res.status, 200);
    const notes = res.body.data as { overview: string; keyPoints: string[] };
    assert.ok(notes.overview.length > 0);
    assert.ok(notes.keyPoints.length > 0);
    assert.equal(
      await summaries.getBySessionId(session.id, 'notes').then((s) => s?.overview),
      notes.overview,
    );
  });

  it('finalizes notes without a transcript', async () => {
    const sessions = new InMemorySessionRepository();
    const summaries = new InMemorySummaryRepository();
    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createSummaryRepository: () => summaries,
      createSummaryProvider: () => new FakeSummaryProvider(),
    });

    const created = await request(app).post(
      '/sessions',
      {
        title: 'Finalize notes',
        sessionType: 'seminar',
        captureMode: 'live_notes',
      },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).post(
      `/sessions/${id}/notes/finalize`,
      {
        overview: 'Final overview',
        keyPoints: ['One'],
        topics: [],
        questionsDiscussed: [],
        actionItems: [],
        importantInsights: [],
        quotes: [],
      },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(res.status, 200);
    assert.equal((res.body.data as { overview: string }).overview, 'Final overview');

    const getRes = await request(app).get(`/sessions/${id}`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal((getRes.body.data as { status: string }).status, 'completed');
    assert.equal(
      await summaries.getBySessionId(id, 'notes').then((s) => s?.overview),
      'Final overview',
    );
  });
});
