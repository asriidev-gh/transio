import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TranscriptSegment } from '@sessionai/shared';
import { colors, radii, spacing, typography } from '@/src/theme';
import { formatDuration } from '@/src/utils/format';

interface TranscriptViewerProps {
  text: string;
  language?: string | null;
  segments?: TranscriptSegment[];
  /** Current playback position in seconds. */
  currentTimeSec?: number;
  onSeekMs?: (startMs: number) => void;
  /** Persist a speaker rename across all matching segments. */
  onRenameSpeaker?: (from: string, to: string) => void | Promise<void>;
}

function activeSegmentIndex(segments: TranscriptSegment[], currentMs: number): number {
  if (segments.length === 0) return -1;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (currentMs >= seg.startMs && currentMs < seg.endMs) return i;
  }
  let last = -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].startMs <= currentMs) last = i;
  }
  return last;
}

async function promptRename(current: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const next = globalThis.prompt?.('Rename speaker', current);
    if (next == null) return null;
    const trimmed = next.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 40) : null;
  }

  return new Promise((resolve) => {
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Rename speaker',
        'Applies to every matching line in this transcript.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          {
            text: 'Save',
            onPress: (value?: string) => {
              const trimmed = (value ?? '').trim();
              resolve(trimmed.length > 0 ? trimmed.slice(0, 40) : null);
            },
          },
        ],
        'plain-text',
        current,
      );
      return;
    }

    Alert.alert('Rename speaker', 'Speaker rename is available on iOS and web for now.');
    resolve(null);
  });
}

export function TranscriptViewer({
  text,
  language,
  segments = [],
  currentTimeSec = 0,
  onSeekMs,
  onRenameSpeaker,
}: TranscriptViewerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<number, number>>({});
  const [busySpeaker, setBusySpeaker] = useState<string | null>(null);
  const currentMs = Math.max(0, Math.round(currentTimeSec * 1000));
  const activeIndex = activeSegmentIndex(segments, currentMs);
  const hasSegments = segments.length > 0;

  useEffect(() => {
    if (activeIndex < 0) return;
    const y = rowOffsets.current[activeIndex];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  }, [activeIndex]);

  async function handleRename(speaker: string) {
    if (!onRenameSpeaker || busySpeaker) return;
    const next = await promptRename(speaker);
    if (!next || next === speaker) return;
    setBusySpeaker(speaker);
    try {
      await onRenameSpeaker(speaker, next);
    } finally {
      setBusySpeaker(null);
    }
  }

  return (
    <View style={styles.wrap}>
      {language ? <Text style={styles.language}>Language: {language}</Text> : null}
      {hasSegments && onRenameSpeaker ? (
        <Text style={styles.hint}>Tap a speaker name to rename.</Text>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        accessibilityLabel="Transcript text"
      >
        {hasSegments
          ? segments.map((seg, index) => {
              const active = index === activeIndex;
              return (
                <Pressable
                  key={`${seg.startMs}-${index}`}
                  onLayout={(e) => {
                    rowOffsets.current[index] = e.nativeEvent.layout.y;
                  }}
                  onPress={() => onSeekMs?.(seg.startMs)}
                  style={[styles.segment, active && styles.segmentActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${seg.speaker ?? 'Segment'} at ${formatDuration(seg.startMs / 1000)}`}
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.segmentMeta}>
                    <Text style={[styles.time, active && styles.timeActive]}>
                      {formatDuration(seg.startMs / 1000)}
                    </Text>
                    {seg.speaker ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          void handleRename(seg.speaker!);
                        }}
                        disabled={busySpeaker === seg.speaker}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${seg.speaker}`}
                      >
                        <Text style={[styles.speaker, active && styles.speakerActive]}>
                          {busySpeaker === seg.speaker ? 'Saving…' : seg.speaker}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]} selectable>
                    {seg.text}
                  </Text>
                </Pressable>
              );
            })
          : (
            <Text style={styles.text} selectable>
              {text}
            </Text>
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: spacing.sm,
    minHeight: 280,
  },
  language: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    ...typography.caption,
    color: colors.inkMuted,
    fontFamily: undefined,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  text: {
    fontSize: 17,
    lineHeight: 28,
    color: colors.ink,
  },
  segment: {
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  segmentActive: {
    backgroundColor: colors.accentSoft,
  },
  segmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: {
    ...typography.caption,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  timeActive: {
    color: colors.accent,
  },
  speaker: {
    ...typography.caption,
    color: colors.brandSoft,
    fontFamily: undefined,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  speakerActive: {
    color: colors.brand,
  },
  segmentText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  segmentTextActive: {
    fontWeight: '600',
  },
});
