import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { request } from './test-helpers/request.js';

const USER = '11111111-1111-1111-1111-111111111111';
const AUTH = { Authorization: 'Bearer token-a' };

function authenticate(req: Request, _res: Response, next: NextFunction): void {
  if (parseBearerToken(req.headers.authorization) === 'token-a') {
    req.user = { id: USER, email: 'a@example.com' };
    req.accessToken = 'token-a';
    next();
    return;
  }
  next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
}

describe('DELETE /me', () => {
  it('deletes the signed-in account when confirmed', async () => {
    const deleted: string[] = [];
    const app = createApp({
      authenticate,
      deleteAccount: async (userId) => {
        deleted.push(userId);
      },
    });

    const res = await request(app).deleteWithBody('/me', { confirm: 'DELETE' }, AUTH);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { deleted: true });
    assert.deepEqual(deleted, [USER]);
  });

  it('refuses without the typed confirmation', async () => {
    const deleted: string[] = [];
    const app = createApp({
      authenticate,
      deleteAccount: async (userId) => {
        deleted.push(userId);
      },
    });

    for (const body of [undefined, {}, { confirm: 'yes' }, { confirm: 'delete' }]) {
      const res = await request(app).deleteWithBody('/me', body, AUTH);
      assert.equal(res.status, 400);
    }
    assert.equal(deleted.length, 0);
  });

  it('requires authentication', async () => {
    const app = createApp({ authenticate, deleteAccount: async () => undefined });
    const res = await request(app).deleteWithBody('/me', { confirm: 'DELETE' });
    assert.equal(res.status, 401);
  });

  it('reports a failed deletion instead of pretending it worked', async () => {
    const app = createApp({
      authenticate,
      deleteAccount: async () => {
        throw new AppError('ACCOUNT_DELETE_FAILED', 'Could not delete your account.', 500);
      },
    });
    const res = await request(app).deleteWithBody('/me', { confirm: 'DELETE' }, AUTH);
    assert.equal(res.status, 500);
    assert.equal(res.body.error?.code, 'ACCOUNT_DELETE_FAILED');
  });
});

describe('GET /me', () => {
  it('rejects requests without a bearer token', async () => {
    const app = createApp();
    const res = await request(app).get('/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'UNAUTHORIZED');
  });

  it('rejects malformed authorization headers', async () => {
    const app = createApp();
    const res = await request(app).get('/me', { Authorization: 'Basic nope' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error?.code, 'UNAUTHORIZED');
  });
});
