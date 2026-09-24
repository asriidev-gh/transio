import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  CAPTURE_MODE_SHORT_LABELS,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type CaptureMode,
  type Session,
} from '@sessionai/shared';
import { Icon } from '@/src/components/ui/Icon';
import { IconWell } from '@/src/components/ui/IconWell';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { captureModeVisual } from '@/src/utils/capture-mode-visual';
import { formatDurationHuman, formatRelativeSessionDate } from '@/src/utils/format';

interface SessionCardProps {
  session: Session;
  onPress: () => void;
  /** Swipe left to reveal; confirmation is handled by the parent. */
  onDelete?: () => void;
}

function statusTone(
  status: Session['status'],
  colors: { success: string; danger: string; accent: string; cyan: string; inkMuted: string },
): { label: string; color: string; bg: string } {
  if (status === 'completed') {
    return { label: 'Ready', color: colors.success, bg: 'rgba(5, 150, 105, 0.12)' };
  }
  if (status === 'failed') {
    return { label: 'Needs attention', color: colors.danger, bg: 'rgba(239, 68, 68, 0.12)' };
  }
  if (status === 'transcribing' || status === 'summarizing') {
    return { label: SESSION_STATUS_LABELS[status], color: colors.accent, bg: 'rgba(91, 108, 255, 0.12)' };
  }
  if (status === 'transcribed' || status === 'uploaded') {
    return { label: SESSION_STATUS_LABELS[status], color: colors.cyan, bg: 'rgba(56, 189, 248, 0.12)' };
  }
  return {
    label: SESSION_STATUS_LABELS[status],
    color: colors.inkMuted,
    bg: 'rgba(156, 163, 175, 0.14)',
  };
}

function captureTone(
  mode: CaptureMode,
  colors: { accent: string; cyan: string; warning: string; brandSoft: string },
): { color: string; bg: string } {
  if (mode === 'live_notes') {
    return { color: colors.warning, bg: 'rgba(245, 158, 11, 0.14)' };
  }
  if (mode === 'notes') {
    return { color: colors.cyan, bg: 'rgba(56, 189, 248, 0.14)' };
  }
  if (mode === 'live') {
    return { color: colors.accent, bg: 'rgba(91, 108, 255, 0.12)' };
  }
  return { color: colors.brandSoft, bg: 'rgba(155, 124, 255, 0.14)' };
}

export function SessionCard({ session, onPress, onDelete }: SessionCardProps) {
  const { colors, scheme, shadows } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);
  const statusLabel = SESSION_STATUS_LABELS[session.status];
  const captureMode = session.captureMode ?? 'batch';
  const captureLabel = CAPTURE_MODE_SHORT_LABELS[captureMode];
  const favorited = Boolean(session.favoritedAt);
  const preview = session.description?.trim();
  const tone = statusTone(session.status, colors);
  const capture = captureTone(captureMode, colors);
  const visual = captureModeVisual(captureMode);
  const wellTint = session.status === 'failed'
    ? colors.actionRecord
    : scheme === 'dark'
      ? visual.dark
      : visual.light;
  const wellColor = session.status === 'failed' ? colors.danger : colors[visual.colorKey];

  const card = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.992 : 1 }],
        },
        // Shadow sits on an outer host when swipeable (otherwise RNGH clips it).
        onDelete ? null : shadows.soft,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${captureLabel}, ${SESSION_TYPE_LABELS[session.sessionType]}, ${statusLabel}${favorited ? ', favorite' : ''}`}
      accessibilityHint={onDelete ? 'Swipe left to delete' : undefined}
    >
      <IconWell name={visual.icon} tint={wellTint} color={wellColor} size={20} wellSize={48} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {session.title}
          </Text>
          {favorited ? <Icon name="star" size={16} color={colors.accent} variant="line" /> : null}
        </View>

        <Text style={[styles.meta, { color: colors.inkMuted }]} numberOfLines={1}>
          {formatRelativeSessionDate(session.recordedAt)}
          {'  ·  '}
          {formatDurationHuman(session.durationSeconds)}
          {'  ·  '}
          {SESSION_TYPE_LABELS[session.sessionType]}
        </Text>

        <View style={styles.pills}>
          <View style={[styles.pill, { backgroundColor: capture.bg }]}>
            <Text style={[styles.pillText, { color: capture.color }]}>{captureLabel}</Text>
          </View>
          {!preview ? (
            <View style={[styles.pill, { backgroundColor: tone.bg }]}>
              <View style={[styles.pillDot, { backgroundColor: tone.color }]} />
              <Text style={[styles.pillText, { color: tone.color }]}>{tone.label}</Text>
            </View>
          ) : null}
        </View>

        {preview ? (
          <Text style={[styles.snippet, { color: colors.tertiary }]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>

      <Icon name="chevron-right" size={18} color={colors.tertiary} variant="line" />
    </Pressable>
  );

  if (!onDelete) return card;

  return (
    <View style={[styles.shadowHost, { backgroundColor: colors.surface }, shadows.soft]}>
      <Swipeable
        ref={swipeRef}
        friction={2}
        overshootRight={false}
        rightThreshold={40}
        containerStyle={styles.swipeContainer}
        childrenContainerStyle={styles.swipeChildren}
        renderRightActions={() => (
          <View style={styles.deleteWrap}>
            <Pressable
              onPress={() => {
                swipeRef.current?.close();
                onDelete();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${session.title}`}
              style={({ pressed }) => [
                styles.deleteBtn,
                {
                  backgroundColor: colors.danger,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Icon name="trash-can-outline" size={22} color={colors.onBrand} variant="line" />
              <Text style={[styles.deleteLabel, { color: colors.onBrand }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      >
        {card}
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowHost: {
    borderRadius: radii.card,
    // Keep elevation/shadow outside Swipeable so Android/iOS match Continue cards.
  },
  swipeContainer: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  swipeChildren: {
    borderRadius: radii.card,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    borderRadius: radii.card,
    borderWidth: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 96,
  },
  body: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  meta: {
    ...typography.caption,
    fontWeight: '500',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  snippet: {
    ...typography.meta,
    fontSize: 13,
    marginTop: 2,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  deleteWrap: {
    width: 88,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  deleteBtn: {
    flex: 1,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 96,
  },
  deleteLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
