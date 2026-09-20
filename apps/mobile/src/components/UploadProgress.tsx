import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/src/theme';

interface UploadProgressProps {
  progress: number; // 0..1
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  onRetry?: () => void;
}

export function UploadProgress({ progress, status, message, onRetry }: UploadProgressProps) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <View style={styles.container} accessibilityLabel={`Upload ${status}`}>
      <Text style={styles.title}>
        {status === 'uploading'
          ? 'Uploading audio…'
          : status === 'success'
            ? 'Audio uploaded'
            : status === 'error'
              ? 'Upload failed'
              : 'Ready to upload'}
      </Text>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${status === 'success' ? 100 : pct}%`,
              backgroundColor: status === 'error' ? colors.danger : colors.brand,
            },
          ]}
        />
      </View>

      <View style={styles.row}>
        {status === 'uploading' ? <ActivityIndicator color={colors.brand} /> : null}
        <Text style={styles.meta}>
          {message ??
            (status === 'uploading'
              ? `${pct}%`
              : status === 'success'
                ? 'Saved privately in cloud storage'
                : status === 'error'
                  ? 'Your local recording is still safe'
                  : 'Waiting')}
        </Text>
      </View>

      {status === 'error' && onRetry ? (
        <Pressable
          onPress={onRetry}
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel="Retry upload"
        >
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.inkMuted,
    flex: 1,
  },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
