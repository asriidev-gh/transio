import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import {
  assertSafeMediaUrl,
  isBlockedMediaHost,
  isPrivateOrLocalIp,
} from './url-guard.js';

describe('media url guard', () => {
  it('flags YouTube and similar page hosts', () => {
    assert.equal(isBlockedMediaHost('youtube.com'), true);
    assert.equal(isBlockedMediaHost('www.youtube.com'), true);
    assert.equal(isBlockedMediaHost('m.youtube.com'), true);
    assert.equal(isBlockedMediaHost('youtu.be'), true);
    assert.equal(isBlockedMediaHost('vimeo.com'), true);
    assert.equal(isBlockedMediaHost('cdn.example.com'), false);
  });

  it('flags loopback and private IPs', () => {
    assert.equal(isPrivateOrLocalIp('127.0.0.1'), true);
    assert.equal(isPrivateOrLocalIp('10.0.0.8'), true);
    assert.equal(isPrivateOrLocalIp('192.168.1.1'), true);
    assert.equal(isPrivateOrLocalIp('172.16.0.1'), true);
    assert.equal(isPrivateOrLocalIp('169.254.169.254'), true);
    assert.equal(isPrivateOrLocalIp('8.8.8.8'), false);
  });

  it('allows a direct https media URL', () => {
    const url = assertSafeMediaUrl('https://cdn.example.com/lectures/week-1.mp4');
    assert.equal(url.hostname, 'cdn.example.com');
  });

  it('rejects YouTube watch links before fetch', () => {
    assert.throws(
      () => assertSafeMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      (err: unknown) => err instanceof AppError && err.code === 'VALIDATION_ERROR',
    );
  });

  it('rejects localhost', () => {
    assert.throws(
      () => assertSafeMediaUrl('http://localhost:8080/clip.mp4'),
      (err: unknown) => err instanceof AppError && err.statusCode === 400,
    );
  });
});
