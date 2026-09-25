import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface SummarySectionsProps {
  summary: {
    overview: string | null;
    keyPoints: string[];
    topics: Array<{ title: string; summary: string }>;
    questionsDiscussed: string[];
    actionItems: Array<{ task: string; details?: string }>;
    importantInsights: string[];
    quotes: string[];
  };
}

export function SummarySections({ summary }: SummarySectionsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap} accessibilityLabel="AI Summary sections">
      <Section title="Overview" colors={colors}>
        <Text style={[styles.body, { color: colors.ink }]} selectable>
          {summary.overview?.trim() || 'No overview available.'}
        </Text>
      </Section>

      <Section title="Key points" colors={colors}>
        <BulletList items={summary.keyPoints} empty="No key points captured." colors={colors} />
      </Section>

      <Section title="Topics" colors={colors}>
        {summary.topics.length === 0 ? (
          <Text style={[styles.muted, { color: colors.inkMuted }]}>No topics captured.</Text>
        ) : (
          summary.topics.map((topic, index) => (
            <View key={`${topic.title}-${index}`} style={styles.topic}>
              <Text style={[styles.topicTitle, { color: colors.ink }]}>{topic.title}</Text>
              <Text style={[styles.body, { color: colors.ink }]} selectable>
                {topic.summary}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Questions discussed" colors={colors}>
        <BulletList
          items={summary.questionsDiscussed}
          empty="No questions captured."
          colors={colors}
        />
      </Section>

      <Section title="Action items" colors={colors}>
        {summary.actionItems.length === 0 ? (
          <Text style={[styles.muted, { color: colors.inkMuted }]}>No action items captured.</Text>
        ) : (
          summary.actionItems.map((item, index) => (
            <View key={`${item.task}-${index}`} style={styles.actionItem}>
              <Text style={[styles.body, { color: colors.ink }]} selectable>
                • {item.task}
              </Text>
              {item.details ? (
                <Text style={[styles.muted, { color: colors.inkMuted }]}>{item.details}</Text>
              ) : null}
            </View>
          ))
        )}
      </Section>

      <Section title="Important insights" colors={colors}>
        <BulletList
          items={summary.importantInsights}
          empty="No insights captured."
          colors={colors}
        />
      </Section>

      {summary.quotes.length > 0 ? (
        <Section title="Quotes" colors={colors}>
          {summary.quotes.map((quote, index) => (
            <Text
              key={`${quote}-${index}`}
              style={[styles.quote, { color: colors.ink }]}
              selectable
            >
              “{quote}”
            </Text>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: ReactNode;
  colors: { accentDeep: string };
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.accentDeep }]}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({
  items,
  empty,
  colors,
}: {
  items: string[];
  empty: string;
  colors: { ink: string; inkMuted: string };
}) {
  if (items.length === 0) {
    return <Text style={[styles.muted, { color: colors.inkMuted }]}>{empty}</Text>;
  }
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={[styles.body, { color: colors.ink }]} selectable>
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
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 13,
  },
  body: {
    ...typography.body,
  },
  muted: {
    ...typography.caption,
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
  },
  actionItem: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  quote: {
    ...typography.body,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
});
