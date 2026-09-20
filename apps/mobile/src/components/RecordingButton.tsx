import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/src/theme';

interface RecordingButtonProps {
  recording: boolean;
  paused: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * Large primary control for stop (while recording) or start (idle).
 * Pause/resume are separate secondary controls on the recording screen.
 */
export function RecordingButton({ recording, paused, disabled, onPress }: RecordingButtonProps) {
  const label = !recording ? 'Start recording' : paused ? 'Resume recording' : 'Stop recording';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.outer,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.inner, recording && !paused ? styles.innerStop : styles.innerRecord]}>
        {recording && !paused ? <View style={styles.stopSquare} /> : <View style={styles.recordDot} />}
      </View>
      <Text style={styles.caption}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  innerRecord: {
    borderColor: colors.recording,
  },
  innerStop: {
    borderColor: colors.recording,
    backgroundColor: '#F8E8E6',
  },
  recordDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.recording,
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.recording,
  },
  caption: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});
