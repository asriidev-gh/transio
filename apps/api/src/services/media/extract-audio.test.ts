import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedUploadMedia, isVideoMedia, prepareMediaForTranscription } from './extract-audio.js';

describe('extract-audio helpers', () => {
  it('treats mp4/mov as video', () => {
    assert.equal(isVideoMedia('video/mp4', 'talk.mp4'), true);
    assert.equal(isVideoMedia('video/quicktime', 'talk.mov'), true);
    assert.equal(isVideoMedia('audio/mpeg', 'talk.mp3'), false);
  });

  it('allows common audio and video uploads', () => {
    assert.equal(isAllowedUploadMedia('audio/mpeg', 'a.mp3'), true);
    assert.equal(isAllowedUploadMedia('video/mp4', 'a.mp4'), true);
    assert.equal(isAllowedUploadMedia('video/quicktime', 'a.mov'), true);
    assert.equal(isAllowedUploadMedia('application/pdf', 'a.pdf'), false);
  });

  it('passes through small audio without converting', async () => {
    const input = {
      data: Buffer.from('not-really-mp3-but-small'),
      mimeType: 'audio/mpeg',
      fileName: 'clip.mp3',
    };
    const out = await prepareMediaForTranscription(input);
    assert.equal(out.mimeType, 'audio/mpeg');
    assert.equal(out.data, input.data);
  });
});
