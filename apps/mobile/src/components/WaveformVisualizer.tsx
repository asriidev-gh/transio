import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const BAR_COUNT = 32;
const MAX_HEIGHT = 56;

interface WaveformVisualizerProps {
  active: boolean;
  accessibilityLabel?: string;
}

export function WaveformVisualizer({
  active,
  accessibilityLabel = 'Audio waveform',
}: WaveformVisualizerProps) {
  const { colors, reduceMotion } = useTheme();
  const [heights, setHeights] = useState(() => Array.from({ length: BAR_COUNT }, () => 8));

  useEffect(() => {
    if (!active || reduceMotion) {
      setHeights(Array.from({ length: BAR_COUNT }, () => (active ? 22 : 8)));
      return;
    }

    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setHeights(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          const wave = Math.sin((frame + i * 1.7) / 4.2) * 0.5 + 0.5;
          const jitter = ((Math.sin(frame * 0.37 + i * 2.1) + 1) / 2) * 0.28;
          const ratio = Math.min(1, 0.18 + wave * 0.58 + jitter * 0.22);
          return Math.max(6, Math.round(ratio * MAX_HEIGHT));
        }),
      );
    }, 80);

    return () => clearInterval(id);
  }, [active, reduceMotion]);

  return (
    <View style={styles.wrap} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      {heights.map((h, i) => {
        const color = active
          ? i % 3 === 0
            ? colors.cyan
            : colors.accent
          : colors.border;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: h,
                backgroundColor: color,
                opacity: active ? 0.55 + (i % 4) * 0.1 : 0.7,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: MAX_HEIGHT,
    width: '100%',
    maxWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 6,
  },
});
