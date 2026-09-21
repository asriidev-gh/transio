import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SessionFolder } from '@sessionai/shared';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Icon } from '@/src/components/ui/Icon';

interface FolderCardProps {
  folder: SessionFolder;
  count: number;
  onPress: () => void;
  onDelete?: () => void;
}

export function FolderCard({ folder, count, onPress, onDelete }: FolderCardProps) {
  const { colors } = useTheme();
  const label = count === 1 ? '1 recording' : `${count} recordings`;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${folder.name}, ${label}`}
      >
        <View style={[styles.mark, { backgroundColor: colors.actionImport }]}>
          <Icon name="folder" size={26} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={[styles.meta, { color: colors.inkMuted }]}>{label}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.tertiary} />
      </Pressable>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete folder ${folder.name}`}
          style={styles.deleteHit}
        >
          <Icon name="close" size={16} color={colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  meta: {
    ...typography.meta,
  },
  deleteHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
