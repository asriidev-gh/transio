import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/src/theme';

const BAR_COUNT = 28;
const MAX_HEIGHT = 64;

interface WaveformVisualizerProps {
  /** When true, bars animate; when false, they settle low. */
  active: boolean;
  accessibilityLabel?: string;
}

/**
 * Decorative live waveform for the recording screen.
 * Uses a seeded pseudo-random pattern (no metering API required).
 */
export function WaveformVisualizer({
  active,
  accessibilityLabel = 'Audio waveform',
}: WaveformVisualizerProps) {
  const [heights, setHeights] = useState(() => Array.from({ length: BAR_COUNT }, () => 10));

  useEffect(() => {
    if (!active) {
      setHeights(Array.from({ length: BAR_COUNT }, () => 10));
      return;
    }

    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setHeights(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          const wave = Math.sin((frame + i * 1.7) / 4.2) * 0.5 + 0.5;
          const jitter = ((Math.sin(frame * 0.37 + i * 2.1) + 1) / 2) * 0.35;
          const ratio = Math.min(1, 0.22 + wave * 0.55 + jitter * 0.25);
          return Math.max(8, Math.round(ratio * MAX_HEIGHT));
        }),
      );
    }, 90);

    return () => clearInterval(id);
  }, [active]);

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      {heights.map((h, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: h,
              backgroundColor: active ? colors.accent : colors.border,
              opacity: active ? 0.85 + (i % 3) * 0.05 : 0.55,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: MAX_HEIGHT,
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 6,
    alignSelf: 'center',
  },
});
