import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { InMemoryFolderRepository } from '../services/folders/repository.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { request } from './test-helpers/request.js';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function testAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.headers.authorization);
  if (token === 'token-a') {
    req.user = { id: USER_A, email: 'a@example.com' };
    req.accessToken = token;
    next();
    return;
  }
  if (token === 'token-b') {
    req.user = { id: USER_B, email: 'b@example.com' };
    req.accessToken = token;
    next();
    return;
  }
  next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
}

function createTestApp() {
  const folders = new InMemoryFolderRepository();
  const sessions = new InMemorySessionRepository();
  const app = createApp({
    authenticate: testAuthenticate,
    createFolderRepository: () => folders,
    createSessionRepository: () => sessions,
  });
  return { app, folders, sessions };
}

describe('folders API', () => {
  it('rejects an empty folder name', async () => {
    const { app } = createTestApp();
    const res = await request(app).post(
      '/folders',
      { name: '   ' },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  });

  it('creates and lists folders for the current user', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/folders',
      { name: '  Lectures  ' },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(created.status, 201);
    const folder = created.body.data as { id: string; name: string; userId: string };
    assert.equal(folder.name, 'Lectures');
    assert.equal(folder.userId, USER_A);

    await request(app).post(
      '/folders',
      { name: 'Other user' },
      { Authorization: 'Bearer token-b' },
    );

    const listed = await request(app).get('/folders', { Authorization: 'Bearer token-a' });
    assert.equal(listed.status, 200);
    const rows = listed.body.data as Array<{ name: string }>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, 'Lectures');
  });

  it('renames and deletes a folder', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/folders',
      { name: 'Temp' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const renamed = await request(app).patch(
      `/folders/${id}`,
      { name: 'Archive' },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(renamed.status, 200);
    assert.equal((renamed.body.data as { name: string }).name, 'Archive');

    const deleted = await request(app).delete(`/folders/${id}`, {
      Authorization: 'Bearer token-a',
    });
    assert.equal(deleted.status, 200);

    const listed = await request(app).get('/folders', { Authorization: 'Bearer token-a' });
    assert.equal((listed.body.data as unknown[]).length, 0);
  });

  it('prevents another user from deleting a folder', async () => {
    const { app } = createTestApp();
    const created = await request(app).post(
      '/folders',
      { name: 'Private' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).delete(`/folders/${id}`, {
      Authorization: 'Bearer token-b',
    });
    assert.equal(res.status, 404);
  });

  it('files a session into a folder', async () => {
    const { app } = createTestApp();
    const folderRes = await request(app).post(
      '/folders',
      { name: 'GLC' },
      { Authorization: 'Bearer token-a' },
    );
    const folderId = (folderRes.body.data as { id: string }).id;

    const sessionRes = await request(app).post(
      '/sessions',
      { title: 'Week 1', sessionType: 'seminar', folderId },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(sessionRes.status, 201);
    assert.equal((sessionRes.body.data as { folderId: string | null }).folderId, folderId);

    const unfile = await request(app).patch(
      `/sessions/${(sessionRes.body.data as { id: string }).id}`,
      { folderId: null },
      { Authorization: 'Bearer token-a' },
    );
    assert.equal(unfile.status, 200);
    assert.equal((unfile.body.data as { folderId: string | null }).folderId, null);
  });
});
