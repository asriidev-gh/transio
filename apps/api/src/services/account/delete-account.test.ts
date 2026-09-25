import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteAccount, deleteUserAudio } from './delete-account.js';

const USER = '11111111-1111-1111-1111-111111111111';

interface FakeOptions {
  /** Paths (relative to the bucket) that exist, for example "user/session/audio.m4a". */
  files: string[];
  removeError?: boolean;
  listError?: boolean;
  deleteUserError?: boolean;
}

function fakeClient(options: FakeOptions) {
  const removed: string[] = [];
  const deletedUsers: string[] = [];

  const storage = {
    async list(prefix: string, { limit, offset }: { limit: number; offset: number }) {
      if (options.listError) return { data: null, error: { message: 'list failed' } };
      const depth = prefix.split('/').length;
      const names = new Map<string, boolean>();
      for (const file of options.files) {
        if (!file.startsWith(`${prefix}/`)) continue;
        const rest = file.slice(prefix.length + 1).split('/');
        const first = rest[0] ?? '';
        names.set(first, rest.length === 1 || names.get(first) === true);
      }
      void depth;
      const all = [...names.entries()].map(([name, isFile]) => ({
        name,
        id: isFile ? `id-${name}` : null,
      }));
      return { data: all.slice(offset, offset + limit), error: null };
    },
    async remove(paths: string[]) {
      if (options.removeError) return { data: null, error: { message: 'remove failed' } };
      removed.push(...paths);
      return { data: [], error: null };
    },
  };

  const client = {
    storage: { from: () => storage },
    auth: {
      admin: {
        async deleteUser(id: string) {
          if (options.deleteUserError) return { error: { message: 'nope' } };
          deletedUsers.push(id);
          return { error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  return { client, removed, deletedUsers };
}

describe('deleteUserAudio', () => {
  it('removes recordings in session folders and files directly under the user', async () => {
    const { client, removed } = fakeClient({
      files: [
        `${USER}/session-a/audio.m4a`,
        `${USER}/session-b/audio.mp3`,
        `${USER}/stray.wav`,
        `someone-else/session-x/audio.m4a`,
      ],
    });

    const count = await deleteUserAudio(client, USER);

    assert.equal(count, 3);
    assert.deepEqual(removed.sort(), [
      `${USER}/session-a/audio.m4a`,
      `${USER}/session-b/audio.mp3`,
      `${USER}/stray.wav`,
    ]);
  });

  it('handles an account with no recordings', async () => {
    const { client, removed } = fakeClient({ files: [] });
    assert.equal(await deleteUserAudio(client, USER), 0);
    assert.equal(removed.length, 0);
  });

  it('pages through more than one page of files', async () => {
    const files = Array.from({ length: 250 }, (_, i) => `${USER}/s${i}/audio.m4a`);
    const { client, removed } = fakeClient({ files });
    assert.equal(await deleteUserAudio(client, USER), 250);
    assert.equal(removed.length, 250);
  });
});

describe('deleteAccount', () => {
  it('deletes recordings and then the login', async () => {
    const { client, removed, deletedUsers } = fakeClient({ files: [`${USER}/s/audio.m4a`] });
    await deleteAccount(client, USER);
    assert.equal(removed.length, 1);
    assert.deepEqual(deletedUsers, [USER]);
  });

  it('keeps the login when recordings cannot be removed, so the user can retry', async () => {
    const { client, deletedUsers } = fakeClient({ files: [`${USER}/s/audio.m4a`], removeError: true });
    await assert.rejects(() => deleteAccount(client, USER), /recordings/);
    assert.equal(deletedUsers.length, 0);
  });

  it('keeps the login when listing fails', async () => {
    const { client, deletedUsers } = fakeClient({ files: [], listError: true });
    await assert.rejects(() => deleteAccount(client, USER));
    assert.equal(deletedUsers.length, 0);
  });

  it('reports a failure to delete the login', async () => {
    const { client } = fakeClient({ files: [], deleteUserError: true });
    await assert.rejects(() => deleteAccount(client, USER), /Could not delete your account/);
  });
});
