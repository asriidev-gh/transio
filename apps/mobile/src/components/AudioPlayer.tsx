import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { colors, radii, spacing, typography } from '@/src/theme';
import { formatDuration } from '@/src/utils/format';

interface AudioPlayerProps {
  uri: string;
  title?: string;
  /** Compact dark dock inspired by review apps; default is surface card. */
  variant?: 'card' | 'dock';
  /** Fires as playback position updates (seconds). */
  onProgress?: (currentTimeSec: number) => void;
  /** When set to a new id, seeks to `sec`. */
  seekRequest?: { id: number; sec: number } | null;
}

const LOAD_TIMEOUT_MS = 12000;
const SPEEDS = [1, 1.25, 1.5, 2] as const;

export function AudioPlayer({
  uri,
  title,
  variant = 'card',
  onProgress,
  seekRequest,
}: AudioPlayerProps) {
  const player = useAudioPlayer({ uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const trackWidthRef = useRef(0);
  const lastSeekIdRef = useRef<number | null>(null);
  const dock = variant === 'dock';

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    async function prepare() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
        if (!cancelled) {
          setReady(true);
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
  }, [player, uri, reloadKey]);

  useEffect(() => {
    if (status.isLoaded || error) return;
    const timeout = setTimeout(() => {
      if (!status.isLoaded) {
        setError('Audio took too long to load. The file may be missing or unreadable.');
      }
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [status.isLoaded, error, reloadKey, uri]);

  useEffect(() => {
    const state = (status.playbackState || '').toLowerCase();
    if (state.includes('error') || state.includes('failed')) {
      setError('Playback failed. The recording may be unavailable.');
    }
  }, [status.playbackState]);

  useEffect(() => {
    try {
      // expo-audio player rate API varies by platform; ignore if unavailable.
      const maybePlayer = player as { setPlaybackRate?: (rate: number) => void };
      maybePlayer.setPlaybackRate?.(SPEEDS[speedIndex]);
    } catch {
      // Some platforms may not support rate changes.
    }
  }, [player, speedIndex]);

  const duration = status.duration > 0 ? status.duration : 0;
  const position = status.currentTime > 0 ? status.currentTime : 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loading = !error && (!ready || !status.isLoaded);
  const speed = SPEEDS[speedIndex];

  useEffect(() => {
    onProgress?.(position);
  }, [onProgress, position]);

  useEffect(() => {
    if (!seekRequest) return;
    if (lastSeekIdRef.current === seekRequest.id) return;
    lastSeekIdRef.current = seekRequest.id;
    void (async () => {
      try {
        await player.seekTo(Math.max(0, seekRequest.sec));
        if (!status.playing) {
          player.play();
        }
      } catch {
        setError('Could not seek in this recording.');
      }
    })();
  }, [player, seekRequest, status.playing]);

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
      setError('Playback failed. The recording may be unavailable.');
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

  function onRetryLoad() {
    setError(null);
    setReady(false);
    setReloadKey((k) => k + 1);
    try {
      player.replace({ uri });
    } catch {
      setError('Could not reload this recording.');
    }
  }

  function cycleSpeed() {
    setSpeedIndex((i) => (i + 1) % SPEEDS.length);
  }

  return (
    <View
      style={[styles.container, dock && styles.containerDock]}
      accessibilityLabel={title ? `Audio player for ${title}` : 'Audio player'}
    >
      {!dock ? <Text style={styles.heading}>Recording</Text> : null}
      <View style={styles.topRow}>
        <Pressable
          onPress={cycleSpeed}
          style={[styles.speed, dock && styles.speedDock]}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${speed}x`}
        >
          <Text style={[styles.speedText, dock && styles.speedTextDock]}>{speed.toFixed(2).replace(/\.00$/, '.0')}x</Text>
        </Pressable>
        <Text style={[styles.status, dock && styles.statusDock, error ? styles.statusError : null]}>
          {statusLabel}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={dock ? colors.accent : colors.brand} />
          <Text style={[styles.loadingText, dock && styles.statusDock]}>Loading…</Text>
        </View>
      ) : null}

      {error ? (
        <Pressable
          onPress={onRetryLoad}
          style={[styles.retry, dock && styles.retryDock]}
          accessibilityRole="button"
          accessibilityLabel="Retry loading audio"
        >
          <Text style={[styles.retryText, dock && styles.retryTextDock]}>Retry playback</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.track}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        onPress={(event) => {
          const width = trackWidthRef.current;
          if (width <= 0 || duration <= 0 || error) return;
          const locationX = event.nativeEvent.locationX;
          void seekToRatio(Math.max(0, Math.min(1, locationX / width)));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
      >
        <View style={[styles.trackBackground, dock && styles.trackBackgroundDock]}>
          <View
            style={[
              styles.trackFill,
              dock && styles.trackFillDock,
              { width: `${progress * 100}%` },
            ]}
          />
        </View>
      </Pressable>

      <View style={styles.times}>
        <Text style={[styles.time, dock && styles.timeDock]}>{formatDuration(position)}</Text>
        <Text style={[styles.time, dock && styles.timeDock]}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => void seekBy(-15)}
          style={[styles.secondary, dock && styles.secondaryDock]}
          accessibilityRole="button"
          accessibilityLabel="Seek back 15 seconds"
          disabled={Boolean(error) || loading}
        >
          <Text style={[styles.secondaryText, dock && styles.secondaryTextDock]}>−15s</Text>
        </Pressable>

        <Pressable
          onPress={() => void togglePlay()}
          style={[
            styles.primary,
            dock && styles.primaryDock,
            (loading || Boolean(error)) && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          disabled={Boolean(error) || loading}
        >
          <Text style={[styles.primaryText, dock && styles.primaryTextDock]}>
            {status.playing ? 'Pause' : 'Play'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void seekBy(15)}
          style={[styles.secondary, dock && styles.secondaryDock]}
          accessibilityRole="button"
          accessibilityLabel="Seek forward 15 seconds"
          disabled={Boolean(error) || loading}
        >
          <Text style={[styles.secondaryText, dock && styles.secondaryTextDock]}>+15s</Text>
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
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  containerDock: {
    backgroundColor: colors.player,
    borderColor: colors.brandSoft,
  },
  heading: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  speed: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  speedDock: {
    borderColor: 'rgba(232,240,242,0.25)',
  },
  speedText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '700',
  },
  speedTextDock: {
    color: colors.playerText,
  },
  status: {
    ...typography.caption,
    color: colors.inkMuted,
    flexShrink: 1,
    textAlign: 'right',
  },
  statusDock: {
    color: colors.playerMuted,
  },
  statusError: {
    color: colors.danger,
    fontWeight: '600',
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
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  retryDock: {
    backgroundColor: colors.accent,
  },
  retryText: {
    color: colors.onBrand,
    fontWeight: '600',
  },
  retryTextDock: {
    color: colors.brand,
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
  trackBackgroundDock: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  trackFill: {
    height: 8,
    backgroundColor: colors.brand,
  },
  trackFillDock: {
    backgroundColor: colors.accent,
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
  timeDock: {
    color: colors.playerMuted,
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
    borderRadius: radii.sm,
    minWidth: 96,
    alignItems: 'center',
  },
  primaryDock: {
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.onBrand,
    fontWeight: '600',
  },
  primaryTextDock: {
    color: colors.brand,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  secondaryDock: {
    borderColor: 'rgba(232,240,242,0.28)',
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '600',
  },
  secondaryTextDock: {
    color: colors.playerText,
  },
  disabled: {
    opacity: 0.45,
  },
});
