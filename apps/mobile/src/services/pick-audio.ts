import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  isLikelyMedia,
  mimeTypeFromFileName,
} from '@/src/services/media-name';

export {
  isLikelyMedia,
  mimeTypeFromFileName,
  titleFromMediaName,
  titleFromMediaUrl,
} from '@/src/services/media-name';

export interface PickedAudio {
  uri: string;
  name: string;
  mimeType: string;
  /** Size in bytes when the picker reports it. */
  size?: number;
}

const MEDIA_ACCEPT = [
  'audio/*',
  'video/*',
  '.mp3',
  '.m4a',
  '.mp4',
  '.m4v',
  '.mov',
  '.mkv',
  '.wav',
  '.webm',
  '.ogg',
  '.aac',
  '.flac',
].join(',');

async function pickMediaWeb(): Promise<PickedAudio | null> {
  if (typeof document === 'undefined') return null;

  return await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = MEDIA_ACCEPT;
    input.style.display = 'none';
    let settled = false;

    const finish = (value: PickedAudio | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }

      const mimeType = file.type || mimeTypeFromFileName(file.name);
      if (!isLikelyMedia(file.name, mimeType)) {
        finish(null);
        return;
      }

      const keepType = file.type && (file.type.startsWith('audio/') || file.type.startsWith('video/'));
      const typed = keepType ? file : new File([file], file.name, { type: mimeType });
      finish({
        uri: URL.createObjectURL(typed),
        name: file.name,
        mimeType,
      });
    });

    input.addEventListener('cancel', () => finish(null));

    document.body.appendChild(input);
    input.click();
  });
}

async function pickMediaNative(): Promise<PickedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'audio/*',
      'video/*',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/x-m4a',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const name = asset.name || 'media.mp4';
  const mimeType = asset.mimeType || mimeTypeFromFileName(name);

  if (!isLikelyMedia(name, mimeType)) {
    throw new Error('Please choose an audio or video file (mp3, m4a, wav, mp4, webm, or mov).');
  }

  return {
    uri: asset.uri,
    name,
    mimeType,
    size: asset.size,
  };
}

/** Opens a system/browser file picker for a single audio or video file. Returns null if cancelled. */
export async function pickAudioFile(): Promise<PickedAudio | null> {
  if (Platform.OS === 'web') {
    return pickMediaWeb();
  }
  return pickMediaNative();
}
