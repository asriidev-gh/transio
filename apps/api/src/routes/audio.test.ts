import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { buildSessionAudioPath, extensionFromMimeType } from '@sessionai/shared';
import { createApp } from '../app.js';
import { AppError } from '../middleware/error-handler.js';
import { parseBearerToken } from '../middleware/auth.js';
import { InMemorySessionRepository } from '../services/sessions/repository.js';
import { InMemoryAudioStorage } from '../services/storage/audio-storage.js';
import { buildMultipartBody, request } from './test-helpers/request.js';

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

function createAudioTestApp(overrides: Parameters<typeof createApp>[0] = {}) {
  const repo = new InMemorySessionRepository();
  const storage = new InMemoryAudioStorage();
  const app = createApp({
    authenticate: testAuthenticate,
    prepareMedia: async (input) => input,
    ...overrides,
    createSessionRepository: overrides.createSessionRepository ?? (() => repo),
    createAudioStorage: overrides.createAudioStorage ?? (() => storage),
  });
  return { app, repo, storage };
}

describe('audio storage helpers', () => {
  it('builds user-scoped storage paths', () => {
    assert.equal(
      buildSessionAudioPath(USER_A, '33333333-3333-3333-3333-333333333333', 'm4a'),
      `${USER_A}/33333333-3333-3333-3333-333333333333/audio.m4a`,
    );
  });

  it('maps mime types to extensions', () => {
    assert.equal(extensionFromMimeType('audio/webm'), 'webm');
    assert.equal(extensionFromMimeType('audio/mp4'), 'm4a');
    assert.equal(extensionFromMimeType('video/mp4'), 'mp4');
    assert.equal(extensionFromMimeType('audio/mpeg'), 'mp3');
  });
});

describe('session audio API', () => {
  it('uploads audio and marks session uploaded', async () => {
    const { app, storage } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Upload Me', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const multipart = buildMultipartBody(
      'file',
      'clip.m4a',
      'audio/mp4',
      Buffer.from('fake-audio-bytes'),
    );

    const res = await request(app).postRaw(`/sessions/${id}/audio`, multipart.body, {
      Authorization: 'Bearer token-a',
      'Content-Type': multipart.contentType,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data as { audioPath: string; status: string };
    assert.equal(data.status, 'uploaded');
    assert.equal(data.audioPath, `${USER_A}/${id}/audio.m4a`);
    assert.equal(storage.files.has(data.audioPath), true);
  });

  it('prevents another user from uploading to a session', async () => {
    const { app } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Private', sessionType: 'meeting' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    const multipart = buildMultipartBody('file', 'clip.m4a', 'audio/mp4', Buffer.from('x'));

    const res = await request(app).postRaw(`/sessions/${id}/audio`, multipart.body, {
      Authorization: 'Bearer token-b',
      'Content-Type': multipart.contentType,
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error?.code, 'NOT_FOUND');
  });

  it('creates a signed URL for uploaded audio', async () => {
    const { app } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Signed', sessionType: 'lecture' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    const multipart = buildMultipartBody('file', 'clip.webm', 'audio/webm', Buffer.from('abc'));
    await request(app).postRaw(`/sessions/${id}/audio`, multipart.body, {
      Authorization: 'Bearer token-a',
      'Content-Type': multipart.contentType,
    });

    const res = await request(app).get(`/sessions/${id}/audio-url`, {
      Authorization: 'Bearer token-a',
    });

    assert.equal(res.status, 200);
    const data = res.body.data as { url: string; expiresIn: number; audioPath: string };
    assert.ok(data.url.startsWith('https://signed.example/'));
    assert.equal(data.expiresIn, 3600);
    assert.equal(data.audioPath, `${USER_A}/${id}/audio.webm`);
  });

  it('rejects signed URL access for another user', async () => {
    const { app } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'No peek', sessionType: 'other' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    const multipart = buildMultipartBody('file', 'clip.m4a', 'audio/mp4', Buffer.from('abc'));
    await request(app).postRaw(`/sessions/${id}/audio`, multipart.body, {
      Authorization: 'Bearer token-a',
      'Content-Type': multipart.contentType,
    });

    const res = await request(app).get(`/sessions/${id}/audio-url`, {
      Authorization: 'Bearer token-b',
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error?.code, 'NOT_FOUND');
  });

  it('requires a file on upload', async () => {
    const { app } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Missing file', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).post(`/sessions/${id}/audio`, {}, {
      Authorization: 'Bearer token-a',
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
  });

  it('accepts an mp4 video upload', async () => {
    const { app, storage } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'Video talk', sessionType: 'lecture' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;
    const multipart = buildMultipartBody(
      'file',
      'talk.mp4',
      'video/mp4',
      Buffer.from('fake-mp4-bytes'),
    );

    const res = await request(app).postRaw(`/sessions/${id}/audio`, multipart.body, {
      Authorization: 'Bearer token-a',
      'Content-Type': multipart.contentType,
    });

    assert.equal(res.status, 200);
    const data = res.body.data as { audioPath: string; status: string };
    assert.equal(data.status, 'uploaded');
    assert.equal(data.audioPath, `${USER_A}/${id}/audio.mp4`);
    assert.equal(storage.files.has(data.audioPath), true);
  });

  it('imports a direct media URL through the injected fetcher', async () => {
    const { app, storage } = createAudioTestApp({
      fetchRemoteMedia: async () => ({
        data: Buffer.from('remote-mp3'),
        mimeType: 'audio/mpeg',
        fileName: 'remote.mp3',
      }),
    });
    const created = await request(app).post(
      '/sessions',
      { title: 'From URL', sessionType: 'seminar' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).post(
      `/sessions/${id}/import-url`,
      { url: 'https://cdn.example.com/lectures/week-1.mp3' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 200);
    const data = res.body.data as { audioPath: string; status: string };
    assert.equal(data.status, 'uploaded');
    assert.equal(data.audioPath, `${USER_A}/${id}/audio.mp3`);
    assert.equal(storage.files.get(data.audioPath)?.data.equals(Buffer.from('remote-mp3')), true);
  });

  it('rejects YouTube page links', async () => {
    const { app } = createAudioTestApp();
    const created = await request(app).post(
      '/sessions',
      { title: 'YouTube', sessionType: 'lecture' },
      { Authorization: 'Bearer token-a' },
    );
    const id = (created.body.data as { id: string }).id;

    const res = await request(app).post(
      `/sessions/${id}/import-url`,
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { Authorization: 'Bearer token-a' },
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR');
    assert.match(String(res.body.error?.message), /video page/i);
  });
});
