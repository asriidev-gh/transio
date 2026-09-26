import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SessionFolder, SessionType } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { KeyboardSafeScrollView } from '@/src/components/KeyboardSafeScrollView';
import { FolderPicker } from '@/src/components/FolderPicker';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionTypePicker } from '@/src/components/SessionTypePicker';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { ApiClientError } from '@/src/services/api';
import {
  listCustomSessionTypes,
  rememberCustomSessionType,
} from '@/src/services/custom-session-types';
import { isDefaultFolder } from '@/src/services/default-folder';
import { listFolders } from '@/src/services/folders';
import { getSession, updateSession } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('group_discussion');
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentFolder = folders.find((folder) => folder.id === folderId) ?? null;
  const folderLabel = currentFolder
    ? isDefaultFolder(currentFolder)
      ? 'Default'
      : currentFolder.name
    : 'Default';

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setLoadError('Invalid session id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [session, customs, folderRows] = await Promise.all([
        getSession(id),
        listCustomSessionTypes(),
        listFolders().catch(() => [] as SessionFolder[]),
      ]);
      setTitle(session.title);
      setSessionType(session.sessionType);
      setCustomTypes(customs);
      setDescription(session.description ?? '');
      setFolders(folderRows);
      setFolderId(session.folderId);
      if (session.sessionType === 'other') {
        setCustomTypeLabel(customs[0] ?? '');
      }
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Could not load session.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!id || typeof id !== 'string') return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }
    if (sessionType === 'other' && !customTypeLabel.trim()) {
      setError('Enter a name for this session type, or pick another type.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (sessionType === 'other') {
        const next = await rememberCustomSessionType(customTypeLabel);
        setCustomTypes(next);
      }
      await updateSession(id, {
        title: trimmed,
        sessionType,
        description: description.trim() ? description.trim() : null,
        folderId,
      });
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not save changes. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState message="Loading session…" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not edit session" description={loadError} onRetry={() => void load()} />
      </View>
    );
  }

  return (
    <>
    <KeyboardSafeScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
        <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
          Update the session title, type, folder, or description.
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkMuted }]}>Title</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.ink,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Session title"
            placeholderTextColor={colors.inkMuted}
            editable={!saving}
            accessibilityLabel="Title"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkMuted }]}>Session Type</Text>
          <SessionTypePicker
            value={sessionType}
            onChange={setSessionType}
            customLabel={customTypeLabel}
            onCustomLabelChange={setCustomTypeLabel}
            customTypes={customTypes}
            disabled={saving}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkMuted }]}>Folder</Text>
          <Pressable
            style={({ pressed }) => [
              styles.folderChip,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.92 : 1,
              },
              shadows.soft,
            ]}
            onPress={() => setFolderPickerOpen(true)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={`Folder: ${folderLabel}`}
          >
            <Icon name="folder" size={20} color={colors.accent} />
            <Text style={[styles.folderChipText, { color: colors.ink }]} numberOfLines={1}>
              {folderLabel}
            </Text>
            <Icon name="chevron-right" size={16} color={colors.inkMuted} />
          </Pressable>
          <Text style={[styles.folderHint, { color: colors.inkMuted }]}>
            Choose where this session is stored.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkMuted }]}>Description (optional)</Text>
          <TextInput
            style={[
              styles.input,
              styles.textarea,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.ink,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this session about?"
            placeholderTextColor={colors.inkMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!saving}
            accessibilityLabel="Description"
          />
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button
          label={saving ? 'Saving…' : 'Save Changes'}
          onPress={() => void onSave()}
          loading={saving}
          disabled={saving}
        />
    </KeyboardSafeScrollView>

      <FolderPicker
        visible={folderPickerOpen}
        folders={folders}
        selectedId={folderId}
        onSelect={(nextId) => {
          setFolderId(nextId);
          setFolderPickerOpen(false);
        }}
        onClose={() => setFolderPickerOpen(false)}
        title="Store in folder"
        allowCreate
        onFoldersChange={setFolders}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    ...typography.body,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
  },
  textarea: {
    minHeight: 100,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48,
  },
  folderChipText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  folderHint: {
    ...typography.caption,
  },
  error: {
    ...typography.body,
    fontSize: 14,
  },
});
