import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/** Inside this many days the notice starts warning rather than just informing. */
const SOON_DAYS = 7;

interface AudioRetentionNoticeProps {
  /** ISO date the stored audio may be deleted. */
  expiresAt: string;
  onDownload: () => void;
  downloading?: boolean;
}

function daysUntil(iso: string, now = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / (24 * 60 * 60 * 1000));
}

function describe(days: number): string {
  if (days <= 0) return 'Audio is being removed';
  if (days === 1) return 'Audio is removed tomorrow';
  return `Audio is removed in ${days} days`;
}

/**
 * Says when a recording stops being kept, and offers a copy before it goes.
 *
 * Only the audio expires — notes, transcripts and summaries stay in the account —
 * so the copy says so, otherwise it reads as though the whole session is going.
 */
export function AudioRetentionNotice({
  expiresAt,
  onDownload,
  downloading = false,
}: AudioRetentionNoticeProps) {
  const { colors } = useTheme();
  const days = daysUntil(expiresAt);
  const soon = days <= SOON_DAYS;
  const accent = soon ? colors.warning : colors.inkMuted;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: soon ? colors.surface : 'transparent',
          borderColor: soon ? colors.warning + '55' : colors.border,
        },
      ]}
    >
      <Icon name="download-outline" size={16} color={accent} variant="line" />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: soon ? colors.ink : colors.inkMuted }]}>
          {describe(days)}
        </Text>
        <Text style={[styles.detail, { color: colors.inkMuted }]}>
          Your notes, transcript and summary are kept. Subscribe to keep the audio too.
        </Text>
      </View>
      <Pressable
        onPress={onDownload}
        disabled={downloading}
        accessibilityRole="button"
        accessibilityLabel="Download audio"
        style={({ pressed }) => [styles.action, { opacity: pressed || downloading ? 0.6 : 1 }]}
      >
        <Text style={[styles.actionText, { color: colors.brand }]}>
          {downloading ? 'Opening…' : 'Download'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.smd,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
  },
  detail: {
    ...typography.caption,
    lineHeight: 16,
  },
  action: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
