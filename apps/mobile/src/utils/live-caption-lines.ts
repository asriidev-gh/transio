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

/** True when the stream has told apart at least two speakers. */
export function hasMultipleSpeakers(speakers: Array<number | null>): boolean {
  const seen = new Set<number>();
  for (const s of speakers) {
    if (s != null) seen.add(s);
    if (seen.size > 1) return true;
  }
  return false;
}
