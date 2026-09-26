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
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { useRevealFocusedField } from '@/src/components/KeyboardSafeScrollView';
import { Icon } from '@/src/components/ui/Icon';

const DEFAULT_PROMPTS = [
  'What were the key points?',
  'List the action items.',
  'What was decided?',
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
  const { colors } = useTheme();
  const revealFocusedField = useRevealFocusedField();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [followUps, setFollowUps] = useState<string[]>(DEFAULT_PROMPTS);
  const hasConversation = turns.some((turn) => turn.role === 'user');
  const canSend = Boolean(input.trim()) && !busy;

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
        keyboardShouldPersistTaps="handled"
      >
        {!hasConversation ? (
          <View style={styles.greeting}>
            <Icon name="chat" size={40} />
            <Text style={[styles.greetingEyebrow, { color: colors.success }]}>
              Ask this session
            </Text>
            <Text style={[styles.greetingTitle, { color: colors.ink }]}>
              What do you want to know about “{sessionTitle}”?
            </Text>
            <Text style={[styles.greetingBody, { color: colors.inkMuted }]}>
              Answers use this session’s transcript and summary.
            </Text>
          </View>
        ) : null}

        {turns.map((turn, index) => (
          <View
            key={`${turn.role}-${index}`}
            style={[
              styles.bubble,
              turn.role === 'user'
                ? { backgroundColor: colors.brand, alignSelf: 'flex-end' }
                : {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    alignSelf: 'flex-start',
                  },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                { color: turn.role === 'user' ? colors.onBrand : colors.ink },
              ]}
            >
              {turn.text}
            </Text>
          </View>
        ))}
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.busyText, { color: colors.inkMuted }]}>Thinking…</Text>
          </View>
        ) : null}
        {error ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.prompts}>
        <Text style={[styles.promptsLabel, { color: colors.inkMuted }]}>
          {hasConversation ? 'Keep asking' : 'Suggested'}
        </Text>
        <View style={styles.promptStack}>
          {followUps.map((prompt) => (
            <Pressable
              key={prompt}
              style={[
                styles.promptRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                busy && styles.promptDisabled,
              ]}
              onPress={() => void submit(prompt)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={prompt}
            >
              <Text style={[styles.promptText, { color: colors.ink }]}>{prompt}</Text>
              <Text style={[styles.promptChevron, { color: colors.success }]}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.composer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.ink,
            },
          ]}
          value={input}
          onChangeText={setInput}
          onFocus={revealFocusedField}
          placeholder="Ask anything about this session"
          placeholderTextColor={colors.inkMuted}
          editable={!busy}
          onSubmitEditing={() => void submit(input)}
          returnKeyType="send"
          accessibilityLabel="Ask question"
        />
        <Pressable
          style={[
            styles.send,
            { backgroundColor: colors.brand },
            !canSend && styles.sendDisabled,
          ]}
          onPress={() => void submit(input)}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send question"
        >
          <Text style={[styles.sendText, { color: colors.onBrand }]}>Ask</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 360,
    gap: spacing.md,
  },
  thread: {
    flexGrow: 1,
    maxHeight: 280,
  },
  threadContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  greeting: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  greetingEyebrow: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  greetingTitle: {
    ...typography.title,
    fontSize: 22,
    lineHeight: 28,
  },
  greetingBody: {
    ...typography.body,
    fontSize: 15,
  },
  bubble: {
    borderRadius: radii.md,
    padding: spacing.md,
    maxWidth: '92%',
  },
  bubbleText: {
    ...typography.body,
    fontSize: 15,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  busyText: {
    ...typography.caption,
  },
  error: {
    ...typography.caption,
    fontWeight: '600',
  },
  prompts: {
    gap: spacing.sm,
  },
  promptsLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptStack: {
    gap: spacing.sm,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  promptDisabled: {
    opacity: 0.55,
  },
  promptText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  promptChevron: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    minHeight: 48,
  },
  send: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
