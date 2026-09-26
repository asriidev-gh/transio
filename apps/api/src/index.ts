import './load-env.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { missingProductionConfig } from './lib/config-check.js';
import { getEnv } from './lib/env.js';
import { drainJobs, jobStats } from './lib/job-queue.js';
import { logger } from './lib/logger.js';
import { getSupabaseConfigStatus } from './lib/supabase.js';
import { attachLiveTranscribeServer } from './live/deepgram-proxy.js';
import { startAudioRetentionSweeper } from './services/sessions/audio-retention.js';
import { startStaleSessionSweeper } from './services/sessions/stale-sweeper.js';

const env = getEnv();
const app = createApp();
const server = createServer(app);

attachLiveTranscribeServer(server);

const missingConfig = missingProductionConfig(env);
if (missingConfig.length > 0) {
  logger.error('Production configuration is incomplete', { missing: missingConfig.join(', ') });
}

const stopSweeper = startStaleSessionSweeper();
const stopAudioSweeper = startAudioRetentionSweeper();

server.listen(env.PORT, () => {
  const supabase = getSupabaseConfigStatus();
  logger.info('SessionAI API listening', {
    port: env.PORT,
    env: env.NODE_ENV,
    supabaseConfigured: supabase.configured,
    hasServiceRole: supabase.hasServiceRole,
    liveCaptions: Boolean(env.DEEPGRAM_API_KEY),
  });
});

/** Render sends SIGTERM on deploy and force-kills after about 30s, so drain within that window. */
const SHUTDOWN_DRAIN_MS = 25_000;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down', { signal, ...jobStats() });

  stopSweeper();
  stopAudioSweeper();
  server.close();

  const drained = await drainJobs(SHUTDOWN_DRAIN_MS);
  if (!drained) {
    // Anything still running is picked up by the stale-session sweeper on the next instance.
    logger.warn('Shutdown timed out with jobs still running', { ...jobStats() });
  }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message });
  void shutdown('uncaughtException');
});
