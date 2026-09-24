import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';
import type { LegalDocument } from '@/src/data/legal';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/** Shared scroll layout for About / Privacy / Terms. */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const { colors, shadows } = useTheme();
  const tabBarInset = useFloatingTabBarContentInset();

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.updated, { color: colors.inkMuted }]}>
        Last updated · {doc.updated}
      </Text>

      {doc.intro ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <Text style={[styles.intro, { color: colors.ink }]}>{doc.intro}</Text>
        </View>
      ) : null}

      {doc.sections.map((section) => (
        <View
          key={section.heading}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <Text style={[styles.heading, { color: colors.ink }]}>{section.heading}</Text>
          {section.paragraphs.map((p) => (
            <Text key={p.slice(0, 48)} style={[styles.body, { color: colors.inkMuted }]}>
              {p}
            </Text>
          ))}
          {section.bullets?.length ? (
            <View style={styles.bullets}>
              {section.bullets.map((b) => (
                <View key={b.slice(0, 48)} style={styles.bulletRow}>
                  <Text style={[styles.bulletMark, { color: colors.brand }]}>•</Text>
                  <Text style={[styles.bulletText, { color: colors.inkMuted }]}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  updated: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    ...typography.body,
    lineHeight: 24,
    fontWeight: '500',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  bullets: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletMark: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
