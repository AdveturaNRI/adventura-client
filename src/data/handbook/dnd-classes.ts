import { getHandbookClassBlurb } from './class-blurbs';
import { getHandbookClassCoverSource } from './class-covers';
import { parseClassSummary } from './class-summary';
import type { HandbookEntry } from './types';

import pack from './dnd-classes.json';

/** Скрытые из ленты классов (хоумбрю / не для показа). */
const HIDDEN_CLASS_IDS = new Set(['dndsu-5e2024-class-pugilist']);

function looksLikeEnglishOnly(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[A-Za-z][A-Za-z0-9 '’-]*$/.test(trimmed);
}

/**
 * Классы из `dnd-classes.json` + локальные обложки.
 * Пересборка JSON: `node scripts/handbook/build-dnd-classes.mjs`
 */
export const DND_HANDBOOK_CLASS_ENTRIES: HandbookEntry[] = (
  pack.entries as HandbookEntry[]
)
  .filter((entry) => !HIDDEN_CLASS_IDS.has(entry.id))
  .map((entry) => {
    const parsed = parseClassSummary(entry.summary);
    const blurb = getHandbookClassBlurb(entry.title);
    const coverSource = getHandbookClassCoverSource(entry.title);
    const summary =
      blurb ||
      (looksLikeEnglishOnly(parsed.text) ? '' : parsed.text);

    return {
      ...entry,
      summary,
      savingThrows:
        entry.savingThrows?.length ? entry.savingThrows : parsed.savingThrows,
      ...(coverSource
        ? { coverSource, coverUrl: undefined }
        : {}),
    };
  });
