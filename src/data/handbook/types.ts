export type HandbookCategory =
  | 'races'
  | 'classes'
  | 'spells'
  | 'equipment'
  | 'bestiary'
  | 'rules';

export type HandbookCategoryFilter = HandbookCategory | 'all';

export type HandbookSystem = {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  coverUrl: string;
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
};
