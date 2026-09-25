import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { setQuotaServiceForTests } from '../services/quota/index.js';
import { QuotaService } from '../services/quota/service.js';
import type {
  ConsumeOutcome,
  ConsumeParams,
  QuotaRepository,
  RefundParams,
} from '../services/quota/types.js';
import { request } from './test-helpers/request.js';

const USER = '11111111-1111-1111-1111-111111111111';
const DEVICE = '9774d56d682e549c';
const AUTH = { Authorization: 'Bearer token-a', 'x-device-id': DEVICE };
const NEW_SESSION = { title: 'Quota test', sessionType: 'seminar' };

function authenticate(req: Request, _res: Response, next: NextFunction): void {
  if (parseBearerToken(req.headers.authorization) === 'token-a') {
    req.user = { id: USER, email: null, isAnonymous: true };
    req.accessToken = 'token-a';
    next();
    return;
  }
  next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
}

class ScriptedRepo implements QuotaRepository {
  outcome: ConsumeOutcome = 'ok';
  consumed: ConsumeParams[] = [];
  refunded: RefundParams[] = [];
  async consume(params: ConsumeParams) {
    this.consumed.push(params);
    return this.outcome;
  }
  async refund(params: RefundParams) {
    this.refunded.push(params);
  }
  async isPro() {
    return false;
  }
  async claimGuestDevice(userId: string) {
    return { ownerUserId: userId };
  }
}

function useQuota(repo: ScriptedRepo, mode: 'log' | 'on' = 'on') {
  setQuotaServiceForTests(
    new QuotaService(repo, { mode, freeLimit: 2, proDailyLimit: 5, globalLimits: {} }),
  );
}

describe('quota wiring', () => {
  afterEach(() => setQuotaServiceForTests(null));

  it('creates the session and charges the hashed device when under the limit', async () => {
    const repo = new ScriptedRepo();
    useQuota(repo);
    const app = createApp({ authenticate, createSessionRepository: () => new InMemorySessionRepository() });

    const res = await request(app).post('/sessions', NEW_SESSION, AUTH);

    assert.equal(res.status, 201);
    assert.equal(repo.consumed.length, 1);
    assert.equal(repo.consumed[0]?.feature, 'session');
    assert.notEqual(repo.consumed[0]?.deviceHash, null);
    assert.notEqual(repo.consumed[0]?.deviceHash, DEVICE);
  });

  it('answers 402 and creates nothing when the free limit is reached', async () => {
    const repo = new ScriptedRepo();
    repo.outcome = 'free_limit';
    useQuota(repo);
    const sessions = new InMemorySessionRepository();
    const app = createApp({ authenticate, createSessionRepository: () => sessions });

    const res = await request(app).post('/sessions', NEW_SESSION, AUTH);

    assert.equal(res.status, 402);
    assert.equal(res.body.error?.code, 'QUOTA_EXCEEDED_FREE');
    assert.equal((await sessions.list(USER)).length, 0);
  });

  it('still creates the session in log mode', async () => {
    const repo = new ScriptedRepo();
    repo.outcome = 'free_limit';
    useQuota(repo, 'log');
    const app = createApp({ authenticate, createSessionRepository: () => new InMemorySessionRepository() });

    const res = await request(app).post('/sessions', NEW_SESSION, AUTH);
    assert.equal(res.status, 201);
  });

  it('refunds the charge when creating the session fails', async () => {
    const repo = new ScriptedRepo();
    useQuota(repo);
    const failing = new InMemorySessionRepository();
    failing.create = async () => {
      throw new AppError('DATABASE_ERROR', 'boom', 500);
    };
    const app = createApp({ authenticate, createSessionRepository: () => failing });

    const res = await request(app).post('/sessions', NEW_SESSION, AUTH);

    assert.equal(res.status, 500);
    assert.equal(repo.refunded.length, 1);
    assert.equal(repo.refunded[0]?.feature, 'session');
  });

  it('claims the guest device through POST /device/claim', async () => {
    useQuota(new ScriptedRepo());
    const app = createApp({ authenticate });

    const ok = await request(app).post('/device/claim', {}, AUTH);
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data, { claimed: true, conflict: false });

    const missing = await request(app).post('/device/claim', {}, { Authorization: 'Bearer token-a' });
    assert.equal(missing.status, 400);

    const anon = await request(app).post('/device/claim', {}, AUTH_NONE);
    assert.equal(anon.status, 401);
  });
});

const AUTH_NONE = { 'x-device-id': DEVICE };
