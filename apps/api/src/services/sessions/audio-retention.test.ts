import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIO_RETENTION_DAYS, audioExpiryFor, sweepExpiredAudio } from './audio-retention.js';

const NOW = new Date('2026-09-26T12:00:00.000Z');

interface StubOptions {
  rows?: { id: string; audio_path: string | null }[];
  selectError?: string;
  removeError?: string;
  updateError?: string;
}

/**
 * Minimal stand-in for the Supabase client: records what the sweep asked for so
 * the tests can assert on the order and the arguments.
 */
function stubClient(options: StubOptions = {}) {
  const calls = { removed: [] as string[][], clearedIds: [] as string[][], filters: [] as string[] };

  const selectChain = {
    not(column: string) {
      calls.filters.push(`not:${column}`);
      return selectChain;
    },
    lt(column: string, value: string) {
      calls.filters.push(`lt:${column}:${value}`);
      return selectChain;
    },
    limit() {
      return Promise.resolve(
        options.selectError
          ? { data: null, error: { message: options.selectError } }
          : { data: options.rows ?? [], error: null },
      );
    },
  };

  const client = {
    from() {
      return {
        select() {
          return selectChain;
        },
        update() {
          return {
            in(_column: string, ids: string[]) {
              calls.clearedIds.push(ids);
              return Promise.resolve(
                options.updateError ? { error: { message: options.updateError } } : { error: null },
              );
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          remove(paths: string[]) {
            calls.removed.push(paths);
            return Promise.resolve(
              options.removeError ? { error: { message: options.removeError } } : { error: null },
            );
          },
        };
      },
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

describe('audioExpiryFor', () => {
  it('keeps audio for an active subscription', () => {
    assert.equal(audioExpiryFor(true, NOW), null);
  });

  it('gives everyone else a retention window', () => {
    const expiry = audioExpiryFor(false, NOW);
    assert.ok(expiry);
    const days = (new Date(expiry).getTime() - NOW.getTime()) / (24 * 60 * 60 * 1000);
    assert.equal(days, AUDIO_RETENTION_DAYS);
  });
});

describe('sweepExpiredAudio', () => {
  it('deletes expired objects and clears the paths that pointed at them', async () => {
    const { client, calls } = stubClient({
      rows: [
        { id: 'a', audio_path: 'user/a/audio.m4a' },
        { id: 'b', audio_path: 'user/b/audio.m4a' },
      ],
    });

    const count = await sweepExpiredAudio(client, NOW);

    assert.equal(count, 2);
    assert.deepEqual(calls.removed, [['user/a/audio.m4a', 'user/b/audio.m4a']]);
    assert.deepEqual(calls.clearedIds, [['a', 'b']]);
  });

  it('only looks at rows that still have audio and have expired', async () => {
    const { client, calls } = stubClient();
    await sweepExpiredAudio(client, NOW);
    assert.ok(calls.filters.includes('not:audio_path'));
    assert.ok(calls.filters.includes('not:audio_expires_at'));
    assert.ok(calls.filters.includes(`lt:audio_expires_at:${NOW.toISOString()}`));
  });

  it('does nothing when nothing has expired', async () => {
    const { client, calls } = stubClient({ rows: [] });
    assert.equal(await sweepExpiredAudio(client, NOW), 0);
    assert.deepEqual(calls.removed, []);
    assert.deepEqual(calls.clearedIds, []);
  });

  it('keeps the path when the object could not be deleted, so the next pass retries', async () => {
    const { client, calls } = stubClient({
      rows: [{ id: 'a', audio_path: 'user/a/audio.m4a' }],
      removeError: 'storage unavailable',
    });

    await assert.rejects(() => sweepExpiredAudio(client, NOW), /Expired audio delete failed/);
    assert.deepEqual(calls.clearedIds, []);
  });

  it('reports a failed path clear so the object is not silently orphaned', async () => {
    const { client } = stubClient({
      rows: [{ id: 'a', audio_path: 'user/a/audio.m4a' }],
      updateError: 'row locked',
    });

    await assert.rejects(() => sweepExpiredAudio(client, NOW), /Expired audio path clear failed/);
  });

  it('surfaces a lookup failure rather than reporting a clean sweep', async () => {
    const { client } = stubClient({ selectError: 'connection reset' });
    await assert.rejects(() => sweepExpiredAudio(client, NOW), /Expired audio lookup failed/);
  });
});
