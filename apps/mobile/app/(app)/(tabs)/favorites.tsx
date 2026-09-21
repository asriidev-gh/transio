import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@sessionai/shared';
import { EmptyState } from '@/src/components/EmptyState';
import { ErrorState } from '@/src/components/ErrorState';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionCard } from '@/src/components/SessionCard';
import { ApiClientError } from '@/src/services/api';
import { clearLocalAudioUri } from '@/src/services/local-audio';
import { deleteSession, listSessions } from '@/src/services/sessions';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmDestructive } from '@/src/utils/confirm';

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setSessions(await listSessions());
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not load favorites. Check that the API is running.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const favorites = useMemo(
    () => sessions.filter((session) => Boolean(session.favoritedAt)),
    [sessions],
  );

  async function onDeleteSession(session: Session) {
    const ok = await confirmDestructive(
      'Delete session?',
      `“${session.title}” and its transcript/summary will be permanently removed.`,
    );
    if (!ok) return;
    try {
      await deleteSession(session.id);
      await clearLocalAudioUri(session.id);
      setSessions((prev) => prev.filter((row) => row.id !== session.id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete this session.');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
          Favorites
        </Text>
        <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
          Sessions you’ve starred for quick access.
        </Text>

        {loading ? <LoadingState message="Loading favorites…" /> : null}

        {!loading && error ? (
          <ErrorState
            title="Couldn't load favorites"
            description={error}
            onRetry={() => void load()}
          />
        ) : null}

        {!loading && !error && favorites.length === 0 ? (
          <EmptyState
            variant="hero"
            icon="star"
            title="No favorites yet"
            description="Open a session and tap the star to pin it here."
            actionLabel="Browse sessions"
            onAction={() => router.push('/')}
          />
        ) : null}

        {!loading && !error && favorites.length > 0 ? (
          <View style={[styles.cards, { borderColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            {favorites.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onPress={() => router.push(`/session/${session.id}`)}
                onDelete={() => void onDeleteSession(session)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
    gap: spacing.md,
  },
  title: {
    ...typography.pageTitle,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  cards: {},
});
