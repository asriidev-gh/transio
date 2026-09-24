import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useAuth } from '@/src/contexts/AuthContext';
import { sharedIntentToImportParams } from '@/src/services/shared-media';

/**
 * Android "Share to Smart Transcriber": recordings from Zoom, Meet, Drive or Files
 * open the import screen prefilled. Waits for a signed-in (or guest) session.
 */
export function ShareIntentHandler() {
  const router = useRouter();
  const { session } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!hasShareIntent || !session) return;
    const params = sharedIntentToImportParams(shareIntent);
    resetShareIntent();
    if (!params) return;
    router.push({ pathname: '/new-session', params: { mode: 'import', ...params } });
  }, [hasShareIntent, shareIntent, session, resetShareIntent, router]);

  return null;
}
