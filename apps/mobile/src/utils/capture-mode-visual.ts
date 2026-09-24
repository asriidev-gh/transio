import type { CaptureMode } from '@sessionai/shared';
import type { AppIconName } from '@/src/components/ui/Icon';

export interface CaptureModeVisual {
  icon: AppIconName;
  /** Soft well background (light / dark). */
  light: string;
  dark: string;
  /** Glyph color. */
  colorKey: 'warning' | 'cyan' | 'accent' | 'accentDeep';
}

/** Left-rail icon + tint keyed by how the session was captured. */
export const CAPTURE_MODE_VISUAL: Record<CaptureMode, CaptureModeVisual> = {
  live_notes: {
    icon: 'sticky-note',
    light: 'rgba(245, 158, 11, 0.14)',
    dark: '#3A3428',
    colorKey: 'warning',
  },
  notes: {
    icon: 'download-outline',
    light: 'rgba(56, 189, 248, 0.14)',
    dark: '#2A3A48',
    colorKey: 'cyan',
  },
  live: {
    icon: 'sine-wave',
    light: 'rgba(91, 108, 255, 0.14)',
    dark: '#2E3A4A',
    colorKey: 'accent',
  },
  batch: {
    icon: 'microphone',
    light: 'rgba(156, 163, 175, 0.14)',
    dark: '#323A3E',
    colorKey: 'accentDeep',
  },
};

export function captureModeVisual(mode: CaptureMode | null | undefined): CaptureModeVisual {
  return CAPTURE_MODE_VISUAL[mode ?? 'batch'];
}
