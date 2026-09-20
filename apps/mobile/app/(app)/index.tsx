import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingState } from '@/src/components/LoadingState';
import { apiGet, ApiClientError } from '@/src/services/api';
import { getSupabaseConfigStatus } from '@/src/lib/supabase';
import { colors, spacing, typography } from '@/src/theme';

interface HealthData {
  status: string;
  service: string;
  version: string;
  supabaseConfigured: boolean;
}

export default function HomeScreen() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<HealthData>('/health');
      setHealth(data);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Could not reach the API. Start the backend with npm run api.';
      setError(message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const supabase = getSupabaseConfigStatus();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand} accessibilityRole="header">
            SessionAI
          </Text>
          <Text style={styles.tagline}>
            Record seminars and discussions. Transcribe. Summarize.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.ctaText}>Open Settings</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          <EmptyState
            title="No sessions yet."
            description="Record your first seminar or group discussion. Session capture arrives in Phase 3–4."
          />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Foundation status</Text>
          {loading ? (
            <LoadingState message="Checking API…" />
          ) : (
            <>
              <StatusRow
                label="API"
                value={health ? `${health.service} v${health.version}` : 'Offline'}
                ok={Boolean(health)}
              />
              <StatusRow
                label="Supabase (mobile)"
                value={
                  supabase.configured
                    ? `Configured (${supabase.urlHost})`
                    : 'Not configured — add EXPO_PUBLIC_SUPABASE_*'
                }
                ok={supabase.configured}
              />
              <StatusRow
                label="Supabase (API)"
                value={
                  health
                    ? health.supabaseConfigured
                      ? 'Configured'
                      : 'Not configured — add SUPABASE_* on API'
                    : 'Unknown'
                }
                ok={Boolean(health?.supabaseConfigured)}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                onPress={() => void loadHealth()}
                accessibilityRole="button"
                accessibilityLabel="Retry health check"
                style={styles.retry}
              >
                <Text style={styles.retryText}>Refresh status</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, ok ? styles.ok : styles.warn]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  brand: {
    ...typography.brand,
    color: colors.brand,
  },
  tagline: {
    ...typography.body,
    color: colors.inkMuted,
    maxWidth: 320,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    gap: spacing.md,
    flex: 1,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.ink,
  },
  statusCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusRow: {
    gap: 2,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  statusValue: {
    ...typography.body,
    fontSize: 14,
  },
  ok: {
    color: colors.success,
  },
  warn: {
    color: colors.accent,
  },
  errorText: {
    color: colors.danger,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  retryText: {
    color: colors.brandSoft,
    fontWeight: '600',
  },
});
