import type { HandbookEntry } from '@/data/handbook/types';

/** Короткое имя варианта под родителем. */
export function variantShortTitle(variantTitle: string, parentTitle: string): string {
  const t = variantTitle.trim();
  if (/^[МM]етка/i.test(t)) return t;
  if (t.startsWith(`${parentTitle} `)) return t.slice(parentTitle.length).trim();
  if (t.startsWith(`${parentTitle}-`)) return t.slice(parentTitle.length + 1).trim();
  if (t.startsWith(`${parentTitle} (`)) return t.slice(parentTitle.length).trim();
  if (t.startsWith(`${parentTitle} —`) || t.startsWith(`${parentTitle} –`)) {
    return t.slice(parentTitle.length).replace(/^[—–]\s*/, '').trim();
  }
  return t;
}

export function raceSourceLabel(entry: HandbookEntry): string {
  const skip = new Set(['Официальный', 'Homebrew']);
  const tag = entry.tags.find((t) => !skip.has(t));
  return tag || '';
}

export function usableRaceSubtitle(title: string, subtitle?: string): string | undefined {
  if (!subtitle) return undefined;
  const s = subtitle.trim();
  if (!s) return undefined;
  if (/[а-яё]/i.test(s)) return s;
  if (!/\s/.test(s) && /[а-яё]/i.test(title) && s.length <= 14) return undefined;
  return s;
}

export function variantCountLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} вариант`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} варианта`;
  return `${n} вариантов`;
}
