import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { resetEnvCache } from './env.js';
import { drainJobs, enqueueJob, jobStats, resetJobQueueForTests } from './job-queue.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('job queue', () => {
  afterEach(() => {
    resetJobQueueForTests();
    delete process.env.JOB_CONCURRENCY;
    resetEnvCache();
  });

  it('runs at most JOB_CONCURRENCY jobs at once and starts queued ones later', async () => {
    process.env.JOB_CONCURRENCY = '1';
    resetEnvCache();
    const first = deferred();
    const order: string[] = [];

    enqueueJob('a', async () => {
      order.push('a:start');
      await first.promise;
      order.push('a:end');
    });
    enqueueJob('b', async () => {
      order.push('b:start');
    });

    await new Promise((r) => setImmediate(r));
    assert.deepEqual(jobStats(), { running: 1, queued: 1 });
    assert.deepEqual(order, ['a:start']);

    first.resolve();
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(order, ['a:start', 'a:end', 'b:start']);
    assert.deepEqual(jobStats(), { running: 0, queued: 0 });
  });

  it('survives a crashing job and keeps running others', async () => {
    let ran = false;
    enqueueJob('boom', async () => {
      throw new Error('nope');
    });
    enqueueJob('ok', async () => {
      ran = true;
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(ran, true);
    assert.deepEqual(jobStats(), { running: 0, queued: 0 });
  });

  it('drain waits for running jobs and reports timeouts', async () => {
    const gate = deferred();
    enqueueJob('slow', () => gate.promise);
    await new Promise((r) => setImmediate(r));
    assert.equal(await drainJobs(30), false);
    gate.resolve();
  });
});
