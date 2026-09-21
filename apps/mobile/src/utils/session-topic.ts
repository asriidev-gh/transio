import type { SessionType } from '@sessionai/shared';

/** Visual topic for a session row — inferred from title, description, and type. */
export type SessionTopicKind =
  | 'health'
  | 'security'
  | 'celebration'
  | 'faith'
  | 'fitness'
  | 'finance'
  | 'travel'
  | 'science'
  | 'docs'
  | 'media'
  | 'music'
  | 'work'
  | 'study'
  | 'idea'
  | 'people'
  | 'notes'
  | 'meeting'
  | 'chat'
  | 'recording';

export type SessionTopicIcon =
  | 'heart'
  | 'key'
  | 'gift'
  | 'home-outline'
  | 'gym'
  | 'chart'
  | 'map-pin'
  | 'lab'
  | 'file-text'
  | 'camera'
  | 'file-music-outline'
  | 'bag'
  | 'computer'
  | 'bulb'
  | 'account-outline'
  | 'pencil'
  | 'calendar'
  | 'chat'
  | 'microphone';

export interface SessionTopicVisual {
  kind: SessionTopicKind;
  icon: SessionTopicIcon;
  light: string;
  dark: string;
}

const PATTERNS: Array<{ kind: SessionTopicKind; re: RegExp }> = [
  {
    kind: 'health',
    re: /\b(health|hospital|clinic|medical|doctor|nurse|dental|pharmacy|outpatient|inpatient|maxicare|philhealth|hmo|vaccine|covid|checkup|check-up|therapy|prescription|wellness)\b/i,
  },
  {
    kind: 'security',
    re: /\b(ssh|authentica|oauth|password|passkey|vpn|encrypt|cyber|security|keys?|lock)\b/i,
  },
  {
    kind: 'celebration',
    re: /\b(birthday|bday|anniversary|party|celebrate|celebration|gift|wedding|edad)\b/i,
  },
  {
    kind: 'faith',
    re: /\b(bible|scripture|sermon|gospel|church|devotion|prayer|worship|verse|fellowship)\b/i,
  },
  {
    kind: 'fitness',
    re: /\b(gym|workout|fitness|exercise|yoga|run|training|cardio)\b/i,
  },
  {
    kind: 'finance',
    re: /\b(money|salary|budget|invoice|payment|peso|dollar|finance|bank|invest|expense)\b/i,
  },
  {
    kind: 'travel',
    re: /\b(travel|trip|flight|airport|hotel|vacation|commute|tour)\b/i,
  },
  {
    kind: 'science',
    re: /\b(lab|science|research|experiment|chemistry|biology|physics)\b/i,
  },
  {
    kind: 'docs',
    re: /\b(pdf|document|contract|report|loa|memo|form|letter)\b/i,
  },
  {
    kind: 'media',
    re: /\b(video|camera|photo|import|mp4|mov|youtube|film)\b/i,
  },
  {
    kind: 'music',
    re: /\b(music|song|playlist|concert|album|podcast)\b/i,
  },
  {
    kind: 'work',
    re: /\b(standup|stand-up|sprint|client|office|career|\bjob\b|\bhr\b|payroll|quarterly)\b/i,
  },
  {
    kind: 'study',
    re: /\b(lecture|seminar|course|class|learning|lesson|tutorial|exam|homework|professor|student|education|linkedin)\b/i,
  },
  {
    kind: 'idea',
    re: /\b(brainstorm|idea|insight|strategy|roadmap|vision)\b/i,
  },
  {
    kind: 'people',
    re: /\b(friend|kaibigan|family|pamilya|relationship|love|crush|usapan|kwento|kwentuhan)\b/i,
  },
  {
    kind: 'notes',
    re: /\b(note|notes|notebook|journal|diary|jotted)\b/i,
  },
  {
    kind: 'meeting',
    re: /\b(meeting|1:1|one-on-one|sync|huddle|standup)\b/i,
  },
  {
    kind: 'chat',
    re: /\b(discussion|discuss|chat|group|conversation|usap)\b/i,
  },
];

const TYPE_FALLBACK: Record<SessionType, SessionTopicKind> = {
  meeting: 'meeting',
  lecture: 'study',
  seminar: 'study',
  bible_study: 'faith',
  group_discussion: 'chat',
  other: 'recording',
};

const VISUAL: Record<SessionTopicKind, Omit<SessionTopicVisual, 'kind'>> = {
  health: { icon: 'heart', light: '#FCE4EC', dark: '#3A2A2E' },
  security: { icon: 'key', light: '#EDE7F6', dark: '#2E3A4A' },
  celebration: { icon: 'gift', light: '#FFF8E1', dark: '#3A3A2E' },
  faith: { icon: 'home-outline', light: '#E8F5E9', dark: '#2A4652' },
  fitness: { icon: 'gym', light: '#FBE9E7', dark: '#3A2A28' },
  finance: { icon: 'chart', light: '#E3F2FD', dark: '#2A3A48' },
  travel: { icon: 'map-pin', light: '#E0F7FA', dark: '#2A4652' },
  science: { icon: 'lab', light: '#F3E5F5', dark: '#342A42' },
  docs: { icon: 'file-text', light: '#EFEBE9', dark: '#323A3E' },
  media: { icon: 'camera', light: '#ECEFF1', dark: '#2E3A40' },
  music: { icon: 'file-music-outline', light: '#F3E5F5', dark: '#342A42' },
  work: { icon: 'bag', light: '#FFF3E0', dark: '#3A3428' },
  study: { icon: 'computer', light: '#E8EEF6', dark: '#2A3A48' },
  idea: { icon: 'bulb', light: '#FFFDE7', dark: '#3A3A2E' },
  people: { icon: 'account-outline', light: '#FFE8D6', dark: '#3A3228' },
  notes: { icon: 'pencil', light: '#E3F2FD', dark: '#2A3A48' },
  meeting: { icon: 'calendar', light: '#EDE7F6', dark: '#2E3A4A' },
  chat: { icon: 'chat', light: '#C8EFD8', dark: '#2A4652' },
  recording: { icon: 'microphone', light: '#D5EBE0', dark: '#253B47' },
};

export function inferSessionTopicKind(input: {
  title: string;
  description?: string | null;
  sessionType: SessionType;
}): SessionTopicKind {
  const text = `${input.title} ${input.description ?? ''}`.trim();
  for (const rule of PATTERNS) {
    if (rule.re.test(text)) return rule.kind;
  }
  return TYPE_FALLBACK[input.sessionType];
}

export function sessionTopicVisual(input: {
  title: string;
  description?: string | null;
  sessionType: SessionType;
}): SessionTopicVisual {
  const kind = inferSessionTopicKind(input);
  return { kind, ...VISUAL[kind] };
}
