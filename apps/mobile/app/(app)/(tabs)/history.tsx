import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { EmptyState } from '@/src/components/EmptyState';
import { ErrorState } from '@/src/components/ErrorState';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { SessionCard } from '@/src/components/SessionCard';
import { SessionListSkeleton } from '@/src/components/Skeleton';
import { SearchBar } from '@/src/components/ui/SearchBar';
import { ApiClientError } from '@/src/services/api';
import { clearLocalAudioUri } from '@/src/services/local-audio';
import { deleteSession, listSessions } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmDestructive } from '@/src/utils/confirm';

type FilterKey = 'all' | 'favorites' | 'processing' | 'ready';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready' },
];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startToday - startThat) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

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
          : 'Could not load history. Check that the API is running.',
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => {
        if (filter === 'favorites' && !s.favoritedAt) return false;
        if (filter === 'processing' && !['transcribing', 'summarizing', 'uploaded'].includes(s.status)) {
          return false;
        }
        if (filter === 'ready' && !['completed', 'transcribed'].includes(s.status)) {
          return false;
        }
        if (!q) return true;
        return (
          s.title.toLowerCase().includes(q) ||
          SESSION_TYPE_LABELS[s.sessionType].toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [sessions, query, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const key = dayLabel(s.recordedAt);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

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
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
          History
        </Text>
        <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
          Search and revisit every capture.
        </Text>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search transcripts" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => {
            const selected = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.accent : colors.inkMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? <SessionListSkeleton rows={6} /> : null}

        {!loading && error ? (
          <ErrorState
            title="Couldn't load history"
            description={error}
            onRetry={() => void load()}
          />
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <EmptyState
            icon="microphone"
            title="No transcripts yet"
            description="Record a conversation and Smart Transcriber will turn it into searchable text."
            actionLabel="Start recording"
            onAction={() => router.push('/new-session?mode=record')}
          />
        ) : null}

        {!loading &&
          groups.map(([label, rows]) => (
            <View key={label} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.inkMuted }]}>{label}</Text>
              {rows.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onPress={() => router.push(`/session/${session.id}`)}
                  onDelete={() => void onDeleteSession(session)}
                />
              ))}
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    padding: spacing.md,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
    gap: spacing.md,
  },
  title: { ...typography.pageTitle, letterSpacing: -0.5 },
  subtitle: { ...typography.body, marginTop: -spacing.sm },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  group: { gap: spacing.smd },
  groupLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});
