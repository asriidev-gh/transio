import { KeyboardSafeScrollView } from '@/src/components/KeyboardSafeScrollView';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session, SessionFolder } from '@sessionai/shared';
import { AccountMenu } from '@/src/components/AccountMenu';
import { BrandLogo } from '@/src/components/BrandLogo';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { CompletionBanner } from '@/src/components/CompletionBanner';
import { ConnectivityBanner } from '@/src/components/ConnectivityBanner';
import { EmptyState } from '@/src/components/EmptyState';
import { ErrorState } from '@/src/components/ErrorState';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { HorizontalCarousel } from '@/src/components/HorizontalCarousel';
import {
  InsightSessionCard,
  InsightStat,
} from '@/src/components/HomeDashboard';
import { SessionCard } from '@/src/components/SessionCard';
import { APP_NAME, APP_TAGLINE } from '@/src/data/brand';
import {
  InsightsCalendarModal,
  InsightsListModal,
} from '@/src/components/InsightsCalendarModal';
import { HomeBanner } from '@/src/components/HomeBanner';
import { HomeLibrarySkeleton } from '@/src/components/Skeleton';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { Icon } from '@/src/components/ui/Icon';
import { useApiReachable } from '@/src/hooks/useApiReachable';
import { useAuth } from '@/src/hooks/useAuth';
import { ApiClientError } from '@/src/services/api';
import { sessionsUnchanged } from '@/src/utils/sessions-unchanged';
import {
  dismissCompletionNotice,
  enqueueCompletionNotice,
  listCompletionNotices,
  type CompletionNotice,
} from '@/src/services/completion-inbox';
import { createFolder, deleteFolder, listFolders } from '@/src/services/folders';
import {
  dedupeFoldersByName,
  ensureDefaultFolder,
  findFolderByName,
  isDefaultFolder,
  sortFoldersWithDefaultFirst,
} from '@/src/services/default-folder';
import { readHomeCache, writeHomeCache } from '@/src/services/home-cache';
import { notifyProcessingComplete } from '@/src/services/notifications';
import { clearLocalAudioUri } from '@/src/services/local-audio';
import { deleteSession, listSessions } from '@/src/services/sessions';
import { fonts, radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDurationHuman } from '@/src/utils/format';
import { confirmDestructive } from '@/src/utils/confirm';

const IN_FLIGHT_STATUSES = new Set(['transcribing', 'summarizing']);
const CONTINUE_LIMIT = 8;
/** Sessions that still need transcription / follow-up (not past transcript yet). */
const NOT_TRANSCRIBED_YET = new Set([
  'recording',
  'uploaded',
  'transcribing',
  'failed',
]);

type CaptureMode = 'record' | 'import';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function hrefForCapture(mode: CaptureMode): string {
  return mode === 'record' ? '/new-session?mode=record' : '/new-session?mode=import';
}

function isInFlight(session: Session): boolean {
  return IN_FLIGHT_STATUSES.has(session.status);
}

function withinDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 86_400_000;
}

function sortRecent(a: Session, b: Session): number {
  return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
}

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, shadows, scheme, reduceMotion } = useTheme();
  const { user } = useAuth();
  const { reachable, refresh: refreshReachable } = useApiReachable();

  const pagePad = windowWidth < 480 ? spacing.md : spacing.lg;
  const usableWidth = Math.max(280, windowWidth - pagePad * 2);
  const carouselCardWidth = Math.min(200, Math.max(150, Math.floor((usableWidth - spacing.smd) / 2)));
  const folderCardWidth = carouselCardWidth;
  const firstName = user?.email?.split('@')[0];
  const greeting = `${greetingForHour(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CompletionNotice | null>(null);
  const [composingFolder, setComposingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [insightBrowse, setInsightBrowse] = useState<
    'calendar' | 'captured' | 'favorites' | 'processing' | null
  >(null);
  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async (isRefresh = false, silent = false) => {
    if (!silent) {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
    }

    // Paint cached library immediately so Render cold starts don't hold the skeleton.
    if (!isRefresh && !silent) {
      const cached = await readHomeCache();
      if (cached && (cached.sessions.length > 0 || cached.folders.length > 0)) {
        setSessions(cached.sessions);
        setFolders(cached.folders);
        setLoading(false);
      }
    }

    try {
      const [data, folderRows] = await Promise.all([
        listSessions(),
        listFolders().catch(() => [] as SessionFolder[]),
      ]);
      setSessions((prev) => (sessionsUnchanged(prev, data) ? prev : data));
      setError(null);
      // Don't wait on ensureDefaultFolder to clear the skeleton.
      setLoading(false);

      let nextFolders = dedupeFoldersByName(folderRows);
      try {
        const def = await ensureDefaultFolder(folderRows);
        nextFolders = sortFoldersWithDefaultFirst(
          dedupeFoldersByName(
            folderRows.some((f) => f.id === def.id) ? folderRows : [...folderRows, def],
          ),
        );
      } catch {
        // Keep listed folders if default ensure fails.
      }
      setFolders(nextFolders);
      void writeHomeCache(data, nextFolders);

      inFlightIdsRef.current = new Set(data.filter(isInFlight).map((s) => s.id));
      const notices = await listCompletionNotices();
      setNotice(notices[0] ?? null);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not load sessions. Check that the API is running.',
        );
      }
      setLoading(false);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const wasUnreachable = useRef(false);
  useEffect(() => {
    if (reachable === false) {
      wasUnreachable.current = true;
      return;
    }
    if (reachable === true && wasUnreachable.current) {
      wasUnreachable.current = false;
      void loadSessions(true, true);
    }
  }, [reachable, loadSessions]);

  const reconcileCompletions = useCallback(async (data: Session[]) => {
    const previouslyInFlight = inFlightIdsRef.current;
    const nextInFlight = new Set(data.filter(isInFlight).map((s) => s.id));
    const newlyCompleted = data.filter(
      (session) =>
        previouslyInFlight.has(session.id) &&
        session.status === 'completed' &&
        !announcedIdsRef.current.has(session.id),
    );

    for (const session of newlyCompleted) {
      announcedIdsRef.current.add(session.id);
      try {
        await enqueueCompletionNotice({ sessionId: session.id, title: session.title });
        await notifyProcessingComplete({ sessionId: session.id, title: session.title });
      } catch {
        // Non-fatal
      }
    }

    inFlightIdsRef.current = nextInFlight;
    if (newlyCompleted.length > 0) {
      const notices = await listCompletionNotices();
      setNotice(notices[0] ?? null);
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
      pollRef.current = setInterval(() => {
        if (inFlightIdsRef.current.size === 0) return;
        void (async () => {
          try {
            const data = await listSessions();
            // Same list as on screen: skip the re-render so polling stays cheap.
            setSessions((prev) => (sessionsUnchanged(prev, data) ? prev : data));
            await reconcileCompletions(data);
          } catch {
            // keep polling
          }
        })();
      }, 4000);
      return () => {
        sub.remove();
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [loadSessions, reconcileCompletions, refreshReachable]),
  );

  const insights = useMemo(() => {
    const thisWeek = sessions.filter((s) => withinDays(s.recordedAt, 7));
    const favorites = sessions.filter((s) => Boolean(s.favoritedAt));
    const processing = sessions.filter(isInFlight);
    const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    return {
      weekCount: thisWeek.length,
      favoriteCount: favorites.length,
      processingCount: processing.length,
      totalTime: formatDurationHuman(totalSeconds),
      sessionCount: sessions.length,
    };
  }, [sessions]);

  const continueSessions = useMemo(
    () =>
      [...sessions]
        .filter((session) => NOT_TRANSCRIBED_YET.has(session.status))
        .sort(sortRecent)
        .slice(0, CONTINUE_LIMIT),
    [sessions],
  );

  const recentSessions = useMemo(
    () => [...sessions].sort(sortRecent).slice(0, 5),
    [sessions],
  );

  const capturedSessions = useMemo(
    () => [...sessions].sort(sortRecent),
    [sessions],
  );

  const processingSessions = useMemo(
    () => sessions.filter(isInFlight).sort(sortRecent),
    [sessions],
  );

  const favoriteSessions = useMemo(
    () => sessions.filter((s) => Boolean(s.favoritedAt)).sort(sortRecent),
    [sessions],
  );

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      if (session.folderId) {
        counts.set(session.folderId, (counts.get(session.folderId) ?? 0) + 1);
      }
    }
    return counts;
  }, [sessions]);

  const visibleFolders = useMemo(() => dedupeFoldersByName(folders), [folders]);

  const hasLibrary = sessions.length > 0 || folders.length > 0;

  async function onCreateFolder() {
    const trimmed = folderName.trim();
    if (!trimmed) return;
    if (findFolderByName(folders, trimmed)) {
      setError(`A folder named “${trimmed}” already exists.`);
      return;
    }
    setCreatingFolder(true);
    setError(null);
    try {
      const created = await createFolder({ name: trimmed });
      const nextFolders = dedupeFoldersByName([...folders, created]);
      setFolders(nextFolders);
      void writeHomeCache(sessions, nextFolders);
      setFolderName('');
      setComposingFolder(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create folder.');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function onDeleteSession(session: Session) {
    const ok = await confirmDestructive(
      'Delete session?',
      `“${session.title}” and its transcript/summary will be permanently removed.`,
    );
    if (!ok) return;
    try {
      await deleteSession(session.id);
      await clearLocalAudioUri(session.id);
      const nextSessions = sessions.filter((row) => row.id !== session.id);
      setSessions(nextSessions);
      void writeHomeCache(nextSessions, folders);    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete this session.');
    }
  }

  async function onDeleteFolder(folder: SessionFolder) {
    if (isDefaultFolder(folder)) {
      setError('The Default folder can’t be deleted.');
      return;
    }
    const count = folderCounts.get(folder.id) ?? 0;
    const ok = await confirmDestructive(
      'Delete folder?',
      count > 0
        ? `“${folder.name}” and its ${count === 1 ? '1 recording' : `${count} recordings`} will be permanently deleted. This can’t be undone.`
        : `“${folder.name}” will be removed.`,
    );
    if (!ok) return;
    try {
      const inFolder = sessions.filter((session) => session.folderId === folder.id);
      await Promise.all(
        inFolder.map(async (session) => {
          await deleteSession(session.id);
          await clearLocalAudioUri(session.id);
        }),
      );
      await deleteFolder(folder.id);
      const nextSessions = sessions.filter((session) => session.folderId !== folder.id);
      const nextFolders = folders.filter((row) => row.id !== folder.id);
      setSessions(nextSessions);
      setFolders(nextFolders);
      void writeHomeCache(nextSessions, nextFolders);    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete this folder.');
    }
  }

  function openCapture(mode: CaptureMode) {
    router.push(hrefForCapture(mode) as Href);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={[
          scheme === 'dark' ? 'rgba(108, 99, 255, 0.16)' : 'rgba(108, 99, 255, 0.10)',
          'transparent',
        ]}
        style={styles.atmosphere}
        pointerEvents="none"
      />
      <KeyboardSafeScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: pagePad }]}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshReachable();
              void loadSessions(true);
            }}
            tintColor={colors.accent}
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

        {notice ? (
          <CompletionBanner
            title={notice.title}
            onOpen={() => {
              const sessionId = notice.sessionId;
              void dismissCompletionNotice(sessionId).then(() => setNotice(null));
              router.push(`/session/${sessionId}`);
            }}
            onDismiss={() => {
              void dismissCompletionNotice(notice.sessionId).then(() => setNotice(null));
            }}
          />
        ) : null}

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.greetingBlock}>
              <Animated.View
                entering={
                  reduceMotion ? undefined : FadeInDown.duration(420).springify().damping(18)
                }
                style={styles.brandLockup}
                accessibilityRole="header"
                accessibilityLabel={APP_NAME}
              >
                <View
                  style={[
                    styles.brandMarkWell,
                    {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <BrandLogo variant="mark" size={22} accessibilityLabel="" />
                </View>
                <Text style={[styles.brandName, { color: colors.ink }]}>{APP_NAME}</Text>
              </Animated.View>
              <Text style={[styles.greeting, { color: colors.ink }]} accessibilityRole="header">
                {greeting}
              </Text>
              <Text style={[styles.pageTitle, { color: colors.inkMuted }]}>
                {APP_TAGLINE}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <ThemeToggle />
              <AccountMenu />
            </View>
          </View>
        </View>

        <HomeBanner onRecord={() => openCapture('record')} onImport={() => openCapture('import')} />

        {loading ? <HomeLibrarySkeleton /> : null}

        {!loading && error && !hasLibrary ? (
          <ErrorState
            title="Couldn't load home"
            description={error}
            onRetry={() => void loadSessions()}
          />
        ) : null}

        {!loading && !error && !hasLibrary ? (
          <EmptyState
            variant="hero"
            icon="microphone"
            title="Your conversations will appear here"
            description="Record your first conversation and Smart Transcriber will turn it into searchable text."
            actionLabel="Start recording"
            onAction={() => openCapture('record')}
          />
        ) : null}

        {!loading && hasLibrary ? (
          <View style={styles.dashboard}>
            {error ? (
              <Text style={[styles.inlineError, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <SectionHeader title="Insights" />
            <View style={styles.stats}>
              <InsightStat
                label="This week"
                value={String(insights.weekCount)}
                icon="calendar"
                tint={colors.actionImport}
                accent={colors.cyan}
                onPress={() => setInsightBrowse('calendar')}
              />
              <InsightStat
                label="Captured"
                value={insights.totalTime}
                icon="sine-wave"
                tint={colors.actionRecord}
                accent={colors.accent}
                onPress={() => setInsightBrowse('captured')}
              />
              <InsightStat
                label="Favorites"
                value={String(insights.favoriteCount)}
                icon="star-outline"
                tint={colors.actionFav}
                accent={colors.warning}
                onPress={() => setInsightBrowse('favorites')}
              />
              <InsightStat
                label="Processing"
                value={String(insights.processingCount)}
                icon="alert"
                tint={colors.actionSettings}
                accent={colors.inkMuted}
                onPress={() => setInsightBrowse('processing')}
              />
            </View>

            <SectionHeader
              title="Recent"
              actionLabel="See all"
              onAction={() => router.push('/(app)/(tabs)/history' as Href)}
            />
            {recentSessions.length === 0 ? (
              <Text style={[styles.hint, { color: colors.inkMuted }]}>
                New transcripts show up here after you record or import.
              </Text>
            ) : (
              <View style={styles.recentList}>
                {recentSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onPress={() => router.push(`/session/${session.id}`)}
                    onDelete={() => void onDeleteSession(session)}
                  />
                ))}
              </View>
            )}

            <SectionHeader
              title="Continue"
              actionLabel="History"
              onAction={() => router.push('/(app)/(tabs)/history' as Href)}
            />
            {continueSessions.length === 0 ? (
              <Text style={[styles.hint, { color: colors.inkMuted }]}>
                Sessions waiting to be transcribed will show up here.
              </Text>
            ) : (
              <HorizontalCarousel step={carouselCardWidth + spacing.smd} showChevrons={false}>
                {continueSessions.map((session) => (
                  <InsightSessionCard
                    key={session.id}
                    session={session}
                    width={carouselCardWidth}
                    onPress={() => router.push(`/session/${session.id}`)}
                  />
                ))}
              </HorizontalCarousel>
            )}

            <SectionHeader
              title="Folders"
              actionLabel={composingFolder ? undefined : 'New'}
              actionIcon={composingFolder ? undefined : 'plus'}
              onAction={composingFolder ? undefined : () => setComposingFolder(true)}
            />

            {composingFolder ? (
              <View style={styles.composer}>
                <TextInput
                  style={[
                    styles.composerInput,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      color: colors.ink,
                    },
                  ]}
                  value={folderName}
                  onChangeText={setFolderName}
                  placeholder="Folder name"
                  placeholderTextColor={colors.tertiary}
                  autoFocus
                  editable={!creatingFolder}
                  onSubmitEditing={() => void onCreateFolder()}
                  accessibilityLabel="Folder name"
                />
                <Pressable
                  onPress={() => void onCreateFolder()}
                  disabled={creatingFolder || !folderName.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Add folder"
                  style={[
                    styles.composerBtn,
                    {
                      backgroundColor: colors.accent,
                      opacity: creatingFolder || !folderName.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.composerBtnText, { color: colors.onBrand }]}>
                    {creatingFolder ? '…' : 'Add'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setComposingFolder(false);
                    setFolderName('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel new folder"
                  style={({ pressed }) => [
                    styles.composerCancel,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                    shadows.soft,
                  ]}
                >
                  <Text style={[styles.composerCancelText, { color: colors.ink }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}

            {visibleFolders.length > 0 ? (
              <HorizontalCarousel step={folderCardWidth + spacing.smd} showChevrons={false}>
                {visibleFolders.map((folder) => {
                  const count = folderCounts.get(folder.id) ?? 0;
                  const locked = isDefaultFolder(folder);
                  return (
                    <View
                      key={folder.id}
                      style={[
                        styles.folderChip,
                        {
                          width: folderCardWidth,
                          backgroundColor: colors.surface,
                        },
                        shadows.soft,
                      ]}
                    >
                      <Pressable
                        onPress={() => router.push(`/folder/${folder.id}` as Href)}
                        style={({ pressed }) => [styles.folderMain, { opacity: pressed ? 0.85 : 1 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${folder.name}, ${count} recordings`}
                      >
                        <View style={[styles.folderMark, { backgroundColor: colors.actionImport }]}>
                          <Icon name="folder" size={24} />
                        </View>
                        <Text style={[styles.folderTitle, { color: colors.ink }]} numberOfLines={1}>
                          {folder.name}
                        </Text>
                        <Text style={[styles.folderMeta, { color: colors.inkMuted }]}>
                          {count === 1 ? '1 recording' : `${count} recordings`}
                        </Text>
                      </Pressable>
                      {!locked ? (
                        <Pressable
                          onPress={() => void onDeleteFolder(folder)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete folder ${folder.name}`}
                          style={styles.folderDelete}
                        >
                          <Icon name="close" size={16} color={colors.inkMuted} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </HorizontalCarousel>
            ) : !composingFolder ? (
              <Text style={[styles.hint, { color: colors.inkMuted }]}>
                Create a folder to group lectures, meetings, or a series.
              </Text>
            ) : null}
          </View>
        ) : null}
      </KeyboardSafeScrollView>

      <InsightsCalendarModal
        visible={insightBrowse === 'calendar'}
        sessions={sessions}
        onClose={() => setInsightBrowse(null)}
        onOpenSession={(sessionId) => router.push(`/session/${sessionId}`)}
      />
      <InsightsListModal
        visible={insightBrowse === 'captured'}
        title="All recordings"
        emptyMessage="No recordings yet — capture something to see it here."
        sessions={capturedSessions}
        onClose={() => setInsightBrowse(null)}
        onOpenSession={(sessionId) => router.push(`/session/${sessionId}`)}
      />
      <InsightsListModal
        visible={insightBrowse === 'favorites'}
        title="Favorites"
        emptyMessage="Star a session to keep it here."
        sessions={favoriteSessions}
        onClose={() => setInsightBrowse(null)}
        onOpenSession={(sessionId) => router.push(`/session/${sessionId}`)}
      />
      <InsightsListModal
        visible={insightBrowse === 'processing'}
        title="Processing"
        emptyMessage="Nothing is processing right now."
        sessions={processingSessions}
        onClose={() => setInsightBrowse(null)}
        onOpenSession={(sessionId) => router.push(`/session/${sessionId}`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  atmosphere: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scroll: { flex: 1, width: '100%' },
  container: {
    paddingTop: spacing.md,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
    gap: spacing.lgSoft,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  topBar: {
    gap: spacing.smd,
    paddingTop: spacing.sm,
    width: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    width: '100%',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  brandMarkWell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandName: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    letterSpacing: -0.35,
    flexShrink: 1,
  },
  greetingBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  greeting: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
    paddingTop: 2,
  },
  pageTitle: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  recentList: {
    gap: spacing.smd,
    width: '100%',
  },
  dashboard: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.smd,
    width: '100%',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smd,
    width: '100%',
  },
  folderChip: {
    borderWidth: 0,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  folderMain: {
    gap: spacing.sm,
  },
  folderMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  folderMeta: {
    ...typography.caption,
  },
  folderDelete: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...typography.meta,
  },
  inlineError: {
    ...typography.meta,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  composerBtn: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  composerCancel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
