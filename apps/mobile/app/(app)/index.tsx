import { useCallback, useMemo, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session, SessionType } from '@sessionai/shared';
import { ConnectivityBanner } from '@/src/components/ConnectivityBanner';
import { EmptyState } from '@/src/components/EmptyState';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionCard } from '@/src/components/SessionCard';
import { useApiReachable } from '@/src/hooks/useApiReachable';
import { useAuth } from '@/src/hooks/useAuth';
import { ApiClientError } from '@/src/services/api';
import { listSessions } from '@/src/services/sessions';
import { colors, radii, spacing, typography } from '@/src/theme';

type FilterKey = 'all' | 'favorites' | SessionType;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'seminar', label: 'Seminar' },
  { key: 'group_discussion', label: 'Discussion' },
  { key: 'meeting', label: 'Meeting' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { reachable, refresh: refreshReachable } = useApiReachable();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

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
      void refreshReachable();

      const onAppState = (next: AppStateStatus) => {
        if (next === 'active') {
          void loadSessions(true);
          void refreshReachable();
        }
      };
      const sub = AppState.addEventListener('change', onAppState);
      return () => sub.remove();
    }, [loadSessions, refreshReachable]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (filter === 'favorites' && !session.favoritedAt) return false;
      if (filter !== 'all' && filter !== 'favorites' && session.sessionType !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        session.title.toLowerCase().includes(q) ||
        (session.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [filter, query, sessions]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshReachable();
              void loadSessions(true);
            }}
          />
        }
      >
        <ConnectivityBanner
          reachable={reachable}
          onRetry={() => {
            void refreshReachable();
            void loadSessions(true);
          }}
        />

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.brand} accessibilityRole="header">
              Session<Text style={styles.brandAccent}>AI</Text>
            </Text>
            <Pressable
              onPress={() => router.push('/settings')}
              style={styles.settingsBtn}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Text style={styles.settingsBtnText}>Settings</Text>
            </Pressable>
          </View>
          <Text style={styles.tagline}>
            Record seminars and discussions. Transcribe. Summarize. Ask.
          </Text>
          {user?.email ? <Text style={styles.signedIn}>Signed in as {user.email}</Text> : null}
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push('/new-session')}
          accessibilityRole="button"
          accessibilityLabel="New session"
        >
          <Text style={styles.ctaText}>New session</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          accessibilityRole="tablist"
        >
          {FILTERS.map((chip) => {
            const selected = filter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setFilter(chip.key)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={chip.label}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search sessions"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Search sessions"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {filter === 'favorites' ? 'Favorites' : 'Sessions'}
          </Text>

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
              actionLabel="New session"
              onAction={() => router.push('/new-session')}
            />
          ) : null}

          {!loading && !error && sessions.length > 0 && filtered.length === 0 ? (
            <EmptyState
              title="No matches."
              description="Try another search or filter."
              actionLabel="Clear filters"
              onAction={() => {
                setQuery('');
                setFilter('all');
              }}
            />
          ) : null}

          {!loading && !error
            ? filtered.map((session) => (
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
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brand: {
    ...typography.brand,
    color: colors.brand,
  },
  brandAccent: {
    color: colors.accent,
  },
  settingsBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingsBtnText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '700',
  },
  tagline: {
    ...typography.body,
    color: colors.inkMuted,
    maxWidth: 340,
  },
  signedIn: {
    ...typography.caption,
    color: colors.brandSoft,
  },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color: colors.onBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  chipTextSelected: {
    color: colors.onBrand,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.ink,
    fontSize: 15,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
});
