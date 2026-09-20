import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/src/theme';
import { mobileEnv, isSupabaseConfigured } from '@/src/lib/env';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.body}>
        Phase 1 foundation only. Sign-in, recording, and AI processing arrive in later phases.
      </Text>

      <View style={styles.block}>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.value}>{mobileEnv.apiBaseUrl}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Supabase</Text>
        <Text style={styles.value}>
          {isSupabaseConfigured()
            ? 'Public URL and anon key are set'
            : 'Not configured — see .env.example'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Auth</Text>
        <Text style={styles.value}>Coming in Phase 2</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  block: {
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    ...typography.body,
    color: colors.ink,
  },
});
