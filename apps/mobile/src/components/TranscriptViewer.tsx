import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { activeSegmentIndex } from '@/src/utils/transcript-active';

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

/** Stable default so effects keyed on `segments` do not fire every render. */
const NO_SEGMENTS: TranscriptSegment[] = [];
/** Long meetings have thousands of lines; render a first page and let the reader ask for more. */
const INITIAL_ROWS = 200;
const ROWS_PER_PAGE = 300;

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

interface SegmentRowProps {
  seg: TranscriptSegment;
  index: number;
  active: boolean;
  canRename: boolean;
  busy: boolean;
  onSeek: (startMs: number) => void;
  onRename: (speaker: string) => void;
  onRowLayout: (index: number, y: number) => void;
}

/** One transcript line. Memoized so playback ticks only redraw the rows whose highlight changes. */
const SegmentRow = memo(function SegmentRow({
  seg,
  index,
  active,
  canRename,
  busy,
  onSeek,
  onRename,
  onRowLayout,
}: SegmentRowProps) {
  const { colors } = useTheme();
  const speaker = seg.speaker?.trim() || null;
  const chip = speaker ? speakerHue(speaker) : colors.accent;

  return (
    <View
      onLayout={(e) => onRowLayout(index, e.nativeEvent.layout.y)}
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
              onPress={() => onRename(speaker)}
              disabled={busy || !canRename}
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
                {busy ? 'Saving…' : speaker}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.speaker, { color: colors.inkMuted }]}>Speaker</Text>
          )}
          <Pressable
            onPress={() => onSeek(seg.startMs)}
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
          onPress={() => onSeek(seg.startMs)}
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
});

/** Premium document-style transcript with speaker rows and playback sync. */
export function TranscriptViewer({
  text,
  language,
  segments = NO_SEGMENTS,
  currentTimeSec = 0,
  onSeekMs,
  onRenameSpeaker,
}: TranscriptViewerProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<number, number>>({});
  const pendingScrollRef = useRef<number | null>(null);
  const [busySpeaker, setBusySpeaker] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const currentMs = Math.max(0, Math.round(currentTimeSec * 1000));
  const activeIndex = activeSegmentIndex(segments, currentMs);
  const hasSegments = segments.length > 0;
  // Always render far enough to include the playing line and a little after it.
  const shown = hasSegments
    ? Math.min(segments.length, Math.max(visibleCount, activeIndex + 30))
    : 0;
  const remaining = segments.length - shown;

  // Keep callbacks stable so memoized rows are not redrawn by unrelated parent renders.
  const onSeekRef = useRef(onSeekMs);
  onSeekRef.current = onSeekMs;
  const onRenameRef = useRef(onRenameSpeaker);
  onRenameRef.current = onRenameSpeaker;
  const busyRef = useRef<string | null>(null);
  busyRef.current = busySpeaker;
  const canRename = Boolean(onRenameSpeaker);

  const handleSeek = useCallback((startMs: number) => onSeekRef.current?.(startMs), []);

  const scrollToRow = useCallback((index: number): boolean => {
    const y = rowOffsets.current[index];
    if (typeof y !== 'number') return false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 32), animated: true });
    return true;
  }, []);

  const handleRowLayout = useCallback(
    (index: number, y: number) => {
      rowOffsets.current[index] = y;
      // The playing row may only just have been rendered (progressive loading or a seek).
      if (pendingScrollRef.current === index) {
        pendingScrollRef.current = null;
        scrollToRow(index);
      }
    },
    [scrollToRow],
  );

  const handleRename = useCallback(async (speaker: string) => {
    const rename = onRenameRef.current;
    if (!rename || busyRef.current) return;
    const next = await promptRename(speaker);
    if (!next || next === speaker) return;
    setBusySpeaker(speaker);
    try {
      await rename(speaker, next);
    } finally {
      setBusySpeaker(null);
    }
  }, []);

  useEffect(() => {
    // New transcript (or edited speakers): start from the first page again.
    setVisibleCount(INITIAL_ROWS);
    rowOffsets.current = {};
    pendingScrollRef.current = null;
  }, [segments]);

  useEffect(() => {
    if (activeIndex < 0) return;
    pendingScrollRef.current = scrollToRow(activeIndex) ? null : activeIndex;
  }, [activeIndex, scrollToRow]);

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
          <>
            {segments.slice(0, shown).map((seg, index) => (
              <SegmentRow
                key={`${seg.startMs}-${index}`}
                seg={seg}
                index={index}
                active={index === activeIndex}
                canRename={canRename}
                busy={busySpeaker !== null && busySpeaker === (seg.speaker?.trim() || null)}
                onSeek={handleSeek}
                onRename={handleRename}
                onRowLayout={handleRowLayout}
              />
            ))}
            {remaining > 0 ? (
              <Pressable
                onPress={() => setVisibleCount(shown + ROWS_PER_PAGE)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${Math.min(remaining, ROWS_PER_PAGE)} more lines`}
                style={[styles.moreButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.moreText, { color: colors.accent }]}>
                  Show more · {remaining} lines left
                </Text>
              </Pressable>
            ) : null}
          </>
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
  moreButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  moreText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
