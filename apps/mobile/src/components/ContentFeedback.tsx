import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedbackRating } from '@sessionai/shared';
import { colors, radii, spacing, typography } from '@/src/theme';

interface ContentFeedbackProps {
  label?: string;
  /** Existing saved rating — if set, the prompt stays hidden. */
  value: FeedbackRating | null;
  busy?: boolean;
  onChange: (rating: FeedbackRating) => void;
}

const THANKS_VISIBLE_MS = 2200;
const THANKS_FADE_MS = 500;

export function ContentFeedback({
  label = 'Was this helpful?',
  value,
  busy = false,
  onChange,
}: ContentFeedbackProps) {
  const alreadyRated = Boolean(value);
  const [phase, setPhase] = useState<'ask' | 'thanks' | 'hidden'>(
    alreadyRated ? 'hidden' : 'ask',
  );
  const [chosen, setChosen] = useState<FeedbackRating | null>(value);
  const opacity = useRef(new Animated.Value(1)).current;
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (thanksTimer.current) clearTimeout(thanksTimer.current);
    };
  }, []);

  // If a rating arrives from the server (reload), keep the prompt hidden.
  useEffect(() => {
    if (value && phase === 'ask') {
      setChosen(value);
      setPhase('hidden');
    }
  }, [phase, value]);

  function onSelect(rating: FeedbackRating) {
    if (busy || phase !== 'ask') return;

    setChosen(rating);
    setPhase('thanks');
    opacity.setValue(1);
    onChange(rating);

    if (thanksTimer.current) clearTimeout(thanksTimer.current);
    thanksTimer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: THANKS_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setPhase('hidden');
      });
    }, THANKS_VISIBLE_MS);
  }

  if (phase === 'hidden') {
    return null;
  }

  if (phase === 'thanks') {
    const message =
      chosen === 'down'
        ? 'Thanks — we’ll use this to improve.'
        : 'Thanks — glad it helped.';

    return (
      <Animated.View
        style={[styles.wrap, { opacity }]}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.thanks}>{message}</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          onPress={() => onSelect('up')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Helpful"
        >
          <Text style={styles.btnText}>Helpful</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          onPress={() => onSelect('down')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Not helpful"
        >
          <Text style={styles.btnText}>Not helpful</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  btnText: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  thanks: {
    ...typography.body,
    color: colors.inkMuted,
    fontSize: 15,
  },
});
