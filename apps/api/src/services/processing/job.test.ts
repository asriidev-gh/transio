import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import { InMemorySessionRepository } from '../sessions/repository.js';
import { InMemorySummaryRepository } from '../summaries/repository.js';
import { InMemoryTranscriptRepository } from '../transcripts/repository.js';
import { runProcessingPipeline } from './job.js';

describe('runProcessingPipeline', () => {
  it('transcribes then summarizes to completed', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Pipeline test',
      sessionType: 'seminar',
    });
    await sessions.update(userId, session.id, {
      audioPath: `${userId}/${session.id}/audio.m4a`,
      status: 'transcribing',
    });

    await runProcessingPipeline(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      transcriptionProvider: {
        name: 'unit-stt',
        async transcribe() {
          return { text: 'Pipeline transcript text', language: 'en' };
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize() {
          return {
            overview: 'Pipeline overview',
            keyPoints: ['A'],
            topics: [{ title: 'T', summary: 'S' }],
            questionsDiscussed: [],
            actionItems: [{ task: 'Do it' }],
            importantInsights: ['Insight'],
            quotes: [],
          };
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
    });

    assert.equal((await transcripts.getBySessionId(session.id))?.text, 'Pipeline transcript text');
    assert.equal((await summaries.getBySessionId(session.id))?.overview, 'Pipeline overview');
    assert.equal((await sessions.getById(userId, session.id))?.status, 'completed');
  });

  it('skips transcription when transcript already exists', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Resume pipeline',
      sessionType: 'meeting',
    });
    await sessions.update(userId, session.id, {
      audioPath: `${userId}/${session.id}/audio.m4a`,
      status: 'summarizing',
    });
    await transcripts.upsertForSession(session.id, 'Existing transcript', 'en');

    let transcribed = false;
    await runProcessingPipeline(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      transcriptionProvider: {
        name: 'unit-stt',
        async transcribe() {
          transcribed = true;
          return { text: 'should not run', language: 'en' };
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize(input) {
          assert.equal(input.transcriptText, 'Existing transcript');
          return {
            overview: 'From existing',
            keyPoints: [],
            topics: [],
            questionsDiscussed: [],
            actionItems: [],
            importantInsights: [],
          };
        },
      },
      downloadAudio: async () => {
        throw new AppError('STORAGE_ERROR', 'should not download', 500);
      },
    });

    assert.equal(transcribed, false);
    assert.equal((await summaries.getBySessionId(session.id))?.overview, 'From existing');
    assert.equal((await sessions.getById(userId, session.id))?.status, 'completed');
  });

  it('marks failed when transcription fails', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Fail pipeline',
      sessionType: 'other',
    });
    await sessions.update(userId, session.id, {
      audioPath: `${userId}/${session.id}/audio.m4a`,
      status: 'transcribing',
    });

    await runProcessingPipeline(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      transcriptionProvider: {
        name: 'broken',
        async transcribe() {
          throw new AppError('TRANSCRIPTION_ERROR', 'stt down', 502);
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize() {
          throw new AppError('SUMMARY_ERROR', 'should not run', 502);
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('x'), mimeType: 'audio/mp4' }),
    });

    assert.equal((await sessions.getById(userId, session.id))?.status, 'failed');
    assert.equal(await transcripts.getBySessionId(session.id), null);
    assert.equal(await summaries.getBySessionId(session.id), null);
  });
});
