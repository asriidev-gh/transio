import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickUserId, subscriptionUpdateFromEvent, type RevenueCatEvent } from './revenuecat.js';

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function event(overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent {
  return {
    type: 'INITIAL_PURCHASE',
    app_user_id: USER,
    product_id: 'smart_transcriber_monthly',
    entitlement_ids: ['pro'],
    expiration_at_ms: NOW + 30 * DAY,
    event_timestamp_ms: NOW - 1000,
    environment: 'PRODUCTION',
    ...overrides,
  };
}

describe('subscriptionUpdateFromEvent', () => {
  it('activates a new purchase until its expiration', () => {
    const update = subscriptionUpdateFromEvent(event(), 'pro', NOW);
    assert.deepEqual(update, {
      userId: USER,
      isActive: true,
      planId: 'smart_transcriber_monthly',
      expiresAt: new Date(NOW + 30 * DAY).toISOString(),
      environment: 'PRODUCTION',
      eventMs: NOW - 1000,
    });
  });

  it('keeps access after a cancellation until the period ends', () => {
    const update = subscriptionUpdateFromEvent(event({ type: 'CANCELLATION' }), 'pro', NOW);
    assert.equal(update?.isActive, true);
  });

  it('ends access on expiration, whatever the expiration time says', () => {
    const update = subscriptionUpdateFromEvent(
      event({ type: 'EXPIRATION', expiration_at_ms: NOW + DAY }),
      'pro',
      NOW,
    );
    assert.equal(update?.isActive, false);
  });

  it('treats a past expiration as inactive and a missing one as lifetime access', () => {
    assert.equal(
      subscriptionUpdateFromEvent(event({ type: 'RENEWAL', expiration_at_ms: NOW - DAY }), 'pro', NOW)
        ?.isActive,
      false,
    );
    const lifetime = subscriptionUpdateFromEvent(
      event({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: null }),
      'pro',
      NOW,
    );
    assert.equal(lifetime?.isActive, true);
    assert.equal(lifetime?.expiresAt, null);
  });

  it('uses the new product on a plan change', () => {
    const update = subscriptionUpdateFromEvent(
      event({ type: 'PRODUCT_CHANGE', new_product_id: 'smart_transcriber_yearly' }),
      'pro',
      NOW,
    );
    assert.equal(update?.planId, 'smart_transcriber_yearly');
  });

  it('ignores events that change nothing or belong to someone else', () => {
    assert.equal(subscriptionUpdateFromEvent(event({ type: 'TEST' }), 'pro', NOW), null);
    assert.equal(subscriptionUpdateFromEvent(event({ type: 'TRANSFER' }), 'pro', NOW), null);
    assert.equal(subscriptionUpdateFromEvent(undefined, 'pro', NOW), null);
    assert.equal(
      subscriptionUpdateFromEvent(event({ entitlement_ids: ['other'] }), 'pro', NOW),
      null,
    );
    assert.equal(
      subscriptionUpdateFromEvent(event({ app_user_id: '$RCAnonymousID:abc123' }), 'pro', NOW),
      null,
    );
  });

  it('accepts events with no entitlement list', () => {
    assert.ok(subscriptionUpdateFromEvent(event({ entitlement_ids: null }), 'pro', NOW));
  });
});

describe('pickUserId', () => {
  it('falls back to aliases when the app user id is anonymous', () => {
    assert.equal(
      pickUserId({ app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc', USER] }),
      USER,
    );
    assert.equal(pickUserId({ app_user_id: '$RCAnonymousID:abc' }), null);
  });
});
