import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SessionFolder } from '@sessionai/shared';
import { ApiClientError } from '@/src/services/api';
import {
  DEFAULT_FOLDER_NAME,
  dedupeFoldersByName,
  ensureDefaultFolder,
  findFolderByName,
  isDefaultFolder,
} from '@/src/services/default-folder';
import { createFolder } from '@/src/services/folders';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface FolderPickerProps {
  visible: boolean;
  folders: SessionFolder[];
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
  /** Sheet heading. */
  title?: string;
  /** When set, picking a row only highlights; Continue calls this. */
  confirmLabel?: string;
  onConfirm?: (folderId: string | null) => void;
  /** Show Create folder + composer. */
  allowCreate?: boolean;
  /** Called after folders change so parents can refresh. */
  onFoldersChange?: (folders: SessionFolder[]) => void;
}

export function FolderPicker({
  visible,
  folders,
  selectedId,
  onSelect,
  onClose,
  title = 'Move to folder',
  confirmLabel,
  onConfirm,
  allowCreate = false,
  onFoldersChange,
}: FolderPickerProps) {
  const { colors } = useTheme();
  const [draftId, setDraftId] = useState<string | null>(selectedId);
  const [localFolders, setLocalFolders] = useState(folders);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmMode = Boolean(onConfirm && confirmLabel);
  const otherFolders = localFolders.filter((folder) => !isDefaultFolder(folder));

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setReady(false);
    setComposing(false);
    setFolderName('');
    setError(null);

    void (async () => {
      try {
        const def = await ensureDefaultFolder(folders);
        if (cancelled) return;
        const merged = dedupeFoldersByName(
          folders.some((f) => f.id === def.id) ? folders : [...folders, def],
        );
        setLocalFolders(merged);
        onFoldersChange?.(merged);
        setDefaultId(def.id);
        const initial =
          selectedId && merged.some((f) => f.id === selectedId) ? selectedId : def.id;
        setDraftId(initial);
        onSelect(initial);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Could not load Default folder.');
        setLocalFolders(folders);
        setDefaultId(null);
        setDraftId(selectedId);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  function pick(id: string) {
    setDraftId(id);
    onSelect(id);
  }

  async function onCreateFolder() {
    const trimmed = folderName.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === DEFAULT_FOLDER_NAME.toLowerCase()) {
      setError(`“${DEFAULT_FOLDER_NAME}” already exists.`);
      return;
    }
    if (findFolderByName(localFolders, trimmed)) {
      setError(`A folder named “${trimmed}” already exists.`);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createFolder({ name: trimmed });
      const next = dedupeFoldersByName([...localFolders, created]);
      setLocalFolders(next);
      onFoldersChange?.(next);
      setDraftId(created.id);
      onSelect(created.id);
      setFolderName('');
      setComposing(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create folder.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close folder picker"
        />
        <View style={[styles.center, { pointerEvents: 'box-none' }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
              Choose a folder. New projects go to {DEFAULT_FOLDER_NAME} unless you pick another.
            </Text>

            {!ready ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {defaultId ? (
                  <PickerRow
                    label={DEFAULT_FOLDER_NAME}
                    selected={draftId === defaultId}
                    onPress={() => pick(defaultId)}
                  />
                ) : null}
                {otherFolders.map((folder) => (
                  <PickerRow
                    key={folder.id}
                    label={folder.name}
                    selected={draftId === folder.id}
                    onPress={() => pick(folder.id)}
                  />
                ))}
              </ScrollView>
            )}

            {allowCreate ? (
              composing ? (
                <View style={styles.composer}>
                  <TextInput
                    style={[
                      styles.composerInput,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        color: colors.ink,
                      },
                    ]}
                    value={folderName}
                    onChangeText={setFolderName}
                    placeholder="Folder name"
                    placeholderTextColor={colors.tertiary}
                    autoFocus
                    editable={!creating}
                    onSubmitEditing={() => void onCreateFolder()}
                    accessibilityLabel="Folder name"
                  />
                  <Pressable
                    onPress={() => void onCreateFolder()}
                    disabled={creating || !folderName.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Add folder"
                    style={[
                      styles.composerBtn,
                      {
                        backgroundColor: colors.accent,
                        opacity: creating || !folderName.trim() ? 0.5 : 1,
                      },
                    ]}
                  >
                    {creating ? (
                      <ActivityIndicator color={colors.onBrand} />
                    ) : (
                      <Text style={[styles.composerBtnText, { color: colors.onBrand }]}>Add</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setComposing(false);
                      setFolderName('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel create folder"
                  >
                    <Text style={[styles.cancelText, { color: colors.inkMuted }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setComposing(true)}
                  style={({ pressed }) => [
                    styles.createBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Create folder"
                >
                  <Icon name="plus" size={20} color={colors.accent} />
                  <Text style={[styles.createLabel, { color: colors.accent }]}>Create folder</Text>
                </Pressable>
              )
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            {confirmMode ? (
              <View style={styles.footer}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.cancelBtnLabel, { color: colors.ink }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => onConfirm?.(draftId)}
                  disabled={!ready || !draftId}
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    {
                      backgroundColor: colors.ink,
                      opacity: !ready || !draftId ? 0.5 : pressed ? 0.9 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={confirmLabel}
                >
                  <Text style={[styles.confirmLabel, { color: colors.onBrand }]}>{confirmLabel}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PickerRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: selected ? colors.accentSoft : 'transparent' },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Icon name="folder" size={22} />
      <Text style={[styles.rowLabel, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={18} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    maxHeight: 520,
    gap: spacing.sm,
  },
  title: {
    ...typography.section,
    flex: 1,
    paddingRight: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    ...typography.meta,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  loading: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 260,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  pressed: { opacity: 0.75 },
  rowLabel: {
    ...typography.body,
    flex: 1,
    fontWeight: '600',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.smd,
    marginTop: spacing.xs,
  },
  createLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  composerBtn: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cancelText: {
    ...typography.caption,
  },
  error: {
    ...typography.caption,
    paddingHorizontal: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: radii.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
