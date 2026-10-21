import { getHandbookClassCoverSource } from './class-covers';
import type { HandbookEntry } from './types';

import pack from './dnd-classes.json';

/**
 * Классы из `dnd-classes.json` + локальные обложки.
 * Пересборка JSON: `node scripts/handbook/build-dnd-classes.mjs`
 */
export const DND_HANDBOOK_CLASS_ENTRIES: HandbookEntry[] = (
  pack.entries as HandbookEntry[]
).map((entry) => {
  const coverSource = getHandbookClassCoverSource(entry.title);
  if (!coverSource) return entry;
  return {
    ...entry,
    coverSource,
    coverUrl: undefined,
  };
});
