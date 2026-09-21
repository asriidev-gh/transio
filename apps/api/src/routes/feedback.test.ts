import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { InMemoryFeedbackRepository } from '../services/feedback/repository.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
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

describe('session feedback API', () => {
  it('saves and clears thumbs feedback', async () => {
    const sessions = new InMemorySessionRepository();
    const feedback = new InMemoryFeedbackRepository();
    const session = await sessions.create(USER_A, {
      title: 'Seminar',
      sessionType: 'seminar',
    });

    const app = createApp({
      authenticate: testAuthenticate,
      createSessionRepository: () => sessions,
      createFeedbackRepository: () => feedback,
    });

    const put = await request(app).put(
      `/sessions/${session.id}/feedback`,
      { target: 'summary', rating: 'up' },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(put.status, 200);
    const putData = put.body.data as { summary: string | null; transcript: string | null };
    assert.equal(putData.summary, 'up');
    assert.equal(putData.transcript, null);

    const get = await request(app).get(`/sessions/${session.id}/feedback`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(get.status, 200);
    const getData = get.body.data as { summary: string | null };
    assert.equal(getData.summary, 'up');

    const clear = await request(app).put(
      `/sessions/${session.id}/feedback`,
      { target: 'summary', rating: null },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(clear.status, 200);
    const clearData = clear.body.data as { summary: string | null };
    assert.equal(clearData.summary, null);
  });
});
