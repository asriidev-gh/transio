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

function speakerHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hues = ['#6C63FF', '#38BDF8', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6'];
  return hues[hash % hues.length];
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

/** Premium document-style transcript with speaker rows and playback sync. */
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
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 32), animated: true });
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
      <View style={styles.metaRow}>
        <Text style={[styles.sectionLabel, { color: colors.ink }]}>Transcript</Text>
        {language ? (
          <Text style={[styles.language, { color: colors.inkMuted }]}>{language}</Text>
        ) : null}
      </View>
      {hasSegments && onRenameSpeaker ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Tap a speaker name to rename · tap text to seek
        </Text>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        accessibilityLabel="Transcript text"
      >
        {hasSegments ? (
          segments.map((seg, index) => {
            const active = index === activeIndex;
            const speaker = seg.speaker?.trim() || null;
            const chip = speaker ? speakerHue(speaker) : colors.accent;
            return (
              <View
                key={`${seg.startMs}-${index}`}
                onLayout={(e) => {
                  rowOffsets.current[index] = e.nativeEvent.layout.y;
                }}
                style={[
                  styles.segment,
                  {
                    borderColor: active ? colors.accent : 'transparent',
                    backgroundColor: active ? colors.accentSoft : 'transparent',
                  },
                ]}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.activeRail, { backgroundColor: active ? colors.accent : 'transparent' }]} />
                <View style={styles.segmentBody}>
                  <View style={styles.segmentMeta}>
                    {speaker ? (
                      <Pressable
                        onPress={() => void handleRename(speaker)}
                        disabled={busySpeaker === speaker || !onRenameSpeaker}
                        hitSlop={8}
                        style={styles.speakerRow}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${speaker}`}
                      >
                        <View style={[styles.avatar, { backgroundColor: chip }]}>
                          <Text style={styles.avatarText}>{speaker.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text
                          style={[
                            styles.speaker,
                            { color: colors.ink },
                            active && { color: colors.accentDeep },
                          ]}
                        >
                          {busySpeaker === speaker ? 'Saving…' : speaker}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.speaker, { color: colors.inkMuted }]}>Speaker</Text>
                    )}
                    <Pressable
                      onPress={() => onSeekMs?.(seg.startMs)}
                      accessibilityRole="button"
                      accessibilityLabel={`Seek to ${formatDuration(seg.startMs / 1000)}`}
                    >
                      <Text
                        style={[
                          styles.time,
                          { color: colors.inkMuted },
                          active && { color: colors.accent },
                        ]}
                      >
                        {formatDuration(seg.startMs / 1000)}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => onSeekMs?.(seg.startMs)}
                    accessibilityRole="button"
                    accessibilityLabel={`${speaker ?? 'Segment'} at ${formatDuration(seg.startMs / 1000)}`}
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
              </View>
            );
          })
        ) : (
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.section,
    fontSize: 18,
  },
  language: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: {
    ...typography.caption,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.smd,
  },
  text: {
    ...typography.transcript,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activeRail: {
    width: 3,
  },
  segmentBody: {
    flex: 1,
    paddingVertical: spacing.smd,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  segmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  speaker: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 13,
  },
  segmentText: {
    ...typography.transcript,
    fontSize: 16,
    lineHeight: 26,
  },
  segmentTextActive: {
    fontWeight: '600',
  },
});
