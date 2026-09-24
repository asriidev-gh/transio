import { Platform } from 'react-native';
import { File } from 'expo-file-system';

/** Best-effort local file size in bytes; null when unknown (web, content URIs, errors). */
export function getLocalFileSize(uri: string): number | null {
  if (Platform.OS === 'web' || !/^(file|content):/i.test(uri)) return null;
  try {
    const size = new File(uri).size;
    return typeof size === 'number' && size > 0 ? size : null;
  } catch {
    return null;
  }
}
