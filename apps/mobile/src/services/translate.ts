import type {
  SummaryKind,
  TranslateLanguage,
  TranslateResult,
  TranslateScope,
} from '@sessionai/shared';
import { apiRequest } from './api';

export async function translateSessionContent(
  sessionId: string,
  language: TranslateLanguage,
  scope: TranslateScope,
  summaryKind?: SummaryKind,
): Promise<TranslateResult> {
  return apiRequest<TranslateResult>(`/sessions/${sessionId}/translate`, {
    method: 'POST',
    auth: true,
    body: { language, scope, ...(summaryKind ? { summaryKind } : {}) },
  });
}
