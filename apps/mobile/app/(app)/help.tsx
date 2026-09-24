import { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Icon } from '@/src/components/ui/Icon';
import { APP_NAME, APP_TAGLINE } from '@/src/data/brand';
import { filterHelpFaq, HELP_FAQ, type HelpFaqItem } from '@/src/data/help-faq';
import { gradients, radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';

function FaqRow({
  item,
  expanded,
  onToggle,
}: {
  item: HelpFaqItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const qColor = expanded ? colors.brand : colors.ink;
  const chevronColor = expanded ? colors.brand : colors.inkMuted;

  return (
    <View
      style={[
        styles.faqCard,
        {
          backgroundColor: colors.surface,
          borderColor: expanded ? colors.brand + '55' : colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.faqHeader, { opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={item.question}
      >
        <Text style={[styles.faqQuestion, { color: qColor }]}>{item.question}</Text>
        <View style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}>
          <Icon name="chevron-right" size={18} color={chevronColor} variant="line" />
        </View>
      </Pressable>
      {expanded ? (
        <View style={[styles.faqBody, { backgroundColor: colors.backgroundAlt }]}>
          <Text style={[styles.faqAnswer, { color: colors.inkMuted }]}>{item.answer}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MenuRow({
  label,
  icon,
  onPress,
  last,
}: {
  label: string;
  icon: 'chat' | 'bulb' | 'mail' | 'alert';
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.menuLabel, { color: colors.ink }]}>{label}</Text>
        <Icon name={icon} size={20} color={colors.inkMuted} variant="line" />
      </Pressable>
      {!last ? (
        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
      ) : null}
    </>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useFloatingTabBarContentInset();
  const { colors, shadows } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [faqOffset, setFaqOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(HELP_FAQ[0]?.id ?? null);

  const items = useMemo(() => filterHelpFaq(query), [query]);

  function onFaqLayout(e: LayoutChangeEvent) {
    setFaqOffset(e.nativeEvent.layout.y);
  }

  function scrollToFaq() {
    scrollRef.current?.scrollTo({ y: Math.max(faqOffset - 12, 0), animated: true });
  }

  function goContact() {
    router.push('/help-contact');
  }

  function goReportBug() {
    router.push('/help-contact?mode=bug' as Href);
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/settings');
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[gradients.primary[0], gradients.primary[1], colors.background]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.heroTop}>
          <View style={styles.brandLockup}>
            <BrandLogo size={28} />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>{APP_NAME}</Text>
              <Text style={styles.brandTagline}>{APP_TAGLINE}</Text>
            </View>
          </View>
          <Pressable
            onPress={close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close help"
            style={({ pressed }) => [
              styles.closeBtn,
              { opacity: pressed ? 0.7 : 1, backgroundColor: 'rgba(255,255,255,0.2)' },
            ]}
          >
            <Icon name="close" size={18} color="#FFFFFF" variant="line" />
          </Pressable>
        </View>
        <Text style={styles.heroTitle} accessibilityRole="header">
          Hi 👋 How can we help?
        </Text>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarInset + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <MenuRow label="Messages" icon="chat" onPress={goContact} />
          <MenuRow label="Help" icon="bulb" onPress={scrollToFaq} />
          <MenuRow label="Report a bug" icon="alert" onPress={goReportBug} last />
        </View>

        <Pressable
          onPress={goContact}
          style={({ pressed }) => [
            styles.card,
            styles.sendCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
            shadows.soft,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send us a message"
        >
          <Text style={[styles.menuLabel, { color: colors.ink }]}>Send us a message</Text>
          <Icon name="mail" size={20} color={colors.brand} variant="line" />
        </Pressable>

        <Pressable
          onPress={goReportBug}
          style={({ pressed }) => [
            styles.card,
            styles.sendCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
            shadows.soft,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Report a bug"
        >
          <Text style={[styles.menuLabel, { color: colors.ink }]}>Report a bug</Text>
          <Icon name="alert" size={20} color={colors.warning} variant="line" />
        </Pressable>

        <View
          onLayout={onFaqLayout}
          style={[
            styles.card,
            styles.faqSection,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>
            Common questions
          </Text>
          <View
            style={[
              styles.search,
              { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
            ]}
          >
            <Icon name="magnify" size={18} color={colors.inkMuted} variant="line" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search for help"
              placeholderTextColor={colors.inkMuted}
              style={[styles.searchInput, { color: colors.ink }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search for help"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Icon name="close" size={16} color={colors.inkMuted} variant="line" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.faqList}>
            {items.length === 0 ? (
              <Text style={[styles.empty, { color: colors.inkMuted }]}>
                No matches. Try another search or send us a message.
              </Text>
            ) : (
              items.map((item) => (
                <FaqRow
                  key={item.id}
                  item={item}
                  expanded={openId === item.id}
                  onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerHint, { color: colors.inkMuted }]}>
            Still stuck?
          </Text>
          <Pressable onPress={goContact} accessibilityRole="link" accessibilityLabel="Contact us">
            <Text style={[styles.footerLink, { color: colors.brand }]}>Contact us</Text>
          </Pressable>
          <View style={styles.legalLinks}>
            <Pressable
              onPress={() => router.push('/about')}
              accessibilityRole="link"
              accessibilityLabel="About us"
            >
              <Text style={[styles.legalLink, { color: colors.inkMuted }]}>About</Text>
            </Pressable>
            <Text style={{ color: colors.border }}>·</Text>
            <Pressable
              onPress={() => router.push('/privacy')}
              accessibilityRole="link"
              accessibilityLabel="Privacy policy"
            >
              <Text style={[styles.legalLink, { color: colors.inkMuted }]}>Privacy</Text>
            </Pressable>
            <Text style={{ color: colors.border }}>·</Text>
            <Pressable
              onPress={() => router.push('/terms')}
              accessibilityRole="link"
              accessibilityLabel="Terms of service"
            >
              <Text style={[styles.legalLink, { color: colors.inkMuted }]}>Terms</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    paddingRight: spacing.sm,
  },
  brandCopy: {
    flex: 1,
    gap: 1,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  content: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 54,
  },
  menuLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
  },
  faqSection: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.section,
    fontSize: 17,
    lineHeight: 22,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.smd,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  faqList: {
    gap: spacing.sm,
  },
  faqCard: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
    minHeight: 52,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  faqBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 21,
  },
  empty: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  footerHint: {
    ...typography.caption,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legalLink: {
    fontSize: 13,
    fontWeight: '600',
  },
});
