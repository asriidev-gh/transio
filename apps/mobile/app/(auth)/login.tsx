import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing, typography } from '@/src/theme';

/**
 * Placeholder login route for navigation wiring.
 * Real email/password auth is implemented in Phase 2.
 */
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SessionAI</Text>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.body}>
        Authentication is not enabled yet. Phase 2 will add email/password sign-in with persistent
        sessions.
      </Text>
      <Link href="/(auth)/register" style={styles.link}>
        Create Account
      </Link>
      <Link href="/(app)" style={styles.link}>
        Continue to app (Phase 1)
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
