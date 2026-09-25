import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sessionsUnchanged } from './sessions-unchanged';

const a = { id: 'a', updatedAt: '2026-09-25T10:00:00Z' };
const b = { id: 'b', updatedAt: '2026-09-25T10:05:00Z' };

describe('sessionsUnchanged', () => {
  it('is true for the same content, even in a new array', () => {
    assert.equal(sessionsUnchanged([a, b], [{ ...a }, { ...b }]), true);
    assert.equal(sessionsUnchanged([], []), true);
  });

  it('detects added, removed, reordered and edited sessions', () => {
    assert.equal(sessionsUnchanged([a], [a, b]), false);
    assert.equal(sessionsUnchanged([a, b], [b, a]), false);
    assert.equal(sessionsUnchanged([a], [{ ...a, updatedAt: '2026-09-25T11:00:00Z' }]), false);
  });
});
