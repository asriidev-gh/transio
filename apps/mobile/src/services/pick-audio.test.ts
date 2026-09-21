import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLikelyMedia,
  mimeTypeFromFileName,
  titleFromMediaName,
  titleFromMediaUrl,
} from './media-name.js';

describe('pick-audio helpers', () => {
  it('maps video and audio extensions', () => {
    assert.equal(mimeTypeFromFileName('talk.mp4'), 'video/mp4');
    assert.equal(mimeTypeFromFileName('clip.m4a'), 'audio/mp4');
    assert.equal(mimeTypeFromFileName('clip.mov'), 'video/quicktime');
    assert.equal(mimeTypeFromFileName('clip.mp3'), 'audio/mpeg');
  });

  it('accepts audio and video mime types', () => {
    assert.equal(isLikelyMedia('a.mp4', 'video/mp4'), true);
    assert.equal(isLikelyMedia('a.mp3', 'audio/mpeg'), true);
    assert.equal(isLikelyMedia('notes.pdf', 'application/pdf'), false);
  });

  it('suggests titles from files and URLs', () => {
    assert.equal(titleFromMediaName('Weekly_Seminar-3.mp4'), 'Weekly Seminar 3');
    assert.equal(
      titleFromMediaUrl('https://cdn.example.com/lectures/week-1.mp4'),
      'week 1',
    );
  });
});
