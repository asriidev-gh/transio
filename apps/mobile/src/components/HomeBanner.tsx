import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { gradients, radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface HomeBannerProps {
  onRecord: () => void;
  onImport: () => void;
}

/** Real features only, so the banner never promises something the app cannot do. */
const FEATURES = ['Live Note Taker', 'AI Summary', 'Voice translate'];

/** Relative bar heights for the decorative waveform. */
const BARS = [0.36, 0.6, 0.88, 0.52, 1, 0.68, 0.44, 0.3];
const BAR_MAX_HEIGHT = 132;

const BRAND = gradients.primary[0];

/**
 * Home hero. Recording and importing are the two ways to start, so both live here.
 * Translate and the library are already in the bottom bar.
 */
export function HomeBanner({ onRecord, onImport }: HomeBannerProps) {
  const { shadows } = useTheme();

  return (
    <View style={[styles.wrap, shadows.emboss]}>
      <LinearGradient
        colors={[...gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View
          style={styles.bars}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {BARS.map((ratio, index) => (
            <View key={index} style={[styles.bar, { height: Math.round(BAR_MAX_HEIGHT * ratio) }]} />
          ))}
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.eyebrow}>READY WHEN YOU ARE</Text>
          <Text style={styles.title} accessibilityRole="header">
            Capture your next conversation
          </Text>
          <View style={styles.chips}>
            {FEATURES.map((label) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onRecord}
            accessibilityRole="button"
            accessibilityLabel="Start recording"
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Icon name="microphone" size={20} color={BRAND} variant="line" />
            <Text style={[styles.primaryLabel, { color: BRAND }]}>Start recording</Text>
          </Pressable>

          <Pressable
            onPress={onImport}
            accessibilityRole="button"
            accessibilityLabel="Import audio or video"
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon name="download-outline" size={18} color="#FFFFFF" variant="line" />
            <Text style={styles.secondaryLabel}>Import audio</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radii.xl,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  bars: {
    position: 'absolute',
    top: 0,
    right: spacing.lg,
    height: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  textBlock: {
    gap: spacing.sm,
    paddingRight: 48,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    ...typography.display,
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  secondaryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.55)',
  },
});
