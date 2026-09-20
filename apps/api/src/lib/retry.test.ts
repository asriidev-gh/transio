import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../middleware/error-handler.js';
import { withProviderRetry } from './retry.js';

describe('withProviderRetry', () => {
  it('returns on first success', async () => {
    let calls = 0;
    const result = await withProviderRetry(async () => {
      calls += 1;
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('retries retryable AppErrors then succeeds', async () => {
    let calls = 0;
    const result = await withProviderRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new AppError('TRANSCRIPTION_ERROR', 'busy', 429);
        }
        return 'done';
      },
      { retries: 3, baseDelayMs: 1 },
    );
    assert.equal(result, 'done');
    assert.equal(calls, 3);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withProviderRetry(
          async () => {
            calls += 1;
            throw new AppError('VALIDATION_ERROR', 'bad', 400);
          },
          { retries: 3, baseDelayMs: 1 },
        ),
      (err: unknown) => err instanceof AppError && err.statusCode === 400,
    );
    assert.equal(calls, 1);
  });
});
