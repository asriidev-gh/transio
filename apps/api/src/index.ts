import './load-env.js';
import { createApp } from './app.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
import { getSupabaseConfigStatus } from './lib/supabase.js';

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  const supabase = getSupabaseConfigStatus();
  logger.info('SessionAI API listening', {
    port: env.PORT,
    env: env.NODE_ENV,
    supabaseConfigured: supabase.configured,
    hasServiceRole: supabase.hasServiceRole,
  });
});
