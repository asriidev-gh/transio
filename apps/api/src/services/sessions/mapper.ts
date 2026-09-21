/**
 * Maps a Postgres sessions row (snake_case) to the API Session shape (camelCase).
 */
export interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  session_type: string;
  description: string | null;
  recorded_at: string;
  duration_seconds: number | null;
  audio_path: string | null;
  status: string;
  favorited_at?: string | null;
  folder_id?: string | null;
  created_at: string;
  updated_at: string;
}

export function mapSessionRow(row: SessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sessionType: row.session_type,
    description: row.description,
    recordedAt: row.recorded_at,
    durationSeconds: row.duration_seconds,
    audioPath: row.audio_path,
    status: row.status,
    favoritedAt: row.favorited_at ?? null,
    folderId: row.folder_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
