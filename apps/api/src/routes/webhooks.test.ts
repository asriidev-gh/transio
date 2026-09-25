import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import { errorHandler } from '../middleware/error-handler.js';
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
}) {
  const applied: SubscriptionUpdate[] = [];
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
    }),
  );
  app.use(errorHandler);
  return { app, applied };
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
