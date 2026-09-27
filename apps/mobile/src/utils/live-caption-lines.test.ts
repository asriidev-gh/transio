import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCaptionTurns,
  hasMultipleSpeakers,
  liveSpeakerLabel,
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

describe('buildCaptionTurns', () => {
  it('joins finals into sentences with stable indexes', () => {
    const turns = buildCaptionTurns(['Thank you very', 'much. See you', 'tomorrow.']);
    assert.equal(turns.length, 1);
    assert.deepEqual(turns[0]!.sentences, [
      { index: 0, text: 'Thank you very much.', complete: true },
      { index: 1, text: 'See you tomorrow.', complete: true },
    ]);
  });

  it('marks only the last unfinished sentence as incomplete', () => {
    const turns = buildCaptionTurns(['Hello there. And then']);
    assert.deepEqual(
      turns[0]!.sentences.map((s) => s.complete),
      [true, false],
    );
  });

  it('starts a new turn when the speaker changes, closing the previous one', () => {
    const turns = buildCaptionTurns(['Hi, how are', 'Fine thanks.'], [0, 1]);
    assert.equal(turns.length, 2);
    assert.equal(turns[0]!.speaker, 0);
    assert.deepEqual(turns[0]!.sentences, [{ index: 0, text: 'Hi, how are', complete: true }]);
    assert.equal(turns[1]!.speaker, 1);
    assert.deepEqual(turns[1]!.sentences, [{ index: 1, text: 'Fine thanks.', complete: true }]);
  });

  it('keeps finals without a speaker id with the turn before them', () => {
    const turns = buildCaptionTurns(['One.', 'Two.'], [0, null]);
    assert.equal(turns.length, 1);
    assert.equal(turns[0]!.sentences.length, 2);
  });
});

describe('speaker helpers', () => {
  it('labels speakers like batch transcripts', () => {
    assert.equal(liveSpeakerLabel(0), 'Speaker A');
    assert.equal(liveSpeakerLabel(1), 'Speaker B');
  });

  it('needs two distinct speakers', () => {
    assert.equal(hasMultipleSpeakers([0, 0, null]), false);
    assert.equal(hasMultipleSpeakers([0, null, 1]), true);
  });
});
