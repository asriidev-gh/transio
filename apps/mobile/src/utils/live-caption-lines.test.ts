import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCaptionTurns,
  countWords,
  hasMultipleSpeakers,
  joinAtPause,
  mergeLiveSegments,
  nextStableSpeaker,
  splitSentences,
} from './live-caption-lines.js';

describe('splitSentences', () => {
  it('splits on end marks and keeps the unfinished tail apart', () => {
    assert.deepEqual(splitSentences('Thank you. How are you? I am'), {
      sentences: ['Thank you.', 'How are you?'],
      trailing: 'I am',
    });
  });

  it('does not split decimals and keeps closing quotes', () => {
    assert.deepEqual(splitSentences('It costs 3.5 dollars. He said "no." Then'), {
      sentences: ['It costs 3.5 dollars.', 'He said "no."'],
      trailing: 'Then',
    });
  });

  it('splits Chinese sentences without spaces', () => {
    assert.deepEqual(splitSentences('你好。谢谢！'), {
      sentences: ['你好。', '谢谢！'],
      trailing: '',
    });
  });
});

describe('joinAtPause', () => {
  it('adds a comma where a piece ends without punctuation', () => {
    assert.equal(joinAtPause('tower', 'lead to genuine.'), 'tower, lead to genuine.');
    assert.equal(joinAtPause('To love our neighbor.', 'Alright?'), 'To love our neighbor. Alright?');
    assert.equal(joinAtPause('Well,', 'look'), 'Well, look');
    assert.equal(joinAtPause('', 'Now'), 'Now');
  });
});

describe('countWords', () => {
  it('counts words, and CJK characters one by one', () => {
    assert.equal(countWords('Thank you very much.'), 4);
    assert.equal(countWords('你好世界。'), 4);
  });
});

describe('buildCaptionTurns', () => {
  it('puts each full sentence on its own line with stable indexes', () => {
    const turns = buildCaptionTurns([
      'Thank you very much to you.',
      'See you again tomorrow morning.',
    ]);
    assert.equal(turns.length, 1);
    assert.deepEqual(turns[0]!.sentences, [
      { index: 0, text: 'Thank you very much to you.', complete: true },
      { index: 1, text: 'See you again tomorrow morning.', complete: true },
    ]);
  });

  it('joins short pieces into one line with commas at pauses', () => {
    const turns = buildCaptionTurns(['tower', 'lead to genuine.', 'To love our neighbor.', 'Alright?']);
    assert.deepEqual(turns[0]!.sentences, [
      { index: 0, text: 'tower, lead to genuine. To love our neighbor.', complete: true },
      { index: 1, text: 'Alright?', complete: false },
    ]);
  });

  it('keeps a short last line open until it has enough words', () => {
    const turns = buildCaptionTurns(['Now', 'if you love those who love you.']);
    assert.deepEqual(turns[0]!.sentences, [
      { index: 0, text: 'Now, if you love those who love you.', complete: true },
    ]);
  });

  it('starts a new turn when the speaker changes, closing the previous one', () => {
    const turns = buildCaptionTurns(['Hi, how are', 'Fine thanks.'], [0, 1]);
    assert.equal(turns.length, 2);
    assert.equal(turns[0]!.speaker, 0);
    assert.deepEqual(turns[0]!.sentences, [{ index: 0, text: 'Hi, how are', complete: true }]);
    assert.equal(turns[1]!.speaker, 1);
    assert.deepEqual(turns[1]!.sentences, [{ index: 1, text: 'Fine thanks.', complete: false }]);
  });

  it('keeps finals without a speaker id with the turn before them', () => {
    const turns = buildCaptionTurns(['One.', 'Two.'], [0, null]);
    assert.equal(turns.length, 1);
  });
});

describe('mergeLiveSegments', () => {
  it('joins short pieces into lines of a few words and drops speaker labels', () => {
    const merged = mergeLiveSegments([
      { startMs: 0, endMs: 1000, text: 'tower', speaker: 'Speaker A' },
      { startMs: 1000, endMs: 2000, text: 'lead to genuine.', speaker: 'Speaker B' },
      { startMs: 2000, endMs: 3000, text: 'To love our neighbor.', speaker: 'Speaker B' },
      { startMs: 3000, endMs: 4000, text: 'Because we cannot obey them by grace.', speaker: null },
    ]);
    assert.deepEqual(merged, [
      {
        startMs: 0,
        endMs: 3000,
        text: 'tower, lead to genuine. To love our neighbor.',
        speaker: null,
      },
      { startMs: 3000, endMs: 4000, text: 'Because we cannot obey them by grace.', speaker: null },
    ]);
  });
});

describe('speaker helpers', () => {
  it('needs two speakers with a few captions each', () => {
    assert.equal(hasMultipleSpeakers([0, 0, null]), false);
    assert.equal(hasMultipleSpeakers([0, 0, 1, 0]), false);
    assert.equal(hasMultipleSpeakers([0, 1, null, 0, 1]), true);
  });

  it('keeps the current speaker on short or mixed captions', () => {
    assert.equal(nextStableSpeaker(null, { speaker: 1, share: 0.5, words: 1 }), 1);
    assert.equal(nextStableSpeaker(0, { speaker: 1, share: 1, words: 2 }), 0);
    assert.equal(nextStableSpeaker(0, { speaker: 1, share: 0.6, words: 10 }), 0);
    assert.equal(nextStableSpeaker(0, { speaker: null }), 0);
  });

  it('switches when a long caption is clearly someone else', () => {
    assert.equal(nextStableSpeaker(0, { speaker: 1, share: 0.9, words: 8 }), 1);
  });
});
