import { Share } from 'react-native';
import type { Session, SummaryRecord, Transcript } from '@sessionai/shared';
import { SESSION_TYPE_LABELS } from '@sessionai/shared';

export function buildSessionShareText(input: {
  session: Session;
  summary?: SummaryRecord | null;
  transcript?: Transcript | null;
}): string {
  const { session, summary, transcript } = input;
  const lines: string[] = [
    session.title,
    SESSION_TYPE_LABELS[session.sessionType],
    '',
  ];

  if (summary?.overview) {
    lines.push('Overview', summary.overview, '');
  }
  if (summary?.keyPoints?.length) {
    lines.push('Key points');
    for (const point of summary.keyPoints) lines.push(`• ${point}`);
    lines.push('');
  }
  if (summary?.actionItems?.length) {
    lines.push('Action items');
    for (const item of summary.actionItems) {
      lines.push(`• ${item.task}`);
      if (item.details) lines.push(`  ${item.details}`);
    }
    lines.push('');
  }
  if (transcript?.text) {
    lines.push('Transcript', transcript.text.slice(0, 4000));
    if (transcript.text.length > 4000) lines.push('…');
  }

  lines.push('', '— Shared from Smart Transcriber');
  return lines.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

export async function shareSessionContent(input: {
  session: Session;
  summary?: SummaryRecord | null;
  transcript?: Transcript | null;
}): Promise<void> {
  const message = buildSessionShareText(input);
  await Share.share({
    title: input.session.title,
    message,
  });
}
