import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@sessionai/shared';
import { EmptyState } from '@/src/components/EmptyState';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionCard } from '@/src/components/SessionCard';
import { useAuth } from '@/src/hooks/useAuth';
import { ApiClientError } from '@/src/services/api';
import { listSessions } from '@/src/services/sessions';
import { colors, spacing, typography } from '@/src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Could not load sessions. Check that the API is running.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadSessions(true)} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.brand} accessibilityRole="header">
            SessionAI
          </Text>
          <Text style={styles.tagline}>
            Record seminars and discussions. Transcribe. Summarize.
          </Text>
          {user?.email ? <Text style={styles.signedIn}>Signed in as {user.email}</Text> : null}
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push('/new-session')}
          accessibilityRole="button"
          accessibilityLabel="New Recording"
        >
          <Text style={styles.ctaText}>+ New Recording</Text>
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
              <Text style={styles.settingsLink}>Settings</Text>
            </Pressable>
          </View>

          {loading ? <LoadingState message="Loading sessions…" /> : null}

          {!loading && error ? (
            <ErrorState
              title="Couldn't load sessions"
              description={error}
              onRetry={() => void loadSessions()}
            />
          ) : null}

          {!loading && !error && sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet."
              description="Record your first seminar or group discussion."
            />
          ) : null}

          {!loading && !error
            ? sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onPress={() => router.push(`/session/${session.id}`)}
                />
              ))
            : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  brand: {
    ...typography.brand,
    color: colors.brand,
  },
  tagline: {
    ...typography.body,
    color: colors.inkMuted,
    maxWidth: 320,
  },
  signedIn: {
    ...typography.caption,
    color: colors.brandSoft,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.ink,
  },
  settingsLink: {
    color: colors.brandSoft,
    fontWeight: '600',
  },
});
