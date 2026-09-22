import { z } from 'zod';

export const MindMapNodeKindSchema = z.enum([
  'root',
  'topic',
  'keyPoint',
  'action',
  'question',
  'insight',
  'group',
]);
export type MindMapNodeKind = z.infer<typeof MindMapNodeKindSchema>;

export type MindMapNode = {
  id: string;
  label: string;
  detail?: string;
  kind: MindMapNodeKind;
  children: MindMapNode[];
};

export const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(120),
    detail: z.string().optional(),
    kind: MindMapNodeKindSchema,
    children: z.array(MindMapNodeSchema).max(16),
  }),
);

export const MindMapSchema = z.object({
  root: MindMapNodeSchema,
  source: z.literal('summary'),
});
export type MindMap = z.infer<typeof MindMapSchema>;

/** Inputs that can build a map (full AI summary or persisted summary row). */
export type MindMapSummaryInput = {
  overview?: string | null;
  keyPoints: string[];
  topics: Array<{ title: string; summary: string }>;
  questionsDiscussed: string[];
  actionItems: Array<{ task: string; details?: string }>;
  importantInsights: string[];
};

function truncateLabel(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max - 1);
  const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('—'));
  const base = breakAt > max * 0.45 ? slice.slice(0, breakAt) : slice;
  return `${base.trimEnd()}…`;
}

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const match = cleaned.match(/^(.+?[.!?])(\s|$)/);
  return match?.[1]?.trim() || cleaned;
}

/**
 * Deterministic mind map from an existing session summary (no extra LLM call).
 */
export function deriveMindMapFromSummary(
  summary: MindMapSummaryInput,
  opts?: { title?: string },
): MindMap {
  const overview = summary.overview?.trim() || '';
  const title = opts?.title?.trim();
  const rootLabel =
    title ||
    (overview ? truncateLabel(firstSentence(overview) || overview) : 'Session');

  const children: MindMapNode[] = [];

  summary.topics.forEach((topic, index) => {
    const label = topic.title.trim();
    if (!label) return;
    children.push({
      id: `topic-${index}`,
      label: truncateLabel(label),
      detail: topic.summary.trim() || undefined,
      kind: 'topic',
      children: [],
    });
  });

  const keyPoints = summary.keyPoints.map((p) => p.trim()).filter(Boolean);
  if (keyPoints.length) {
    children.push({
      id: 'group-keypoints',
      label: 'Key points',
      kind: 'group',
      children: keyPoints.slice(0, 12).map((point, index) => ({
        id: `kp-${index}`,
        label: truncateLabel(point),
        detail: point.length > 72 ? point : undefined,
        kind: 'keyPoint' as const,
        children: [],
      })),
    });
  }

  const questions = summary.questionsDiscussed.map((q) => q.trim()).filter(Boolean);
  if (questions.length) {
    children.push({
      id: 'group-questions',
      label: 'Questions',
      kind: 'group',
      children: questions.slice(0, 12).map((q, index) => ({
        id: `q-${index}`,
        label: truncateLabel(q),
        detail: q.length > 72 ? q : undefined,
        kind: 'question' as const,
        children: [],
      })),
    });
  }

  const actions = summary.actionItems
    .map((item) => ({
      task: item.task.trim(),
      details: item.details?.trim(),
    }))
    .filter((item) => item.task);
  if (actions.length) {
    children.push({
      id: 'group-actions',
      label: 'Actions',
      kind: 'group',
      children: actions.slice(0, 12).map((item, index) => ({
        id: `a-${index}`,
        label: truncateLabel(item.task),
        detail: item.details || (item.task.length > 72 ? item.task : undefined),
        kind: 'action' as const,
        children: [],
      })),
    });
  }

  const insights = summary.importantInsights.map((i) => i.trim()).filter(Boolean);
  if (insights.length) {
    children.push({
      id: 'group-insights',
      label: 'Insights',
      kind: 'group',
      children: insights.slice(0, 12).map((insight, index) => ({
        id: `i-${index}`,
        label: truncateLabel(insight),
        detail: insight.length > 72 ? insight : undefined,
        kind: 'insight' as const,
        children: [],
      })),
    });
  }

  return MindMapSchema.parse({
    root: {
      id: 'root',
      label: rootLabel,
      detail: overview || undefined,
      kind: 'root',
      children,
    },
    source: 'summary',
  });
}
