export function isGifImage(uri, mimeType) {
    if (mimeType?.toLowerCase() === 'image/gif') {
        return true;
    }
    const normalizedUri = uri.split('?')[0]?.toLowerCase() ?? '';
    return normalizedUri.endsWith('.gif');
}
