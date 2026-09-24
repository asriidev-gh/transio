import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session, SessionFolder } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionCard } from '@/src/components/SessionCard';
import { Button } from '@/src/components/ui/Button';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';
import { Icon } from '@/src/components/ui/Icon';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ApiClientError } from '@/src/services/api';
import { isDefaultFolder } from '@/src/services/default-folder';
import { deleteFolder, getFolder, updateFolder } from '@/src/services/folders';
import { clearLocalAudioUri } from '@/src/services/local-audio';
import { deleteSession, listSessions } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmDestructive, showAlert } from '@/src/utils/confirm';

function FolderHeaderLeft({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.headerLeft}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={({ pressed }) => [
          styles.backBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.backGlyph}>
          <Icon name="chevron-right" size={18} color={colors.ink} />
        </View>
      </Pressable>
    </View>
  );
}

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const tabBarInset = useFloatingTabBarContentInset();
  const [folder, setFolder] = useState<SessionFolder | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id || typeof id !== 'string') return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [nextFolder, allSessions] = await Promise.all([getFolder(id), listSessions()]);
        setFolder(nextFolder);
        setName(nextFolder.name);
        setSessions(allSessions.filter((session) => session.folderId === id));
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : 'Could not load this folder.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const countLabel = useMemo(() => {
    const n = sessions.length;
    return n === 1 ? '1 recording' : `${n} recordings`;
  }, [sessions.length]);

  async function onSaveName() {
    if (!id || typeof id !== 'string' || !folder) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) {
      setName(folder.name);
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateFolder(id, { name: trimmed });
      setFolder(updated);
      setName(updated.name);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not rename this folder.');
      setName(folder.name);
    } finally {
      setSavingName(false);
    }
  }

  async function onDeleteFolder() {
    if (!id || typeof id !== 'string' || !folder) return;
    if (isDefaultFolder(folder)) {
      void showAlert(
        'Keep Default',
        'The Default folder can’t be deleted — new recordings land here.',
      );
      return;
    }
    const ok = await confirmDestructive(
      'Delete folder?',
      sessions.length > 0
        ? `“${folder.name}” and its ${countLabel} will be permanently deleted. This can’t be undone.`
        : `“${folder.name}” will be removed.`,
    );
    if (!ok) return;
    try {
      await Promise.all(
        sessions.map(async (session) => {
          await deleteSession(session.id);
          await clearLocalAudioUri(session.id);
        }),
      );
      await deleteFolder(id);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete this folder.');
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
      setSessions((prev) => prev.filter((row) => row.id !== session.id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete this session.');
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <Stack.Screen
        options={{
          title: '',
          headerTitle: () => null,
          headerBackVisible: false,
          headerLeft: () => (
            <FolderHeaderLeft
              onBack={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
            />
          ),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: tabBarInset }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
          />
        }
      >
        {loading ? <LoadingState message="Loading folder…" /> : null}

        {!loading && error && !folder ? (
          <ErrorState title="Couldn't load folder" description={error} onRetry={() => void load()} />
        ) : null}

        {!loading && folder ? (
          <>
            {error ? (
              <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <View
              style={[
                styles.hero,
                shadows.soft,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.heroMark, { backgroundColor: colors.actionImport }]}>
                <Icon name="folder" size={40} />
              </View>
              <View style={styles.heroBody}>
                <Text style={[styles.eyebrow, { color: colors.inkMuted }]}>FOLDER</Text>
                {folder && isDefaultFolder(folder) ? (
                  <Text style={[styles.nameInput, { color: colors.ink }]} accessibilityRole="header">
                    Default
                  </Text>
                ) : (
                  <TextInput
                    style={[styles.nameInput, { color: colors.ink }]}
                    value={name}
                    onChangeText={setName}
                    onBlur={() => void onSaveName()}
                    editable={!savingName}
                    accessibilityLabel="Folder name"
                    placeholder="Folder name"
                    placeholderTextColor={colors.tertiary}
                  />
                )}
                <Text style={[styles.meta, { color: colors.inkMuted }]}>
                  {countLabel}
                  {savingName ? ' · Saving…' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <View style={styles.actionHalf}>
                <Button
                  label="Record"
                  onPress={() => router.push(`/new-session?mode=record&folderId=${folder.id}`)}
                  accessibilityLabel="Record into this folder"
                />
              </View>
              <View style={styles.actionHalf}>
                <Button
                  label="Import"
                  variant="secondary"
                  onPress={() => router.push(`/new-session?mode=import&folderId=${folder.id}`)}
                  accessibilityLabel="Import into this folder"
                />
              </View>
            </View>

            {sessions.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  shadows.soft,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.emptyMark, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="folder" size={48} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>
                  Nothing in this folder yet
                </Text>
                <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
                  Capture or import here so Home stays easy to scan. You can rename the folder any
                  time.
                </Text>
              </View>
            ) : (
              <View style={styles.listBlock}>
                <SectionHeader title="Recordings" meta={`${sessions.length}`} />
                <View
                  style={[
                    styles.listCard,
                    shadows.soft,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onPress={() => router.push(`/session/${session.id}`)}
                      onDelete={() => void onDeleteSession(session)}
                    />
                  ))}
                </View>
              </View>
            )}

            {folder && !isDefaultFolder(folder) ? (
              <Pressable
                onPress={() => void onDeleteFolder()}
                accessibilityRole="button"
                accessibilityLabel={`Delete folder ${folder.name}`}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Icon name="alert" size={18} color={colors.danger} />
                <Text style={[styles.deleteText, { color: colors.danger }]}>Delete folder</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    marginLeft: spacing.xs,
    maxWidth: 380,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    transform: [{ rotate: '180deg' }],
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  heroMark: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  heroBody: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nameInput: {
    ...typography.title,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  meta: {
    ...typography.meta,
  },
  error: {
    ...typography.body,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionHalf: {
    flex: 1,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'visible',
  },
  emptyTitle: {
    ...typography.section,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  listBlock: {
    gap: spacing.sm,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  deleteBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.smd,
    marginTop: spacing.sm,
  },
  deleteText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
});
