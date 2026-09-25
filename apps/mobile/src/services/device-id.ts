import { Platform } from 'react-native';

let cached: string | null | undefined;

/**
 * Stable Android device id, sent to the API so free usage is counted per device.
 * It survives reinstalling the app but not a factory reset. The server hashes it and never
 * stores it raw. Null on other platforms or when unavailable.
 *
 * The native module is loaded lazily inside a try: an update delivered to an older build that
 * lacks the module must degrade to "no device id" instead of crashing at startup.
 */
export function getDeviceId(): string | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== 'android') return cached;

  try {
    const Application = require('expo-application') as typeof import('expo-application');
    const id = Application.getAndroidId();
    cached = typeof id === 'string' && id.length >= 8 ? id : null;
  } catch {
    cached = null;
  }
  return cached;
}
