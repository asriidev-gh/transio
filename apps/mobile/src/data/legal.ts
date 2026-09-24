/**
 * In-app legal / about copy for Smart Transcriber.
 * Not a substitute for counsel — update contact details and jurisdiction before production launch.
 */

import { APP_LOCKUP } from '@/src/data/brand';

export type LegalDocSlug = 'about' | 'privacy' | 'terms';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  slug: LegalDocSlug;
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<LegalDocSlug, LegalDocument> = {
  about: {
    slug: 'about',
    title: 'About us',
    updated: 'September 22, 2026',
    intro:
      `${APP_LOCKUP}. Capture conversations, turn them into clear notes, optionally generate AI summaries, and translate live speech when you need another language — so you can focus on the discussion, not the notebook.`,
    sections: [
      {
        heading: 'What we build',
        paragraphs: [
          'We make it easy to record or upload audio, transcribe speech into searchable notes, organize sessions into folders, and translate finished notes when you need another language.',
          'Voice translate lets you hold to talk in one language and hear a spoken translation on your phone — handy for face-to-face conversations.',
          'Notes stay faithful to what was said. AI Summary is opt-in whenever you want a polished overview.',
        ],
      },
      {
        heading: 'Our principles',
        paragraphs: ['We design around a few simple rules:'],
        bullets: [
          'Your sessions belong to your account.',
          'Processing should be understandable — no surprise auto-summaries.',
          'The product should feel fast on phone and web.',
          'Support is reachable when something breaks.',
        ],
      },
      {
        heading: 'Get in touch',
        paragraphs: [
          'Questions, feedback, or partnership ideas are welcome. Reach us from Help → Contact us, or email andyr@consorttech.com.',
        ],
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy policy',
    updated: 'September 22, 2026',
    intro:
      'This policy explains what Smart Transcriber collects, how we use it, and the choices you have. By using the app, you agree to this policy.',
    sections: [
      {
        heading: '1. Information we collect',
        paragraphs: ['Depending on how you use Smart Transcriber, we may process:'],
        bullets: [
          'Account details such as email address and authentication identifiers.',
          'Session content you create: audio recordings, transcripts, notes, summaries, translations, and related metadata (titles, folders, timestamps).',
          'Voice translate clips and text you submit when you use hold-to-talk translation (short audio for speech recognition and translation).',
          'On-device Voice translate conversation history stored locally on your phone so you can continue or reopen past chats.',
          'Device and usage information needed to run the service (app version, platform, approximate diagnostics when you report a bug).',
          'Support messages you send to us.',
        ],
      },
      {
        heading: '2. How we use information',
        paragraphs: ['We use this information to:'],
        bullets: [
          'Provide transcription, notes, optional AI summaries, session translation, voice translate, and sync across your signed-in devices.',
          'Secure accounts, prevent abuse, and improve reliability.',
          'Respond to support requests and bug reports.',
          'Comply with legal obligations when required.',
        ],
      },
      {
        heading: '3. AI and third-party processors',
        paragraphs: [
          'Audio and text you submit for processing may be sent to infrastructure and AI providers solely to deliver features you request (for example transcription, summarization, or voice translate). We do not sell your session content.',
          'When you use Voice translate, each hold-to-talk clip is sent for speech recognition and translation. Spoken playback of the translation uses your device’s built-in text-to-speech and does not require a separate cloud voice call.',
          'Those providers process data under their own terms and safeguards. We configure services to support the product experience described in the app.',
        ],
      },
      {
        heading: '4. Sharing',
        paragraphs: [
          'We do not sell personal information. We may share data with service providers who help us operate Smart Transcriber (hosting, auth, storage, AI inference), or when required by law, or to protect rights and safety.',
        ],
      },
      {
        heading: '5. Retention',
        paragraphs: [
          'We retain account and session data while your account is active and as needed to provide the service. You may delete sessions from the app.',
          'Voice translate conversation history is stored on your device. You can archive, reopen, or delete those chats from History in the app. Clearing app data or uninstalling removes local history on that device.',
          'If you want your account removed, contact support and we will process the request within a reasonable time, subject to legal retention needs.',
        ],
      },
      {
        heading: '6. Security',
        paragraphs: [
          'We use industry-standard measures such as encrypted transport and access controls. No method of transmission or storage is perfectly secure; please use a strong password and keep your devices updated.',
        ],
      },
      {
        heading: '7. Your choices',
        paragraphs: [
          'You can update account email through your auth provider flows, delete sessions, manage Voice translate history on your device, control notification and microphone permissions on your device, and contact us about access or deletion requests.',
        ],
      },
      {
        heading: '8. Children',
        paragraphs: [
          'Smart Transcriber is not directed to children under 13 (or the minimum age required in your region). Do not use the service if you are under that age.',
        ],
      },
      {
        heading: '9. Changes',
        paragraphs: [
          'We may update this policy from time to time. We will revise the “Last updated” date above and, when changes are material, provide additional notice in the app when practical.',
        ],
      },
      {
        heading: '10. Contact',
        paragraphs: [
          'Privacy questions: andyr@consorttech.com, or Help → Contact us in the app.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of service',
    updated: 'September 22, 2026',
    intro:
      'These Terms govern your use of Smart Transcriber. By creating an account or using the app, you agree to them.',
    sections: [
      {
        heading: '1. The service',
        paragraphs: [
          'Smart Transcriber provides tools to record or upload audio, generate transcripts and notes, optionally create AI summaries, organize sessions, translate session content, use voice translate for spoken back-and-forth, and related features we make available over time.',
          'Features may change, and availability can depend on your plan, device capabilities, and third-party services.',
        ],
      },
      {
        heading: '2. Accounts',
        paragraphs: [
          'You are responsible for safeguarding your login credentials and for activity under your account. Provide accurate information and notify us promptly of unauthorized use.',
        ],
      },
      {
        heading: '3. Acceptable use',
        paragraphs: ['You agree not to:'],
        bullets: [
          'Use the service for unlawful, harmful, or abusive purposes.',
          'Upload content you do not have rights to record or process.',
          'Attempt to disrupt, reverse engineer, or overload the service except as allowed by law.',
          'Misrepresent the source of AI-generated summaries or translations as human-authored when disclosure is required.',
        ],
      },
      {
        heading: '4. Your content',
        paragraphs: [
          'You retain ownership of audio and text you submit. You grant us a limited license to host, process, and display that content solely to operate and improve the features you use.',
          'You are responsible for obtaining any consents required to record other people and for complying with local recording laws.',
        ],
      },
      {
        heading: '5. AI output',
        paragraphs: [
          'Transcripts, summaries, and translations can contain errors. Treat AI output as assistive, not definitive. You are responsible for reviewing important content before relying on it.',
        ],
      },
      {
        heading: '6. Disclaimers',
        paragraphs: [
          'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY LAW.',
        ],
      },
      {
        heading: '7. Limitation of liability',
        paragraphs: [
          'TO THE FULLEST EXTENT PERMITTED BY LAW, SMART TRANSCRIBER AND ITS OPERATORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR BUSINESS, ARISING FROM YOUR USE OF THE SERVICE.',
        ],
      },
      {
        heading: '8. Termination',
        paragraphs: [
          'You may stop using the service at any time. We may suspend or terminate access if you violate these Terms or if we discontinue the product. Provisions that by nature should survive will survive termination.',
        ],
      },
      {
        heading: '9. Changes',
        paragraphs: [
          'We may update these Terms. Continued use after changes become effective constitutes acceptance of the updated Terms. The “Last updated” date shows the latest revision.',
        ],
      },
      {
        heading: '10. Contact',
        paragraphs: [
          'Questions about these Terms: andyr@consorttech.com, or Help → Contact us.',
        ],
      },
    ],
  },
};

export function getLegalDocument(slug: string | undefined): LegalDocument | null {
  if (slug === 'about' || slug === 'privacy' || slug === 'terms') {
    return LEGAL_DOCS[slug];
  }
  return null;
}
