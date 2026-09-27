/**
 * Turns the live caption stream (finals + speaker ids) into speaker turns made of
 * sentences, so each sentence can sit on its own line with its translation under it.
 *
 * Finals only ever get appended, so a sentence keeps its index once it exists and
 * its text stops changing once it is complete — safe to key translations on.
 */

export interface LiveCaptionSentence {
  /** Position across the whole session; stable while finals are appended. */
  index: number;
  text: string;
  /** False only for the last sentence while it still waits for its end mark. */
  complete: boolean;
}

export interface LiveCaptionTurn {
  speaker: number | null;
  sentences: LiveCaptionSentence[];
}

const TERMINATORS = new Set(['.', '!', '?', '…', '。', '！', '？']);
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '」', '』']);
const CJK_TERMINATORS = new Set(['。', '！', '？']);

/** 0 -> "Speaker A", 1 -> "Speaker B" — same labels as batch Deepgram transcripts. */
export function liveSpeakerLabel(speaker: number): string {
  if (speaker >= 0 && speaker < 26) return `Speaker ${String.fromCharCode(65 + speaker)}`;
  return `Speaker ${speaker + 1}`;
}

/** Split text into sentences; the last piece has no end mark when `trailing` is set. */
export function splitSentences(text: string): { sentences: string[]; trailing: string } {
  const sentences: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (!TERMINATORS.has(ch)) {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < text.length && (TERMINATORS.has(text[end]!) || CLOSERS.has(text[end]!))) {
      end += 1;
    }
    // "3.5" or "e.g" keep going; a space, the end, or a CJK mark closes the sentence.
    const atBoundary = end >= text.length || /\s/.test(text[end]!) || CJK_TERMINATORS.has(ch);
    if (atBoundary) {
      const sentence = text.slice(start, end).trim();
      if (sentence) sentences.push(sentence);
      start = end;
    }
    i = end;
  }
  return { sentences, trailing: text.slice(start).trim() };
}

export function buildCaptionTurns(
  finals: string[],
  speakers: Array<number | null> = [],
): LiveCaptionTurn[] {
  // Group consecutive finals by speaker. A final with no speaker id stays with the
  // turn before it, so a stream without diarization is one long turn.
  const groups: Array<{ speaker: number | null; parts: string[] }> = [];
  finals.forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    const speaker = speakers[i] ?? null;
    const last = groups[groups.length - 1];
    if (last && (speaker == null || last.speaker == null || last.speaker === speaker)) {
      last.parts.push(text);
      if (last.speaker == null) last.speaker = speaker;
      return;
    }
    groups.push({ speaker, parts: [text] });
  });

  let index = 0;
  return groups.map((group, g) => {
    const isLastGroup = g === groups.length - 1;
    const { sentences, trailing } = splitSentences(group.parts.join(' '));
    const turn: LiveCaptionTurn = {
      speaker: group.speaker,
      sentences: sentences.map((text) => ({ index: index++, text, complete: true })),
    };
    // A new speaker ends the previous turn even without punctuation.
    if (trailing) {
      turn.sentences.push({ index: index++, text: trailing, complete: !isLastGroup });
    }
    return turn;
  });
}

/** Words a caption needs, and the share one voice must hold, to switch speaker. */
const SWITCH_MIN_WORDS = 4;
const SWITCH_MIN_SHARE = 0.75;

/**
 * Live diarization from one phone mic often splits a single voice into two,
 * mostly on short or mixed phrases. Keep the current speaker unless a caption is
 * long enough and clearly said by someone else.
 */
export function nextStableSpeaker(
  current: number | null,
  heard: { speaker: number | null; share?: number; words?: number },
): number | null {
  if (heard.speaker == null) return current;
  if (current == null || heard.speaker === current) return heard.speaker;
  const words = heard.words ?? 0;
  const share = heard.share ?? 0;
  return words >= SWITCH_MIN_WORDS && share >= SWITCH_MIN_SHARE ? heard.speaker : current;
}

/** Captions a speaker needs before labels appear, so one stray switch shows nothing. */
const MIN_CAPTIONS_PER_SPEAKER = 2;

/** True when at least two speakers each have a few captions of their own. */
export function hasMultipleSpeakers(speakers: Array<number | null>): boolean {
  const counts = new Map<number, number>();
  let established = 0;
  for (const s of speakers) {
    if (s == null) continue;
    const next = (counts.get(s) ?? 0) + 1;
    counts.set(s, next);
    if (next === MIN_CAPTIONS_PER_SPEAKER) established += 1;
    if (established > 1) return true;
  }
  return false;
}
