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

Store billing is **not wired yet** (no RevenueCat / Play Billing / App Store IAP).

The paywall **Continue** button currently **unlocks Pro locally** on the device so the wall and gates can be tested end-to-end. Replace that stub with real purchases before production submit.

Recommended next step: **RevenueCat** (or native IAP) with product IDs mapped to:

| Plan | Suggested product id |
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

## Local reset (dev)

Entitlements live in AsyncStorage key `smart-transcriber-entitlements-v3`. Clearing app data / reinstall resets free counters, Pro daily counters, and local Pro unlock.
