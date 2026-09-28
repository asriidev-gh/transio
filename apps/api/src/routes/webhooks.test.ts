import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import { errorHandler } from '../middleware/error-handler.js';
import type { StoredSubscription } from '../services/billing/repository.js';
import type { SubscriptionUpdate } from '../services/billing/revenuecat.js';
import { authorizationMatches, createWebhooksRouter } from './webhooks.js';
import { request } from './test-helpers/request.js';

const USER = '11111111-1111-4111-8111-111111111111';
const SECRET = 'webhook-secret-value';

function body(type = 'INITIAL_PURCHASE') {
  return {
    api_version: '1.0',
    event: {
      type,
      app_user_id: USER,
      product_id: 'smart_transcriber_monthly',
      entitlement_ids: ['pro'],
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      event_timestamp_ms: Date.now(),
      environment: 'SANDBOX',
    },
  };
}

function makeApp(options: {
  secret?: string;
  apply?: (update: SubscriptionUpdate) => Promise<boolean>;
  read?: (userId: string) => Promise<StoredSubscription | null>;
  onSubscriptionChanged?: (userId: string, isPro: boolean) => Promise<void>;
}) {
  const applied: SubscriptionUpdate[] = [];
  const rescheduled: { userId: string; isPro: boolean }[] = [];
  const app = express();
  app.use(express.json());
  app.use(
    '/webhooks',
    createWebhooksRouter({
      secret: () => options.secret ?? SECRET,
      entitlementId: () => 'pro',
      apply:
        options.apply ??
        (async (update) => {
          applied.push(update);
          return true;
        }),
      read: options.read ?? (async () => null),
      onSubscriptionChanged:
        options.onSubscriptionChanged ??
        (async (userId, isPro) => {
          rescheduled.push({ userId, isPro });
        }),
    }),
  );
  app.use(errorHandler);
  return { app, applied, rescheduled };
}

describe('authorizationMatches', () => {
  it('accepts the raw secret or a Bearer prefix and rejects anything else', () => {
    assert.equal(authorizationMatches(SECRET, SECRET), true);
    assert.equal(authorizationMatches(`Bearer ${SECRET}`, SECRET), true);
    assert.equal(authorizationMatches('wrong', SECRET), false);
    assert.equal(authorizationMatches(undefined, SECRET), false);
    assert.equal(authorizationMatches(SECRET, ''), false);
  });
});

describe('POST /webhooks/revenuecat', () => {
  it('applies a valid event from RevenueCat', async () => {
    const { app, applied } = makeApp({});

    const res = await request(app).post('/webhooks/revenuecat', body(), { Authorization: SECRET });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { applied: true });
    assert.equal(applied.length, 1);
    assert.equal(applied[0]?.userId, USER);
    assert.equal(applied[0]?.isActive, true);
  });

  it('also accepts a Bearer authorization header', async () => {
    const { app, applied } = makeApp({});
    const res = await request(app).post('/webhooks/revenuecat', body(), {
      Authorization: `Bearer ${SECRET}`,
    });
    assert.equal(res.status, 200);
    assert.equal(applied.length, 1);
  });

  it('rejects a wrong secret and applies nothing', async () => {
    const { app, applied } = makeApp({});
    const res = await request(app).post('/webhooks/revenuecat', body(), {
      Authorization: 'Bearer nope',
    });
    assert.equal(res.status, 401);
    assert.equal(applied.length, 0);
  });

  it('rejects a missing header', async () => {
    const { app, applied } = makeApp({});
    const res = await request(app).post('/webhooks/revenuecat', body());
    assert.equal(res.status, 401);
    assert.equal(applied.length, 0);
  });

  it('is disabled with 503 when no secret is configured', async () => {
    const { app } = makeApp({ secret: '' });
    const res = await request(app).post('/webhooks/revenuecat', body(), { Authorization: SECRET });
    assert.equal(res.status, 503);
    assert.equal(res.body.error?.code, 'WEBHOOK_DISABLED');
  });

  it('answers 200 for ignored events so RevenueCat does not retry them', async () => {
    const { app, applied } = makeApp({});
    const res = await request(app).post('/webhooks/revenuecat', body('TEST'), {
      Authorization: SECRET,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { applied: false, reason: 'ignored' });
    assert.equal(applied.length, 0);
  });

  it('lets a database failure surface so the delivery is retried', async () => {
    const { app } = makeApp({
      apply: async () => {
        throw new Error('db down');
      },
    });
    const res = await request(app).post('/webhooks/revenuecat', body(), { Authorization: SECRET });
    assert.equal(res.status, 500);
  });
});

describe('audio retention after a billing event', () => {
  it('reschedules stored audio when the subscription is recorded', async () => {
    const { app, rescheduled } = makeApp({});

    const res = await request(app).post('/webhooks/revenuecat', body(), {
      Authorization: `Bearer ${SECRET}`,
    });

    assert.equal(res.status, 200);
    assert.equal(rescheduled.length, 1);
    assert.equal(rescheduled[0]?.isPro, true);
  });

  it('leaves retention alone when the event was a duplicate', async () => {
    const { app, rescheduled } = makeApp({ apply: async () => false });

    await request(app).post('/webhooks/revenuecat', body(), {
      Authorization: `Bearer ${SECRET}`,
    });

    assert.deepEqual(rescheduled, []);
  });

  it('still answers 200 when rescheduling fails, so RevenueCat does not retry', async () => {
    const { app } = makeApp({
      onSubscriptionChanged: async () => {
        throw new Error('database unavailable');
      },
    });

    const res = await request(app).post('/webhooks/revenuecat', body(), {
      Authorization: `Bearer ${SECRET}`,
    });

    assert.equal(res.status, 200);
  });
});

describe('purchase transferred to another account', () => {
  const NEW_USER = '22222222-2222-4222-8222-222222222222';
  const yearly: StoredSubscription = {
    isActive: true,
    planId: 'pro_yearly:yearly',
    expiresAt: '2027-09-28T00:00:00.000Z',
    environment: 'SANDBOX',
  };

  function transferBody(from: string[], to: string[]) {
    return {
      api_version: '1.0',
      event: {
        type: 'TRANSFER',
        transferred_from: from,
        transferred_to: to,
        event_timestamp_ms: 1_800_000_000_000,
        environment: 'SANDBOX',
      },
    };
  }

  it('moves the subscription to the new account and ends it on the old one', async () => {
    const { app, applied, rescheduled } = makeApp({
      read: async (userId) => (userId === USER ? yearly : null),
    });

    const res = await request(app).post(
      '/webhooks/revenuecat',
      transferBody([USER, '$RCAnonymousID:abc'], [NEW_USER]),
      { Authorization: SECRET },
    );

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { applied: true });
    assert.deepEqual(applied, [
      { ...yearly, userId: NEW_USER, eventMs: 1_800_000_000_000 },
      {
        userId: USER,
        isActive: false,
        planId: null,
        expiresAt: null,
        environment: 'SANDBOX',
        eventMs: 1_800_000_000_000,
      },
    ]);
    assert.deepEqual(rescheduled, [
      { userId: NEW_USER, isPro: true },
      { userId: USER, isPro: false },
    ]);
  });

  it('applies nothing when the old account has no stored subscription', async () => {
    const { app, applied } = makeApp({});
    const res = await request(app).post('/webhooks/revenuecat', transferBody([USER], [NEW_USER]), {
      Authorization: SECRET,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { applied: false });
    assert.equal(applied.length, 0);
  });

  it('ignores a transfer between ids that are not our accounts', async () => {
    const { app, applied } = makeApp({ read: async () => yearly });
    const res = await request(app).post(
      '/webhooks/revenuecat',
      transferBody(['$RCAnonymousID:abc'], [NEW_USER]),
      { Authorization: SECRET },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { applied: false, reason: 'ignored' });
    assert.equal(applied.length, 0);
  });
});
