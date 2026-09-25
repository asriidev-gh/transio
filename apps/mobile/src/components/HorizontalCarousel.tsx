import { useRef, useState, type ReactNode } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface HorizontalCarouselProps {
  children: ReactNode;
  /** Distance to scroll per chevron tap (card width + gap). */
  step: number;
  contentContainerStyle?: object;
  /** Side arrows — hide on phones so swipe is the main gesture. */
  showChevrons?: boolean;
}

/** Themed horizontal scroller — swipe/drag the cards; optional chevrons + progress track. */
export function HorizontalCarousel({
  children,
  step,
  contentContainerStyle,
  showChevrons = true,
}: HorizontalCarouselProps) {
  const { colors, shadows, scheme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [trackW, setTrackW] = useState(0);

  const maxScroll = Math.max(0, contentW - viewportW);
  const canScroll = maxScroll > 8;
  const atStart = offsetX <= 4;
  const atEnd = offsetX >= maxScroll - 4;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, offsetX / maxScroll)) : 0;
  const thumbW =
    trackW <= 0
      ? 0
      : Math.max(28, Math.min(trackW, trackW * Math.min(0.85, viewportW / Math.max(contentW, 1))));
  const thumbX = (trackW - thumbW) * progress;
  const trackBg = scheme === 'light' ? '#FFFFFF' : colors.border;
  const thumbBg = scheme === 'light' ? colors.ink : colors.accent;
  const chevrons = showChevrons && canScroll;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setOffsetX(event.nativeEvent.contentOffset.x);
  }

  function onViewportLayout(event: LayoutChangeEvent) {
    setViewportW(event.nativeEvent.layout.width);
  }

  function scrollBy(delta: number) {
    const next = Math.max(0, Math.min(maxScroll, offsetX + delta));
    scrollRef.current?.scrollTo({ x: next, animated: true });
    setOffsetX(next);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {chevrons ? (
          <Pressable
            onPress={() => scrollBy(-step)}
            disabled={atStart}
            accessibilityRole="button"
            accessibilityLabel="Scroll left"
            style={({ pressed }) => [
              styles.chevron,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: atStart ? 0.35 : pressed ? 0.85 : 1,
              },
              shadows.soft,
            ]}
          >
            <View style={styles.chevronFlip}>
              <Icon name="chevron-right" size={18} color={colors.ink} />
            </View>
          </Pressable>
        ) : null}

        <View style={styles.scroller} onLayout={onViewportLayout}>
          <ScrollView
            ref={scrollRef}
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={step}
            snapToAlignment="start"
            disableIntervalMomentum
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(width) => setContentW(width)}
            contentContainerStyle={[styles.content, contentContainerStyle]}
            // RN Web: enable drag/swipe scrolling without a native scrollbar.
            style={
              Platform.OS === 'web'
                ? // overflowX is valid on web but missing from some versions of the native style types.
                  ({ overflowX: 'auto', overflowY: 'hidden' } as unknown as ViewStyle)
                : undefined
            }
          >
            {children}
          </ScrollView>
        </View>

        {chevrons ? (
          <Pressable
            onPress={() => scrollBy(step)}
            disabled={atEnd}
            accessibilityRole="button"
            accessibilityLabel="Scroll right"
            style={({ pressed }) => [
              styles.chevron,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: atEnd ? 0.35 : pressed ? 0.85 : 1,
              },
              shadows.soft,
            ]}
          >
            <Icon name="chevron-right" size={18} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>

      {canScroll ? (
        <View
          style={[styles.track, { backgroundColor: trackBg }]}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Carousel position"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          <View
            style={[
              styles.thumb,
              {
                backgroundColor: thumbBg,
                width: thumbW,
                transform: [{ translateX: thumbX }],
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    width: '100%',
    maxWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  scroller: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    gap: spacing.smd,
    paddingVertical: spacing.xs,
  },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevronFlip: {
    transform: [{ rotate: '180deg' }],
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: spacing.xs,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 2,
  },
});
