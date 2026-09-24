import { LegalDocumentView } from '@/src/components/LegalDocumentView';
import { LEGAL_DOCS } from '@/src/data/legal';

export default function AboutScreen() {
  return <LegalDocumentView doc={LEGAL_DOCS.about} />;
}
