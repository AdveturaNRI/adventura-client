import { Image as RNImage, Platform } from 'react-native';

function getImageSizeViaDom(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API unavailable'));
      return;
    }

    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = uri;
  });
}

function getImageSizeViaNative(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

export async function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  if (Platform.OS === 'web') {
    try {
      return await getImageSizeViaDom(uri);
    } catch {
      return getImageSizeViaNative(uri);
    }
  }

  return getImageSizeViaNative(uri);
}
