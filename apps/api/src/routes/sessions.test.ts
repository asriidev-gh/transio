import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { mapSessionRow } from '../services/sessions/mapper.js';
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

function createTestApp(repo = new InMemorySessionRepository()) {
  return {
    repo,
    app: createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => repo,
    }),
  };
}

describe('sessions API', () => {
  it('creates a session for the authenticated user', async () => {
    const { app } = createTestApp();
    const res = await request(app).post(
      '/sessions',
      {
        title: 'GLC Session 3',
        sessionType: 'group_discussion',
        description: 'Weekly discussion',
      },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const data = res.body.data as Record<string, unknown>;
    assert.equal(data.title, 'GLC Session 3');
    assert.equal(data.sessionType, 'group_discussion');
    assert.equal(data.userId, USER_A);
    assert.equal(data.status, 'recording');
  });

  it('lists only the current user sessions', async () => {
    const { app } = createTestApp();
    await request(app).post(
      '/sessions',
      { title: 'A1', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );
    await request(app).post(
      '/sessions',
      { title: 'B1', sessionType: 'meeting' },
      { Authorization: 'Bearer token-b' },
    );

    const res = await request(app).get('/sessions', { Authorization: 'Bearer token-a' });
    assert.equal(res.status, 200);
    const sessions = res.body.data as Array<{ title: string; userId: string }>;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.title, 'A1');
    assert.equal(sessions[0]?.userId, USER_A);
  });

  it('prevents access to another user session', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Private', sessionType: 'bible_study' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).get(`/sessions/${id}`, {
      Authorization: 'Bearer token-b',
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'NOT_FOUND');
  });

  it('updates a session owned by the user', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Draft', sessionType: 'lecture' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).patch(
      `/sessions/${id}`,
      { title: 'Updated Lecture', durationSeconds: 90 },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 200);
    const data = res.body.data as { title: string; durationSeconds: number };
    assert.equal(data.title, 'Updated Lecture');
    assert.equal(data.durationSeconds, 90);
  });

  it('deletes a session owned by the user', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Disposable', sessionType: 'other' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const deleted = await request(app).delete(`/sessions/${id}`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(deleted.status, 200);
    assert.equal((deleted.body.data as { id: string }).id, id);

    const missing = await request(app).get(`/sessions/${id}`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(missing.status, 404);
  });

  it('prevents deleting another user session', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Keep', sessionType: 'meeting' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).delete(`/sessions/${id}`, {
      Authorization: 'Bearer token-b',
    });
    assert.equal(res.status, 404);
  });

  it('rejects invalid create payloads', async () => {
    const { app } = createTestApp();
    const res = await request(app).post(
      '/sessions',
      { title: '', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/sessions');
    assert.equal(res.status, 401);
    assert.equal(res.body.error?.code, 'UNAUTHORIZED');
  });
});

describe('mapSessionRow', () => {
  it('maps snake_case database rows to camelCase', () => {
    const mapped = mapSessionRow({
      id: USER_A,
      user_id: USER_B,
      title: 'Test',
      session_type: 'seminar',
      description: null,
      recorded_at: '2026-09-20T00:00:00.000Z',
      duration_seconds: 12,
      audio_path: null,
      status: 'completed',
      created_at: '2026-09-20T00:00:00.000Z',
      updated_at: '2026-09-20T00:00:00.000Z',
    });

    assert.equal(mapped.userId, USER_B);
    assert.equal(mapped.sessionType, 'seminar');
    assert.equal(mapped.durationSeconds, 12);
  });
});
