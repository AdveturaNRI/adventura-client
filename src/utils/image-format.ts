export function isGifImage(uri: string, mimeType?: string | null): boolean {
  if (mimeType?.toLowerCase() === 'image/gif') {
    return true;
  }

  const normalizedUri = uri.split('?')[0]?.toLowerCase() ?? '';
  return normalizedUri.endsWith('.gif');
}
