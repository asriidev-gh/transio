import { Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';
import { showAlert } from '@/src/utils/confirm';

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

// PermissionsAndroid does not exist on web, and this runs at import time, so guard the lookup.
const POST_NOTIFICATIONS: Permission =
  PermissionsAndroid?.PERMISSIONS?.POST_NOTIFICATIONS ??
  ('android.permission.POST_NOTIFICATIONS' as Permission);

function webNotificationSupported(): boolean {
  return Platform.OS === 'web' && typeof Notification !== 'undefined';
}

function androidNeedsRuntimeNotificationPermission(): boolean {
  return Platform.OS === 'android' && typeof Platform.Version === 'number'
    ? Platform.Version >= 33
    : Platform.OS === 'android';
}

/**
 * Current OS / browser notification permission.
 * - Android 13+: POST_NOTIFICATIONS (also used for locked-screen recording)
 * - Older Android: treated as granted (no runtime prompt)
 * - Web: browser Notification API
 * - iOS: no push stack yet — in-app alerts when the app is open
 */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') {
    if (!webNotificationSupported()) return 'unsupported';
    const perm = Notification.permission;
    if (perm === 'granted') return 'granted';
    if (perm === 'denied') return 'denied';
    return 'default';
  }

  if (Platform.OS === 'android') {
    if (!androidNeedsRuntimeNotificationPermission()) return 'granted';
    try {
      const ok = await PermissionsAndroid.check(POST_NOTIFICATIONS);
      return ok ? 'granted' : 'default';
    } catch {
      return 'unsupported';
    }
  }

  // iOS: local/push notifications not wired yet — processing uses in-app alerts.
  return 'granted';
}

/** Request permission (or open system settings when blocked). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') {
    if (!webNotificationSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result as NotificationPermission;
  }

  if (Platform.OS === 'android') {
    if (!androidNeedsRuntimeNotificationPermission()) return 'granted';
    try {
      const result = await PermissionsAndroid.request(POST_NOTIFICATIONS, {
        title: 'Allow notifications',
        message:
          'Get an alert when a session finishes processing, and keep recording if the screen locks.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'denied';
      return 'default';
    } catch {
      return 'unsupported';
    }
  }

  return 'granted';
}

export async function openSystemNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Best-effort.
  }
}

export async function notifyProcessingComplete(input: {
  sessionId: string;
  title?: string;
}): Promise<void> {
  const name = input.title?.trim() || 'Your session';
  const body = `${name} is ready — summary and transcript are available.`;

  if (webNotificationSupported() && Notification.permission === 'granted') {
    try {
      const notification = new Notification('Smart Transcriber — processing complete', {
        body,
        tag: `sessionai-complete-${input.sessionId}`,
      });
      notification.onclick = () => {
        try {
          window.focus();
        } catch {
          // ignore
        }
        notification.close();
      };
      return;
    } catch {
      // fall through to alert
    }
  }

  // Foreground fallback (native + web without permission).
  if (Platform.OS !== 'web') {
    await showAlert('Processing complete', body);
  }
}
