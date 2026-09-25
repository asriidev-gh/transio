import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { failStaleSessions } from './stale-sweeper.js';

function fakeClient(result: {
  data: Array<{ id: string }> | null;
  error: { message: string } | null;
}) {
  const calls: Record<string, unknown> = {};
  const chain = {
    update(values: unknown) {
      calls.update = values;
      return chain;
    },
    in(column: string, values: unknown) {
      calls.in = [column, values];
      return chain;
    },
    lt(column: string, value: unknown) {
      calls.lt = [column, value];
      return chain;
    },
    select(columns: string) {
      calls.select = columns;
      return Promise.resolve(result);
    },
  };
  const client = {
    from(table: string) {
      calls.from = table;
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('failStaleSessions', () => {
  it('marks only old in-progress sessions as failed', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 'a' }, { id: 'b' }], error: null });
    const now = new Date('2026-09-25T12:00:00.000Z');
    const count = await failStaleSessions(client, 30, now);

    assert.equal(count, 2);
    assert.equal(calls.from, 'sessions');
    assert.deepEqual(calls.update, { status: 'failed' });
    assert.deepEqual(calls.in, ['status', ['transcribing', 'summarizing']]);
    assert.deepEqual(calls.lt, ['updated_at', '2026-09-25T11:30:00.000Z']);
  });

  it('throws when the database call fails', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'db down' } });
    await assert.rejects(() => failStaleSessions(client, 30), /db down/);
  });
});
