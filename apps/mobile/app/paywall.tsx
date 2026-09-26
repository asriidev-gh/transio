import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SessionNavHeaderLeft } from '@/src/components/SessionNavHeaderLeft';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Icon } from '@/src/components/ui/Icon';
import { APP_NAME, APP_TAGLINE } from '@/src/data/brand';
import {
  FREE_TRIAL_COPY,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from '@/src/data/pricing';
import { useAuth } from '@/src/hooks/useAuth';
import { getCurrentSession } from '@/src/services/auth';
import {
  isBillingAvailable,
  loadPlanPackages,
  purchasePlan,
  restoreBillingPurchases,
  syncBillingUser,
  type PlanPackage,
} from '@/src/services/billing';
import {
  featurePaywallMessage,
  loadEntitlements,
  unlockPremium,
  type GatedFeature,
} from '@/src/services/entitlements';
import { gradients, radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { showAlert } from '@/src/utils/confirm';

function parseFeature(raw: string | string[] | undefined): GatedFeature | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'session' || value === 'summary' || value === 'voiceTranslate') return value;
  return null;
}

/** Plan captions when prices come from the store. No prices here, so they never disagree with it. */
const STORE_PLAN_DETAIL: Record<SubscriptionPlanId, string> = {
  weekly: 'Flexible · cancel anytime',
  monthly: 'Most popular',
  yearly: 'Best value',
};

const PERKS = [
  'Record, import & Live Note Taker',
  'AI Summaries on demand',
  'Voice translate (hold to talk)',
  'Translate finished notes',
];

export default function PaywallScreen() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, continueAsGuest, isConfigured } = useAuth();
  const params = useLocalSearchParams<{ feature?: string }>();
  const feature = parseFeature(params.feature);

  const [planId, setPlanId] = useState<SubscriptionPlanId>('monthly');
  const [busy, setBusy] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<PlanPackage[]>([]);
  const [storeRetrying, setStoreRetrying] = useState(false);
  // Real store billing needs Android, a RevenueCat key and the native module in this build.
  const billing = useMemo(() => isBillingAvailable(), []);
  const hasPlans = useRef(false);

  useEffect(() => {
    void loadEntitlements().then((s) => {
      setIsPremium(s.isPremium);
      if (s.planId) setPlanId(s.planId);
    });
  }, []);

  useEffect(() => {
    if (!billing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled || hasPlans.current) return;
      setStoreRetrying(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void attempt();
      }, 3000);
    };

    const attempt = async () => {
      if (cancelled) return;
      try {
        const list = await loadPlanPackages();
        if (cancelled) return;
        if (list.length === 0) {
          schedule();
          return;
        }
        hasPlans.current = true;
        setPackages(list);
        setStoreRetrying(false);
        setPlanId((current) =>
          list.some((p) => p.planId === current) ? current : (list[0]?.planId ?? current),
        );
      } catch {
        if (!cancelled) schedule();
      }
    };

    void attempt();

    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || cancelled || hasPlans.current) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void attempt();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [billing]);

  // With store billing the plans and prices come from the store, so what is shown is what is charged.
  const plans = useMemo(() => {
    if (!billing) return SUBSCRIPTION_PLANS;
    return SUBSCRIPTION_PLANS.flatMap((plan) => {
      const store = packages.find((p) => p.planId === plan.id);
      if (!store) return [];
      return [
        {
          ...plan,
          priceLabel: store.priceString,
          detail:
            plan.id === 'yearly' && store.pricePerMonthString
              ? `${store.pricePerMonthString}/mo · Best value`
              : STORE_PLAN_DETAIL[plan.id],
        },
      ];
    });
  }, [billing, packages]);

  const subtitle = useMemo(() => {
    if (feature) return featurePaywallMessage(feature);
    return FREE_TRIAL_COPY.body;
  }, [feature]);

  async function enterApp() {
    if (!session) {
      if (!isConfigured) {
        setError(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart.',
        );
        return;
      }
      await continueAsGuest();
      router.replace('/');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function leavePaywall() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await enterApp();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start a guest session. Enable Anonymous sign-ins in Supabase Auth.',
      );
    } finally {
      setBusy(false);
    }
  }

  /** Purchases must be tied to an account, so create the guest account first when there is none. */
  async function ensureAccountForPurchase() {
    if (!session) {
      if (!isConfigured) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart.',
        );
      }
      await continueAsGuest();
    }
    const current = await getCurrentSession();
    if (current?.user?.id) await syncBillingUser(current.user.id);
  }

  /** Leave once an account exists. Does not create a guest, unlike enterApp. */
  function leaveAfterPurchase() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function purchaseFromStore() {
    const store = packages.find((p) => p.planId === planId);
    if (!store) {
      setError('That plan is not available right now. Try again in a moment.');
      return;
    }

    await ensureAccountForPurchase();
    const outcome = await purchasePlan(store.pkg);
    if (outcome === 'cancelled') return;
    if (outcome === 'purchased') {
      setIsPremium(true);
      await showAlert('Pro unlocked', 'Thanks for subscribing. Pro is active on this account.');
      leaveAfterPurchase();
      return;
    }
    setError('Your purchase is still processing. Pro unlocks as soon as the store confirms it.');
  }

  async function onRestore() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await ensureAccountForPurchase();
      if (await restoreBillingPurchases()) {
        setIsPremium(true);
        await showAlert('Pro restored', 'Your subscription is active again on this account.');
        leaveAfterPurchase();
      } else {
        await showAlert(
          'No purchases found',
          'We could not find an active subscription for this Google account.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore purchases. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onSubscribe() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (billing) {
        await purchaseFromStore();
        return;
      }
      // No store billing in this build (web, or no RevenueCat key): preview unlock only.
      await unlockPremium(planId);
      setIsPremium(true);
      await showAlert(
        'Pro unlocked',
        'App Store / Play Billing will replace this preview unlock. You’re Pro on this device now.',
      );
      await enterApp();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start a guest session. Enable Anonymous sign-ins in Supabase Auth.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Unlock Pro',
          headerBackVisible: false,
          headerLeft: () => (
            <SessionNavHeaderLeft onBack={() => void leavePaywall()} />
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[gradients.primary[0] + '22', gradients.primary[1] + '10', 'transparent']}
          style={styles.heroGlow}
          pointerEvents="none"
        />

        <View style={styles.heroLogo}>
          <BrandLogo size={160} />
        </View>
        <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
          {isPremium ? 'You’re on Pro' : `Unlock ${APP_NAME} Pro`}
        </Text>
        <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
          {isPremium ? `${APP_TAGLINE} — you’re on Pro.` : subtitle}
        </Text>

        <View style={styles.perkList}>
          {PERKS.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <Icon name="check" size={16} color={colors.brand} variant="line" />
              <Text style={[styles.perkText, { color: colors.ink }]}>{perk}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.trialNote, { color: colors.inkMuted }]}>
          Cancel anytime in your store settings. Sign in later to keep your library across devices.
        </Text>

        {billing && plans.length === 0 ? (
          <Text style={[styles.trialNote, { color: colors.inkMuted }]}>
            {storeRetrying ? 'Retrying…' : 'Loading plans…'}
          </Text>
        ) : null}

        <View style={styles.planList}>
          {plans.map((plan) => {
            const selected = planId === plan.id;
            return (
              <Pressable
                key={plan.id}
                onPress={() => setPlanId(plan.id)}
                disabled={isPremium || busy}
                style={[
                  styles.planCard,
                  {
                    borderColor: selected ? colors.brand : colors.border,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    opacity: isPremium ? 0.7 : 1,
                  },
                  shadows.soft,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${plan.label} ${plan.priceLabel}`}
              >
                <View style={styles.planTop}>
                  <Text style={[styles.planLabel, { color: colors.ink }]}>{plan.label}</Text>
                  {plan.badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                      <Text style={styles.badgeText}>{plan.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.planPrice, { color: colors.ink }]}>{plan.priceLabel}</Text>
                <Text style={[styles.planDetail, { color: colors.inkMuted }]}>{plan.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {!isPremium ? (
          <Pressable
            onPress={() => void onSubscribe()}
            disabled={busy || (billing && plans.length === 0)}
            style={({ pressed }) => [
              styles.cta,
              { opacity: busy ? 0.6 : pressed ? 0.92 : 1 },
              shadows.soft,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue with Pro"
          >
            <LinearGradient
              colors={[...gradients.primary]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {busy ? 'Starting…' : `Continue · ${plans.find((p) => p.id === planId)?.priceLabel ?? ''}`}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}

        {!isPremium ? (
          <Pressable
            onPress={() => void leavePaywall()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={styles.freeLink}
          >
            <Text style={[styles.freeLinkText, { color: colors.ink }]}>
              {busy ? 'Starting…' : 'Not now'}
            </Text>
          </Pressable>
        ) : null}

        {billing && !isPremium ? (
          <Pressable
            onPress={() => void onRestore()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            style={styles.freeLink}
          >
            <Text style={[styles.freeLinkText, { color: colors.inkMuted }]}>Restore purchases</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.legal, { color: colors.inkMuted }]}>
          {billing
            ? 'Subscriptions renew automatically through Google Play until you cancel. Manage or cancel anytime in Google Play under Payments & subscriptions.'
            : 'Prices shown in USD. Subscriptions will renew through the App Store or Google Play once billing is connected. Cancel anytime in your store settings.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  heroGlow: {
    ...StyleSheet.absoluteFill,
    height: 220,
  },
  heroLogo: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.pageTitle,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  perkList: { gap: spacing.sm, marginTop: spacing.sm },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  perkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  trialNote: {
    ...typography.caption,
    textAlign: 'center',
  },
  planList: { gap: spacing.sm },
  planCard: {
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: 4,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  planDetail: {
    fontSize: 13,
    fontWeight: '500',
  },
  cta: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  ctaGradient: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  freeLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  freeLinkText: {
    fontWeight: '600',
    fontSize: 15,
  },
  error: {
    ...typography.body,
    fontSize: 14,
    textAlign: 'center',
  },
  legal: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
