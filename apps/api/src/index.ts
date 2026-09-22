import './load-env.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
import { getSupabaseConfigStatus } from './lib/supabase.js';
import { attachLiveTranscribeServer } from './live/deepgram-proxy.js';

const env = getEnv();
const app = createApp();
const server = createServer(app);

attachLiveTranscribeServer(server);

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
