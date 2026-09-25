/**
 * Dynamic Expo config so EAS EXPO_PUBLIC_* vars are embedded in `extra`
 * (reliable in release APKs; process.env alone can be empty at runtime).
 */
export default ({ config }) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  const revenueCatAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
  const revenueCatEntitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? '';

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: revenueCatAndroidKey,
      EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: revenueCatEntitlementId,
    },
  };
};
