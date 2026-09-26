import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRevealFocusedField } from '@/src/components/KeyboardSafeScrollView';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface PaperNotesViewProps {
  bullets: string[];
  /** Trailing in-progress phrase (live captions interim). */
  interim?: string;
  emptyLabel?: string;
  compact?: boolean;
  /** Show edit control on the pad (top-right). */
  editable?: boolean;
  editing?: boolean;
  onEditPress?: () => void;
  onChangeBullets?: (next: string[]) => void;
  onDoneEditing?: () => void;
  onCancelEditing?: () => void;
  saving?: boolean;
}

const ROW_LINE_HEIGHT = 22;
const ROW_PAD_Y = 7;

/**
 * Paper-like note sheet: one bullet per sentence / caption final.
 * Ruling sits under each row (not through wrapped mid-lines).
 */
export function PaperNotesView({
  bullets,
  interim,
  emptyLabel = 'Speak to see notes…',
  compact = false,
  editable = false,
  editing = false,
  onEditPress,
  onChangeBullets,
  onDoneEditing,
  onCancelEditing,
  saving = false,
}: PaperNotesViewProps) {
  const { colors, scheme } = useTheme();
  const revealFocusedField = useRevealFocusedField();
  const paperBg = scheme === 'dark' ? colors.surfaceAlt : '#FFFEF9';
  const rule = scheme === 'dark' ? colors.border : '#E4DDD2';
  const margin = scheme === 'dark' ? colors.accent : '#C45C4A';
  const hasContent = bullets.length > 0 || Boolean(interim?.trim()) || editing;

  function updateLine(index: number, value: string) {
    if (!onChangeBullets) return;
    const next = [...bullets];
    next[index] = value;
    onChangeBullets(next);
  }

  function removeLine(index: number) {
    if (!onChangeBullets) return;
    onChangeBullets(bullets.filter((_, i) => i !== index));
  }

  function addLine() {
    if (!onChangeBullets) return;
    onChangeBullets([...bullets, '']);
  }

  return (
    <View
      style={[
        styles.sheet,
        compact && styles.sheetCompact,
        {
          backgroundColor: paperBg,
          borderColor: rule,
          shadowColor: '#1A1A1A',
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel="Notes"
    >
      <View style={[styles.marginRule, { backgroundColor: margin }]} />
      <View style={styles.body}>
        {editable || editing ? (
          <View style={styles.padHeader}>
            {editing ? (
              <>
                <Text style={[styles.padLabel, { color: colors.inkMuted }]}>Editing</Text>
                <View style={styles.padActions}>
                  <Pressable
                    onPress={onCancelEditing}
                    disabled={saving}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing"
                    style={({ pressed }) => [
                      styles.padChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: pressed || saving ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.padChipText, { color: colors.ink }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={onDoneEditing}
                    disabled={saving}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Save notes"
                    style={({ pressed }) => [
                      styles.padChip,
                      {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.accent,
                        opacity: pressed || saving ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.padChipText, { color: colors.accent }]}>
                      {saving ? 'Saving…' : 'Done'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable
                onPress={onEditPress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Edit notes"
                style={({ pressed }) => [
                  styles.editBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                    marginLeft: 'auto',
                  },
                ]}
              >
                <Icon name="edit" size={16} color={colors.ink} variant="line" />
              </Pressable>
            )}
          </View>
        ) : null}

        {!hasContent ? (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>{emptyLabel}</Text>
        ) : editing ? (
          <>
            {bullets.map((line, index) => (
              <View
                key={`edit-${index}`}
                style={[styles.row, styles.rowEdit, { borderBottomColor: rule }]}
              >
                <Text style={[styles.bullet, { color: colors.inkMuted }]}>•</Text>
                <TextInput
                  value={line}
                  onChangeText={(text) => updateLine(index, text)}
                  onFocus={revealFocusedField}
                  onContentSizeChange={revealFocusedField}
                  multiline
                  style={[styles.lineInput, { color: colors.ink, borderColor: rule }]}
                  placeholder="Note line"
                  placeholderTextColor={colors.tertiary}
                  accessibilityLabel={`Note line ${index + 1}`}
                />
                <Pressable
                  onPress={() => removeLine(index)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove note line ${index + 1}`}
                  style={styles.removeHit}
                >
                  <Icon name="close" size={16} color={colors.inkMuted} variant="line" />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={addLine}
              accessibilityRole="button"
              accessibilityLabel="Add note line"
              style={({ pressed }) => [
                styles.addRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Icon name="plus" size={16} color={colors.accent} variant="line" />
              <Text style={[styles.addLabel, { color: colors.accent }]}>Add line</Text>
            </Pressable>
          </>
        ) : (
          <>
            {bullets.map((line, index) => (
              <View
                key={`${index}-${line.slice(0, 32)}`}
                style={[styles.row, { borderBottomColor: rule }]}
              >
                <Text style={[styles.bullet, { color: colors.inkMuted }]}>•</Text>
                <Text style={[styles.line, { color: colors.ink }]}>{line}</Text>
              </View>
            ))}
            {interim?.trim() ? (
              <View style={[styles.row, styles.rowInterim, { borderBottomColor: rule }]}>
                <Text style={[styles.bullet, { color: colors.inkMuted }]}>•</Text>
                <Text style={[styles.line, styles.interim, { color: colors.inkMuted }]}>
                  {interim.trim()}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 160,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sheetCompact: {
    minHeight: 120,
  },
  marginRule: {
    width: 2,
    marginLeft: spacing.md + 2,
    marginVertical: spacing.md,
    borderRadius: 1,
    opacity: 0.7,
  },
  body: {
    flex: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
  },
  padHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingRight: 2,
  },
  padLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  padActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  padChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  padChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: ROW_PAD_Y,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowEdit: {
    alignItems: 'center',
  },
  rowInterim: {
    borderBottomWidth: 0,
  },
  bullet: {
    fontSize: 15,
    lineHeight: ROW_LINE_HEIGHT,
    width: 14,
    textAlign: 'center',
    marginTop: 1,
  },
  line: {
    ...typography.body,
    flex: 1,
    fontSize: 15,
    lineHeight: ROW_LINE_HEIGHT,
  },
  lineInput: {
    ...typography.body,
    flex: 1,
    fontSize: 15,
    lineHeight: ROW_LINE_HEIGHT,
    minHeight: ROW_LINE_HEIGHT + 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
  },
  removeHit: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  addLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  interim: {
    fontStyle: 'italic',
  },
  empty: {
    ...typography.body,
    lineHeight: ROW_LINE_HEIGHT,
    paddingVertical: spacing.sm,
  },
});
