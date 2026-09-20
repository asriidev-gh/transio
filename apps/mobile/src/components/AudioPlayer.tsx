import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { colors, spacing, typography } from '@/src/theme';
import { formatDuration } from '@/src/utils/format';

interface AudioPlayerProps {
  uri: string;
  title?: string;
}

export function AudioPlayer({ uri, title }: AudioPlayerProps) {
  const player = useAudioPlayer({ uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const trackWidthRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to prepare audio playback.');
        }
      }
    }
    void prepare();
    return () => {
      cancelled = true;
      try {
        player.pause();
      } catch {
        // Player may already be released on unmount.
      }
    };
  }, [player, uri]);

  const duration = status.duration > 0 ? status.duration : 0;
  const position = status.currentTime > 0 ? status.currentTime : 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loading = !ready || (!status.isLoaded && !error);

  const statusLabel = useMemo(() => {
    if (error) return error;
    if (loading) return 'Loading audio…';
    if (status.playing) return 'Playing';
    return 'Paused';
  }, [error, loading, status.playing]);

  async function togglePlay() {
    setError(null);
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (duration > 0 && position >= duration - 0.25) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setError('Playback failed. The local recording may be unavailable.');
    }
  }

  async function seekBy(deltaSeconds: number) {
    try {
      const next = Math.max(0, Math.min(duration, position + deltaSeconds));
      await player.seekTo(next);
    } catch {
      setError('Could not seek in this recording.');
    }
  }

  async function seekToRatio(ratio: number) {
    if (duration <= 0) return;
    try {
      await player.seekTo(Math.max(0, Math.min(duration, duration * ratio)));
    } catch {
      setError('Could not seek in this recording.');
    }
  }

  return (
    <View
      style={styles.container}
      accessibilityLabel={title ? `Audio player for ${title}` : 'Audio player'}
    >
      <Text style={styles.heading}>Recording</Text>
      <Text style={styles.status}>{statusLabel}</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.track}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        onPress={(event) => {
          const width = trackWidthRef.current;
          if (width <= 0 || duration <= 0) return;
          const locationX = event.nativeEvent.locationX;
          void seekToRatio(Math.max(0, Math.min(1, locationX / width)));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
      >
        <View style={styles.trackBackground}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
      </Pressable>

      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(position)}</Text>
        <Text style={styles.time}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => void seekBy(-10)}
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel="Seek back 10 seconds"
          disabled={Boolean(error) || loading}
        >
          <Text style={styles.secondaryText}>-10s</Text>
        </Pressable>

        <Pressable
          onPress={() => void togglePlay()}
          style={[styles.primary, (loading || Boolean(error)) && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          disabled={Boolean(error) || loading}
        >
          <Text style={styles.primaryText}>{status.playing ? 'Pause' : 'Play'}</Text>
        </Pressable>

        <Pressable
          onPress={() => void seekBy(10)}
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel="Seek forward 10 seconds"
          disabled={Boolean(error) || loading}
        >
          <Text style={styles.secondaryText}>+10s</Text>
        </Pressable>
      </View>
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
  heading: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  status: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  track: {
    paddingVertical: spacing.xs,
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  trackFill: {
    height: 8,
    backgroundColor: colors.brand,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    color: colors.inkMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primary: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});
