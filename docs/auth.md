# Authentication

Smart Transcriber uses **Supabase Auth**. The API verifies JWTs for protected routes.

## Product funnel

```text
App launch
  → restore session from AsyncStorage
  → if never onboarded → /onboarding
  → if no session → /paywall
Sign in (email) or Continue as guest (anonymous)
  → session → /(app)
Save account (guest later)
  → attach email/password to the same user id
Sign out (Settings)
  → supabase.auth.signOut()
  → /(auth)/login
```

Preferred order: **onboarding → paywall → use the app → save email later**.

## Guest (anonymous) sessions

Continuing from the paywall without email calls `signInAnonymously()`. Guests get a real JWT and the same API access as signed-in users.

**Required Supabase setting:** Authentication → Providers → **Anonymous sign-ins** → Enable.

Later, Settings → **Save account** (or login) calls `updateUser({ email, password })` so cloud data stays on the same `user_id`.

Signing into a *different* existing account replaces the guest session (guest data is not merged).

## Screens

| Screen | Behavior |
| --- | --- |
| Onboarding | First-launch slides → paywall |
| Paywall | Pro / free trial → guest session → app |
| Login | Email sign-in, or **Save account** when the current session is anonymous |
| Settings | Guest → Save account; email → signed-in address + Sign out |

## API

### `GET /me` (authenticated)

Requires `Authorization: Bearer <access_token>`.

Returns:

```json
{
  "success": true,
  "data": { "id": "<uuid>", "email": "you@example.com" }
}
```

Unauthorized:

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Authentication required" }
}
```

Anonymous users typically have `email: null`.

## Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email** enabled.
3. **Authentication → Providers → Anonymous** enabled (required for paywall → app without login).
4. For local MVP testing, you may disable **Confirm email** under Authentication → Providers → Email (or confirm via inbox).
5. Copy values:

| Env var | App | Source |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile | `anon` `public` key |
| `SUPABASE_URL` | API | Project URL |
| `SUPABASE_ANON_KEY` | API | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | `service_role` (never in mobile) |

6. Restart API and Expo after editing `.env` files.

## Security notes

- Mobile uses the **anon** key only.
- API `requireAuth` validates the JWT with `supabase.auth.getUser(token)`.
- Do not trust a client-supplied user id; always derive identity from the JWT.
- Treat anonymous users like any other `auth.users` row for RLS / `user_id` ownership.
