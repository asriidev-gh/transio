import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../middleware/error-handler.js';
import { InMemorySessionRepository } from '../sessions/repository.js';
import { InMemoryTranscriptRepository } from '../transcripts/repository.js';
import { runTranscriptionJob } from './job.js';

describe('runTranscriptionJob', () => {
  it('persists transcript and sets transcribed status', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const session = await sessions.create(userId, {
      title: 'Job test',
      sessionType: 'seminar',
    });
    await sessions.update(userId, session.id, {
      audioPath: `${userId}/${session.id}/audio.m4a`,
      status: 'transcribing',
    });

    await runTranscriptionJob(session.id, {
      userId,
      sessions,
      transcripts,
      provider: {
        name: 'unit',
        async transcribe() {
          return { text: 'Unit transcript text', language: 'en' };
        },
      },
      downloadAudio: async () => ({ data: Buffer.from('abc'), mimeType: 'audio/mp4' }),
    });

    const saved = await transcripts.getBySessionId(session.id);
    assert.equal(saved?.text, 'Unit transcript text');
    const updated = await sessions.getById(userId, session.id);
    assert.equal(updated?.status, 'transcribed');
  });

  it('sets failed status when download fails', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const sessions = new InMemorySessionRepository();
    const transcripts = new InMemoryTranscriptRepository();
    const session = await sessions.create(userId, {
      title: 'Fail download',
      sessionType: 'seminar',
    });
    await sessions.update(userId, session.id, {
      audioPath: `${userId}/${session.id}/audio.m4a`,
      status: 'transcribing',
    });

    await runTranscriptionJob(session.id, {
      userId,
      sessions,
      transcripts,
      provider: {
        name: 'unit',
        async transcribe() {
          return { text: 'unused', language: 'en' };
        },
      },
      downloadAudio: async () => {
        throw new AppError('STORAGE_ERROR', 'missing', 500);
      },
    });

    const updated = await sessions.getById(userId, session.id);
    assert.equal(updated?.status, 'failed');
    assert.equal(await transcripts.getBySessionId(session.id), null);
  });
});
