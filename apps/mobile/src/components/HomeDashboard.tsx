import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CAPTURE_MODE_SHORT_LABELS,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { captureModeVisual } from '@/src/utils/capture-mode-visual';
import { formatDurationHuman, formatRelativeSessionDate } from '@/src/utils/format';

interface InsightStatProps {
  label: string;
  value: string;
  icon: AppIconName;
  tint: string;
  accent?: string;
  onPress?: () => void;
}

/** Compact metric tile for the home insights row. */
export function InsightStat({ label, value, icon, tint, accent, onPress }: InsightStatProps) {
  const { colors, shadows } = useTheme();
  const accentColor = accent ?? colors.accent;

  const body = (
    <>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: tint }]}>
          <Icon name={icon} size={20} variant="line" color={accentColor} />
        </View>
      </View>
      <Text style={[styles.statValue, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
    </>
  );

  const shellStyle = [
    styles.stat,
    { backgroundColor: colors.surface },
    shadows.soft,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...shellStyle,
          {
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint="Opens details"
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={shellStyle} accessibilityLabel={`${label}: ${value}`}>
      {body}
    </View>
  );
}

interface ActionCardProps {
  label: string;
  hint: string;
  icon: AppIconName;
  tint: string;
  onPress: () => void;
}

/** Primary capture action on the home dashboard. */
export function HomeActionCard({ label, hint, icon, tint, onPress }: ActionCardProps) {
  const { colors, shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
        shadows.soft,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={28} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.actionHint, { color: colors.inkMuted }]} numberOfLines={2}>
        {hint}
      </Text>
    </Pressable>
  );
}

interface InsightSessionCardProps {
  session: Session;
  onPress: () => void;
  width?: number;
}

/** Larger session card for the home continue carousel. */
export function InsightSessionCard({ session, onPress, width = 200 }: InsightSessionCardProps) {
  const { colors, scheme, shadows } = useTheme();
  const captureMode = session.captureMode ?? 'batch';
  const visual = captureModeVisual(captureMode);
  const markColor = session.status === 'failed'
    ? colors.actionRecord
    : scheme === 'dark'
      ? visual.dark
      : visual.light;
  const markIconColor = session.status === 'failed' ? colors.danger : colors[visual.colorKey];
  const preview = session.description?.trim();
  const statusLabel = SESSION_STATUS_LABELS[session.status];
  const captureLabel = CAPTURE_MODE_SHORT_LABELS[captureMode];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionCard,
        {
          width,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
        shadows.soft,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${captureLabel}, ${SESSION_TYPE_LABELS[session.sessionType]}`}
    >
      <View style={[styles.sessionMark, { backgroundColor: markColor }]}>
        <Icon name={visual.icon} size={28} color={markIconColor} variant="line" />
      </View>
      <Text style={[styles.sessionTitle, { color: colors.ink }]} numberOfLines={2}>
        {session.title}
      </Text>
      <Text style={[styles.sessionMeta, { color: colors.inkMuted }]} numberOfLines={1}>
        {formatRelativeSessionDate(session.recordedAt)} · {formatDurationHuman(session.durationSeconds)}
      </Text>
      <Text style={[styles.sessionType, { color: colors.tertiary }]} numberOfLines={1}>
        {captureLabel} · {SESSION_TYPE_LABELS[session.sessionType]}
      </Text>
      <Text
        style={[
          styles.sessionSnippet,
          {
            color:
              session.status === 'completed'
                ? colors.inkMuted
                : session.status === 'failed'
                  ? colors.danger
                  : colors.accent,
          },
        ]}
        numberOfLines={2}
      >
        {preview
          ? preview
          : session.status === 'completed'
            ? 'Ready to review'
            : statusLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stat: {
    width: '47%',
    flexGrow: 1,
    minWidth: 148,
    borderWidth: 0,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: 4,
    overflow: 'hidden',
    minHeight: 118,
  },
  statTop: {
    marginBottom: spacing.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  statLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  statAccent: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    opacity: 0.85,
  },
  action: {
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 120,
    maxHeight: 160,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.section,
  },
  actionHint: {
    ...typography.meta,
  },
  sessionCard: {
    borderWidth: 0,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    flexShrink: 0,
  },
  sessionMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    minHeight: 40,
  },
  sessionMeta: {
    ...typography.caption,
  },
  sessionType: {
    ...typography.caption,
  },
  sessionSnippet: {
    ...typography.meta,
    marginTop: spacing.xs,
  },
});
