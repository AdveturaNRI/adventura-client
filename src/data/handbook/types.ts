export type HandbookCategory =
  | 'races'
  | 'classes'
  | 'backgrounds'
  | 'feats'
  | 'glossary'
  | 'spells'
  | 'bestiary'
  | 'magicItems'
  | 'equipment'
  | 'beginners'
  /** @deprecated Prefer `glossary`. Kept for старые моки / storage. */
  | 'rules';

export type HandbookCategoryFilter = HandbookCategory | 'all';

export type HandbookSystem = {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  /** CDN/URL обложки (если нет локального ассета). */
  coverUrl?: string;
  /** Локальный require из `assets/handbook/systems`. */
  coverSource?: number;
  /** Акцент для градиента плитки (hex) */
  accent: string;
  isOfficial: boolean;
};

export type HandbookEntry = {
  id: string;
  systemId: string;
  category: HandbookCategory;
  title: string;
  summary: string;
  tags: string[];
  /** Спасброски класса — чипы на карточке (без «Кость хитов»). */
  savingThrows?: string[];
  /** Панорамная обложка для плитки (CDN). */
  coverUrl?: string;
  /** Локальный require из `assets/handbook/classes`. */
  coverSource?: number;
  /** Акцент нижней полоски на карточке. */
  accent?: string;
};
