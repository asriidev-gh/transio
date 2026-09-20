# Authentication

Phase 2 uses **Supabase Auth** (email/password) on the mobile client. The API verifies JWTs for protected routes.

## Mobile flow

```text
App launch
  → restore session from AsyncStorage
  → if no session → /(auth)/login
  → if session → /(app)
Sign in / Create account
  → Supabase Auth
  → onAuthStateChange updates AuthProvider
  → redirect into /(app)
Sign out (Settings)
  → supabase.auth.signOut()
  → redirect to login
```

## Screens

| Screen | Behavior |
| --- | --- |
| Login | Email + password, validation, loading, error states |
| Register | Email + password, handles email-confirmation-required |
| Settings | Shows signed-in email + Sign Out |

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

## Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email** enabled.
3. For local MVP testing, you may disable **Confirm email** under Authentication → Providers → Email (or confirm via inbox).
4. Copy values:

| Env var | App | Source |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile | `anon` `public` key |
| `SUPABASE_URL` | API | Project URL |
| `SUPABASE_ANON_KEY` | API | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | `service_role` (never in mobile) |

5. Restart API and Expo after editing `.env` files.

## Security notes

- Mobile uses the **anon** key only.
- API `requireAuth` validates the JWT with `supabase.auth.getUser(token)`.
- Do not trust a client-supplied user id; always derive identity from the JWT.
- RLS for sessions/transcripts arrives in Phase 3.
