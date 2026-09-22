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
import type { Session } from '@sessionai/shared';
import { EmptyState } from '@/src/components/EmptyState';
import { ErrorState } from '@/src/components/ErrorState';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { SessionListSkeleton } from '@/src/components/Skeleton';
import { Icon } from '@/src/components/ui/Icon';
import { ApiClientError } from '@/src/services/api';
import { listSessions } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatRelativeSessionDate } from '@/src/utils/format';

const READY = new Set(['completed', 'transcribed']);

const LANG_PRESETS = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
] as const;

export default function TranslateHubScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('English');
  const [target, setTarget] = useState('Filipino');

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
          : 'Could not load sessions for translation.',
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

  const ready = useMemo(
    () =>
      sessions
        .filter((s) => READY.has(s.status))
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
        .slice(0, 12),
    [sessions],
  );

  function swapLanguages() {
    setSource((prev) => {
      setTarget(prev);
      return target;
    });
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
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
          Translate
        </Text>
        <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
          Live dual-pane while you record, or translate a finished transcript.
        </Text>

        <Pressable
          onPress={() => router.push('/new-session?mode=record&captions=live')}
          style={({ pressed }) => [
            styles.liveCta,
            {
              backgroundColor: colors.actionImport,
              borderColor: colors.cyan,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start live translate recording"
        >
          <View style={[styles.liveIcon, { backgroundColor: colors.cyan }]}>
            <Icon name="translate" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.liveCopy}>
            <Text style={[styles.liveTitle, { color: colors.ink }]}>Live translate</Text>
            <Text style={[styles.liveHint, { color: colors.inkMuted }]}>
              Hear one language, read another in real time
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.inkMuted} />
        </Pressable>

        <View
          style={[
            styles.pairCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <View style={styles.langCol}>
            <Text style={[styles.langLabel, { color: colors.inkMuted }]}>From</Text>
            <Text style={[styles.langValue, { color: colors.ink }]}>{source}</Text>
          </View>
          <Pressable
            onPress={swapLanguages}
            style={[styles.swapBtn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Swap languages"
          >
            <Icon name="translate" size={20} color={colors.accent} />
          </Pressable>
          <View style={[styles.langCol, styles.langColEnd]}>
            <Text style={[styles.langLabel, { color: colors.inkMuted }]}>To</Text>
            <Text style={[styles.langValue, { color: colors.cyan }]}>{target}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {LANG_PRESETS.map((lang) => {
            const selected = target === lang.label;
            return (
              <Pressable
                key={lang.code}
                onPress={() => setTarget(lang.label)}
                style={[
                  styles.presetChip,
                  {
                    borderColor: selected ? colors.cyan : colors.border,
                    backgroundColor: selected ? colors.actionImport : colors.surface,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Target ${lang.label}`}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: selected ? colors.cyan : colors.inkMuted },
                  ]}
                >
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.section, { color: colors.ink }]}>Ready to translate</Text>

        {loading ? <SessionListSkeleton rows={4} /> : null}

        {!loading && error ? (
          <ErrorState title="Couldn't load sessions" description={error} onRetry={() => void load()} />
        ) : null}

        {!loading && !error && ready.length === 0 ? (
          <EmptyState
            icon="translate"
            title="Nothing to translate yet"
            description="Finish a recording first — then open it here to translate transcript or summary."
            actionLabel="Record"
            onAction={() => router.push('/new-session?mode=record')}
          />
        ) : null}

        {!loading &&
          ready.map((session) => (
            <Pressable
              key={session.id}
              onPress={() => router.push(`/session/${session.id}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
                shadows.soft,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Translate ${session.title}`}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.actionImport }]}>
                <Icon name="translate" size={22} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                  {session.title}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.inkMuted }]}>
                  {formatRelativeSessionDate(session.recordedAt)} · Open session Translate bar
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.inkMuted} />
            </Pressable>
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
  title: { ...typography.pageTitle },
  subtitle: { ...typography.body, marginTop: -spacing.sm },
  liveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  liveIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCopy: { flex: 1, gap: 2 },
  liveTitle: { fontSize: 16, fontWeight: '700' },
  liveHint: { ...typography.caption },
  pairCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  langCol: { flex: 1, gap: 4 },
  langColEnd: { alignItems: 'flex-end' },
  langLabel: { ...typography.caption },
  langValue: { fontSize: 17, fontWeight: '600' },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: { ...typography.section, marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowMeta: { ...typography.caption },
});
