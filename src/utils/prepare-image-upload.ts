import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { UploadImageKind } from '@/constants/upload.config';
import { isGifImage } from '@/utils/image-format';

const UPLOAD_MAX_WIDTH: Record<UploadImageKind, number> = {
  avatar: 1024,
  profileCard: 1200,
};

const JPEG_QUALITY = 0.85;

export async function prepareImageForUpload(
  uri: string,
  kind: UploadImageKind,
): Promise<string> {
  if (isGifImage(uri)) {
    return uri;
  }

  // Profile card is already cropped and sized in PhotoCropEditor.
  if (kind === 'profileCard') {
    return uri;
  }

  const result = await manipulateAsync(
    uri,
    [{ resize: { width: UPLOAD_MAX_WIDTH[kind] } }],
    { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
  );

  return result.uri;
}
