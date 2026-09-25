import AsyncStorage from '@react-native-async-storage/async-storage';
import { shouldClearKeyAfterDeletion } from '@/src/services/account-keys';
import { apiRequest } from '@/src/services/api';

/** Permanently delete the signed-in account and everything stored for it on the server. */
export async function deleteMyAccount(): Promise<void> {
  await apiRequest<{ deleted: boolean }>('/me', {
    method: 'DELETE',
    auth: true,
    body: { confirm: 'DELETE' },
    // Never retried: the account is gone after the first success.
    retries: 0,
  });
}

/** Remove local drafts, cached lists and saved recordings' pointers after deletion. */
export async function clearLocalDataAfterDeletion(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(shouldClearKeyAfterDeletion));
  } catch {
    // Best effort: the server side is already deleted.
  }
}
