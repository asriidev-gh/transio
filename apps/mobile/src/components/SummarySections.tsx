import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SummaryRecord } from '@sessionai/shared';
import { colors, spacing, typography } from '@/src/theme';

interface SummarySectionsProps {
  summary: SummaryRecord;
}

export function SummarySections({ summary }: SummarySectionsProps) {
  return (
    <View style={styles.wrap} accessibilityLabel="AI summary sections">
      <Section title="Overview">
        <Text style={styles.body} selectable>
          {summary.overview?.trim() || 'No overview available.'}
        </Text>
      </Section>

      <Section title="Key points">
        <BulletList items={summary.keyPoints} empty="No key points captured." />
      </Section>

      <Section title="Topics">
        {summary.topics.length === 0 ? (
          <Text style={styles.muted}>No topics captured.</Text>
        ) : (
          summary.topics.map((topic, index) => (
            <View key={`${topic.title}-${index}`} style={styles.topic}>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              <Text style={styles.body} selectable>
                {topic.summary}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Questions discussed">
        <BulletList items={summary.questionsDiscussed} empty="No questions captured." />
      </Section>

      <Section title="Action items">
        {summary.actionItems.length === 0 ? (
          <Text style={styles.muted}>No action items captured.</Text>
        ) : (
          summary.actionItems.map((item, index) => (
            <View key={`${item.task}-${index}`} style={styles.actionItem}>
              <Text style={styles.body} selectable>
                • {item.task}
              </Text>
              {item.details ? <Text style={styles.muted}>{item.details}</Text> : null}
            </View>
          ))
        )}
      </Section>

      <Section title="Important insights">
        <BulletList items={summary.importantInsights} empty="No insights captured." />
      </Section>

      {summary.quotes.length > 0 ? (
        <Section title="Quotes">
          {summary.quotes.map((quote, index) => (
            <Text key={`${quote}-${index}`} style={styles.quote} selectable>
              “{quote}”
            </Text>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <Text style={styles.muted}>{empty}</Text>;
  }
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.body} selectable>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.sm,
  },
  heading: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brandSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 13,
  },
  body: {
    ...typography.body,
    color: colors.ink,
  },
  muted: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  list: {
    gap: spacing.xs,
  },
  topic: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  topicTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  actionItem: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  quote: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
});
