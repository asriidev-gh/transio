import { useCallback, useEffect, useState } from 'react';
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
import type { SessionType } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionTypePicker } from '@/src/components/SessionTypePicker';
import { ApiClientError } from '@/src/services/api';
import {
  listCustomSessionTypes,
  rememberCustomSessionType,
} from '@/src/services/custom-session-types';
import { getSession, updateSession } from '@/src/services/sessions';
import { colors, spacing, typography } from '@/src/theme';

export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('group_discussion');
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setLoadError('Invalid session id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [session, customs] = await Promise.all([getSession(id), listCustomSessionTypes()]);
      setTitle(session.title);
      setSessionType(session.sessionType);
      setCustomTypes(customs);
      setDescription(session.description ?? '');
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
      <View style={styles.centered}>
        <LoadingState message="Loading session…" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <ErrorState title="Could not edit session" description={loadError} onRetry={() => void load()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Update the session title, type, or description.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Session title"
            placeholderTextColor={colors.inkMuted}
            editable={!saving}
            accessibilityLabel="Title"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Session Type</Text>
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
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
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
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            saving && styles.buttonDisabled,
            pressed && !saving && styles.buttonPressed,
          ]}
          onPress={() => void onSave()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
        >
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMuted,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: colors.ink,
  },
  textarea: {
    minHeight: 100,
  },
  error: {
    color: colors.danger,
    ...typography.body,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
