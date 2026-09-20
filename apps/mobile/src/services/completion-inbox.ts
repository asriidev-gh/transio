import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sessionai:completion-inbox';

export interface CompletionNotice {
  sessionId: string;
  title: string;
  completedAt: string;
}

export async function enqueueCompletionNotice(
  notice: Omit<CompletionNotice, 'completedAt'> & { completedAt?: string },
): Promise<void> {
  const next: CompletionNotice = {
    sessionId: notice.sessionId,
    title: notice.title,
    completedAt: notice.completedAt ?? new Date().toISOString(),
  };
  const existing = await listCompletionNotices();
  const filtered = existing.filter((item) => item.sessionId !== next.sessionId);
  await AsyncStorage.setItem(KEY, JSON.stringify([next, ...filtered].slice(0, 10)));
}

export async function listCompletionNotices(): Promise<CompletionNotice[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CompletionNotice =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as CompletionNotice).sessionId === 'string' &&
        typeof (item as CompletionNotice).title === 'string',
    );
  } catch {
    return [];
  }
}

export async function dismissCompletionNotice(sessionId: string): Promise<void> {
  const existing = await listCompletionNotices();
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify(existing.filter((item) => item.sessionId !== sessionId)),
  );
}

export async function clearCompletionNotices(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
