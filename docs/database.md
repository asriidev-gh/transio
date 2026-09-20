# Database

## Phase status

Phase 1 does **not** create tables. Configuration and client setup only.

## Planned schema (Phase 3+)

### `sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `user_id` | UUID | Owner; RLS key |
| `title` | TEXT NOT NULL | |
| `session_type` | TEXT NOT NULL | seminar, group_discussion, … |
| `description` | TEXT | nullable |
| `recorded_at` | TIMESTAMPTZ NOT NULL | |
| `duration_seconds` | INTEGER | nullable |
| `audio_path` | TEXT | private storage path |
| `status` | TEXT NOT NULL | recording → … → completed / failed |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `transcripts` (Phase 6)

| Column | Type |
| --- | --- |
| `id` | UUID PK |
| `session_id` | UUID FK → sessions |
| `text` | TEXT NOT NULL |
| `language` | TEXT |
| `created_at` / `updated_at` | TIMESTAMPTZ |

### `summaries` (Phase 7)

| Column | Type |
| --- | --- |
| `id` | UUID PK |
| `session_id` | UUID FK → sessions |
| `overview` | TEXT |
| `key_points` | JSONB |
| `topics` | JSONB |
| `questions_discussed` | JSONB |
| `action_items` | JSONB |
| `important_insights` | JSONB |
| `quotes` | JSONB |
| `created_at` / `updated_at` | TIMESTAMPTZ |

## Security

- Row Level Security on all user data tables.
- Users access only their own sessions (and related transcripts/summaries).
- Storage bucket `session-audio` will be **private**; playback via signed URLs.

## Migrations

SQL files live in `supabase/migrations/`. Apply with the Supabase CLI; never mutate production from application code.
