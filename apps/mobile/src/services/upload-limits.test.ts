import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_UPLOAD_LIMITS,
  durationLimitError,
  formatFileSize,
  formatLimitMinutes,
  uploadLimitHint,
  uploadSizeError,
} from './upload-limits';

describe('upload limits', () => {
  it('accepts files within limits and unknown sizes', () => {
    assert.equal(uploadSizeError(100 * 1024 * 1024, DEFAULT_UPLOAD_LIMITS), null);
    assert.equal(uploadSizeError(null), null);
    assert.equal(durationLimitError(50 * 60, DEFAULT_UPLOAD_LIMITS), null);
    assert.equal(durationLimitError(undefined), null);
  });

  it('explains oversize files and recordings', () => {
    const size = uploadSizeError(612 * 1024 * 1024, DEFAULT_UPLOAD_LIMITS);
    assert.match(size ?? '', /612 MB/);
    assert.match(size ?? '', /100 MB/);
    const dur = durationLimitError(67 * 60 + 25, DEFAULT_UPLOAD_LIMITS);
    assert.match(dur ?? '', /67 min/);
    assert.match(dur ?? '', /50 min/);
  });

  it('formats hints with API-provided limits', () => {
    assert.equal(formatLimitMinutes(50), '50 min');
    assert.equal(formatLimitMinutes(210), '3.5 hours');
    assert.equal(formatFileSize(5 * 1024 * 1024), '5 MB');
    assert.match(uploadLimitHint({ maxUploadMb: 100, maxAudioMinutes: 50 }), /up to 100 MB and 50 min/);
  });
});
