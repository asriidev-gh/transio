import { LegalDocumentView } from '@/src/components/LegalDocumentView';
import { LEGAL_DOCS } from '@/src/data/legal';

export default function TermsScreen() {
  return <LegalDocumentView doc={LEGAL_DOCS.terms} />;
}
