import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlossOrb, type GlossOrbTint } from '@/src/components/ui/GlossOrb';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { markOnboardingSeen } from '@/src/services/onboarding';
import { fonts, gradients, radii, spacing } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const { width: PAGE_WIDTH } = Dimensions.get('window');

type SlideKey = 'capture' | 'notes' | 'translate' | 'privacy';

interface Slide {
  key: SlideKey;
  title: string;
  subtitle: string;
  footnote?: string;
}

const SLIDES: Slide[] = [
  {
    key: 'capture',
    title: 'Hit record.',
    subtitle: 'Walk away with a clean, word-for-word transcript.',
    footnote: 'Microphone access is requested only the first time you record.',
  },
  {
    key: 'notes',
    title: 'Notes that land.',
    subtitle: 'Summaries, replay, and share — ready when you are.',
  },
  {
    key: 'translate',
    title: 'Speak. Hear.',
    subtitle: 'Hold to talk — Voice translate speaks back in their language.',
  },
  {
    key: 'privacy',
    title: 'Yours alone.',
    subtitle: 'Signed-in sessions stay in your private library.',
  },
];

const WAVE_HEIGHTS = [
  18, 32, 48, 28, 58, 38, 68, 44, 56, 26, 62, 36, 72, 42, 54, 22, 50, 34, 66, 40, 28, 60, 36, 24, 46, 30, 64, 38,
];

const SEMINAR_LINES = [
  {
    name: 'Keynote',
    time: '0:42',
    text: 'Today we’ll unpack how AI changes classroom assessment.',
    align: 'left' as const,
  },
  {
    name: 'Moderator',
    time: '1:18',
    text: 'Hold questions for the panel — we’ll open the floor next.',
    align: 'right' as const,
  },
  {
    name: 'Attendee',
    time: '2:05',
    text: 'Could you expand on the formative assessment piece?',
    align: 'left' as const,
  },
];

function ProgressSegments({ index, total }: { index: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ now: index + 1, min: 1, max: total }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSeg,
            {
              backgroundColor: i <= index ? colors.brand : colors.accentSoft,
            },
          ]}
        />
      ))}
    </View>
  );
}

function WaveformArt() {
  const { colors } = useTheme();
  const clock = useRef(new Animated.Value(0)).current;
  const playhead = useRef(new Animated.Value(0)).current;
  const reveal = useRef(SEMINAR_LINES.map(() => new Animated.Value(0))).current;
  const [trackWidth, setTrackWidth] = useState(PAGE_WIDTH - spacing.lg * 2);

  useEffect(() => {
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(clock, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(clock, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const headLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(playhead, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(playhead, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    waveLoop.start();
    headLoop.start();

    const bubbleIn = Animated.stagger(
      220,
      reveal.map((v) =>
        Animated.spring(v, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ),
    );
    bubbleIn.start();

    return () => {
      waveLoop.stop();
      headLoop.stop();
    };
  }, [clock, playhead, reveal]);

  const mid = Math.floor(WAVE_HEIGHTS.length * 0.42);
  const headTravel = Math.max(0, trackWidth - 8);
  const headX = playhead.interpolate({
    inputRange: [0, 1],
    outputRange: [trackWidth * 0.12, trackWidth * 0.12 + headTravel * 0.55],
  });

  const speakerTint = [colors.brand, colors.success, colors.brandSoft] as const;

  return (
    <View style={styles.waveWrap}>
      <View
        style={styles.waveRow}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {WAVE_HEIGHTS.map((h, i) => {
          const played = i < mid;
          const phase = (i % 7) / 7;
          const scaleY = clock.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: played
              ? [0.72 + phase * 0.2, 1.22 - phase * 0.15, 0.78 + phase * 0.18]
              : [0.55 + phase * 0.15, 0.95 - phase * 0.1, 0.6 + phase * 0.12],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: h,
                  backgroundColor: played ? colors.brand : colors.brandSoft,
                  opacity: played ? 1 : 0.4,
                  transform: [{ scaleY }],
                },
              ]}
            />
          );
        })}
        <Animated.View
          style={[
            styles.playhead,
            { backgroundColor: colors.ink, transform: [{ translateX: headX }] },
          ]}
        >
          <View style={[styles.playheadDot, { backgroundColor: colors.ink }]} />
          <View style={[styles.playheadDot, styles.playheadDotBottom, { backgroundColor: colors.ink }]} />
        </Animated.View>
      </View>

      <View style={styles.bubbles}>
        {SEMINAR_LINES.map((line, i) => (
          <Animated.View
            key={line.name}
            style={{
              opacity: reveal[i],
              transform: [
                {
                  translateY: reveal[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            <TranscriptBubble
              name={line.name}
              time={line.time}
              text={line.text}
              tint={speakerTint[i]}
              align={line.align}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function TranscriptBubble({
  name,
  time,
  text,
  tint,
  align,
}: {
  name: string;
  time: string;
  text: string;
  tint: string;
  align: 'left' | 'right';
}) {
  const { colors, shadows } = useTheme();
  return (
    <View style={[styles.bubbleWrap, align === 'right' && styles.bubbleWrapRight]}>
      <View style={[styles.bubbleMeta, align === 'right' && styles.bubbleMetaRight]}>
        <View style={[styles.speakerDot, { backgroundColor: tint }]} />
        <Text style={[styles.speakerName, { color: colors.ink }]}>{name}</Text>
        <Text style={[styles.speakerTime, { color: colors.inkMuted }]}>{time}</Text>
      </View>
      <View
        style={[
          styles.bubble,
          { backgroundColor: colors.surface, borderColor: colors.border },
          shadows.soft,
        ]}
      >
        <Text style={[styles.bubbleText, { color: colors.ink }]}>{text}</Text>
      </View>
    </View>
  );
}

const NOTE_TABS: { label: string; icon: AppIconName }[] = [
  { label: 'Summary', icon: 'file-text' },
  { label: 'Transcript', icon: 'file-text' },
  { label: 'Ask', icon: 'file-text' },
];
const NOTE_BULLETS = ['Launch moved to March 12', 'Design review due Friday', 'Sam owns the budget draft'];
const NOTE_LINES = [
  { who: 'Sam', text: 'We should lock the launch date today.' },
  { who: 'Priya', text: 'March 12 works if design signs off Friday.' },
  { who: 'Sam', text: 'Great, I will draft the budget.' },
];

/** Runs 0 to 1 whenever the page becomes visible, and resets when it leaves so it replays. */
function useEntrance(active: boolean, reduceMotion: boolean, duration = 1100) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      value.setValue(active ? 1 : 0);
      return;
    }
    if (!active) {
      value.setValue(0);
      return;
    }
    const anim = Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, reduceMotion, duration, value]);
  return value;
}

function FadeIn({ children }: { children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function NotesArt({ active }: { active: boolean }) {
  const { colors, shadows, reduceMotion } = useTheme();
  const enter = useEntrance(active, reduceMotion);
  const float = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState(0);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !active) {
      progress.setValue(reduceMotion ? 0.38 : 0);
      badge.setValue(reduceMotion && active ? 1 : 0);
      return;
    }
    progress.setValue(0);
    const bar = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true }),
    );
    bar.start();
    const pop = Animated.sequence([
      Animated.delay(900),
      Animated.spring(badge, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]);
    pop.start();
    const timer = setInterval(() => setTab((t) => (t + 1) % NOTE_TABS.length), 2800);
    return () => {
      bar.stop();
      pop.stop();
      clearInterval(timer);
    };
  }, [active, reduceMotion, progress, badge]);

  useEffect(() => {
    if (!active) setTab(0);
  }, [active]);

  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const cardRise = enter.interpolate({ inputRange: [0, 1], outputRange: [70, 0] });
  const cardScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const backSlide = enter.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const backSpin = enter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] });
  const reveal = (i: number) => ({
    opacity: enter.interpolate({ inputRange: [0.35 + i * 0.13, 0.6 + i * 0.13], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateX: enter.interpolate({
          inputRange: [0.35 + i * 0.13, 0.6 + i * 0.13],
          outputRange: [-14, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  });
  const fillX = progress.interpolate({ inputRange: [0, 1], outputRange: [-trackW, 0] });

  return (
    <View style={styles.notesStage}>
      <Animated.View
        style={[
          styles.backCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] }),
            transform: [{ translateX: backSlide }, { rotate: backSpin }],
          },
          shadows.soft,
        ]}
      >
        <Text style={[styles.backCardTitle, { color: colors.inkMuted }]}>Psychology lecture</Text>
        <View style={[styles.line, { backgroundColor: colors.border, width: '78%' }]} />
        <View style={[styles.line, { backgroundColor: colors.border, width: '62%' }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.frontCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: enter.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
            transform: [{ translateY: Animated.add(cardRise, lift) }, { scale: cardScale }],
          },
          shadows.soft,
        ]}
      >
        <View style={styles.frontHeader}>
          <Text style={[styles.frontTitle, { color: colors.ink }]} numberOfLines={1}>
            Team kickoff
          </Text>
          <Icon name="share-variant-outline" size={16} color={colors.brand} variant="line" />
        </View>

        <View style={styles.tabRow}>
          {NOTE_TABS.map((item, i) =>
            i === tab ? (
              <View key={item.label} style={[styles.tabActive, { backgroundColor: colors.accentSoft }]}>
                <Icon name={item.icon} size={12} color={colors.brand} variant="line" />
                <Text style={[styles.tabActiveText, { color: colors.brand }]}>{item.label}</Text>
              </View>
            ) : (
              <Text key={item.label} style={[styles.tabIdle, { color: colors.inkMuted }]}>
                {item.label}
              </Text>
            ),
          )}
        </View>

        <View style={styles.noteBox}>
          <FadeIn key={tab}>
            {tab === 0 ? (
              <View style={styles.noteList}>
                <Text style={[styles.noteSection, { color: colors.ink }]}>Overview</Text>
                {NOTE_BULLETS.map((line, i) => (
                  <Animated.View key={line} style={[styles.bulletRow, reveal(i)]}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.brand }]} />
                    <Text style={[styles.noteBody, { color: colors.inkMuted }]}>{line}</Text>
                  </Animated.View>
                ))}
              </View>
            ) : tab === 1 ? (
              <View style={styles.noteList}>
                {NOTE_LINES.map((line, i) => (
                  <Text key={i} style={[styles.noteBody, { color: colors.inkMuted }]} numberOfLines={1}>
                    <Text style={{ fontFamily: fonts.sansBold, color: colors.cyan }}>{line.who}  </Text>
                    {line.text}
                  </Text>
                ))}
              </View>
            ) : (
              <View style={styles.noteList}>
                <View style={[styles.askBubble, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.noteBody, { color: colors.brand }]}>What are the action items?</Text>
                </View>
                <Text style={[styles.noteBody, { color: colors.inkMuted }]}>
                  Design review by Friday, and Sam drafts the budget.
                </Text>
              </View>
            )}
          </FadeIn>
        </View>

        <View style={[styles.miniPlayer, { borderTopColor: colors.border }]}>
          <View
            style={[styles.miniTrack, { backgroundColor: colors.border }]}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.miniFill,
                { backgroundColor: colors.brand, width: trackW || '100%', transform: [{ translateX: trackW ? fillX : -9999 }] },
              ]}
            />
          </View>
          <View style={styles.miniControls}>
            <Text style={[styles.miniSpeed, { color: colors.inkMuted }]}>1×</Text>
            <View style={[styles.miniPlay, { backgroundColor: colors.brand }]}>
              <Icon name="play" size={14} color="#FFFFFF" variant="line" />
            </View>
            <Icon name="download-outline" size={16} color={colors.inkMuted} variant="line" />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.aiBadge,
          {
            opacity: badge,
            transform: [
              { scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { rotate: '6deg' },
            ],
          },
          shadows.soft,
        ]}
      >
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiBadgeFill}
        >
          <Text style={styles.aiBadgeText}>AI Summary</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function PrivacyArt() {
  const { colors } = useTheme();
  const clock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(clock, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(clock, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [clock]);

  const chips: Array<{
    icon: AppIconName;
    top: `${number}%`;
    left?: `${number}%`;
    right?: `${number}%`;
    size: number;
    phase: number;
    tint: GlossOrbTint;
  }> = [
    { icon: 'lock', top: '10%', right: '12%', size: 56, phase: 0, tint: 'violet' },
    { icon: 'translate', top: '62%', left: '4%', size: 54, phase: 0.2, tint: 'brand' },
    { icon: 'video', top: '18%', left: '8%', size: 52, phase: 0.4, tint: 'cyan' },
    { icon: 'file-text', top: '68%', right: '6%', size: 52, phase: 0.55, tint: 'brand' },
    { icon: 'sticky-note', top: '42%', right: '0%', size: 50, phase: 0.75, tint: 'violet' },
    { icon: 'file-music-outline', top: '38%', left: '0%', size: 48, phase: 0.9, tint: 'cyan' },
  ];

  // The center orb breathes slowly so it stays the focal point.
  const coreScale = clock.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.97, 1.04, 0.97],
  });

  return (
    <View style={styles.privacyStage}>
      <View style={[styles.ring, styles.ringOuter, { borderColor: colors.accentSoft }]} />
      <View style={[styles.ring, styles.ringMid, { borderColor: colors.accentSoft }]} />
      <View style={[styles.ring, styles.ringInner, { borderColor: colors.accentSoft }]} />

      <Animated.View style={{ transform: [{ scale: coreScale }] }}>
        <GlossOrb size={128} halo>
          <Icon name="microphone" size={52} color="#FFFFFF" variant="line" />
        </GlossOrb>
      </Animated.View>

      {chips.map((chip) => {
        const shift = chip.phase * 0.35;
        const translateY = clock.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [6 - shift * 10, -10 - shift * 4, 6 - shift * 10],
        });
        const scale = clock.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.96 + shift * 0.04, 1.06 - shift * 0.02, 0.96 + shift * 0.04],
        });
        return (
          <Animated.View
            key={chip.icon}
            style={[
              styles.floatChip,
              {
                top: chip.top,
                left: chip.left,
                right: chip.right,
                width: chip.size,
                height: chip.size,
                transform: [{ translateY }, { scale }],
              },
            ]}
          >
            <GlossOrb size={chip.size} tint={chip.tint} intensity={0.55} borderWidth={2}>
              <Icon name={chip.icon} size={Math.round(chip.size * 0.42)} color="#FFFFFF" variant="line" />
            </GlossOrb>
          </Animated.View>
        );
      })}
    </View>
  );
}

const PHRASES = [
  { lang: 'Tagalog', src: 'Salamat!', out: 'Thank you!' },
  { lang: 'Spanish', src: 'Gracias por todo', out: 'Thanks for everything' },
  { lang: 'French', src: 'Où est la gare ?', out: 'Where is the station?' },
];
const WAVE_BARS = [0.5, 0.9, 0.65, 1, 0.55];

function TranslateArt({ active }: { active: boolean }) {
  const { colors, shadows, reduceMotion } = useTheme();
  const enter = useEntrance(active, reduceMotion, 800);
  const press = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const src = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const [cycle, setCycle] = useState(0);
  const phrase = PHRASES[cycle % PHRASES.length]!;

  useEffect(() => {
    if (reduceMotion || !active) {
      const shown = reduceMotion && active ? 1 : 0;
      src.setValue(shown);
      out.setValue(shown);
      press.setValue(0);
      ring.setValue(0);
      return;
    }
    press.setValue(0);
    ring.setValue(0);
    src.setValue(0);
    out.setValue(0);
    const run = Animated.sequence([
      Animated.delay(cycle === 0 ? 700 : 200),
      Animated.timing(press, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(450),
          Animated.spring(src, { toValue: 1, friction: 6, tension: 110, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(press, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.spring(out, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }),
      Animated.delay(2300),
      Animated.parallel([
        Animated.timing(src, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(out, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]);
    run.start(({ finished }) => {
      if (finished) setCycle((c) => c + 1);
    });
    return () => run.stop();
  }, [active, reduceMotion, cycle, press, ring, src, out]);

  useEffect(() => {
    if (reduceMotion || !active) return;
    const loop = Animated.loop(
      Animated.timing(wave, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, wave]);

  const cardRise = enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const pop = (v: Animated.Value, fromX: number) => ({
    opacity: v.interpolate({ inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
    ],
  });

  return (
    <View style={styles.translateStage}>
      <Animated.View
        style={[
          styles.translateCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: enter,
            transform: [{ translateY: cardRise }],
          },
          shadows.soft,
        ]}
      >
        <View style={styles.translateLangRow}>
          <Text style={[styles.translateLang, { color: colors.inkMuted }]}>{phrase.lang}</Text>
          <Icon name="translate" size={16} color={colors.brand} variant="line" />
          <Text style={[styles.translateLang, { color: colors.cyan }]}>English</Text>
        </View>

        <View style={styles.translateBubbles}>
          <Animated.View
            style={[
              styles.translateBubble,
              styles.translateSpeaker,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              pop(src, -30),
            ]}
          >
            <Text style={[styles.translateLabel, { color: colors.inkMuted }]}>Speaker</Text>
            <Text style={[styles.translateBody, { color: colors.ink }]}>{phrase.src}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.translateBubble,
              styles.translateOut,
              { backgroundColor: colors.actionImport, borderColor: colors.cyan + '44' },
              pop(out, 30),
            ]}
          >
            <View style={styles.translateOutHeader}>
              <Text style={[styles.translateLabel, { color: colors.cyan }]}>Translation</Text>
              <View style={styles.soundRow}>
                {WAVE_BARS.map((h, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.soundBar,
                      {
                        backgroundColor: colors.cyan,
                        transform: [
                          {
                            scaleY: wave.interpolate({
                              inputRange: [0, 0.25 + i * 0.1, 1],
                              outputRange: [0.4, h, 0.4],
                              extrapolate: 'clamp',
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={[styles.translateBody, { color: colors.ink }]}>{phrase.out}</Text>
          </Animated.View>
        </View>

        <View style={styles.translateMicRow}>
          <View style={styles.micWrap}>
            <Animated.View
              style={[
                styles.micRing,
                {
                  borderColor: colors.brand,
                  opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.7] }) }],
                },
              ]}
            />
            <Animated.View
              style={{ transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] }}
            >
              <GlossOrb size={68} halo>
                <Icon name="microphone" size={26} color="#FFFFFF" variant="line" />
              </GlossOrb>
            </Animated.View>
          </View>
          <Text style={[styles.translateHint, { color: colors.inkMuted }]}>Hold to talk</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function SlideArt({ slideKey, active }: { slideKey: SlideKey; active: boolean }) {
  if (slideKey === 'capture') return <WaveformArt />;
  if (slideKey === 'notes') return <NotesArt active={active} />;
  if (slideKey === 'translate') return <TranslateArt active={active} />;
  return <PrivacyArt />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, scheme, shadows } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [pagerHeight, setPagerHeight] = useState(0);
  const last = index >= SLIDES.length - 1;
  const slide = SLIDES[index];

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
    router.replace('/paywall');
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <LinearGradient
        colors={[gradients.primary[0] + '28', gradients.primary[1] + '12', 'transparent']}
        locations={[0, 0.35, 1]}
        style={styles.glowTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', gradients.primary[0] + '14']}
        style={styles.glowBottom}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <ProgressSegments index={index} total={SLIDES.length} />
          <Pressable
            onPress={() => void finish()}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={12}
            style={styles.skipHit}
          >
            <Text style={[styles.skip, { color: colors.inkMuted }]}>Skip</Text>
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
          onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
          accessibilityLabel="Onboarding slides"
        >
          {SLIDES.map((item, slideIndex) => (
            <View
              key={item.key}
              style={[
                styles.page,
                { width: PAGE_WIDTH, height: pagerHeight > 0 ? pagerHeight : undefined },
              ]}
            >
              <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.brand }]}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: colors.inkMuted }]}>{item.subtitle}</Text>
              </View>
              <View style={styles.artSlot}>
                <SlideArt slideKey={item.key} active={index === slideIndex} />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.cta, finishing && styles.ctaDisabled, shadows.soft]}
            onPress={goNext}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel={last ? 'Get started' : 'Continue'}
          >
            <LinearGradient
              colors={[...gradients.primary]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaGradient}
            >
              <Text style={[styles.ctaText, { color: colors.onBrand }]}>
                {last ? 'Get started' : 'Continue'}
              </Text>
              <Icon name="chevron-right" size={20} color={colors.onBrand} variant="line" />
            </LinearGradient>
          </Pressable>
          {slide.footnote ? (
            <Text style={[styles.footnote, { color: colors.inkMuted }]}>{slide.footnote}</Text>
          ) : (
            <View style={styles.footnoteSpacer} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  glowTop: {
    position: 'absolute',
    top: -60,
    left: -40,
    right: -40,
    height: 320,
  },
  glowBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  skipHit: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  skip: {
    fontFamily: fonts.sansSemi,
    fontSize: 15,
  },
  pager: { flex: 1 },
  page: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  copy: {
    gap: 8,
    paddingRight: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.1,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 20,
    lineHeight: 28,
    maxWidth: 360,
  },
  artSlot: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  cta: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  ctaDisabled: { opacity: 0.55 },
  ctaGradient: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    letterSpacing: 0.2,
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    minHeight: 28,
  },
  footnoteSpacer: { minHeight: 28 },

  // Capture art
  waveWrap: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 96,
    position: 'relative',
    marginBottom: spacing.xs,
  },
  waveBar: {
    width: 7,
    borderRadius: 4,
  },
  playhead: {
    position: 'absolute',
    left: 0,
    width: 2,
    height: 92,
    borderRadius: 1,
  },
  playheadDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -5,
    left: -5,
  },
  playheadDotBottom: {
    top: undefined,
    bottom: -5,
  },
  bubbles: {
    gap: spacing.sm,
  },
  bubbleWrap: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    gap: 4,
  },
  bubbleWrapRight: {
    alignSelf: 'flex-end',
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  bubbleMetaRight: {
    alignSelf: 'flex-end',
  },
  speakerDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  speakerName: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  speakerTime: {
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
  },
  bubbleText: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
  },

  // Notes art
  notesStage: {
    width: '100%',
    flex: 1,
    maxHeight: 460,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCard: {
    position: 'absolute',
    width: '90%',
    top: '8%',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
    opacity: 0.72,
  },
  backCardTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    marginBottom: 4,
  },
  line: {
    height: 10,
    borderRadius: 5,
  },
  frontCard: {
    width: '96%',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.smd,
  },
  frontHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  frontTitle: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 17,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  tabActiveText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  tabIdle: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
  },
  noteSection: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    marginTop: 2,
  },
  noteBox: {
    minHeight: 96,
  },
  noteList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  askBubble: {
    alignSelf: 'flex-start',
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  aiBadge: {
    position: 'absolute',
    top: '2%',
    right: 0,
    borderRadius: radii.pill,
  },
  aiBadgeFill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  noteBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  miniPlayer: {
    marginTop: spacing.xs,
    paddingTop: spacing.smd,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  miniTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniFill: {
    height: 5,
    borderRadius: 3,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniSpeed: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    minWidth: 28,
  },
  miniPlay: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Translate art
  translateStage: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  translateCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  translateLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  translateLang: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  translateBubbles: {
    gap: spacing.md,
    minHeight: 150,
    justifyContent: 'center',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
  },
  soundBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  micWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
  },
  translateBubble: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 4,
    maxWidth: '92%',
  },
  translateSpeaker: {
    alignSelf: 'flex-start',
  },
  translateOut: {
    alignSelf: 'flex-end',
  },
  translateOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  translateLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  translateBody: {
    fontFamily: fonts.sansSemi,
    fontSize: 17,
    lineHeight: 24,
  },
  translatePlay: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateMicRow: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  translateMic: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateHint: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
  },

  // Privacy art
  privacyStage: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 999,
  },
  ringOuter: {
    width: '94%',
    aspectRatio: 1,
  },
  ringMid: {
    width: '80%',
    aspectRatio: 1,
  },
  ringInner: {
    width: '64%',
    aspectRatio: 1,
  },
  floatChip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
