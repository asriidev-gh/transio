import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/src/theme';
import { formatDuration } from '@/src/utils/format';

interface RecordingTimerProps {
  /** Elapsed recording time in seconds. */
  seconds: number;
}

export function RecordingTimer({ seconds }: RecordingTimerProps) {
  return (
    <View style={styles.wrap} accessibilityLabel={`Recording time ${formatDuration(seconds)}`}>
      <Text style={styles.time}>{formatDuration(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  time: {
    fontSize: 48,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.ink,
    letterSpacing: 1,
  },
});
