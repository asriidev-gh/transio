import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getEnv, resetEnvCache } from './env.js';
import { missingProductionConfig } from './config-check.js';

function envWith(overrides: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  const env = getEnv();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  return env;
}

describe('missingProductionConfig', () => {
  it('reports nothing outside production', () => {
    assert.deepEqual(missingProductionConfig(envWith({ NODE_ENV: 'development' })), []);
  });

  it('lists every missing key in production, honoring the Deepgram provider', () => {
    const base = {
      NODE_ENV: 'production',
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      TRANSCRIPTION_API_KEY: undefined,
      DEEPGRAM_API_KEY: undefined,
    };
    const whisper = missingProductionConfig(envWith({ ...base, TRANSCRIPTION_PROVIDER: 'whisper' }));
    assert.ok(whisper.includes('TRANSCRIPTION_API_KEY'));
    assert.ok(whisper.includes('SUPABASE_SERVICE_ROLE_KEY'));

    const dg = missingProductionConfig(envWith({ ...base, TRANSCRIPTION_PROVIDER: 'deepgram' }));
    assert.ok(dg.some((m) => m.startsWith('DEEPGRAM_API_KEY')));
    assert.ok(!dg.includes('TRANSCRIPTION_API_KEY'));
  });

  it('is clean when everything is set', () => {
    const env = envWith({
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_ANON_KEY: 'a',
      SUPABASE_SERVICE_ROLE_KEY: 's',
      ANTHROPIC_API_KEY: 'k',
      TRANSCRIPTION_PROVIDER: 'deepgram',
      DEEPGRAM_API_KEY: 'd',
    });
    assert.deepEqual(missingProductionConfig(env), []);
  });
});
