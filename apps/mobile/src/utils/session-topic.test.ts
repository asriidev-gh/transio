import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferSessionTopicKind, sessionTopicVisual } from './session-topic.js';

describe('inferSessionTopicKind', () => {
  it('picks health from medical titles', () => {
    assert.equal(
      inferSessionTopicKind({
        title: 'Maxicare Outpatient LOA',
        sessionType: 'other',
      }),
      'health',
    );
  });

  it('picks security before generic learning words', () => {
    assert.equal(
      inferSessionTopicKind({
        title: 'Understanding SSH key authentication LinkedIn Learning',
        sessionType: 'lecture',
      }),
      'security',
    );
  });

  it('picks notes, celebration, and people from everyday titles', () => {
    assert.equal(
      inferSessionTopicKind({ title: "Sunday's Note", sessionType: 'other' }),
      'notes',
    );
    assert.equal(
      inferSessionTopicKind({ title: 'Usapang Edad', sessionType: 'group_discussion' }),
      'celebration',
    );
    assert.equal(
      inferSessionTopicKind({
        title: 'Wants Her to Be Friend',
        sessionType: 'group_discussion',
      }),
      'people',
    );
  });

  it('falls back to session type when the title is generic', () => {
    assert.equal(
      inferSessionTopicKind({ title: 'test 767', sessionType: 'group_discussion' }),
      'chat',
    );
    assert.equal(
      inferSessionTopicKind({ title: 'Weekly catch-up', sessionType: 'meeting' }),
      'meeting',
    );
    assert.equal(
      inferSessionTopicKind({ title: 'Week 3', sessionType: 'bible_study' }),
      'faith',
    );
    assert.equal(
      inferSessionTopicKind({ title: 'GLC Session 3', sessionType: 'seminar' }),
      'study',
    );
  });

  it('maps import and gym titles', () => {
    assert.equal(
      inferSessionTopicKind({ title: 'test import', sessionType: 'other' }),
      'media',
    );
    assert.equal(
      inferSessionTopicKind({ title: 'Gym — leg day', sessionType: 'other' }),
      'fitness',
    );
  });
});

describe('sessionTopicVisual', () => {
  it('returns a 3D glyph for the inferred topic', () => {
    const visual = sessionTopicVisual({
      title: "Sunday's Note",
      sessionType: 'other',
    });
    assert.equal(visual.kind, 'notes');
    assert.equal(visual.icon, 'pencil');
  });
});
