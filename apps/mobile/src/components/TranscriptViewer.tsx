import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/src/theme';

interface TranscriptViewerProps {
  text: string;
  language?: string | null;
}

export function TranscriptViewer({ text, language }: TranscriptViewerProps) {
  return (
    <View style={styles.wrap}>
      {language ? <Text style={styles.language}>Language: {language}</Text> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        accessibilityLabel="Transcript text"
      >
        <Text style={styles.text} selectable>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: spacing.sm,
  },
  language: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  text: {
    fontSize: 17,
    lineHeight: 28,
    color: colors.ink,
  },
});
