import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SessionSummarySchema } from '@sessionai/shared';
import { buildSummarySystemPrompt, buildSummaryUserPrompt } from '../../prompts/summary.js';
import { FakeSummaryProvider } from './index.js';

describe('summary provider helpers', () => {
  it('builds session-type specific system prompts', () => {
    const meeting = buildSummarySystemPrompt('meeting');
    const bible = buildSummarySystemPrompt('bible_study');
    assert.match(meeting, /action items/i);
    assert.match(bible, /scripture/i);
    assert.notEqual(meeting, bible);
  });

  it('includes transcript text in the user prompt', () => {
    const prompt = buildSummaryUserPrompt({
      title: 'Weekly sync',
      sessionType: 'meeting',
      transcriptText: 'We decided to ship on Friday.',
    });
    assert.match(prompt, /Weekly sync/);
    assert.match(prompt, /ship on Friday/);
  });

  it('fake provider returns Zod-valid summary', async () => {
    const provider = new FakeSummaryProvider();
    const summary = await provider.summarize({
      transcriptText: 'Hello',
      sessionType: 'lecture',
      title: 'Intro',
    });
    const parsed = SessionSummarySchema.parse(summary);
    assert.ok(parsed.overview.length > 0);
  });
});
