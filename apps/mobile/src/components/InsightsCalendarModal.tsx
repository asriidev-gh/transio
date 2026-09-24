import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const DRAWER_HEIGHT = Math.round(Dimensions.get('window').height * 0.9);

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

function DrawerChrome({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.drawer,
        shadows.float,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          height: DRAWER_HEIGHT,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
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
      {children}
    </View>
  );
}

interface InsightsCalendarModalProps {
  visible: boolean;
  sessions: Session[];
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
}

/** Bottom drawer calendar → pick a day → list recordings from that date. */
export function InsightsCalendarModal({
  visible,
  sessions,
  onClose,
  onOpenSession,
}: InsightsCalendarModalProps) {
  const { colors } = useTheme();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);
  const [calendarOpen, setCalendarOpen] = useState(true);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKey(sessionDay(session));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [sessions]);

  useEffect(() => {
    if (!visible) return;
    const newest = [...sessions].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )[0];
    if (newest) {
      const day = sessionDay(newest);
      setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
      setSelected(day);
    } else {
      setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
      setSelected(today);
    }
    setCalendarOpen(true);
  }, [visible, sessions, today]);

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

  const monthCaptureCount = useMemo(() => {
    let total = 0;
    for (const [key, count] of countsByDay) {
      const [y, m] = key.split('-').map(Number);
      if (y === cursor.getFullYear() && m === cursor.getMonth() + 1) {
        total += count;
      }
    }
    return total;
  }, [countsByDay, cursor]);

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

  function onPickDay(date: Date) {
    setSelected(date);
    const count = countsByDay.get(dayKey(date)) ?? 0;
    if (count > 0) {
      setCalendarOpen(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close calendar"
        />
        <DrawerChrome title="Recordings by date" onClose={onClose}>
          <View style={styles.calendarToggleRow}>
            <Pressable
              onPress={() => setCalendarOpen((open) => !open)}
              style={({ pressed }) => [
                styles.calendarToggle,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: calendarOpen }}
              accessibilityLabel={calendarOpen ? 'Hide calendar' : 'Show calendar'}
            >
              <Icon name="calendar" size={16} color={colors.accent} variant="line" />
              <Text style={[styles.calendarToggleLabel, { color: colors.ink }]}>
                {calendarOpen ? 'Hide calendar' : 'Show calendar'}
              </Text>
              <View style={calendarOpen ? styles.chevronUp : undefined}>
                <Icon name="chevron-right" size={16} color={colors.inkMuted} variant="line" />
              </View>
            </Pressable>
            {!calendarOpen && selected ? (
              <Text style={[styles.collapsedHint, { color: colors.inkMuted }]} numberOfLines={1}>
                {selectedLabel}
              </Text>
            ) : null}
          </View>

          {calendarOpen ? (
            <>
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
                <View style={styles.monthCenter}>
                  <Text style={[styles.monthLabel, { color: colors.ink }]}>
                    {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                  </Text>
                  <Text style={[styles.monthMeta, { color: colors.inkMuted }]}>
                    {monthCaptureCount === 0
                      ? 'No captures'
                      : monthCaptureCount === 1
                        ? '1 capture'
                        : `${monthCaptureCount} captures`}
                  </Text>
                </View>
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
                      onPress={() => onPickDay(date)}
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
                            styles.countBadge,
                            {
                              backgroundColor: isSelected ? colors.onBrand : colors.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              { color: isSelected ? colors.accent : colors.onBrand },
                            ]}
                          >
                            {count > 9 ? '9+' : String(count)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.countSpacer} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <View style={[styles.listHeader, { borderTopColor: colors.border }]}>
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
                {calendarOpen
                  ? 'Nothing recorded on this day. Pick a date with a count badge.'
                  : 'Nothing recorded on this day. Show the calendar to pick another date.'}
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
        </DrawerChrome>
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

/** Bottom drawer session list used by Captured / Favorites / Processing tiles. */
export function InsightsListModal({
  visible,
  title,
  emptyMessage,
  sessions,
  onClose,
  onOpenSession,
}: InsightsListModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <DrawerChrome title={title} onClose={onClose}>
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
        </DrawerChrome>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  drawer: {
    width: '100%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.xs,
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
  monthCenter: {
    alignItems: 'center',
    gap: 2,
  },
  monthLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  monthMeta: {
    ...typography.caption,
  },
  calendarToggleRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  calendarToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  collapsedHint: {
    ...typography.meta,
    paddingHorizontal: spacing.xs,
  },
  chevronUp: {
    transform: [{ rotate: '-90deg' }],
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
    gap: 1,
    paddingVertical: 2,
  },
  dayNum: {
    fontSize: 14,
  },
  countBadge: {
    minWidth: 16,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  countSpacer: {
    height: 14,
  },
  listHeader: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  listTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  listCount: {
    ...typography.meta,
  },
  list: {
    flex: 1,
    minHeight: 120,
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
