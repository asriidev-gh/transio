# Pricing & entitlements

Smart Transcriber uses a **free trial allowance**, then a **Pro subscription** paywall.

Source of truth in the app:

- Plans / copy: `apps/mobile/src/data/pricing.ts`
- Free usage + Pro unlock: `apps/mobile/src/services/entitlements.ts`
- Paywall UI: `apps/mobile/app/paywall.tsx`

## Free tier (guest / trial)

Each **device** gets a lifetime free allowance of **2 per feature**, then the paywall:

| Allowance | What it unlocks | Consumed when |
| --- | --- | --- |
| **2 sessions** | Record or import a session | Session is created successfully |
| **2 AI Summaries** | Opt-in summary generation | Summarize API call starts successfully |
| **2 Voice translate chats** | Hold-to-talk live translate | First successful turn of a **new** conversation |

After a free cap is hit, the next attempt opens **Unlock Pro**. Free counters do **not** reset daily.

Notes:

- Counters live in AsyncStorage on the device (survive guest → save-account on the same install).
- Voice translate: turns in the **same** conversation do not consume another free slot.
- Notes-only capture still counts as a **session**.

## Pro fair-use (subscribed)

Pro is not fully unlimited on-device: **5 of each feature per local calendar day** to limit abuse / cost.

| Cap | Behavior when hit |
| --- | --- |
| **5 sessions / day** | Alert: resets tomorrow (not paywall) |
| **5 AI Summaries / day** | Alert: resets tomorrow |
| **5 Voice translate chats / day** | Alert: resets tomorrow |

Same-conversation Voice translate turns do not consume another daily slot.

## Pro plans (USD)

| Plan | Price | Notes |
| --- | --- | --- |
| **Weekly** | **$4.99** | Flexible; cancel anytime |
| **Monthly** | **$12.99** | Default / “Popular” |
| **Yearly** | **$79.99** | ~$6.67/mo · ~49% off monthly · “Best value” |

Yearly ≈ **6× monthly**, not 12× — standard store discount pattern.

### What Pro includes

- Record, import & Live Note Taker (fair-use **5 sessions / day**)  
- AI Summaries on demand (fair-use **5 / day**)  
- Voice translate hold-to-talk (fair-use **5 chats / day**)  
- Translate finished notes  

## Paywall entry points

- End of first-launch **onboarding** (then guest session → app; email login is optional later)
- **Create account** on the signed-out login screen (replays onboarding → paywall)
- Creating a session / import when the **free** session cap is used  
- **Generate AI Summary** when the **free** summary cap is used  
- Voice translate entry / new conversation when the **free** chat cap is used  
- Settings → **Smart Transcriber Pro**

Pro daily caps show an in-app alert instead of the paywall.

## Billing status (current)

Purchases go through RevenueCat with Google Play Billing. A build without
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (web, or any build with no key set) falls back to
unlocking Pro locally so the wall and gates stay testable.

Play product IDs, one subscription each with a single base plan:

| Plan | Product id |
| --- | --- |
| Weekly | `pro_weekly` |
| Monthly | `pro_monthly` |
| Yearly | `pro_yearly` |

After store products exist, keep `pricing.ts` labels in sync with App Store Connect / Play Console prices (regional pricing may differ from the USD list above).

## Changing prices

1. Update `SUBSCRIPTION_PLANS` in `apps/mobile/src/data/pricing.ts`.  
2. Update this doc.  
3. Update store product prices (when billing is live).  
4. Rebuild the app if you embed prices only in the binary (EAS).

## Billing (RevenueCat)

Real purchases use RevenueCat with Google Play Billing. The app account id (the Supabase user id)
is the RevenueCat app user id, so a purchase belongs to the account that made it.

### One-time setup

1. **Play Console:** create the app (`com.consorttech.smarttranscriber`) and three subscription products, one each
   for weekly, monthly and yearly. Add a free trial offer to the yearly base plan if you want one.
2. **RevenueCat:** add a Google Play app to the project and upload the Play service account
   credentials. Import the three products.
3. **Entitlement:** create the entitlement `smarttranscriber_pro` and attach all three products to it.
   The code uses this name by default. To use another name, set `REVENUECAT_ENTITLEMENT_ID` on the API
   and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` in the EAS environment.
4. **Offering:** put the three products in the current offering as the standard Weekly, Monthly
   and Annual packages. The app maps package types to plans, so use those exact types.
5. **App key:** copy the Android public SDK key (`goog_...`) into the EAS environment as
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` for the preview and production builds.
6. **Webhook:** in RevenueCat add a webhook to `https://<api-host>/webhooks/revenuecat` and set its
   Authorization header value to the same value as `REVENUECAT_WEBHOOK_SECRET` on the API.
7. **Migration:** apply `202609250003_billing_webhook.sql`.
8. **Quotas:** once a test purchase shows up in the `subscriptions` table, set `QUOTA_MODE=on`.

### Testing without the store

A `test_...` key uses the RevenueCat Test Store, which simulates purchases. It works in preview
builds for checking the whole flow, including the webhook. Never ship a release build with it.

### How it fits together

| Piece | Where |
| --- | --- |
| Buy, restore, entitlement to local state | `apps/mobile/src/services/billing.ts` |
| Paywall with store prices | `apps/mobile/app/paywall.tsx` |
| Webhook and event mapping | `apps/api/src/routes/webhooks.ts`, `services/billing/revenuecat.ts` |
| Server Pro check for quotas | `subscriptions` table, read by `services/quota` |

The store is the source of truth. After every purchase, restore or customer update the app sets or
clears local Pro to match, so an expired subscription also removes any old preview unlock.

## Local reset (dev)

Entitlements live in AsyncStorage key `smart-transcriber-entitlements-v3`. Clearing app data / reinstall resets free counters, Pro daily counters, and local Pro unlock.
