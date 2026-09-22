import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { FakeTranslateProvider } from '../providers/translate/index.js';
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

describe('POST /sessions/:id/translate', () => {
  it('translates a summary', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();

    const session = await sessions.create(USER_A, {
      title: 'Seminar',
      sessionType: 'seminar',
    });
    await summaries.upsertForSession(session.id, {
      overview: 'We focused on retention.',
      keyPoints: ['Retention first'],
      topics: [{ title: 'Growth', summary: 'Keep users longer.' }],
      questionsDiscussed: ['How do we retain?'],
      actionItems: [{ task: 'Ship onboarding fixes' }],
      importantInsights: ['Churn drops with coaching'],
      quotes: ['Retention is oxygen'],
    });

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createSummaryRepository: () => summaries,
      createTranslateProvider: () => new FakeTranslateProvider(),
    });

    const res = await request(app).post(
      `/sessions/${session.id}/translate`,
      { language: 'tl', scope: 'summary' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data as {
      language: string;
      languageLabel: string;
      summary: { overview: string; keyPoints: string[] };
    };
    assert.equal(data.language, 'tl');
    assert.equal(data.languageLabel, 'Filipino');
    assert.match(data.summary.overview, /^\[tl\]/);
    assert.ok(data.summary.keyPoints[0]);
    assert.match(data.summary.keyPoints[0]!, /^\[tl\]/);
  });

  it('translates a transcript with segments', async () => {
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const session = await sessions.create(USER_A, {
      title: 'Discussion',
      sessionType: 'group_discussion',
    });
    await transcripts.upsertForSession(
      session.id,
      'Hello world',
      'en',
      [{ startMs: 0, endMs: 1000, text: 'Hello world', speaker: 'A' }],
    );

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createTranscriptRepository: () => transcripts,
      createTranslateProvider: () => new FakeTranslateProvider(),
    });

    const res = await request(app).post(
      `/sessions/${session.id}/translate`,
      { language: 'es', scope: 'transcript' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 200);
    const data = res.body.data as {
      transcript: { text: string; segments: Array<{ text: string; speaker: string }> };
    };
    assert.match(data.transcript.text, /^\[es\]/);
    assert.ok(data.transcript.segments[0]);
    assert.equal(data.transcript.segments[0]!.speaker, 'A');
    assert.match(data.transcript.segments[0]!.text, /^\[es\]/);
  });

  it('requires summary content for summary scope', async () => {
    const sessions = new InMemorySessionRepository();
    const session = await sessions.create(USER_A, {
      title: 'Empty',
      sessionType: 'meeting',
    });

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createSummaryRepository: () => new InMemorySummaryRepository(),
      createTranslateProvider: () => new FakeTranslateProvider(),
    });

    const res = await request(app).post(
      `/sessions/${session.id}/translate`,
      { language: 'en', scope: 'summary' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('translates a live caption chunk', async () => {
    const sessions = new InMemorySessionRepository();
    const session = await sessions.create(USER_A, {
      title: 'Live',
      sessionType: 'seminar',
    });

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createSummaryRepository: () => new InMemorySummaryRepository(),
      createTranslateProvider: () => new FakeTranslateProvider(),
    });

    const res = await request(app).post(
      `/sessions/${session.id}/translate-live`,
      { text: '你好', language: 'en', sourceLanguage: 'zh' },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(res.status, 200);
    assert.equal((res.body.data as { text: string }).text, '[en] 你好');
  });
});
