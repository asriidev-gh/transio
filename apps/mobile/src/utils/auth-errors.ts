/**
 * Maps Supabase Auth error messages to user-facing copy.
 * Keeps raw provider errors out of the UI where possible.
 */
export function mapAuthErrorMessage(rawMessage: string | undefined | null): string {
  const message = (rawMessage ?? '').toLowerCase();

  if (!message) {
    return 'Something went wrong. Please try again.';
  }

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Invalid email or password.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists.';
  }

  if (message.includes('password should be at least') || message.includes('password is too short')) {
    return 'Password must be at least 8 characters.';
  }

  if (message.includes('unable to validate email') || message.includes('invalid email')) {
    return 'Enter a valid email address.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Network unavailable. Check your connection and try again.';
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return 'Something went wrong. Please try again.';
}

export function validateAuthForm(email: string, password: string): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return 'Email is required.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Enter a valid email address.';
  }
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}
