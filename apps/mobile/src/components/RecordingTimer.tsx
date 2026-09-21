import { StyleSheet, Text, View } from 'react-native';
import { fonts, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDuration } from '@/src/utils/format';

interface RecordingTimerProps {
  seconds: number;
}

export function RecordingTimer({ seconds }: RecordingTimerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityLabel={`Recording time ${formatDuration(seconds)}`}>
      <Text style={[styles.time, { color: colors.ink }]}>{formatDuration(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 44,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
});
