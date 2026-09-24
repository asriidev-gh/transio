import { LegalDocumentView } from '@/src/components/LegalDocumentView';
import { LEGAL_DOCS } from '@/src/data/legal';

export default function PrivacyScreen() {
  return <LegalDocumentView doc={LEGAL_DOCS.privacy} />;
}
