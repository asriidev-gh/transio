import { useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markOnboardingSeen } from '@/src/services/onboarding';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';

const { width: PAGE_WIDTH } = Dimensions.get('window');

type SlideKey = 'capture' | 'process' | 'ask';

interface Slide {
  key: SlideKey;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    key: 'capture',
    title: 'Transcribe every\nseminar',
    subtitle: 'Record live, import audio or video, or paste a file link.',
  },
  {
    key: 'process',
    title: 'Leave while\nwe work',
    subtitle: 'Safe to close the app — we’ll notify you when it’s ready.',
  },
  {
    key: 'ask',
    title: 'Ask, translate,\nand act',
    subtitle: 'Explore the transcript, ask questions, and track action items.',
  },
];

const SLIDE_ICONS: Record<SlideKey, AppIconName> = {
  capture: 'microphone',
  process: 'cog-outline',
  ask: 'chat',
};

const WAVE_BARS = [10, 18, 28, 16, 34, 22, 40, 14, 30, 20, 36, 12, 26, 18, 32, 24];

function SoftCard({ children }: { children: ReactNode }) {
  return <View style={[styles.softCard, shadows.soft]}>{children}</View>;
}

function CaptureDemo() {
  return (
    <SoftCard>
      <Text style={styles.demoLabel}>LIVE CAPTURE</Text>
      <Text style={styles.quote}>
        “Ship the pilot <Text style={styles.quoteAccent}>next Friday</Text>.”
      </Text>
      <View style={styles.waveRow}>
        {WAVE_BARS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              { height: h, backgroundColor: i % 3 === 0 ? colors.accent : colors.brandSoft },
            ]}
          />
        ))}
      </View>
      <View style={styles.pill}>
        <View style={styles.recDot} />
        <Text style={styles.pillText}>Recording</Text>
      </View>
    </SoftCard>
  );
}

function ProcessDemo() {
  return (
    <SoftCard>
      <Text style={styles.demoLabel}>PIPELINE</Text>
      {['Upload', 'Transcribe', 'Summarize'].map((label, i) => (
        <View key={label} style={styles.stepRow}>
          <View style={[styles.stepDot, i < 2 && styles.stepDone, i === 2 && styles.stepActive]}>
            <Text style={styles.stepDotText}>{i < 2 ? '✓' : '3'}</Text>
          </View>
          <Text style={[styles.stepLabel, i === 2 && styles.stepLabelActive]}>{label}</Text>
        </View>
      ))}
      <View style={styles.safeBanner}>
        <Text style={styles.safeBannerText}>Safe to leave — we’ll notify you</Text>
      </View>
    </SoftCard>
  );
}

function AskDemo() {
  return (
    <SoftCard>
      <Text style={styles.demoLabel}>ASK</Text>
      <Text style={styles.askTitle}>What do you want to know?</Text>
      {['Key points', 'Action items', 'What was decided?'].map((prompt) => (
        <View key={prompt} style={styles.promptRow}>
          <Text style={styles.promptText}>{prompt}</Text>
          <Text style={styles.promptChevron}>›</Text>
        </View>
      ))}
    </SoftCard>
  );
}

function SlideVisual({ slideKey }: { slideKey: SlideKey }) {
  if (slideKey === 'capture') return <CaptureDemo />;
  if (slideKey === 'process') return <ProcessDemo />;
  return <AskDemo />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const last = index >= SLIDES.length - 1;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (next !== index && next >= 0 && next < SLIDES.length) {
      setIndex(next);
    }
  }

  function goNext() {
    if (last) {
      void finish();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * PAGE_WIDTH, animated: true });
    setIndex(next);
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    await markOnboardingSeen();
    router.replace('/');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.glow} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topRow}>
          <BrandLogo size={52} />
          <Pressable
            onPress={() => void finish()}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={12}
          >
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.pager}
          accessibilityLabel="Onboarding slides"
        >
          {SLIDES.map((slide) => (
            <View key={slide.key} style={[styles.page, { width: PAGE_WIDTH }]}>
              <View style={styles.copyBlock}>
                <Icon name={SLIDE_ICONS[slide.key]} size={56} />
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
              <View style={styles.demoStage}>
                <SlideVisual slideKey={slide.key} />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots} accessibilityRole="adjustable" accessibilityLabel="Slide progress">
            {SLIDES.map((slide, i) => (
              <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            style={[styles.cta, finishing && styles.ctaDisabled]}
            onPress={goNext}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel={last ? 'Get started' : 'Continue'}
          >
            <Text style={styles.ctaText}>{last ? 'Get started' : 'Continue'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: { flex: 1 },
  glow: {
    position: 'absolute',
    bottom: -60,
    left: -20,
    right: -20,
    height: 280,
    backgroundColor: colors.accentSoft,
    borderRadius: 200,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  skip: {
    color: colors.inkMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  pager: { flex: 1 },
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  copyBlock: {
    gap: spacing.sm,
    minHeight: 168,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
  demoStage: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  softCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  demoLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accentDeep,
    fontWeight: '700',
  },
  quote: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  quoteAccent: {
    color: colors.accentDeep,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 42,
  },
  waveBar: {
    width: 5,
    borderRadius: 3,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.recording,
  },
  pillText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: {
    backgroundColor: colors.accentSoft,
  },
  stepActive: {
    backgroundColor: colors.accent,
  },
  stepDotText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    color: colors.inkMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.ink,
  },
  safeBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  safeBannerText: {
    color: colors.accentDeep,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
  },
  askTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  promptText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 14,
  },
  promptChevron: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md + 4,
    alignItems: 'center',
    ...shadows.float,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: colors.onBrand,
    fontSize: 16,
    fontWeight: '800',
  },
});
