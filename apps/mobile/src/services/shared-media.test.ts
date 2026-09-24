import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sharedIntentToImportParams } from './shared-media';

describe('sharedIntentToImportParams', () => {
  it('maps a shared video recording to a file uri', () => {
    const out = sharedIntentToImportParams({
      files: [{ fileName: 'Zoom Meeting.mp4', mimeType: 'video/mp4', path: '/data/cache/z.mp4' }],
    });
    assert.deepEqual(out, {
      sharedUri: 'file:///data/cache/z.mp4',
      sharedName: 'Zoom Meeting.mp4',
      sharedMime: 'video/mp4',
    });
  });

  it('keeps existing uri schemes and ignores non-media files', () => {
    const kept = sharedIntentToImportParams({
      files: [{ fileName: 'a.m4a', mimeType: 'audio/mp4', path: 'content://x/a' }],
    });
    assert.equal(kept?.sharedUri, 'content://x/a');
    assert.equal(
      sharedIntentToImportParams({
        files: [{ fileName: 'notes.pdf', mimeType: 'application/pdf', path: '/a.pdf' }],
      }),
      null,
    );
  });

  it('falls back to a shared url', () => {
    assert.deepEqual(sharedIntentToImportParams({ text: 'see https://x.com/r.mp4 now' }), {
      sharedUrl: 'https://x.com/r.mp4',
    });
    assert.equal(sharedIntentToImportParams({}), null);
  });
});
