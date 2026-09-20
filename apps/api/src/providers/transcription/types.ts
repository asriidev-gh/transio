export interface TranscriptionInput {
  /** Raw audio bytes downloaded from private storage. */
  audio: Buffer;
  /** MIME type of the audio payload. */
  mimeType: string;
  /** Preferred filename hint for multipart providers. */
  fileName: string;
  /** Optional BCP-47 language hint. */
  language?: string;
}

export interface TranscriptionResult {
  text: string;
  language?: string | null;
}

/**
 * Replaceable speech-to-text provider.
 * Concrete implementations live under apps/api/src/providers.
 */
export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
