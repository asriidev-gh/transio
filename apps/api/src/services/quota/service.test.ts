import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import { parseGlobalLimits, QuotaService, type QuotaConfig } from './service.js';
import type {
  ConsumeOutcome,
  ConsumeParams,
  QuotaContext,
  QuotaRepository,
  RefundParams,
} from './types.js';

class FakeRepo implements QuotaRepository {
  outcome: ConsumeOutcome = 'ok';
  pro = false;
  failConsume = false;
  owner: string | null = null;
  consumeCalls: ConsumeParams[] = [];
  refundCalls: RefundParams[] = [];

  async consume(params: ConsumeParams): Promise<ConsumeOutcome> {
    this.consumeCalls.push(params);
    if (this.failConsume) throw new Error('db down');
    return this.outcome;
  }
  async refund(params: RefundParams): Promise<void> {
    this.refundCalls.push(params);
  }
  async isPro(): Promise<boolean> {
    return this.pro;
  }
  async claimGuestDevice(userId: string): Promise<{ ownerUserId: string }> {
    this.owner ??= userId;
    return { ownerUserId: this.owner };
  }
}

const ctx: QuotaContext = { userId: 'user-1', isAnonymous: true, deviceHash: 'device-hash' };

function config(overrides: Partial<QuotaConfig> = {}): QuotaConfig {
  return {
    mode: 'on',
    freeLimit: 2,
    proDailyLimit: 5,
    globalLimits: { summary: 300 },
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof AppError);
    return err;
  }
  throw new Error('Expected the promise to reject');
}

describe('QuotaService.charge', () => {
  it('does nothing when off or when there is no repository', async () => {
    const repo = new FakeRepo();
    await new QuotaService(repo, config({ mode: 'off' })).charge(ctx, 'summary');
    assert.equal(repo.consumeCalls.length, 0);

    const noRepo = new QuotaService(null, config());
    assert.equal(noRepo.mode, 'off');
    await noRepo.charge(ctx, 'summary');
  });

  it('passes limits to the database and refunds with the same identity', async () => {
    const repo = new FakeRepo();
    const charge = await new QuotaService(repo, config()).charge(ctx, 'summary');

    assert.deepEqual(repo.consumeCalls[0], {
      feature: 'summary',
      userId: 'user-1',
      deviceHash: 'device-hash',
      isPro: false,
      freeLimit: 2,
      proDailyLimit: 5,
      globalLimit: 300,
      conversationId: null,
    });

    await charge.refund();
    assert.equal(repo.refundCalls.length, 1);
    assert.equal(repo.refundCalls[0]?.feature, 'summary');
    assert.equal(repo.refundCalls[0]?.deviceHash, 'device-hash');
  });

  it('treats subscribers as Pro and skips the global cap for features without one', async () => {
    const repo = new FakeRepo();
    repo.pro = true;
    await new QuotaService(repo, config()).charge(ctx, 'session');
    assert.equal(repo.consumeCalls[0]?.isPro, true);
    assert.equal(repo.consumeCalls[0]?.globalLimit, null);
  });

  it('does not charge or refund a conversation that was already counted', async () => {
    const repo = new FakeRepo();
    repo.outcome = 'already_counted';
    const charge = await new QuotaService(repo, config()).charge(ctx, 'voiceTranslate', {
      conversationId: 'conversation-1',
    });
    await charge.refund();
    assert.equal(repo.consumeCalls[0]?.conversationId, 'conversation-1');
    assert.equal(repo.refundCalls.length, 0);
  });

  it('blocks over-limit requests in on mode with a paywall or daily code', async () => {
    const repo = new FakeRepo();
    const service = new QuotaService(repo, config());

    repo.outcome = 'free_limit';
    const free = await rejection(service.charge(ctx, 'summary'));
    assert.equal(free.statusCode, 402);
    assert.equal(free.code, 'QUOTA_EXCEEDED_FREE');

    repo.outcome = 'daily_limit';
    const daily = await rejection(service.charge(ctx, 'session'));
    assert.equal(daily.statusCode, 402);
    assert.equal(daily.code, 'QUOTA_EXCEEDED_DAILY');
  });

  it('only logs over-limit requests in log mode', async () => {
    const repo = new FakeRepo();
    repo.outcome = 'free_limit';
    const charge = await new QuotaService(repo, config({ mode: 'log' })).charge(ctx, 'summary');
    await charge.refund();
    assert.equal(repo.refundCalls.length, 0);
  });

  it('always enforces the spend kill switch', async () => {
    const repo = new FakeRepo();
    repo.outcome = 'paused';
    for (const mode of ['log', 'on'] as const) {
      const err = await rejection(new QuotaService(repo, config({ mode })).charge(ctx, 'summary'));
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, 'SERVICE_PAUSED');
    }
  });

  it('fails open when the database errors', async () => {
    const repo = new FakeRepo();
    repo.failConsume = true;
    const charge = await new QuotaService(repo, config()).charge(ctx, 'summary');
    await charge.refund();
    assert.equal(repo.refundCalls.length, 0);
  });
});

describe('QuotaService.claimDevice', () => {
  it('ignores signed-in accounts and unknown devices', async () => {
    const repo = new FakeRepo();
    const service = new QuotaService(repo, config());
    assert.deepEqual(await service.claimDevice({ ...ctx, isAnonymous: false }), {
      claimed: false,
      conflict: false,
    });
    assert.deepEqual(await service.claimDevice({ ...ctx, deviceHash: null }), {
      claimed: false,
      conflict: false,
    });
  });

  it('lets the first guest keep the device and blocks a second one in on mode', async () => {
    const repo = new FakeRepo();
    const service = new QuotaService(repo, config());
    assert.deepEqual(await service.claimDevice(ctx), { claimed: true, conflict: false });
    assert.deepEqual(await service.claimDevice(ctx), { claimed: true, conflict: false });

    const err = await rejection(service.claimDevice({ ...ctx, userId: 'user-2' }));
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'DEVICE_ALREADY_CLAIMED');
  });

  it('only reports the conflict in log mode', async () => {
    const repo = new FakeRepo();
    const service = new QuotaService(repo, config({ mode: 'log' }));
    await service.claimDevice(ctx);
    assert.deepEqual(await service.claimDevice({ ...ctx, userId: 'user-2' }), {
      claimed: false,
      conflict: true,
    });
  });
});

describe('parseGlobalLimits', () => {
  it('reads valid entries and ignores malformed ones', () => {
    assert.deepEqual(parseGlobalLimits('session=300, summary=50,voiceTranslate=3000'), {
      session: 300,
      summary: 50,
      voiceTranslate: 3000,
    });
    assert.deepEqual(parseGlobalLimits('bogus=5,summary=abc,session=0,voiceTranslate'), {});
    assert.deepEqual(parseGlobalLimits(''), {});
  });
});
