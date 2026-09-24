import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { colors, shadows } = useTheme();
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
  // Some Android/signed-URL loads report duration before isLoaded flips true.
  const effectivelyLoaded = status.isLoaded || duration > 0;
  const loading = !error && (!ready || !effectivelyLoaded);
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
    if (effectivelyLoaded || error) return;
    const timeoutMs = remote ? 90_000 : 20_000;
    const timeout = setTimeout(() => {
      if (!status.isLoaded && !(status.duration > 0)) {
        setError('Audio took too long to load. The file may be missing or unreadable.');
      }
    }, timeoutMs);
    return () => clearTimeout(timeout);
  }, [effectivelyLoaded, error, reloadKey, uri, remote, status.isLoaded, status.duration]);

  // Clear a stale timeout error once the player becomes usable.
  useEffect(() => {
    if (!effectivelyLoaded) return;
    setError((prev) =>
      prev && prev.includes('took too long') ? null : prev,
    );
  }, [effectivelyLoaded]);

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
      if (!effectivelyLoaded) {
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
    [duration, effectivelyLoaded, player, showSeekHint],
  );

  useEffect(() => {
    if (!seekRequest) return;
    if (lastSeekIdRef.current === seekRequest.id) return;
    if (!effectivelyLoaded) return;

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
  }, [effectivelyLoaded, player, seekRequest, seekToSeconds, status.playing]);

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

  function renderSkip(delta: -15 | 15) {
    const back = delta < 0;
    return (
      <Pressable
        onPress={() => void seekBy(delta)}
        style={({ pressed }) => [
          styles.skipBtn,
          dock ? styles.skipBtnDock : null,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            opacity: controlsDisabled ? 0.45 : pressed ? 0.9 : 1,
          },
          shadows.soft,
        ]}
        accessibilityRole="button"
        accessibilityLabel={back ? 'Seek back 15 seconds' : 'Seek forward 15 seconds'}
        disabled={controlsDisabled}
        hitSlop={dock ? 8 : undefined}
      >
        {back ? <Icon name="rewind-15" size={dock ? 15 : 16} color={colors.ink} variant="line" /> : null}
        <Text style={[styles.skipLabel, { color: colors.ink }]}>15</Text>
        {!back ? <Icon name="forward-15" size={dock ? 15 : 16} color={colors.ink} variant="line" /> : null}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        dock ? styles.dock : null,
        {
          borderColor: colors.glassBorder,
          backgroundColor: dock ? colors.glass : colors.surface,
        },
      ]}
      accessibilityLabel={title ? `Audio player for ${title}` : 'Audio player'}
    >
      {!dock ? (
        <Text style={[styles.heading, { color: colors.ink }]}>Recording</Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.inkMuted }]}>Loading audio…</Text>
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

      <View style={styles.compactRow}>
        <Pressable
          onPress={() => void togglePlay()}
          style={[
            styles.playBtn,
            { backgroundColor: colors.accent },
            controlsDisabled && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          disabled={controlsDisabled}
        >
          <Icon name={status.playing ? 'pause' : 'play'} size={22} color={colors.onBrand} variant="line" />
        </Pressable>

        <Text style={[styles.time, { color: colors.inkMuted }]}>{formatDuration(position)}</Text>

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
          <View style={[styles.trackBackground, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: colors.accent, width: `${progress * 100}%` },
              ]}
            />
            <View
              style={[
                styles.thumb,
                {
                  backgroundColor: colors.accent,
                  left: `${Math.max(0, Math.min(100, progress * 100))}%`,
                },
              ]}
            />
          </View>
        </Pressable>

        <Text style={[styles.time, { color: colors.inkMuted }]}>{formatDuration(duration)}</Text>

        <Pressable
          onPress={cycleSpeed}
          style={[styles.speed, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${speed}x`}
        >
          <Text style={[styles.speedText, { color: colors.ink }]}>
            {speed.toFixed(2).replace(/\.00$/, '')}x
          </Text>
        </Pressable>
      </View>

      {(error || seekHint) && statusLabel ? (
        <Text style={[styles.status, { color: colors.danger }]}>{statusLabel}</Text>
      ) : null}

      <View style={dock ? styles.dockExtras : styles.controls}>
        {renderSkip(-15)}
        {renderSkip(15)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    ...Platform.select({
      web: { backdropFilter: 'blur(16px)' } as object,
      default: {},
    }),
  },
  dock: {
    borderRadius: radii.xl,
    paddingVertical: spacing.smd,
  },
  heading: {
    ...typography.body,
    fontWeight: '600',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speed: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  speedText: {
    ...typography.caption,
    fontWeight: '700',
  },
  status: {
    ...typography.caption,
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
    flex: 1,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'visible',
    justifyContent: 'center',
  },
  trackFill: {
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    top: -4,
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  dockExtras: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 76,
    minHeight: 36,
  },
  skipBtnDock: {
    minWidth: 72,
    minHeight: 34,
    paddingVertical: 6,
  },
  skipLabel: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.45,
  },
});
