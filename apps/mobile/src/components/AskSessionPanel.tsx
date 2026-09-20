import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiClientError } from '@/src/services/api';
import { askSessionQuestion } from '@/src/services/ask';
import { colors, radii, spacing, typography } from '@/src/theme';

const DEFAULT_PROMPTS = [
  'What were the key points?',
  'List the action items.',
  'What questions were discussed?',
];

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface AskSessionPanelProps {
  sessionId: string;
  sessionTitle: string;
}

export function AskSessionPanel({ sessionId, sessionTitle }: AskSessionPanelProps) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      text: `Ask anything about “${sessionTitle}”. Answers use this session’s transcript and summary.`,
    },
  ]);
  const [followUps, setFollowUps] = useState<string[]>(DEFAULT_PROMPTS);

  async function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setInput('');
    setTurns((prev) => [...prev, { role: 'user', text: trimmed }]);

    try {
      const result = await askSessionQuestion(sessionId, trimmed);
      setTurns((prev) => [...prev, { role: 'assistant', text: result.answer }]);
      if (result.suggestedFollowUps.length > 0) {
        setFollowUps(result.suggestedFollowUps);
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Could not get an answer. Try again.';
      setError(message);
      setTurns((prev) => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        accessibilityLabel="Ask conversation"
      >
        {turns.map((turn, index) => (
          <View
            key={`${turn.role}-${index}`}
            style={[styles.bubble, turn.role === 'user' ? styles.userBubble : styles.botBubble]}
          >
            <Text style={turn.role === 'user' ? styles.userText : styles.botText}>{turn.text}</Text>
          </View>
        ))}
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.busyText}>Thinking…</Text>
          </View>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.prompts}>
        <Text style={styles.promptsLabel}>Keep asking</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptRow}>
          {followUps.map((prompt) => (
            <Pressable
              key={prompt}
              style={styles.promptChip}
              onPress={() => void submit(prompt)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={prompt}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about this session"
          placeholderTextColor={colors.inkMuted}
          editable={!busy}
          onSubmitEditing={() => void submit(input)}
          returnKeyType="send"
          accessibilityLabel="Ask question"
        />
        <Pressable
          style={[styles.send, (!input.trim() || busy) && styles.sendDisabled]}
          onPress={() => void submit(input)}
          disabled={!input.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Send question"
        >
          <Text style={styles.sendText}>Ask</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 360,
    gap: spacing.sm,
  },
  thread: {
    flexGrow: 1,
    maxHeight: 320,
  },
  threadContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bubble: {
    borderRadius: radii.md,
    padding: spacing.md,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: {
    ...typography.body,
    color: colors.onBrand,
    fontSize: 15,
  },
  botText: {
    ...typography.body,
    color: colors.ink,
    fontSize: 15,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  busyText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  prompts: {
    gap: spacing.xs,
  },
  promptsLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  promptText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.ink,
    fontSize: 15,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 15,
  },
});
