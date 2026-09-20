import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapAuthErrorMessage, validateAuthForm } from './auth-errors.js';

describe('mapAuthErrorMessage', () => {
  it('maps common supabase errors', () => {
    assert.equal(mapAuthErrorMessage('Invalid login credentials'), 'Invalid email or password.');
    assert.equal(
      mapAuthErrorMessage('User already registered'),
      'An account with this email already exists.',
    );
    assert.equal(
      mapAuthErrorMessage('Email not confirmed'),
      'Please confirm your email before signing in.',
    );
  });

  it('falls back safely', () => {
    assert.equal(mapAuthErrorMessage(null), 'Something went wrong. Please try again.');
    assert.equal(mapAuthErrorMessage('weird upstream'), 'Something went wrong. Please try again.');
  });
});

describe('validateAuthForm', () => {
  it('requires email and password', () => {
    assert.equal(validateAuthForm('', 'password1'), 'Email is required.');
    assert.equal(validateAuthForm('a@b.com', ''), 'Password is required.');
    assert.equal(validateAuthForm('a@b.com', 'short'), 'Password must be at least 8 characters.');
    assert.equal(validateAuthForm('a@b.com', 'password1'), null);
  });
});
