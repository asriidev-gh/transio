export function localAudioStorageKey(sessionId: string): string {
  return `sessionai:local-audio:${sessionId}`;
}
