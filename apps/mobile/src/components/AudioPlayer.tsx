import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
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

const SPEEDS = [1, 1.25, 1.5, 2] as const;

function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

export function AudioPlayer({
  uri,
  title,
  variant = 'card',
  onProgress,
  seekRequest,
}: AudioPlayerProps) {
  const { colors } = useTheme();
  const remote = isRemoteUri(uri);
  // downloadFirst makes remote signed URLs reliably seekable (full file, not range stream).
  const player = useAudioPlayer({ uri }, { updateInterval: 250, downloadFirst: remote });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);
  const [seekHint, setSeekHint] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const trackWidthRef = useRef(0);
  const lastSeekIdRef = useRef<number | null>(null);
  const seekHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dock = variant === 'dock';

  const duration = status.duration > 0 ? status.duration : 0;
  const position = status.currentTime > 0 ? status.currentTime : 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loading = !error && (!ready || !status.isLoaded);
  const speed = SPEEDS[speedIndex];
  const controlsDisabled = Boolean(error) || loading;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    setSeekHint(null);

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
    const timeoutMs = remote ? 45000 : 12000;
    const timeout = setTimeout(() => {
      if (!status.isLoaded) {
        setError('Audio took too long to load. The file may be missing or unreadable.');
      }
    }, timeoutMs);
    return () => clearTimeout(timeout);
  }, [status.isLoaded, error, reloadKey, uri, remote]);

  useEffect(() => {
    const state = (status.playbackState || '').toLowerCase();
    if (state.includes('error') || state.includes('failed')) {
      setError('Playback failed. The recording may be unavailable.');
    }
  }, [status.playbackState]);

  useEffect(() => {
    try {
      const maybePlayer = player as { setPlaybackRate?: (rate: number) => void };
      maybePlayer.setPlaybackRate?.(SPEEDS[speedIndex]);
    } catch {
      // Some platforms may not support rate changes.
    }
  }, [player, speedIndex]);

  useEffect(() => {
    return () => {
      if (seekHintTimerRef.current) clearTimeout(seekHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    onProgress?.(position);
  }, [onProgress, position]);

  const showSeekHint = useCallback((message: string) => {
    setSeekHint(message);
    if (seekHintTimerRef.current) clearTimeout(seekHintTimerRef.current);
    seekHintTimerRef.current = setTimeout(() => setSeekHint(null), 2800);
  }, []);

  const seekToSeconds = useCallback(
    async (seconds: number): Promise<boolean> => {
      if (!status.isLoaded) {
        showSeekHint('Audio is still loading — try again in a moment.');
        return false;
      }

      const target =
        duration > 0 ? Math.max(0, Math.min(duration, seconds)) : Math.max(0, seconds);

      try {
        const result = player.seekTo(target) as void | Promise<void>;
        if (result && typeof (result as Promise<void>).then === 'function') {
          await result;
        }
        setSeekHint(null);
        return true;
      } catch {
        try {
          const writable = player as { currentTime?: number };
          if (typeof writable.currentTime === 'number') {
            writable.currentTime = target;
            setSeekHint(null);
            return true;
          }
        } catch {
          // fall through
        }
        showSeekHint('Could not seek in this recording.');
        return false;
      }
    },
    [duration, player, showSeekHint, status.isLoaded],
  );

  useEffect(() => {
    if (!seekRequest) return;
    if (lastSeekIdRef.current === seekRequest.id) return;
    if (!status.isLoaded) return;

    lastSeekIdRef.current = seekRequest.id;
    void (async () => {
      const ok = await seekToSeconds(seekRequest.sec);
      if (!ok) return;
      if (!status.playing) {
        try {
          player.play();
        } catch {
          // Autoplay may be blocked; seek still succeeded.
        }
      }
    })();
  }, [player, seekRequest, seekToSeconds, status.isLoaded, status.playing]);

  const statusLabel = useMemo(() => {
    if (error) return error;
    if (seekHint) return seekHint;
    if (loading) return remote ? 'Loading audio (preparing seek)…' : 'Loading audio…';
    if (status.playing) return 'Playing';
    return 'Paused';
  }, [error, loading, remote, seekHint, status.playing]);

  async function togglePlay() {
    setError(null);
    setSeekHint(null);
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (duration > 0 && position >= duration - 0.25) {
        await seekToSeconds(0);
      }
      player.play();
    } catch {
      setError('Playback failed. The recording may be unavailable.');
    }
  }

  async function seekBy(deltaSeconds: number) {
    await seekToSeconds(position + deltaSeconds);
  }

  async function seekToRatio(ratio: number) {
    if (duration <= 0) return;
    await seekToSeconds(duration * ratio);
  }

  function onRetryLoad() {
    setError(null);
    setSeekHint(null);
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
      style={[
        styles.container,
        {
          borderColor: dock ? colors.border : colors.border,
          backgroundColor: dock ? colors.player : colors.surface,
        },
      ]}
      accessibilityLabel={title ? `Audio player for ${title}` : 'Audio player'}
    >
      {!dock ? (
        <Text style={[styles.heading, { color: colors.ink }]}>Recording</Text>
      ) : null}
      <View style={styles.topRow}>
        <Pressable
          onPress={cycleSpeed}
          style={[styles.speed, { borderColor: dock ? 'rgba(232,240,242,0.25)' : colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${speed}x`}
        >
          <Text style={[styles.speedText, { color: dock ? colors.playerText : colors.ink }]}>
            {speed.toFixed(2).replace(/\.00$/, '.0')}x
          </Text>
        </Pressable>
        <Text
          style={[
            styles.status,
            { color: error || seekHint ? colors.danger : dock ? colors.playerMuted : colors.inkMuted },
          ]}
        >
          {statusLabel}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, { color: dock ? colors.playerMuted : colors.inkMuted }]}>
            Loading…
          </Text>
        </View>
      ) : null}

      {error ? (
        <Pressable
          onPress={onRetryLoad}
          style={[styles.retry, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Retry loading audio"
        >
          <Text style={[styles.retryText, { color: colors.onBrand }]}>Retry playback</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.track}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        onPress={(event) => {
          const width = trackWidthRef.current;
          if (width <= 0 || duration <= 0 || controlsDisabled) return;
          const locationX = event.nativeEvent.locationX;
          void seekToRatio(Math.max(0, Math.min(1, locationX / width)));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
      >
        <View
          style={[
            styles.trackBackground,
            { backgroundColor: dock ? 'rgba(255,255,255,0.18)' : colors.backgroundAlt },
          ]}
        >
          <View
            style={[
              styles.trackFill,
              { backgroundColor: colors.accent, width: `${progress * 100}%` },
            ]}
          />
        </View>
      </Pressable>

      <View style={styles.times}>
        <Text
          style={[styles.time, { color: dock ? colors.playerMuted : colors.inkMuted }]}
        >
          {formatDuration(position)}
        </Text>
        <Text
          style={[styles.time, { color: dock ? colors.playerMuted : colors.inkMuted }]}
        >
          {formatDuration(duration)}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => void seekBy(-15)}
          style={[
            styles.secondary,
            { borderColor: dock ? 'rgba(232,240,242,0.28)' : colors.border },
            controlsDisabled && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Seek back 15 seconds"
          disabled={controlsDisabled}
        >
          <Text style={[styles.secondaryText, { color: dock ? colors.playerText : colors.ink }]}>
            −15s
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void togglePlay()}
          style={[
            styles.primary,
            { backgroundColor: colors.accent },
            controlsDisabled && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          disabled={controlsDisabled}
        >
          <Icon name={status.playing ? 'pause' : 'play'} size={28} />
        </Pressable>

        <Pressable
          onPress={() => void seekBy(15)}
          style={[
            styles.secondary,
            { borderColor: dock ? 'rgba(232,240,242,0.28)' : colors.border },
            controlsDisabled && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Seek forward 15 seconds"
          disabled={controlsDisabled}
        >
          <Text style={[styles.secondaryText, { color: dock ? colors.playerText : colors.ink }]}>
            +15s
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    ...typography.body,
    fontWeight: '600',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  speed: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  speedText: {
    ...typography.caption,
    fontWeight: '700',
  },
  status: {
    ...typography.caption,
    flexShrink: 1,
    textAlign: 'right',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
  },
  retry: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  retryText: {
    fontWeight: '600',
  },
  track: {
    paddingVertical: spacing.xs,
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: 8,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 72,
    alignItems: 'center',
  },
  secondaryText: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});
