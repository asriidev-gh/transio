import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import { fetchRemoteMedia } from './fetch-media.js';

function jsonResponse(): never {
  throw new Error('unused');
}

describe('fetchRemoteMedia', () => {
  it('downloads a public mp4 via injected fetch', async () => {
    const body = Buffer.from('fake-mp4-bytes');
    const result = await fetchRemoteMedia('https://cdn.example.com/talks/week1.mp4', {
      lookupFn: async () => ({ address: '1.1.1.1', family: 4 }),
      fetchImpl: async () =>
        new Response(body, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': String(body.byteLength),
          },
        }),
    });
    assert.equal(result.mimeType, 'video/mp4');
    assert.equal(result.fileName, 'week1.mp4');
    assert.equal(result.data.equals(body), true);
  });

  it('rejects YouTube without fetching', async () => {
    let fetched = false;
    await assert.rejects(
      () =>
        fetchRemoteMedia('https://youtu.be/abc123', {
          lookupFn: async () => ({ address: '1.1.1.1', family: 4 }),
          fetchImpl: async () => {
            fetched = true;
            return jsonResponse();
          },
        }),
      (err: unknown) => err instanceof AppError && err.code === 'VALIDATION_ERROR',
    );
    assert.equal(fetched, false);
  });

  it('rejects hosts that resolve to private IPs', async () => {
    await assert.rejects(
      () =>
        fetchRemoteMedia('https://evil.example.com/a.mp3', {
          lookupFn: async () => ({ address: '127.0.0.1', family: 4 }),
          fetchImpl: async () => jsonResponse(),
        }),
      (err: unknown) => err instanceof AppError && /Local URLs/i.test(err.message),
    );
  });
});
