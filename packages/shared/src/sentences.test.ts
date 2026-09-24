import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bulletsFromCaptionFinals,
  bulletsFromNotes,
  rawNotesFromFinals,
  rawNotesFromText,
  splitIntoSentences,
} from './sentences.js';

describe('splitIntoSentences', () => {
  it('splits on period boundaries', () => {
    assert.deepEqual(splitIntoSentences('Tax residence. Milan in December. Italy charges'), [
      'Tax residence.',
      'Milan in December.',
      'Italy charges',
    ]);
  });

  it('keeps question and exclamation marks', () => {
    assert.deepEqual(splitIntoSentences('Really? Yes! Okay'), ['Really?', 'Yes!', 'Okay']);
  });
});

describe('bulletsFromCaptionFinals', () => {
  it('keeps each Deepgram final as its own bullet without requiring periods', () => {
    assert.deepEqual(
      bulletsFromCaptionFinals([
        'Notes tab',
        'Raw transcript restyle live notes',
        'sentence paper like',
      ]),
      ['Notes tab', 'Raw transcript restyle live notes', 'sentence paper like'],
    );
  });

  it('still splits a final that contains multiple sentences', () => {
    assert.deepEqual(bulletsFromCaptionFinals(['One. Two.', 'Three']), [
      'One.',
      'Two.',
      'Three',
    ]);
  });
});

describe('rawNotesFromText', () => {
  it('builds notes from raw speech', () => {
    const notes = rawNotesFromText('One. Two.');
    assert.equal(notes.overview, 'One.');
    assert.deepEqual(notes.keyPoints, ['One.', 'Two.']);
    assert.equal(notes.topics.length, 0);
  });
});

describe('rawNotesFromFinals', () => {
  it('persists one key point per caption final', () => {
    const notes = rawNotesFromFinals(['Alpha', 'Beta gamma']);
    assert.deepEqual(notes.keyPoints, ['Alpha', 'Beta gamma']);
    assert.equal(notes.overview, 'Alpha');
  });
});

describe('bulletsFromNotes', () => {
  it('prefers key points', () => {
    assert.deepEqual(
      bulletsFromNotes({ overview: 'A. B.', keyPoints: ['Stored one', 'Stored two'] }),
      ['Stored one', 'Stored two'],
    );
  });
});
