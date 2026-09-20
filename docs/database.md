# Database

## Phase status

Phase 3 introduces the `sessions` table with Row Level Security.

## Schema

### `sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE |
| `title` | TEXT NOT NULL | non-empty after trim |
| `session_type` | TEXT NOT NULL | seminar, group_discussion, bible_study, meeting, lecture, other |
| `description` | TEXT | nullable |
| `recorded_at` | TIMESTAMPTZ NOT NULL | defaults to now (UTC) |
| `duration_seconds` | INTEGER | nullable, ≥ 0 |
| `audio_path` | TEXT | private storage path (Phase 5) |
| `status` | TEXT NOT NULL | recording → … → completed / failed |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` maintained by trigger |

Migration file:

```text
supabase/migrations/202609200001_create_sessions.sql
```

### `transcripts` (Phase 6)

| Column | Type |
| --- | --- |
| `id` | UUID PK |
| `session_id` | UUID FK → sessions (unique) |
| `text` | TEXT NOT NULL |
| `language` | TEXT |
| `created_at` / `updated_at` | TIMESTAMPTZ |

RLS: access only when the related `sessions.user_id = auth.uid()`.

Migration: `202609200003_create_transcripts.sql`

### `summaries` (Phase 7)

| Column | Type |
| --- | --- |
| `id` | UUID PK |
| `session_id` | UUID FK → sessions (unique) |
| `overview` | TEXT |
| `key_points` | JSONB |
| `topics` | JSONB |
| `questions_discussed` | JSONB |
| `action_items` | JSONB |
| `important_insights` | JSONB |
| `quotes` | JSONB |
| `created_at` / `updated_at` | TIMESTAMPTZ |

RLS: access only when the related `sessions.user_id = auth.uid()`.

Migration: `202609200004_create_summaries.sql`

## Row Level Security

Enabled on `sessions`. Policies for the `authenticated` role:

| Policy | Command | Rule |
| --- | --- | --- |
| `sessions_select_own` | SELECT | `auth.uid() = user_id` |
| `sessions_insert_own` | INSERT | `auth.uid() = user_id` |
| `sessions_update_own` | UPDATE | `auth.uid() = user_id` |
| `sessions_delete_own` | DELETE | `auth.uid() = user_id` |

`anon` has no grants on `sessions`.

The API uses a **user-scoped** Supabase client (caller JWT) so RLS applies, and still filters by `user_id` in queries.

## Storage (`session-audio`)

Private bucket created in `202609200002_session_audio_bucket.sql`.

| Item | Value |
| --- | --- |
| Public | **false** |
| Path | `{user_id}/{session_id}/audio.{ext}` |
| Max size | 100 MB |
| Access | storage RLS: first path folder must equal `auth.uid()` |
| Playback | signed URLs only |

## Applying migrations

```bash
# With Supabase CLI linked to your project:
npx supabase db push

# Or run the SQL in the Supabase SQL editor:
# supabase/migrations/202609200001_create_sessions.sql
# supabase/migrations/202609200002_session_audio_bucket.sql
# supabase/migrations/202609200003_create_transcripts.sql
# supabase/migrations/202609200004_create_summaries.sql
```

Never mutate production schema from application code.
