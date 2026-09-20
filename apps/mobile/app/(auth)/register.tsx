import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing, typography } from '@/src/theme';

/**
 * Placeholder register route for navigation wiring.
 * Real registration is implemented in Phase 2.
 */
export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SessionAI</Text>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.body}>
        Registration arrives in Phase 2 with Supabase Auth email/password support.
      </Text>
      <Link href="/(auth)/login" style={styles.link}>
        Back to Sign In
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  brand: {
    ...typography.brand,
    fontSize: 28,
    color: colors.brand,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkMuted,
  },
  link: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 16,
  },
});
