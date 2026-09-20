import type { SessionSummary, SessionType } from '@sessionai/shared';

export interface SummaryInput {
  transcriptText: string;
  sessionType: SessionType;
  title?: string;
}

/**
 * Replaceable structured-summary provider.
 * Concrete implementations live under apps/api/src/providers/summary.
 */
export interface SummaryProvider {
  readonly name: string;
  summarize(input: SummaryInput): Promise<SessionSummary>;
}
