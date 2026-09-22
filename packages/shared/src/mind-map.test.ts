import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveMindMapFromSummary, MindMapSchema } from './mind-map.js';

describe('deriveMindMapFromSummary', () => {
  it('builds a tree from summary sections', () => {
    const map = deriveMindMapFromSummary(
      {
        overview: 'We reviewed growth plans for Q3. Next steps are clear.',
        keyPoints: ['Hire two engineers', 'Ship onboarding v2'],
        topics: [{ title: 'Growth', summary: 'Focus on retention first.' }],
        questionsDiscussed: ['What is the budget?'],
        actionItems: [{ task: 'Draft hiring plan', details: 'Share by Friday' }],
        importantInsights: ['Retention beats acquisition right now'],
      },
      { title: 'Planning sync' },
    );

    assert.equal(map.source, 'summary');
    assert.equal(map.root.label, 'Planning sync');
    assert.equal(map.root.kind, 'root');
    assert.match(map.root.detail ?? '', /growth plans/i);

    const kinds = map.root.children.map((c) => c.kind);
    assert.deepEqual(kinds, ['topic', 'group', 'group', 'group', 'group']);

    const topic = map.root.children[0];
    assert.equal(topic?.label, 'Growth');
    assert.equal(topic?.detail, 'Focus on retention first.');

    const keyGroup = map.root.children.find((c) => c.id === 'group-keypoints');
    assert.equal(keyGroup?.children.length, 2);
    assert.equal(keyGroup?.children[0]?.kind, 'keyPoint');

    assert.doesNotThrow(() => MindMapSchema.parse(map));
  });

  it('falls back to overview sentence when title is missing', () => {
    const map = deriveMindMapFromSummary({
      overview: 'Team aligned on launch criteria. Risks remain.',
      keyPoints: [],
      topics: [],
      questionsDiscussed: [],
      actionItems: [],
      importantInsights: [],
    });
    assert.equal(map.root.label, 'Team aligned on launch criteria.');
    assert.equal(map.root.children.length, 0);
  });

  it('skips empty sections and truncates long labels', () => {
    const long =
      'This is a very long key point that should be truncated so the map node stays readable on a phone screen without wrapping forever';
    const map = deriveMindMapFromSummary({
      overview: null,
      keyPoints: [long],
      topics: [],
      questionsDiscussed: [],
      actionItems: [],
      importantInsights: [],
    });
    assert.equal(map.root.label, 'Session');
    const leaf = map.root.children[0]?.children[0];
    assert.ok(leaf);
    assert.ok(leaf.label.endsWith('…'));
    assert.ok(leaf.label.length <= 72);
    assert.equal(leaf.detail, long);
  });
});
