import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Icon } from '@/src/components/ui/Icon';

interface RecordingButtonProps {
  recording: boolean;
  paused: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function RecordingButton({ recording, paused, disabled, onPress }: RecordingButtonProps) {
  const { colors, reduceMotion } = useTheme();
  const live = recording && !paused;
  const pulse = useSharedValue(1);
  const label = !recording ? 'Start recording' : paused ? 'Resume recording' : 'Stop recording';

  useEffect(() => {
    if (live && !reduceMotion) {
      pulse.value = withRepeat(withTiming(1.12, { duration: 900 }), -1, true);
      return;
    }
    cancelAnimation(pulse);
    pulse.value = withTiming(1, { duration: 180 });
  }, [live, pulse, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.outer, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.stack}>
        {live ? (
          <Animated.View
            style={[styles.ring, { borderColor: colors.recording }, ringStyle]}
            pointerEvents="none"
          />
        ) : null}
        <View
          style={[
            styles.inner,
            {
              backgroundColor: live ? colors.recording : colors.surface,
              borderColor: colors.recording,
            },
          ]}
        >
          {recording && !paused ? (
            <View style={[styles.stopSquare, { backgroundColor: colors.onBrand }]} />
          ) : paused ? (
            <Icon name="play" size={40} />
          ) : (
            <Icon name="microphone" size={44} />
          )}
        </View>
      </View>
      <Text style={[styles.caption, { color: colors.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.45 },
  stack: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
  },
  inner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    overflow: 'visible',
  },
  stopSquare: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
  },
});
