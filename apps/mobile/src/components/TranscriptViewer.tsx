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
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { showAlert } from '@/src/utils/confirm';
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

    void showAlert('Rename speaker', 'Speaker rename is available on iOS and web for now.');
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
  const { colors } = useTheme();
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
      {language ? (
        <Text style={[styles.language, { color: colors.inkMuted }]}>Language: {language}</Text>
      ) : null}
      {hasSegments && onRenameSpeaker ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>Tap a speaker name to rename.</Text>
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
                <View
                  key={`${seg.startMs}-${index}`}
                  onLayout={(e) => {
                    rowOffsets.current[index] = e.nativeEvent.layout.y;
                  }}
                  style={[
                    styles.segment,
                    active && { backgroundColor: colors.accentSoft },
                  ]}
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.segmentMeta}>
                    <Pressable
                      onPress={() => onSeekMs?.(seg.startMs)}
                      accessibilityRole="button"
                      accessibilityLabel={`Seek to ${formatDuration(seg.startMs / 1000)}`}
                    >
                      <Text
                        style={[
                          styles.time,
                          { color: colors.inkMuted },
                          active && { color: colors.accentDeep },
                        ]}
                      >
                        {formatDuration(seg.startMs / 1000)}
                      </Text>
                    </Pressable>
                    {seg.speaker ? (
                      <Pressable
                        onPress={() => void handleRename(seg.speaker!)}
                        disabled={busySpeaker === seg.speaker}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${seg.speaker}`}
                      >
                        <Text
                          style={[
                            styles.speaker,
                            { color: colors.inkMuted },
                            active && { color: colors.accentDeep },
                          ]}
                        >
                          {busySpeaker === seg.speaker ? 'Saving…' : seg.speaker}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => onSeekMs?.(seg.startMs)}
                    accessibilityRole="button"
                    accessibilityLabel={`${seg.speaker ?? 'Segment'} at ${formatDuration(seg.startMs / 1000)}`}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: colors.ink },
                        active && styles.segmentTextActive,
                      ]}
                      selectable
                    >
                      {seg.text}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          : (
            <Text style={[styles.text, { color: colors.ink }]} selectable>
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    ...typography.caption,
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
    ...typography.transcript,
  },
  segment: {
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  segmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  speaker: {
    ...typography.caption,
    fontFamily: undefined,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  segmentText: {
    ...typography.transcript,
  },
  segmentTextActive: {
    fontWeight: '600',
  },
});
