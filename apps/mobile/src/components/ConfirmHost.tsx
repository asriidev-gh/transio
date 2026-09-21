import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import {
  settleConfirm,
  setConfirmListener,
  type ConfirmRequest,
} from '@/src/utils/confirm';

/** Root-mounted host for themed confirm / alert dialogs (all platforms). */
export function ConfirmHost() {
  const { colors, shadows } = useTheme();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    setConfirmListener(setRequest);
    return () => setConfirmListener(null);
  }, []);

  const visible = request != null;
  const isAlert = request?.kind === 'alert';

  function dismiss(ok: boolean) {
    if (!request) return;
    settleConfirm(request.id, ok);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => dismiss(false)}
    >
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => dismiss(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={[styles.center, { pointerEvents: 'box-none' }]}>
          {request ? (
            <View
              style={[
                styles.sheet,
                shadows.float,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.ink }]}>{request.title}</Text>
                <Pressable
                  onPress={() => dismiss(false)}
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
              <Text style={[styles.message, { color: colors.inkMuted }]}>{request.message}</Text>
              <View style={styles.actions}>
                {isAlert ? (
                  <Button label={request.confirmLabel} onPress={() => dismiss(true)} />
                ) : (
                  <>
                    <View style={styles.actionHalf}>
                      <Button
                        label={request.cancelLabel}
                        variant="secondary"
                        onPress={() => dismiss(false)}
                      />
                    </View>
                    <View style={styles.actionHalf}>
                      <Button
                        label={request.confirmLabel}
                        variant={request.destructive ? 'danger' : 'primary'}
                        onPress={() => dismiss(true)}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
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
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  title: {
    ...typography.section,
    flex: 1,
    paddingRight: spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...typography.body,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
  },
  actionHalf: {
    flex: 1,
  },
});
