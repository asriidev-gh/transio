import type { SessionSummary } from './summary.js';

/**
 * Split spoken/transcribed text into note bullets on sentence boundaries.
 * Keeps the trailing punctuation on each item when present.
 */
export function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const parts = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts) return [normalized];

  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Live caption finals → note bullets.
 * Each Deepgram final is its own row (STT often omits periods mid-utterance).
 * Finals that do contain .!? are further split.
 */
export function bulletsFromCaptionFinals(finals: string[]): string[] {
  const out: string[] = [];
  for (const chunk of finals) {
    const trimmed = chunk.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    const sentences = splitIntoSentences(trimmed);
    // Multiple sentence-ending marks inside one final → multiple bullets.
    // Otherwise keep the whole final as one bullet (even without a period).
    if (sentences.length > 1) {
      out.push(...sentences);
    } else {
      out.push(trimmed);
    }
  }
  return out;
}

/** Build a notes-shaped payload from raw speech text (no AI structuring). */
export function rawNotesFromText(text: string): SessionSummary {
  const keyPoints = splitIntoSentences(text);
  const overview = keyPoints[0] ?? text.trim();
  return {
    overview,
    keyPoints: keyPoints.length > 0 ? keyPoints : overview ? [overview] : [],
    topics: [],
    questionsDiscussed: [],
    actionItems: [],
    importantInsights: [],
    quotes: [],
  };
}

/** Persist live caption finals as notes (one bullet per final / sentence). */
export function rawNotesFromFinals(finals: string[]): SessionSummary {
  const keyPoints = bulletsFromCaptionFinals(finals);
  const overview = keyPoints[0] ?? '';
  return {
    overview,
    keyPoints,
    topics: [],
    questionsDiscussed: [],
    actionItems: [],
    importantInsights: [],
    quotes: [],
  };
}

/** Prefer stored bullets; otherwise split overview into sentences. */
export function bulletsFromNotes(notes: {
  overview?: string | null;
  keyPoints?: string[];
}): string[] {
  if (notes.keyPoints && notes.keyPoints.length > 0) {
    return notes.keyPoints.map((p) => p.trim()).filter(Boolean);
  }
  if (notes.overview?.trim()) {
    return splitIntoSentences(notes.overview);
  }
  return [];
}
