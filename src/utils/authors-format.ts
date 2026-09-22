import { MAX_UPLOAD_SIZE_MB } from '@/constants/upload.config';

export const AUTHOR_POST_MAX_FILE_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
export const AUTHOR_POST_MAX_FILE_SIZE_HINT = `Максимальный размер файла — ${MAX_UPLOAD_SIZE_MB} МБ`;

export function formatAuthorFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getAuthorFileExtension(name: string): string {
  const parts = name.trim().split('.');
  if (parts.length < 2) {
    return '';
  }
  return (parts[parts.length - 1] ?? '').toUpperCase();
}

export function isAuthorImageMime(type: string, name?: string): boolean {
  if (type.startsWith('image/')) {
    return true;
  }
  const lower = (name ?? '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/.test(lower);
}

export function formatAuthorPostDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatAuthorPrice(price: number, currency = '₽'): string {
  const amount = Number.isFinite(price) ? Math.round(price) : 0;
  return `${amount.toLocaleString('ru-RU')} ${currency}`.trim();
}

/** HTML/markdown → плоский текст для превью карточки */
export function authorContentToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\*\*|__/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function authorContentExcerpt(value: string, maxLength = 140): string {
  const plain = authorContentToPlainText(value);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
