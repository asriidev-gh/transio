# Play Store launch checklist

What the store and the servers need before a public release. Tick items as you finish them.

## Accounts and policies

- [ ] Publish the pages in `legal/` (see `legal/README.md`) and note the privacy policy and
      account deletion URLs.
- [ ] Play Console: set the privacy policy URL.
- [ ] Play Console, Data safety: set the account deletion URL (`delete-account.html`) and state
      that users can delete their account in the app (Settings > Delete account).
- [ ] Create a test account and give the login to reviewers under App access. Reviewers cannot
      use a guest account if a paywall blocks it, so make sure the test login can reach every screen.

## Billing

- [ ] Follow the setup steps in `docs/pricing.md` (Play products, RevenueCat, webhook).
- [ ] Set `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` to the `goog_` key in the EAS production environment.
- [ ] Make a test purchase with a license tester account and confirm a row appears in `subscriptions`.
- [ ] Confirm Restore purchases works on a second device signed in to the same account.
- [ ] Switch `QUOTA_MODE` from `log` to `on` after the checks above.

## Data safety form: what to declare

The app collects or shares the following. Confirm against the current build before submitting.

| Data | Collected | Purpose | Shared with |
| --- | --- | --- | --- |
| Email address | Yes, optional (email accounts only) | Account management | Supabase |
| User IDs | Yes | Account management, app functionality | Supabase |
| Audio recordings | Yes | App functionality | Supabase, Deepgram, speech recognition provider |
| Voice or sound recordings (Voice translate clips) | Yes | App functionality | Speech recognition provider, Anthropic |
| Other user content (transcripts, notes, summaries) | Yes | App functionality | Supabase, Anthropic |
| Device or other IDs (hashed Android ID) | Yes | Fraud prevention, usage limits | Supabase |
| Purchase history | Yes, after billing launches | Subscriptions | RevenueCat, Google Play |
| Crash logs | Yes, after Sentry launches | Analytics, diagnostics | Sentry |

- Data is encrypted in transit.
- Users can request deletion (in the app and on the web).

## Permissions to justify

| Permission | Why |
| --- | --- |
| `RECORD_AUDIO` | Recording sessions and Voice translate |
| `POST_NOTIFICATIONS` | Tell the user when processing finishes |
| `FOREGROUND_SERVICE` and media playback type | Keep audio playback and recording alive |

Declare the foreground service type in the Play Console when asked.

## Testing requirements

- [ ] New personal developer accounts may have to run a closed test with about 12 testers for about
      14 days before production access. Check the current Play rule for your account type.
- [ ] Test on at least one low-end Android phone and one recent phone.
- [ ] Try the share-sheet import from Files, Drive, Zoom and Meet.
- [ ] Record for longer than 30 minutes with `TRANSCRIPTION_PROVIDER=deepgram`.

## Server side

- [ ] Apply every migration in `supabase/migrations`.
- [ ] Set `DEVICE_HASH_SECRET` on the API host and never change it.
- [ ] Keep `QUOTA_MODE=log` until billing is live, then switch to `on`.
- [ ] Add an external uptime monitor for `/health`.
- [ ] Create budget alerts at Anthropic, Deepgram and the speech provider.
