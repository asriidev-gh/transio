import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import type { SessionType } from '@sessionai/shared';
import { SessionTypePicker } from '@/src/components/SessionTypePicker';
import { ApiClientError } from '@/src/services/api';
import { createSession } from '@/src/services/sessions';
import { colors, spacing, typography } from '@/src/theme';

export default function NewSessionScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('group_discussion');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await createSession({
        title: trimmed,
        sessionType,
        description: description.trim() ? description.trim() : null,
      });
      router.replace(`/recording?id=${session.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not create session. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Add session details, then start recording. Audio is saved on this device first.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="GLC Session 3"
            placeholderTextColor={colors.inkMuted}
            editable={!loading}
            accessibilityLabel="Title"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Session Type</Text>
          <SessionTypePicker value={sessionType} onChange={setSessionType} disabled={loading} />
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
            editable={!loading}
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
            loading && styles.buttonDisabled,
            pressed && !loading && styles.buttonPressed,
          ]}
          onPress={() => void onSubmit()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Start Recording"
        >
          <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Start Recording'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
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
