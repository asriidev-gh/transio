import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import { InMemorySessionRepository } from '../sessions/repository.js';
import { InMemorySummaryRepository } from '../summaries/repository.js';
import { InMemoryTranscriptRepository } from '../transcripts/repository.js';
import { runProcessingPipeline } from './job.js';

describe('runProcessingPipeline', () => {
  it('transcribes without auto-summarizing', async () => {
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
          throw new Error('should not summarize');
        },
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
    });

    assert.equal((await transcripts.getBySessionId(session.id))?.text, 'Pipeline transcript text');
    assert.equal(await summaries.getBySessionId(session.id, 'ai_summary'), null);
    assert.equal((await sessions.getById(userId, session.id))?.status, 'transcribed');
  });

  it('deletes the cloud audio when the session keeps it on the device', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Device only',
      sessionType: 'seminar',
      audioStorage: 'device',
    });
    const audioPath = `${userId}/${session.id}/audio.m4a`;
    await sessions.update(userId, session.id, { audioPath, status: 'transcribing' });
    const removed: string[] = [];

    await runProcessingPipeline(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      transcriptionProvider: {
        name: 'unit-stt',
        async transcribe() {
          return { text: 'Device only transcript', language: 'en' };
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize() {
          throw new Error('should not summarize');
        },
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
      removeAudio: async (path) => {
        removed.push(path);
      },
    });

    const after = await sessions.getById(userId, session.id);
    assert.deepEqual(removed, [audioPath]);
    assert.equal(after?.audioPath, null);
    assert.equal(after?.status, 'transcribed');
    // The transcript is the point of the run, so it must survive the cleanup.
    assert.equal((await transcripts.getBySessionId(session.id))?.text, 'Device only transcript');
  });

  it('keeps the cloud audio for a normal session', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Cloud session',
      sessionType: 'seminar',
    });
    const audioPath = `${userId}/${session.id}/audio.m4a`;
    await sessions.update(userId, session.id, { audioPath, status: 'transcribing' });
    let removeCalls = 0;

    await runProcessingPipeline(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      transcriptionProvider: {
        name: 'unit-stt',
        async transcribe() {
          return { text: 'Cloud transcript', language: 'en' };
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize() {
          throw new Error('should not summarize');
        },
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
      removeAudio: async () => {
        removeCalls += 1;
      },
    });

    assert.equal(removeCalls, 0);
    assert.equal((await sessions.getById(userId, session.id))?.audioPath, audioPath);
  });

  it('keeps the transcript when releasing the audio fails', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Release fails',
      sessionType: 'seminar',
      audioStorage: 'device',
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
          return { text: 'Survives cleanup failure', language: 'en' };
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize() {
          throw new Error('should not summarize');
        },
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
      removeAudio: async () => {
        throw new Error('storage unavailable');
      },
    });

    const after = await sessions.getById(userId, session.id);
    assert.equal(after?.status, 'transcribed');
    assert.equal(
      (await transcripts.getBySessionId(session.id))?.text,
      'Survives cleanup failure',
    );
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
      status: 'uploaded',
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
        async summarize() {
          throw new Error('should not summarize');
        },
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => {
        throw new AppError('STORAGE_ERROR', 'should not download', 500);
      },
    });

    assert.equal(transcribed, false);
    assert.equal(await summaries.getBySessionId(session.id, 'ai_summary'), null);
    assert.equal((await sessions.getById(userId, session.id))?.status, 'transcribed');
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
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('x'), mimeType: 'audio/mp4' }),
    });

    assert.equal((await sessions.getById(userId, session.id))?.status, 'failed');
    assert.equal(await transcripts.getBySessionId(session.id), null);
    assert.equal(await summaries.getBySessionId(session.id, 'ai_summary'), null);
    assert.equal(await summaries.getBySessionId(session.id, 'notes'), null);
  });

  it('notes-only mode stores raw sentence notes without persisting a transcript', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const summaries = new InMemorySummaryRepository();
    const session = await sessions.create(userId, {
      title: 'Auto notes',
      sessionType: 'meeting',
      captureMode: 'notes',
    });
    await sessions.update(userId, session.id, {
      audioPath: `${userId}/${session.id}/audio.m4a`,
      status: 'uploaded',
    });

    await runProcessingPipeline(session.id, {
      userId,
      sessions,
      transcripts,
      summaries,
      transcriptionProvider: {
        name: 'unit-stt',
        async transcribe() {
          return { text: 'Ephemeral speech for notes', language: 'en' };
        },
      },
      summaryProvider: {
        name: 'unit-summary',
        async summarize() {
          throw new Error('should not summarize for notes-only raw capture');
        },
        async mergeLiveNotes() {
          throw new Error('not used');
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
    });

    assert.equal(await transcripts.getBySessionId(session.id), null);
    const notes = await summaries.getBySessionId(session.id, 'notes');
    assert.equal(notes?.overview, 'Ephemeral speech for notes');
    assert.deepEqual(notes?.keyPoints, ['Ephemeral speech for notes']);
    assert.equal((await sessions.getById(userId, session.id))?.status, 'completed');
  });
});
