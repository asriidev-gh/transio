import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { APP_NAME } from '@/src/data/brand';
import {
  markStoreReviewPrompted,
  releaseStoreReviewClaim,
  saveStoreReviewStar,
  tryClaimStoreReviewPrompt,
} from '@/src/services/store-review';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

const PLAY_STORE_ID = 'com.consorttech.smarttranscriber';

async function openPlayListing(): Promise<void> {
  const https = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;
  const market = `market://details?id=${PLAY_STORE_ID}`;
  try {
    await Linking.openURL(market);
  } catch {
    await Linking.openURL(https);
  }
}

/**
 * One rating prompt on the second app open. Picking a star, or closing it,
 * means it does not come back.
 */
export function StoreReviewPrompt() {
  const { colors, shadows } = useTheme();
  const segments = useSegments();
  const [visible, setVisible] = useState(false);
  const [star, setStar] = useState(0);
  const onRecording = segments.some((part) => part === 'recording');

  useEffect(() => {
    if (Platform.OS !== 'android' || onRecording) return;
    let cancelled = false;
    void (async () => {
      const show = await tryClaimStoreReviewPrompt();
      if (cancelled || !show) {
        if (cancelled) releaseStoreReviewClaim();
        return;
      }
      await markStoreReviewPrompted();
      if (!cancelled) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onRecording]);

  async function chooseStar(next: number) {
    setStar(next);
    await saveStoreReviewStar(next);
  }

  async function rate() {
    if (star < 1) return;
    setVisible(false);
    await openPlayListing();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setVisible(false)}
          accessibilityLabel="Dismiss rating"
        />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.float,
          ]}
        >
          <Pressable
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}
          >
            <Icon name="close" size={18} color={colors.inkMuted} variant="line" />
          </Pressable>
          <Text style={[styles.title, { color: colors.ink }]}>Do you like {APP_NAME}?</Text>
          <Text style={[styles.body, { color: colors.inkMuted }]}>
            We’re working on a better experience. A Play Store rating helps others find the app.
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = value <= star;
              return (
                <Pressable
                  key={value}
                  onPress={() => void chooseStar(value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                  accessibilityState={{ selected }}
                  hitSlop={6}
                >
                  <Icon
                    name={selected ? 'star' : 'star-outline'}
                    size={36}
                    color={selected ? colors.warning : colors.tertiary}
                    variant="line"
                  />
                </Pressable>
              );
            })}
          </View>
          <Button label="Rate" onPress={() => void rate()} disabled={star < 1} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  close: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    textAlign: 'center',
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
