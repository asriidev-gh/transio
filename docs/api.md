# API

Base URL (local): `http://127.0.0.1:3847`

All responses use a consistent envelope:

```json
{ "success": true, "data": {} }
```

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "…" }
}
```

## Implemented endpoints

### `GET /health`

Unauthenticated liveness + config probe.

**Response `data`:**

| Field | Type | Description |
| --- | --- | --- |
| `status` | `"ok"` | Always ok when the process is healthy |
| `service` | `"sessionai-api"` | Service name |
| `version` | string | API version |
| `timestamp` | ISO string | Server time |
| `supabaseConfigured` | boolean | `SUPABASE_URL` + `SUPABASE_ANON_KEY` present |

### `GET /me`

Requires `Authorization: Bearer <supabase_access_token>`.

Returns the authenticated user `{ id, email }` derived from the JWT (never from a client-supplied id).

| Status | Code | When |
| --- | --- | --- |
| 200 | — | Valid token |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 503 | `SERVICE_UNAVAILABLE` | Supabase not configured on API |

### Sessions (`/sessions`)

All session routes require a valid Bearer token. Ownership is enforced via RLS + `user_id` filters.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/sessions` | List current user's sessions (newest first) |
| `POST` | `/sessions` | Create session (`title`, `sessionType`, optional `description`) |
| `GET` | `/sessions/:id` | Get one session (404 if missing or not owned) |
| `PATCH` | `/sessions/:id` | Update fields (title, type, description, status, …) |
| `DELETE` | `/sessions/:id` | Delete session |

Create body example:

```json
{
  "title": "GLC Session 3",
  "sessionType": "group_discussion",
  "description": "Weekly discussion"
}
```

New sessions start with `status: "recording"`.

## Planned endpoints (later phases)

```text
POST   /sessions/:id/audio
POST   /sessions/:id/transcribe
POST   /sessions/:id/summarize

GET    /sessions/:id/transcript
GET    /sessions/:id/summary
GET    /sessions/:id/status
```

Session CRUD (`POST/GET/PATCH/DELETE /sessions`) is implemented in Phase 3.
Authenticated endpoints will require a Supabase JWT (`Authorization: Bearer …`) and verify ownership server-side.

## Running

```bash
npm run api
```

## Testing

```bash
npm run test --workspace=@sessionai/api
```
