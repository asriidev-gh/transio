import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SummaryRecord } from '@sessionai/shared';
import { colors, radii, spacing, typography } from '@/src/theme';

interface ActionItemsPanelProps {
  sessionId: string;
  actionItems: SummaryRecord['actionItems'];
}

function storageKey(sessionId: string): string {
  return `sessionai:action-checks:${sessionId}`;
}

export function ActionItemsPanel({ sessionId, actionItems }: ActionItemsPanelProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(sessionId));
        if (!cancelled && raw) {
          setChecked(JSON.parse(raw) as Record<number, boolean>);
        }
      } catch {
        // ignore corrupt local state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const toggle = useCallback(
    async (index: number) => {
      setChecked((prev) => {
        const next = { ...prev, [index]: !prev[index] };
        void AsyncStorage.setItem(storageKey(sessionId), JSON.stringify(next));
        return next;
      });
    },
    [sessionId],
  );

  if (actionItems.length === 0) {
    return (
      <Text style={styles.empty}>
        No action items in this summary yet. Re-run processing after a longer discussion to extract
        tasks.
      </Text>
    );
  }

  const doneCount = actionItems.reduce((n, _item, i) => n + (checked[i] ? 1 : 0), 0);

  return (
    <View style={styles.wrap} accessibilityLabel="Action items">
      <Text style={styles.progress}>
        {doneCount} of {actionItems.length} done
      </Text>
      {actionItems.map((item, index) => {
        const isChecked = Boolean(checked[index]);
        return (
          <Pressable
            key={`${item.task}-${index}`}
            onPress={() => void toggle(index)}
            style={[styles.row, isChecked && styles.rowDone]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
            accessibilityLabel={item.task}
          >
            <View style={[styles.box, isChecked && styles.boxChecked]}>
              {isChecked ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <View style={styles.body}>
              <Text style={[styles.task, isChecked && styles.taskDone]}>{item.task}</Text>
              {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  progress: {
    ...typography.caption,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.inkMuted,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  rowDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  check: {
    color: colors.onBrand,
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  task: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
  },
  taskDone: {
    textDecorationLine: 'line-through',
    color: colors.inkMuted,
  },
  details: {
    ...typography.caption,
    color: colors.inkMuted,
    fontFamily: undefined,
  },
});
