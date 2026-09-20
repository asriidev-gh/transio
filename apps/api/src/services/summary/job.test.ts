import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import { InMemorySessionRepository } from '../sessions/repository.js';
import { InMemorySummaryRepository } from '../summaries/repository.js';
import { InMemoryTranscriptRepository } from '../transcripts/repository.js';
import { runSummaryJob } from './job.js';

describe('runSummaryJob', () => {
  it('persists summary and sets completed status', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Job test',
      sessionType: 'seminar',
    });
    await transcripts.upsertForSession(session.id, 'Unit transcript text for summarizing.', 'en');
    await sessions.update(userId, session.id, { status: 'summarizing' });

    await runSummaryJob(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      provider: {
        name: 'unit',
        async summarize() {
          return {
            overview: 'Unit overview',
            keyPoints: ['A'],
            topics: [{ title: 'T', summary: 'S' }],
            questionsDiscussed: [],
            actionItems: [{ task: 'Do the thing' }],
            importantInsights: ['Insight'],
            quotes: [],
          };
        },
      },
    });

    const saved = await summaries.getBySessionId(session.id);
    assert.equal(saved?.overview, 'Unit overview');
    const updated = await sessions.getById(userId, session.id);
    assert.equal(updated?.status, 'completed');
  });

  it('sets failed status when transcript is missing', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Fail missing transcript',
      sessionType: 'meeting',
    });
    await sessions.update(userId, session.id, { status: 'summarizing' });

    await runSummaryJob(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      provider: {
        name: 'unit',
        async summarize() {
          throw new AppError('SUMMARY_ERROR', 'should not run', 502);
        },
      },
    });

    const updated = await sessions.getById(userId, session.id);
    assert.equal(updated?.status, 'failed');
    assert.equal(await summaries.getBySessionId(session.id), null);
  });
});
