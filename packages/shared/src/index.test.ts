import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  apiError,
  apiSuccess,
  AuthCredentialsSchema,
  CreateSessionSchema,
  HealthResponseSchema,
  SessionTypeSchema,
  UpdateSessionSchema,
} from './index.js';

describe('shared schemas', () => {
  it('validates session types', () => {
    assert.equal(SessionTypeSchema.parse('seminar'), 'seminar');
    assert.throws(() => SessionTypeSchema.parse('invalid'));
  });

  it('builds api envelopes', () => {
    assert.deepEqual(apiSuccess({ id: '1' }), { success: true, data: { id: '1' } });
    assert.deepEqual(apiError('VALIDATION_ERROR', 'Title is required'), {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Title is required' },
    });
  });

  it('validates health response shape', () => {
    const parsed = HealthResponseSchema.parse({
      status: 'ok',
      service: 'sessionai-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      supabaseConfigured: false,
    });
    assert.equal(parsed.status, 'ok');
  });

  it('validates auth credentials', () => {
    assert.deepEqual(AuthCredentialsSchema.parse({ email: 'a@b.com', password: 'password1' }), {
      email: 'a@b.com',
      password: 'password1',
    });
    assert.throws(() => AuthCredentialsSchema.parse({ email: 'bad', password: 'short' }));
  });

  it('validates create session payloads', () => {
    const parsed = CreateSessionSchema.parse({
      title: '  GLC Session 3  ',
      sessionType: 'group_discussion',
    });
    assert.equal(parsed.title, 'GLC Session 3');
    assert.throws(() =>
      CreateSessionSchema.parse({ title: '', sessionType: 'seminar' }),
    );
  });

  it('requires at least one field on update', () => {
    assert.throws(() => UpdateSessionSchema.parse({}));
    assert.equal(UpdateSessionSchema.parse({ title: 'Updated' }).title, 'Updated');
  });
});
