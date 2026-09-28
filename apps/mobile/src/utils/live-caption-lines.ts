import type { TranscriptSegment } from '@sessionai/shared';

/**
 * Turns the live caption stream (finals + speaker ids) into speaker turns made of
 * lines, so each line can sit on its own with its translation under it. A line is
 * one sentence, or several short ones joined until it has a few words.
 *
 * Finals only ever get appended, so a line keeps its index once it exists and its
 * text stops changing once it is complete — safe to key translations on.
 */

export interface LiveCaptionSentence {
  /** Position across the whole session; stable while finals are appended. */
  index: number;
  text: string;
  /** False only for the last line while it still waits for its end mark or words. */
  complete: boolean;
}

export interface LiveCaptionTurn {
  speaker: number | null;
  sentences: LiveCaptionSentence[];
}

const TERMINATORS = new Set(['.', '!', '?', '…', '。', '！', '？']);
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '」', '』']);
const CJK_TERMINATORS = new Set(['。', '！', '？']);

/** Short sentences are joined until a line has at least this many words. */
export const MIN_LINE_WORDS = 5;
/** Saved transcript lines stop growing here even without an end mark. */
const MAX_SEGMENT_WORDS = 40;

const ENDS_WITH_PUNCTUATION = /[.,!?;:…。，！？、；：]["'”’)\]」』]*$/;
const ENDS_WITH_TERMINATOR = /[.!?…。！？]["'”’)\]」』]*$/;
const CJK_CHAR = /[぀-ヿ㐀-鿿가-힯]/;

/** Words in a line; each CJK character counts as one since there are no spaces. */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    const cjk = [...token].filter((ch) => CJK_CHAR.test(ch)).length;
    count += cjk > 0 ? cjk : 1;
  }
  return count;
}

/**
 * Join two caption pieces. Each piece ends where the speaker paused, so a piece
 * without its own punctuation gets a comma rather than running into the next.
 */
export function joinAtPause(prev: string, next: string): string {
  const a = prev.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  if (ENDS_WITH_PUNCTUATION.test(a)) return `${a} ${b}`;
  return CJK_CHAR.test(a.slice(-1)) ? `${a}，${b}` : `${a}, ${b}`;
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
    const { sentences, trailing } = splitSentences(group.parts.reduce(joinAtPause, ''));
    const turn: LiveCaptionTurn = { speaker: group.speaker, sentences: [] };
    // Join short sentences so a line has a few words; a line closes only once its
    // finished sentences reach that, so earlier lines never change afterwards.
    let line = '';
    for (const sentence of sentences) {
      line = line ? `${line} ${sentence}` : sentence;
      if (countWords(line) >= MIN_LINE_WORDS) {
        turn.sentences.push({ index: index++, text: line, complete: true });
        line = '';
      }
    }
    if (trailing) line = line ? `${line} ${trailing}` : trailing;
    // A new speaker ends the previous turn even without punctuation.
    if (line) turn.sentences.push({ index: index++, text: line, complete: !isLastGroup });
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

/**
 * Saved live transcripts: join the short pieces Deepgram finalizes at every pause
 * into readable lines of a few words, with commas at pauses. Speaker labels are
 * dropped — live diarization from one mic cannot tell one voice from two reliably.
 */
export function mergeLiveSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const merged: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    if (current) {
      const words = countWords(current.text);
      const done =
        words >= MAX_SEGMENT_WORDS ||
        (words >= MIN_LINE_WORDS && ENDS_WITH_TERMINATOR.test(current.text));
      if (!done) {
        current.text = joinAtPause(current.text, text);
        current.endMs = Math.max(current.endMs, seg.endMs);
        continue;
      }
      merged.push(current);
    }
    current = { startMs: seg.startMs, endMs: seg.endMs, text, speaker: null };
  }
  if (current) merged.push(current);
  return merged;
}
