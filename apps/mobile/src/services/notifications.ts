import { Platform } from 'react-native';
import { showAlert } from '@/src/utils/confirm';

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

function webNotificationSupported(): boolean {
  return Platform.OS === 'web' && typeof Notification !== 'undefined';
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!webNotificationSupported()) {
    return Platform.OS === 'web' ? 'unsupported' : 'default';
  }
  return Notification.permission as NotificationPermission;
}

/** Request browser notification permission (web). Native uses in-app alerts. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!webNotificationSupported()) {
    return Platform.OS === 'web' ? 'unsupported' : 'default';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result as NotificationPermission;
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

  // Foreground / native fallback — only when permission wasn't used.
  if (Platform.OS !== 'web') {
    await showAlert('Processing complete', body);
  }
}
