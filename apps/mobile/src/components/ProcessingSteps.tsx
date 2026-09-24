import { StyleSheet, Text, View } from 'react-native';
import type { SessionStatus } from '@sessionai/shared';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface Flags {
  hasAudio: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  hasNotes: boolean;
}

const STEPS: Array<{
  key: string;
  label: string;
  notesLabel?: string;
  hint: string;
  notesHint?: string;
  /** Hide on non-notes pipeline (summary is opt-in elsewhere). */
  notesOnly?: boolean;
  matches: (status: SessionStatus, flags: Flags) => 'done' | 'active' | 'pending' | 'failed';
}> = [
  {
    key: 'uploaded',
    label: 'Audio ready',
    hint: 'File is on the server',
    matches: (_status, flags) => (flags.hasAudio ? 'done' : 'pending'),
  },
  {
    key: 'transcribing',
    label: 'Detecting speech',
    notesLabel: 'Understanding audio',
    hint: 'Listening for words and speakers',
    notesHint: 'Listening to write notes',
    matches: (status, flags) => {
      if (
        flags.hasTranscript ||
        flags.hasNotes ||
        status === 'transcribed' ||
        status === 'summarizing' ||
        status === 'completed'
      ) {
        return 'done';
      }
      if (status === 'transcribing') return 'active';
      if (status === 'failed' && flags.hasAudio && !flags.hasTranscript && !flags.hasNotes) {
        return 'failed';
      }
      return 'pending';
    },
  },
  {
    key: 'transcript',
    label: 'Converting audio to text',
    notesLabel: 'Preparing notes',
    hint: 'Building a readable transcript',
    notesHint: 'Speech is processed privately — not saved as a transcript',
    matches: (status, flags) => {
      if (
        flags.hasTranscript ||
        flags.hasNotes ||
        status === 'transcribed' ||
        status === 'summarizing' ||
        status === 'completed'
      ) {
        return 'done';
      }
      return 'pending';
    },
  },
  {
    key: 'summarizing',
    label: 'Formatting insights',
    notesLabel: 'Writing notes',
    hint: 'Summary and action items',
    notesHint: 'Structured notes and action items',
    notesOnly: true,
    matches: (status, flags) => {
      if (flags.hasNotes || flags.hasSummary || status === 'completed') return 'done';
      if (status === 'summarizing') return 'active';
      if (status === 'failed' && !flags.hasNotes && !flags.hasSummary) return 'failed';
      return 'pending';
    },
  },
  {
    key: 'completed',
    label: 'Ready to review',
    notesLabel: 'Finishing up',
    hint: 'Transcript is ready — generate a summary anytime from Notes',
    notesHint: 'Almost ready to review',
    matches: (status, flags) => {
      if (
        status === 'completed' ||
        status === 'transcribed' ||
        flags.hasTranscript ||
        flags.hasNotes ||
        flags.hasSummary
      ) {
        return 'done';
      }
      return 'pending';
    },
  },
];

interface ProcessingStepsProps {
  status: SessionStatus;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  hasNotes?: boolean;
  notesOnly?: boolean;
}

export function ProcessingSteps({
  status,
  hasAudio,
  hasTranscript,
  hasSummary,
  hasNotes = false,
  notesOnly = false,
}: ProcessingStepsProps) {
  const { colors } = useTheme();
  const flags = { hasAudio, hasTranscript, hasSummary, hasNotes };
  const steps = STEPS.filter((step) => (step.notesOnly ? notesOnly : true));

  return (
    <View style={styles.wrap} accessibilityLabel="Processing pipeline stages">
      {steps.map((step, index) => {
        const state = step.matches(status, flags);
        const label = notesOnly && step.notesLabel ? step.notesLabel : step.label;
        const hint = notesOnly && step.notesHint ? step.notesHint : step.hint;
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  state === 'done' && { borderColor: colors.success, backgroundColor: colors.success },
                  state === 'active' && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                  state === 'failed' && { borderColor: colors.danger, backgroundColor: colors.danger },
                ]}
              />
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: colors.border },
                    (state === 'done' || state === 'active') && { backgroundColor: colors.accent },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.labelWrap}>
              <Text
                style={[
                  styles.label,
                  { color: colors.ink },
                  state === 'active' && { color: colors.accent },
                  state === 'failed' && { color: colors.danger },
                  state === 'pending' && { color: colors.inkMuted, fontWeight: '500' },
                ]}
              >
                {label}
              </Text>
              {state === 'active' ? (
                <Text style={[styles.hint, { color: colors.inkMuted }]}>{hint}</Text>
              ) : null}
              {state === 'failed' ? (
                <Text style={[styles.hint, { color: colors.danger }]}>Failed — you can retry</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
  },
  rail: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 1.5,
    marginVertical: 4,
  },
  labelWrap: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    marginTop: 2,
  },
});
