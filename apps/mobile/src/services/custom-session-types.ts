import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sessionai:custom-session-types';
const MAX = 12;
const MAX_LEN = 40;

function normalize(label: string): string {
  return label.trim().replace(/\s+/g, ' ').slice(0, MAX_LEN);
}

export async function listCustomSessionTypes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(normalize)
      .filter((item) => item.length > 0)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/** Remember a custom type label for future new-session chips (most recent first). */
export async function rememberCustomSessionType(label: string): Promise<string[]> {
  const next = normalize(label);
  if (!next) return listCustomSessionTypes();
  try {
    const existing = await listCustomSessionTypes();
    const filtered = existing.filter((item) => item.toLowerCase() !== next.toLowerCase());
    const merged = [next, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return listCustomSessionTypes();
  }
}
