const MEDIA_EXTENSIONS = /\.(mp3|m4a|mp4|m4v|mov|mkv|wav|webm|ogg|aac|flac|caf)$/i;

export function mimeTypeFromFileName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.m4a') || lower.endsWith('.caf')) return 'audio/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.m4v') || lower.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

export function isLikelyMedia(name: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return true;
  if (!mime || mime === 'application/octet-stream') {
    return MEDIA_EXTENSIONS.test(name);
  }
  return false;
}

export function titleFromMediaName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleFromMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    if (last && last.includes('.')) {
      return titleFromMediaName(decodeURIComponent(last));
    }
  } catch {
    /* ignore */
  }
  return '';
}
