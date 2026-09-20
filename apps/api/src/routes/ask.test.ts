import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { FakeAskProvider } from '../providers/ask/index.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { InMemorySummaryRepository } from '../services/summaries/repository.js';
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

describe('POST /sessions/:id/ask', () => {
  it('answers from transcript context', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();

    const session = await sessions.create(USER_A, {
      title: 'Strategy seminar',
      sessionType: 'seminar',
    });
    await transcripts.upsertForSession(
      session.id,
      'We agreed retention is the top priority for Q4.',
      'en',
    );

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createSummaryRepository: () => summaries,
      createAskProvider: () => new FakeAskProvider(),
    });

    const res = await request(app).post(
      `/sessions/${session.id}/ask`,
      { question: 'What is the top priority?' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data as { answer: string; suggestedFollowUps: string[] };
    assert.match(data.answer, /Strategy seminar/i);
    assert.ok(Array.isArray(data.suggestedFollowUps));
  });

  it('requires a transcript', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const session = await sessions.create(USER_A, {
      title: 'Empty session',
      sessionType: 'group_discussion',
    });

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createAskProvider: () => new FakeAskProvider(),
    });

    const res = await request(app).post(
      `/sessions/${session.id}/ask`,
      { question: 'Anything?' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
});
