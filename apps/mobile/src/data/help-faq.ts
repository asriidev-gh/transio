/**
 * In-app Help Center Q&A for Smart Transcriber.
 * Keep answers short and product-accurate; contact form covers the rest.
 */

export interface HelpFaqItem {
  id: string;
  question: string;
  answer: string;
  /** Optional keywords to improve search match. */
  tags?: string[];
}

export const HELP_FAQ: HelpFaqItem[] = [
  {
    id: 'how-it-works',
    question: 'How does Smart Transcriber work?',
    answer:
      'Record or upload audio, and Smart Transcriber turns it into searchable notes. You can keep raw Notes as spoken bullets, optionally generate an AI Summary, translate finished notes, or use Voice translate for live hold-to-talk conversations.',
    tags: ['overview', 'notes', 'summary', 'transcribe', 'translate'],
  },
  {
    id: 'recording-limit',
    question: 'Is there a limit on recording time?',
    answer:
      'You can capture long sessions, but very large files may take longer to upload and process. For best results, keep recordings clear and avoid long stretches of silence when possible.',
    tags: ['limit', 'duration', 'length'],
  },
  {
    id: 'privacy',
    question: 'Are my recordings private?',
    answer:
      'Yes. Sessions belong to your account. Only you can access your recordings, transcripts, notes, and summaries from devices signed in with your credentials. Voice translate clips are processed when you use hold-to-talk; conversation history stays on that phone unless you share it.',
    tags: ['privacy', 'security', 'data', 'voice translate'],
  },
  {
    id: 'accuracy',
    question: 'How accurate are the transcriptions?',
    answer:
      'Transcription quality depends on audio clarity, accents, overlapping speakers, and background noise. Clear speech close to the mic produces the best results. You can edit notes after processing.',
    tags: ['whisper', 'accuracy', 'quality'],
  },
  {
    id: 'notes-vs-summary',
    question: 'What’s the difference between Notes and AI Summary?',
    answer:
      'Notes are the raw spoken content as bullets — what was said. AI Summary is an optional, polished overview you generate when you want highlights and structure. Processing never auto-summarizes; you choose when to create a summary.',
    tags: ['notes', 'summary', 'ai'],
  },
  {
    id: 'file-transcribe',
    question: 'Can I transcribe an audio or video file?',
    answer:
      'Yes. From Home tap Upload, or from New session choose Transcribe Audio/Video File. Pick a file or paste a direct media URL, then Transcribe.',
    tags: ['upload', 'file', 'transcribe', 'import'],
  },
  {
    id: 'live-notes',
    question: 'How does Live Note Taker work?',
    answer:
      'Live Note Taker turns speech into paper-style bullets while you talk, then saves those notes when you stop. Audio is kept; a full transcript is not saved.',
    tags: ['live', 'notes', 'captions'],
  },
  {
    id: 'upload',
    question: 'Can I create notes from an audio file?',
    answer:
      'For a full transcript, use Transcribe Audio/Video File. For spoken bullets while recording, use Live Note Taker.',
    tags: ['upload', 'import', 'file'],
  },
  {
    id: 'translate',
    question: 'Can I translate my notes?',
    answer:
      'Yes. Open a session with notes, use Translate, pick a language, and confirm. You can switch between the original and translated language pills afterward.',
    tags: ['translate', 'language', 'notes'],
  },
  {
    id: 'voice-translate',
    question: 'How does Voice translate work?',
    answer:
      'From Translate → Voice translate, choose languages, then hold the mic to speak. We transcribe and translate the clip; your phone speaks the result with built-in text-to-speech (no extra playback cost). Turns stack in a conversation you can continue later, start new (which archives the old one to History), share, or reopen from History.',
    tags: ['voice translate', 'live', 'hold', 'tts', 'history', 'language'],
  },
  {
    id: 'languages',
    question: 'Can I record in multiple languages?',
    answer:
      'Transcription works best when a session is mostly one language. Mixed-language recordings may be less accurate. Use Translate after processing if you need another language version of the notes, or Voice translate for live back-and-forth.',
    tags: ['language', 'multilingual', 'voice translate'],
  },
  {
    id: 'folders',
    question: 'How do folders work?',
    answer:
      'Organize sessions into folders from the session header or Edit session. Use folders to keep related meetings, classes, or projects together.',
    tags: ['folder', 'organize'],
  },
  {
    id: 'devices',
    question: 'Can I access Smart Transcriber on multiple devices?',
    answer:
      'Sign in with the same account on each device. Your sessions sync through your cloud account so history stays available wherever you open the app. Voice translate conversation history is stored on each phone locally and does not sync across devices.',
    tags: ['sync', 'devices', 'account', 'voice translate'],
  },
  {
    id: 'background',
    question: 'Can I keep recording with the screen off?',
    answer:
      'Recording behavior depends on your device and OS power settings. Keep the app open when possible for the most reliable capture, especially on long sessions.',
    tags: ['background', 'screen'],
  },
];

/** Case-insensitive filter across question, answer, and tags. */
export function filterHelpFaq(query: string, items: HelpFaqItem[] = HELP_FAQ): HelpFaqItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const hay = [item.question, item.answer, ...(item.tags ?? [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}
