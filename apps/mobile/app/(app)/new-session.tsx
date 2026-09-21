import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SessionFolder, SessionType } from '@sessionai/shared';
import { SessionTypePicker } from '@/src/components/SessionTypePicker';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { ApiClientError } from '@/src/services/api';
import { saveLocalAudioUri } from '@/src/services/local-audio';
import {
  pickAudioFile,
  titleFromMediaName,
  titleFromMediaUrl,
  type PickedAudio,
} from '@/src/services/pick-audio';
import { importSessionMediaFromUrl } from '@/src/services/audio-upload';
import {
  DEFAULT_FOLDER_NAME,
  dedupeFoldersByName,
  ensureDefaultFolder,
  isDefaultFolder,
  sortFoldersWithDefaultFirst,
} from '@/src/services/default-folder';
import {
  listCustomSessionTypes,
  rememberCustomSessionType,
} from '@/src/services/custom-session-types';
import { listFolders } from '@/src/services/folders';
import { createSession } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export default function NewSessionScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const { mode, folderId: folderIdParam } = useLocalSearchParams<{
    mode?: string;
    folderId?: string;
  }>();
  const preferImport = mode === 'import';
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('group_discussion');
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<PickedAudio | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(
    typeof folderIdParam === 'string' && folderIdParam ? folderIdParam : null,
  );

  useEffect(() => {
    void (async () => {
      try {
        const [rows, customs] = await Promise.all([
          listFolders(),
          listCustomSessionTypes(),
        ]);
        setCustomTypes(customs);
        const def = await ensureDefaultFolder(rows);
        const merged = sortFoldersWithDefaultFirst(
          dedupeFoldersByName(rows.some((f) => f.id === def.id) ? rows : [...rows, def]),
        );
        setFolders(merged);
        setFolderId((current) => {
          if (current && merged.some((f) => f.id === current)) return current;
          return def.id;
        });
      } catch {
        setFolders([]);
      }
    })();
  }, []);

  function resolveTitle(): string | null {
    const typed = title.trim();
    if (typed) return typed;
    const suggested = picked
      ? titleFromMediaName(picked.name)
      : titleFromMediaUrl(mediaUrl.trim());
    if (suggested) {
      setTitle(suggested);
      return suggested;
    }
    setError('Title is required.');
    return null;
  }

  async function createDraft(trimmedTitle: string) {
    if (sessionType === 'other') {
      const label = customTypeLabel.trim();
      if (!label) {
        throw new Error('Enter a name for this session type, or pick another type.');
      }
      const next = await rememberCustomSessionType(label);
      setCustomTypes(next);
    }

    let destinationId = folderId;
    if (!destinationId) {
      const def = await ensureDefaultFolder(folders);
      destinationId = def.id;
      setFolderId(def.id);
    }
    return createSession({
      title: trimmedTitle,
      sessionType,
      description: description.trim() ? description.trim() : null,
      folderId: destinationId,
    });
  }

  async function onStartRecording() {
    const trimmed = resolveTitle();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const session = await createDraft(trimmed);
      router.replace(`/recording?id=${session.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not create session. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function onChooseFile() {
    setError(null);
    try {
      const next = await pickAudioFile();
      if (next) {
        setPicked(next);
        setMediaUrl('');
        if (!title.trim()) {
          const suggested = titleFromMediaName(next.name);
          if (suggested) setTitle(suggested);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file picker.');
    }
  }

  async function onTranscribeImport() {
    const trimmed = resolveTitle();
    if (!trimmed) return;
    const url = mediaUrl.trim();
    if (!picked && !url) {
      setError('Choose a file or paste a media URL first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await createDraft(trimmed);
      if (picked) {
        await saveLocalAudioUri(session.id, picked.uri);
        router.replace(`/session/${session.id}`);
        return;
      }

      await importSessionMediaFromUrl(session.id, url);
      router.replace(`/session/${session.id}/processing`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not import media. Try another file, a direct file URL, or record instead.',
      );
    } finally {
      setLoading(false);
    }
  }

  function onCancel() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  function switchMode() {
    if (preferImport) {
      router.replace(
        folderId ? `/new-session?folderId=${folderId}` : '/new-session',
      );
      return;
    }
    router.replace(
      folderId
        ? `/new-session?mode=import&folderId=${folderId}`
        : '/new-session?mode=import',
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View
              style={[
                styles.heroMark,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                shadows.soft,
              ]}
            >
              <Icon
                name={preferImport ? 'download-outline' : 'microphone'}
                size={36}
              />
            </View>
            <Text style={[styles.title, { color: colors.ink }]}>
              {preferImport ? 'Import to transcribe' : 'New recording'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
              {preferImport
                ? 'Upload audio or video, or paste a direct file link. YouTube pages aren’t supported — download those first.'
                : 'Name the session, pick a type and folder, then start recording.'}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              shadows.soft,
            ]}
          >
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.inkMuted }]}>Title</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.ink,
                  },
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="Weekly seminar"
                placeholderTextColor={colors.tertiary}
                editable={!loading}
                accessibilityLabel="Title"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.inkMuted }]}>Session type</Text>
              <SessionTypePicker
                value={sessionType}
                onChange={setSessionType}
                customLabel={customTypeLabel}
                onCustomLabelChange={setCustomTypeLabel}
                customTypes={customTypes}
                disabled={loading}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.inkMuted }]}>
                Description (optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.ink,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="What is this about?"
                placeholderTextColor={colors.tertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
                accessibilityLabel="Description"
              />
            </View>

            {folders.length > 0 ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.inkMuted }]}>Folder</Text>
                <View style={styles.folderChips}>
                  {folders.map((folder) => {
                    const selected = folderId === folder.id;
                    const label = isDefaultFolder(folder)
                      ? DEFAULT_FOLDER_NAME
                      : folder.name;
                    return (
                      <Pressable
                        key={folder.id}
                        onPress={() => setFolderId(folder.id)}
                        disabled={loading}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={label}
                        style={({ pressed }) => [
                          styles.folderChip,
                          {
                            backgroundColor: selected ? colors.accent : colors.background,
                            borderColor: selected ? colors.accent : colors.border,
                            opacity: pressed && !selected ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.folderChipText,
                            { color: selected ? colors.onBrand : colors.ink },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>

          {preferImport ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                shadows.soft,
              ]}
            >
              <Pressable
                onPress={() => void onChooseFile()}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Choose an audio or video file"
                style={[
                  styles.drop,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
              >
                <Icon name="file-music-outline" size={48} color={colors.accent} />
                <Text style={[styles.dropTitle, { color: colors.ink }]}>
                  {picked ? picked.name : 'Choose audio or video'}
                </Text>
                <Text style={[styles.dropHint, { color: colors.inkMuted }]}>
                  {picked ? picked.mimeType : 'MP3, M4A, WAV, MP4, MOV, WebM'}
                </Text>
              </Pressable>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.inkMuted }]}>
                  Or paste a file URL
                </Text>
                <View
                  style={[
                    styles.urlRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Icon name="share-variant-outline" size={22} />
                  <TextInput
                    style={[styles.urlInput, { color: colors.ink }]}
                    value={mediaUrl}
                    onChangeText={(value) => {
                      setMediaUrl(value);
                      if (value.trim()) setPicked(null);
                    }}
                    placeholder="https://…/lecture.mp4"
                    placeholderTextColor={colors.tertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    editable={!loading}
                    accessibilityLabel="Media URL"
                  />
                </View>
                <Text style={[styles.dropHint, { color: colors.tertiary, textAlign: 'left' }]}>
                  Direct links to mp4, webm, or mp3 files. Not YouTube or Vimeo pages.
                </Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {preferImport ? (
              <Button
                label={loading ? 'Working…' : 'Transcribe'}
                onPress={() => void onTranscribeImport()}
                loading={loading}
                disabled={loading}
              />
            ) : (
              <Button
                label={loading ? 'Working…' : 'Start recording'}
                onPress={() => void onStartRecording()}
                loading={loading}
                disabled={loading}
              />
            )}
            <Button
              label={
                preferImport
                  ? 'Start recording instead'
                  : 'Import a file or link instead'
              }
              onPress={switchMode}
              variant="secondary"
              disabled={loading}
            />
            <Button
              label="Cancel"
              onPress={onCancel}
              variant="ghost"
              disabled={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroMark: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.pageTitle,
  },
  subtitle: {
    ...typography.body,
    maxWidth: 420,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
  },
  textarea: {
    minHeight: 96,
  },
  folderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  folderChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  folderChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  drop: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dropTitle: {
    ...typography.section,
    textAlign: 'center',
  },
  dropHint: {
    ...typography.meta,
    textAlign: 'center',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  urlInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  error: {
    ...typography.body,
    fontSize: 14,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
