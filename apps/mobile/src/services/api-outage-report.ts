import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { mobileEnv } from '@/src/lib/env';

/**
 * File one unreachable-API report straight to support.
 * This does not use our API (that is the thing that failed) and does not open the mail app.
 * FormSubmit delivers the message to the support inbox. The first ever report asks that
 * inbox to confirm the address; later reports arrive on their own.
 */
export async function reportApiOutage(accountEmail: string | null): Promise<void> {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(mobileEnv.supportEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        _subject: '[Bug] Smart Transcriber API unreachable',
        _captcha: 'false',
        _template: 'table',
        message:
          'The app could not reach the Smart Transcriber API after several silent retries.',
        appVersion: version,
        platform: `${Platform.OS} ${String(Platform.Version)}`,
        apiBaseUrl: mobileEnv.apiBaseUrl,
        account: accountEmail ?? 'signed out',
        reportedAt: new Date().toISOString(),
      }),
    });
  } catch {
    // The calm banner is enough if the report itself cannot be sent.
  } finally {
    clearTimeout(timer);
  }
}
