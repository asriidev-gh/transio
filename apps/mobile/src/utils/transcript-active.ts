import type { TranscriptSegment } from '@sessionai/shared';

/**
 * Index of the segment being spoken at `currentMs`, or -1 before the first one.
 * Segments are ordered by start time, so this is a binary search for the last segment that
 * has started. Playback updates several times a second, so it must not scan the whole list.
 */
export function activeSegmentIndex(
  segments: ReadonlyArray<Pick<TranscriptSegment, 'startMs'>>,
  currentMs: number,
): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = segments[mid]?.startMs ?? 0;
    if (start <= currentMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
