import { getHandbookClassBlurb } from './class-blurbs';
import { getHandbookClassCoverSource } from './class-covers';
import { getHandbookRaceCoverSource } from './race-covers.generated';
import type { HandbookEntry } from './types';

import backgroundsPack from './laaru/backgrounds.json';
import classesPack from './laaru/classes.json';
import racesPack from './laaru/races.json';
import spellsPack from './laaru/spells.json';

/**
 * Лёгкий индекс из Laaru•Compendium (D&D 5e 2014).
 * Пересборка: `npm run build:handbook-laaru`
 * Обложки классов — свои из `assets/handbook/classes`.
 * Портреты рас — из модуля Laaru (`assets/handbook/races`).
 */
const laaruClasses: HandbookEntry[] = (classesPack.entries as HandbookEntry[]).map((entry) => {
  const blurb = getHandbookClassBlurb(entry.title);
  const coverSource = getHandbookClassCoverSource(entry.title, entry.id);
  const { coverFile: _coverFile, ...rest } = entry as HandbookEntry & {
    coverFile?: string;
  };
  return {
    ...rest,
    summary: blurb || entry.summary,
    ...(coverSource ? { coverSource, coverUrl: undefined } : {}),
  };
});

function withRaceCover(entry: HandbookEntry): HandbookEntry {
  const coverSource = getHandbookRaceCoverSource(entry.id);
  const { coverFile: _coverFile, ...rest } = entry as HandbookEntry & {
    coverFile?: string;
  };
  return {
    ...rest,
    ...(coverSource ? { coverSource, coverUrl: undefined } : {}),
  };
}

/** «Своя раса» TCE — конструктор, не карточка расы. */
function isCustomLineage(entry: HandbookEntry): boolean {
  return /^Своя\s+раса/i.test(entry.title.trim());
}

function isDragonmark(title: string): boolean {
  return /^[МM]етка/i.test(title.trim());
}

/** Родитель из «Метка … — Полуэльф». */
function dragonmarkParentTitle(title: string): string | null {
  const m = title.trim().match(/^[МM]етка.+?[—–-]\s*(.+)$/u);
  return m ? m[1].trim() : null;
}

function isPrefixChild(childTitle: string, parentTitle: string): boolean {
  if (childTitle === parentTitle) return false;
  return (
    childTitle.startsWith(`${parentTitle} `) ||
    childTitle.startsWith(`${parentTitle}-`) ||
    childTitle.startsWith(`${parentTitle} (`) ||
    childTitle.startsWith(`${parentTitle} —`) ||
    childTitle.startsWith(`${parentTitle} –`)
  );
}

function slugRaceTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, '-')
    .replace(/^-|-$/g, '');
}

/** Если метка ссылается на «Эльф», а карточки «Эльф» нет — создаём родителя. */
function ensureParentsForMarks(entries: HandbookEntry[]): HandbookEntry[] {
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  const stubs: HandbookEntry[] = [];

  for (const entry of entries) {
    if (!isDragonmark(entry.title)) continue;
    const parentName = dragonmarkParentTitle(entry.title);
    if (!parentName || byTitle.has(parentName)) continue;

    const coverDonor =
      entries.find((e) => isPrefixChild(e.title, parentName) && e.coverSource != null) ||
      entry;
    const tagDonor =
      entries.find((e) => isPrefixChild(e.title, parentName) && e.tags.length > 0) || entry;
    const skipMeta = new Set(['Официальный', 'Homebrew']);
    const bookTag = tagDonor.tags.find((t) => !skipMeta.has(t));
    const official = tagDonor.tags.includes('Официальный');

    const stub: HandbookEntry = {
      id: `laaru-race-stub-${slugRaceTitle(parentName)}`,
      systemId: entry.systemId,
      category: 'races',
      title: parentName,
      summary: '',
      tags: [
        ...(bookTag ? [bookTag] : []),
        official ? 'Официальный' : 'Homebrew',
      ],
      ...(coverDonor.coverSource != null
        ? { coverSource: coverDonor.coverSource, coverUrl: undefined }
        : {}),
    };
    byTitle.set(parentName, stub);
    stubs.push(stub);
  }

  return stubs.length ? [...entries, ...stubs] : entries;
}

/**
 * Варианты и метки кладём в `variants` базовой расы.
 * В сетке остаётся только родитель.
 */
function nestRaceVariants(entries: HandbookEntry[]): HandbookEntry[] {
  const all = ensureParentsForMarks(entries);
  const byTitle = new Map(all.map((e) => [e.title, e]));
  const parentTitles = [...byTitle.keys()].sort((a, b) => b.length - a.length);
  const variantsByParentId = new Map<string, HandbookEntry[]>();
  const childIds = new Set<string>();

  const attach = (parent: HandbookEntry, child: HandbookEntry) => {
    if (childIds.has(child.id) || parent.id === child.id) return;
    childIds.add(child.id);
    const list = variantsByParentId.get(parent.id) ?? [];
    list.push(child);
    variantsByParentId.set(parent.id, list);
  };

  for (const entry of all) {
    if (!isDragonmark(entry.title)) continue;
    const parentName = dragonmarkParentTitle(entry.title);
    if (!parentName) continue;
    const parent = byTitle.get(parentName);
    if (parent) attach(parent, entry);
  }

  for (const entry of all) {
    if (childIds.has(entry.id) || isDragonmark(entry.title)) continue;
    for (const parentTitle of parentTitles) {
      if (!isPrefixChild(entry.title, parentTitle)) continue;
      const parent = byTitle.get(parentTitle);
      if (parent) attach(parent, entry);
      break;
    }
  }

  return all
    .filter((e) => !childIds.has(e.id))
    .map((e) => {
      const variants = variantsByParentId.get(e.id);
      if (!variants?.length) return e;
      return {
        ...e,
        variants: [...variants].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
      };
    });
}

const laaruRaces: HandbookEntry[] = nestRaceVariants(
  (racesPack.entries as HandbookEntry[]).filter((entry) => !isCustomLineage(entry)).map(withRaceCover),
);

export const LAARU_HANDBOOK_ENTRIES: HandbookEntry[] = [
  ...laaruClasses,
  ...laaruRaces,
  ...(backgroundsPack.entries as HandbookEntry[]),
  ...(spellsPack.entries as HandbookEntry[]),
];
