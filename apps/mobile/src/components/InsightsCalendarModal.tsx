import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Session } from '@sessionai/shared';
import { SessionCard } from '@/src/components/SessionCard';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sessionDay(session: Session): Date {
  return startOfDay(new Date(session.recordedAt));
}

interface InsightsCalendarModalProps {
  visible: boolean;
  sessions: Session[];
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
}

/** Month calendar → pick a day → list recordings from that date. */
export function InsightsCalendarModal({
  visible,
  sessions,
  onClose,
  onOpenSession,
}: InsightsCalendarModalProps) {
  const { colors, shadows } = useTheme();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKey(sessionDay(session));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [sessions]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: Array<Date | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) grid.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      grid.push(new Date(year, month, day));
    }
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [cursor]);

  const daySessions = useMemo(() => {
    if (!selected) return [];
    return sessions
      .filter((session) => sameDay(sessionDay(session), selected))
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [sessions, selected]);

  const selectedLabel = selected
    ? selected.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close calendar"
        />
        <View style={[styles.center, { pointerEvents: 'box-none' }]}>
          <View
            style={[
              styles.sheet,
              shadows.float,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.ink }]}>Recordings by date</Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon name="close" size={18} color={colors.inkMuted} />
              </Pressable>
            </View>

            <View style={styles.monthRow}>
              <Pressable
                onPress={() => shiftMonth(-1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={({ pressed }) => [
                  styles.navBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.flip}>
                  <Icon name="chevron-right" size={18} color={colors.ink} />
                </View>
              </Pressable>
              <Text style={[styles.monthLabel, { color: colors.ink }]}>
                {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={({ pressed }) => [
                  styles.navBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Icon name="chevron-right" size={18} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.weekdays}>
              {WEEKDAYS.map((label) => (
                <Text key={label} style={[styles.weekday, { color: colors.inkMuted }]}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }
                const key = dayKey(date);
                const count = countsByDay.get(key) ?? 0;
                const isSelected = selected ? sameDay(date, selected) : false;
                const isToday = sameDay(date, today);
                const hasRecordings = count > 0;

                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelected(date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${date.getDate()}${hasRecordings ? `, ${count} recordings` : ''}`}
                    style={({ pressed }) => [
                      styles.dayCell,
                      styles.dayBtn,
                      {
                        backgroundColor: isSelected
                          ? colors.accent
                          : hasRecordings
                            ? colors.accentSoft
                            : 'transparent',
                        borderColor: isToday && !isSelected ? colors.accent : 'transparent',
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        {
                          color: isSelected
                            ? colors.onBrand
                            : hasRecordings
                              ? colors.ink
                              : colors.inkMuted,
                          fontWeight: hasRecordings || isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {hasRecordings ? (
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: isSelected ? colors.onBrand : colors.accent },
                        ]}
                      />
                    ) : (
                      <View style={styles.dotSpacer} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.ink }]} numberOfLines={1}>
                {selectedLabel}
              </Text>
              <Text style={[styles.listCount, { color: colors.inkMuted }]}>
                {daySessions.length === 0
                  ? 'No recordings'
                  : daySessions.length === 1
                    ? '1 recording'
                    : `${daySessions.length} recordings`}
              </Text>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {daySessions.length === 0 ? (
                <Text style={[styles.empty, { color: colors.inkMuted }]}>
                  Nothing recorded on this day. Pick another date with a dot.
                </Text>
              ) : (
                daySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onPress={() => {
                      onClose();
                      onOpenSession(session.id);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface InsightsListModalProps {
  visible: boolean;
  title: string;
  emptyMessage: string;
  sessions: Session[];
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
}

/** Simple session list sheet used by Captured / Processing insight tiles. */
export function InsightsListModal({
  visible,
  title,
  emptyMessage,
  sessions,
  onClose,
  onOpenSession,
}: InsightsListModalProps) {
  const { colors, shadows } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[styles.center, { pointerEvents: 'box-none' }]}>
          <View
            style={[
              styles.sheet,
              styles.listSheet,
              shadows.float,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon name="close" size={18} color={colors.inkMuted} />
              </Pressable>
            </View>
            <Text style={[styles.listCount, { color: colors.inkMuted, paddingHorizontal: spacing.sm }]}>
              {sessions.length === 0
                ? 'None yet'
                : sessions.length === 1
                  ? '1 session'
                  : `${sessions.length} sessions`}
            </Text>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {sessions.length === 0 ? (
                <Text style={[styles.empty, { color: colors.inkMuted }]}>{emptyMessage}</Text>
              ) : (
                sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onPress={() => {
                      onClose();
                      onOpenSession(session.id);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  listSheet: {
    minHeight: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.section,
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  monthLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flip: {
    transform: [{ rotate: '180deg' }],
  },
  weekdays: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 2,
  },
  dayNum: {
    fontSize: 14,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotSpacer: {
    width: 4,
    height: 4,
  },
  listHeader: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  listTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  listCount: {
    ...typography.meta,
  },
  list: {
    maxHeight: 260,
  },
  listContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  empty: {
    ...typography.meta,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
