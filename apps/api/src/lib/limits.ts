/**
 * Max raw upload / remote-download size in bytes (before ffmpeg conversion).
 * MAX_UPLOAD_MB defaults to 100. Raise it only if the API host has RAM for the
 * in-memory upload buffer (video is converted to compact audio afterwards).
 */
export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  const clamped = Number.isFinite(mb) && mb > 0 ? Math.min(Math.max(mb, 10), 1000) : 100;
  return Math.floor(clamped * 1024 * 1024);
}
