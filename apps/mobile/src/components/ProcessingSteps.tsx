import { StyleSheet, Text, View } from 'react-native';
import type { SessionStatus } from '@sessionai/shared';
import { colors, spacing, typography } from '@/src/theme';

const STEPS: Array<{
  key: string;
  label: string;
  matches: (status: SessionStatus, flags: Flags) => 'done' | 'active' | 'pending' | 'failed';
}> = [
  {
    key: 'uploaded',
    label: 'Uploaded',
    matches: (_status, flags) => (flags.hasAudio ? 'done' : 'pending'),
  },
  {
    key: 'transcribing',
    label: 'Transcribing',
    matches: (status, flags) => {
      if (flags.hasTranscript || status === 'transcribed' || status === 'summarizing' || status === 'completed') {
        return 'done';
      }
      if (status === 'transcribing') return 'active';
      if (status === 'failed' && flags.hasAudio && !flags.hasTranscript) return 'failed';
      return 'pending';
    },
  },
  {
    key: 'transcript',
    label: 'Transcript saved',
    matches: (status, flags) => {
      if (flags.hasTranscript || status === 'transcribed' || status === 'summarizing' || status === 'completed') {
        return 'done';
      }
      return 'pending';
    },
  },
  {
    key: 'summarizing',
    label: 'Generating summary',
    matches: (status, flags) => {
      if (flags.hasSummary || status === 'completed') return 'done';
      if (status === 'summarizing') return 'active';
      if (status === 'failed' && flags.hasTranscript && !flags.hasSummary) return 'failed';
      return 'pending';
    },
  },
  {
    key: 'completed',
    label: 'Completed',
    matches: (status, flags) => {
      if (status === 'completed' || flags.hasSummary) return 'done';
      return 'pending';
    },
  },
];

interface Flags {
  hasAudio: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
}

interface ProcessingStepsProps {
  status: SessionStatus;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
}

export function ProcessingSteps({
  status,
  hasAudio,
  hasTranscript,
  hasSummary,
}: ProcessingStepsProps) {
  const flags = { hasAudio, hasTranscript, hasSummary };

  return (
    <View style={styles.wrap} accessibilityLabel="Processing pipeline stages">
      {STEPS.map((step, index) => {
        const state = step.matches(status, flags);
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  state === 'done' && styles.dotDone,
                  state === 'active' && styles.dotActive,
                  state === 'failed' && styles.dotFailed,
                ]}
              />
              {index < STEPS.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    (state === 'done' || state === 'active') && styles.lineActive,
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.labelWrap}>
              <Text
                style={[
                  styles.label,
                  state === 'active' && styles.labelActive,
                  state === 'failed' && styles.labelFailed,
                  state === 'pending' && styles.labelPending,
                ]}
              >
                {step.label}
              </Text>
              {state === 'active' ? <Text style={styles.hint}>In progress…</Text> : null}
              {state === 'failed' ? <Text style={styles.hintFailed}>Failed</Text> : null}
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
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 4,
  },
  dotDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  dotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dotFailed: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  lineActive: {
    backgroundColor: colors.brandSoft,
  },
  labelWrap: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  labelActive: {
    color: colors.accent,
  },
  labelFailed: {
    color: colors.danger,
  },
  labelPending: {
    color: colors.inkMuted,
    fontWeight: '500',
  },
  hint: {
    ...typography.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  hintFailed: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 2,
  },
});
