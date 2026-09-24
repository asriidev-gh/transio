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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SessionFolder, SessionType } from '@sessionai/shared';
import { CAPTURE_MODE_LABELS } from '@sessionai/shared';
import { SessionTypePicker } from '@/src/components/SessionTypePicker';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';
import { Button } from '@/src/components/ui/Button';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { IconWell } from '@/src/components/ui/IconWell';
import { ApiClientError } from '@/src/services/api';
import { saveLocalAudioUri } from '@/src/services/local-audio';
import {
  mimeTypeFromFileName,
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
import { listFolders, createFolder } from '@/src/services/folders';
import {
  getRecordCaptionsModePref,
  isLiveCaptionsModeAvailable,
  modeNeedsLiveStt,
  setRecordCaptionsModePref,
  type RecordCaptionsMode,
} from '@/src/services/record-mode';
import { createSession } from '@/src/services/sessions';
import { consumeFeature } from '@/src/services/entitlements';
import { ensureFeatureAccess } from '@/src/utils/feature-gate';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const MODE_ICONS: Record<RecordCaptionsMode, AppIconName> = {
  live: 'sine-wave',
  batch: 'microphone',
  notes: 'download-outline',
  live_notes: 'sticky-note',
};

export default function NewSessionScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const tabBarInset = useFloatingTabBarContentInset();
  const {
    mode,
    folderId: folderIdParam,
    captions: captionsParam,
    sharedUri,
    sharedName,
    sharedMime,
    sharedUrl,
  } = useLocalSearchParams<{
    mode?: string;
    folderId?: string;
    captions?: string;
    sharedUri?: string;
    sharedName?: string;
    sharedMime?: string;
    sharedUrl?: string;
  }>();
  const preferImport = mode === 'import';
  const [step, setStep] = useState<'mode' | 'details'>(preferImport ? 'details' : 'mode');
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('group_discussion');
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<PickedAudio | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [captionsMode, setCaptionsMode] = useState<RecordCaptionsMode>(() => {
    if (
      captionsParam === 'live' ||
      captionsParam === 'batch' ||
      captionsParam === 'notes' ||
      captionsParam === 'live_notes'
    ) {
      if (captionsParam === 'live' || captionsParam === 'live_notes') {
        return isLiveCaptionsModeAvailable() ? captionsParam : 'batch';
      }
      // Legacy `notes` deep-link → same screen as home Upload.
      if (captionsParam === 'notes') return 'batch';
      return captionsParam;
    }
    return isLiveCaptionsModeAvailable() ? 'live' : 'batch';
  });
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(
    typeof folderIdParam === 'string' && folderIdParam ? folderIdParam : null,
  );
  const [composingFolder, setComposingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Recording shared in from Zoom / Meet / Drive via the Android share sheet.
  useEffect(() => {
    if (sharedUri) {
      const name = sharedName || 'Shared recording';
      setPicked({
        uri: sharedUri,
        name,
        mimeType: sharedMime || mimeTypeFromFileName(name),
      });
      setMediaUrl('');
      const suggested = titleFromMediaName(name);
      if (suggested) setTitle((current) => current || suggested);
    } else if (sharedUrl) {
      setPicked(null);
      setMediaUrl(sharedUrl);
    }
  }, [sharedUri, sharedName, sharedMime, sharedUrl]);

  useEffect(() => {
    void (async () => {
      try {
        const [rows, customs, pref] = await Promise.all([
          listFolders(),
          listCustomSessionTypes(),
          getRecordCaptionsModePref(),
        ]);
        setCustomTypes(customs);
        if (
          captionsParam !== 'live' &&
          captionsParam !== 'batch' &&
          captionsParam !== 'notes' &&
          captionsParam !== 'live_notes'
        ) {
          setCaptionsMode(pref === 'notes' ? 'batch' : pref);
        }
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
  }, [captionsParam]);

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

  async function createDraft(trimmedTitle: string, captureMode: RecordCaptionsMode = 'batch') {
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
      captureMode,
    });
  }

  async function ensureSessionQuota(): Promise<boolean> {
    return ensureFeatureAccess('session', router);
  }

  async function onStartRecording() {
    const trimmed = resolveTitle();
    if (!trimmed) return;
    if (!(await ensureSessionQuota())) return;

    let modeToUse = captionsMode;
    if (modeNeedsLiveStt(modeToUse) && !isLiveCaptionsModeAvailable()) {
      modeToUse = 'batch';
    }

    setLoading(true);
    setError(null);
    try {
      await setRecordCaptionsModePref(modeToUse);
      const session = await createDraft(trimmed, modeToUse);
      await consumeFeature('session');
      router.replace(`/recording?id=${session.id}&captions=${modeToUse}`);
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
    if (!(await ensureSessionQuota())) return;

    setLoading(true);
    setError(null);
    try {
      const session = await createDraft(trimmed);
      await consumeFeature('session');
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

  function chooseCaptureMode(next: RecordCaptionsMode) {
    if (modeNeedsLiveStt(next) && !isLiveCaptionsModeAvailable()) return;
    setCaptionsMode(next);
    setError(null);
    setStep('details');
  }

  /** Same destination as home Upload. */
  function chooseFileTranscribe() {
    const qs = new URLSearchParams({ mode: 'import' });
    if (folderId) qs.set('folderId', folderId);
    router.replace(`/new-session?${qs.toString()}` as Href);
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

  async function onCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setCreatingFolder(true);
    setError(null);
    try {
      const created = await createFolder({ name: trimmed });
      const merged = sortFoldersWithDefaultFirst(
        dedupeFoldersByName([...folders, created]),
      );
      setFolders(merged);
      setFolderId(created.id);
      setNewFolderName('');
      setComposingFolder(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not create folder.',
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  const showModeStep = !preferImport && step === 'mode';
  const showDetailsStep = preferImport || step === 'details';

  function renderModeOption(
    optionMode: RecordCaptionsMode,
    titleText: string,
    hint: string,
    disabled: boolean,
  ) {
    const selected = captionsMode === optionMode;
    const tint =
      optionMode === 'live'
        ? colors.actionImport
        : optionMode === 'batch'
          ? colors.actionRecord
          : optionMode === 'notes'
            ? colors.actionFav
            : colors.accentSoft;
    return (
      <Pressable
        key={optionMode}
        onPress={() => chooseCaptureMode(optionMode)}
        disabled={disabled}
        style={[
          styles.modeOption,
          {
            borderColor: selected ? colors.accent : colors.border,
            backgroundColor: selected ? colors.accentSoft : colors.background,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={titleText}
      >
        <IconWell
          name={MODE_ICONS[optionMode]}
          tint={tint}
          color={selected ? colors.accent : colors.ink}
          size={20}
          wellSize={40}
        />
        <View style={styles.modeCopy}>
          <Text style={[styles.modeTitle, { color: colors.ink }]}>{titleText}</Text>
          <Text style={[styles.modeHint, { color: colors.inkMuted }]}>{hint}</Text>
        </View>
      </Pressable>
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
          contentContainerStyle={[styles.container, { paddingBottom: tabBarInset }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroTitleRow}>
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
                  size={20}
                />
              </View>
              <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
                {preferImport
                  ? 'Transcribe Audio/Video File'
                  : showModeStep
                    ? 'How to capture speech'
                    : 'New recording'}
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
              {preferImport
                ? 'Upload audio or video, or paste a direct file link. YouTube pages aren’t supported — download those first.'
                : showModeStep
                  ? 'Pick a capture mode first. You’ll name the session on the next step.'
                  : 'Name the session, then start recording.'}
            </Text>
          </View>

          {showModeStep ? (
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
              <View style={styles.modeList}>
                {renderModeOption(
                  'batch',
                  CAPTURE_MODE_LABELS.batch,
                  'Save audio only while recording. Transcribe after you upload and proceed — quieter and uses less data.',
                  false,
                )}
                <Pressable
                  onPress={chooseFileTranscribe}
                  style={[
                    styles.modeOption,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Transcribe Audio/Video File"
                >
                  <IconWell
                    name="download-outline"
                    tint={colors.actionFav}
                    color={colors.ink}
                    size={20}
                    wellSize={40}
                  />
                  <View style={styles.modeCopy}>
                    <Text style={[styles.modeTitle, { color: colors.ink }]}>
                      Transcribe Audio/Video File
                    </Text>
                    <Text style={[styles.modeHint, { color: colors.inkMuted }]}>
                      Upload an audio or video file, or paste a direct file link — same as Home →
                      Upload.
                    </Text>
                  </View>
                </Pressable>
                {isLiveCaptionsModeAvailable() ? (
                  <>
                    {renderModeOption(
                      'live_notes',
                      'Live Note Taker',
                      'Notes grow while you speak. Audio is kept; transcript is not saved.',
                      false,
                    )}
                    {renderModeOption(
                      'live',
                      'Live captions',
                      'See speech as you talk. Choose Tagalog or English on the recording screen.',
                      false,
                    )}
                  </>
                ) : (
                  <View
                    style={[
                      styles.devBuildHint,
                      {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.brand + '33',
                      },
                    ]}
                  >
                    <Icon name="bulb" size={18} color={colors.brand} variant="line" />
                    <Text style={[styles.devBuildHintText, { color: colors.ink }]}>
                      Live Note Taker and Live captions need a development or EAS build (not Expo
                      Go). Use Record Audio and Transcribe or Transcribe Audio/Video File here.
                    </Text>
                  </View>
                )}
                <Pressable
                  onPress={async () => {
                    if (!(await ensureFeatureAccess('voiceTranslate', router))) return;
                    router.push('/voice-translate' as Href);
                  }}
                  style={[
                    styles.modeOption,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Live Translator"
                >
                  <IconWell
                    name="translate"
                    tint={colors.actionImport}
                    color={colors.ink}
                    size={20}
                    wellSize={40}
                  />
                  <View style={styles.modeCopy}>
                    <Text style={[styles.modeTitle, { color: colors.ink }]}>Live Translator</Text>
                    <Text style={[styles.modeHint, { color: colors.inkMuted }]}>
                      Hold to talk — we translate and your phone speaks it back. No session file.
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : null}

          {showDetailsStep ? (
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
            {!preferImport ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.inkMuted }]}>Capture mode</Text>
                <Pressable
                  onPress={() => setStep('mode')}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Change capture mode"
                  style={[
                    styles.modeSummary,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.modeTitle, { color: colors.ink, flex: 1 }]}>
                    {CAPTURE_MODE_LABELS[captionsMode]}
                  </Text>
                  <Text style={[styles.changeLink, { color: colors.accent }]}>Change</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.inkMuted }]}>Title</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: error === 'Title is required.' ? colors.danger : colors.border,
                    backgroundColor: colors.background,
                    color: colors.ink,
                  },
                ]}
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  if (error === 'Title is required.') setError(null);
                }}
                placeholder="Weekly seminar"
                placeholderTextColor={colors.tertiary}
                editable={!loading}
                accessibilityLabel="Title"
              />
              {error === 'Title is required.' ? (
                <Text style={[styles.fieldError, { color: colors.danger }]} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
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
                      disabled={loading || creatingFolder}
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

              {composingFolder ? (
                <View style={styles.createFolderRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.createFolderInput,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        color: colors.ink,
                      },
                    ]}
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                    placeholder="Folder name"
                    placeholderTextColor={colors.tertiary}
                    editable={!creatingFolder && !loading}
                    autoFocus
                    accessibilityLabel="New folder name"
                    onSubmitEditing={() => void onCreateFolder()}
                  />
                  <Pressable
                    onPress={() => void onCreateFolder()}
                    disabled={creatingFolder || loading || !newFolderName.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Add folder"
                    style={[
                      styles.createFolderAction,
                      {
                        backgroundColor: colors.accent,
                        opacity: creatingFolder || loading || !newFolderName.trim() ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.createFolderActionText, { color: colors.onBrand }]}>
                      {creatingFolder ? '…' : 'Add'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setComposingFolder(false);
                      setNewFolderName('');
                    }}
                    disabled={creatingFolder || loading}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel create folder"
                    style={[
                      styles.createFolderCancel,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        opacity: creatingFolder || loading ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.createFolderActionText, { color: colors.ink }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setComposingFolder(true)}
                  disabled={loading || creatingFolder}
                  accessibilityRole="button"
                  accessibilityLabel="Create folder"
                  style={[
                    styles.createFolderBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Icon name="plus" size={18} color={colors.accent} />
                  <Text style={[styles.createFolderLabel, { color: colors.accent }]}>
                    Create folder
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
          ) : null}

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

          {error && error !== 'Title is required.' ? (
            <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {showModeStep ? (
              <Button
                label="Cancel"
                onPress={onCancel}
                variant="secondary"
                disabled={loading}
              />
            ) : preferImport ? (
              <>
                <Button
                  label={loading ? 'Working…' : 'Transcribe'}
                  onPress={() => void onTranscribeImport()}
                  loading={loading}
                  disabled={loading}
                />
                <Button
                  label="Start recording instead"
                  onPress={switchMode}
                  variant="secondary"
                  disabled={loading}
                />
                <Button
                  label="Cancel"
                  onPress={onCancel}
                  variant="secondary"
                  disabled={loading}
                />
              </>
            ) : (
              <>
                <Button
                  label={
                    loading
                      ? 'Working…'
                      : captionsMode === 'live'
                        ? 'Start with live captions'
                        : captionsMode === 'live_notes'
                          ? 'Start Live Note Taker'
                          : 'Start recording'
                  }
                  onPress={() => void onStartRecording()}
                  loading={loading}
                  disabled={loading}
                />
                <Button
                  label="Cancel"
                  onPress={onCancel}
                  variant="secondary"
                  disabled={loading}
                />
              </>
            )}
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
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  heroMark: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    ...typography.pageTitle,
    flexShrink: 1,
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
  createFolderBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  createFolderLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  createFolderRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: spacing.sm,
  },
  createFolderAction: {
    flexShrink: 0,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFolderCancel: {
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFolderActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  createFolderInput: {
    flex: 1,
    minWidth: 0,
  },
  modeList: {
    gap: spacing.sm,
  },
  devBuildHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  devBuildHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smd,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modeCopy: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: 2,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modeHint: {
    ...typography.meta,
    lineHeight: 18,
  },
  modeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  changeLink: {
    fontSize: 14,
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
  fieldError: {
    ...typography.caption,
    marginTop: 4,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  notesActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  notesActionHalf: {
    flex: 1,
    minWidth: 0,
  },
});
