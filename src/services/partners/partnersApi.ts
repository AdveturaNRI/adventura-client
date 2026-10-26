import { apiRequest } from '@/services/api/client';
import type { Partner } from '@/data/partners/partners';

type PartnerApiDto = {
  id: string;
  name: string;
  href: string;
  mark: string;
  tagline?: string;
  accent: string;
  logoUrl?: string | null;
};

let cache: Partner[] | null = null;
let inflight: Promise<Partner[]> | null = null;
let sidebarCache: Partner[] | null = null;
let sidebarInflight: Promise<Partner[]> | null = null;

function mapPartner(dto: PartnerApiDto): Partner {
  return {
    id: dto.id,
    name: dto.name,
    href: dto.href,
    mark: dto.mark,
    tagline: dto.tagline?.trim() || undefined,
    accent: dto.accent,
    logoUrl: dto.logoUrl ?? undefined,
  };
}

/** Активные партнёры из админки. Кэш на сессию, чтобы тикеры на разных экранах не били API. */
export function listPartners(options?: { force?: boolean }): Promise<Partner[]> {
  if (!options?.force && cache) {
    return Promise.resolve(cache);
  }
  if (!options?.force && inflight) {
    return inflight;
  }

  inflight = apiRequest<PartnerApiDto[]>('/partners', {
    skipLoading: true,
    skipAuthRefresh: true,
  })
    .then((rows) => {
      const next = Array.isArray(rows) ? rows.map(mapPartner) : [];
      cache = next;
      return next;
    })
    .catch(() => {
      cache = [];
      return [];
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Партнёры с галкой «В боковом меню» (+ активные). */
export function listSidebarPartners(options?: {
  force?: boolean;
}): Promise<Partner[]> {
  if (!options?.force && sidebarCache) {
    return Promise.resolve(sidebarCache);
  }
  if (!options?.force && sidebarInflight) {
    return sidebarInflight;
  }

  sidebarInflight = apiRequest<PartnerApiDto[]>('/partners?sidebar=1', {
    skipLoading: true,
    skipAuthRefresh: true,
  })
    .then((rows) => {
      const next = Array.isArray(rows) ? rows.map(mapPartner) : [];
      sidebarCache = next;
      return next;
    })
    .catch(() => {
      sidebarCache = [];
      return [];
    })
    .finally(() => {
      sidebarInflight = null;
    });

  return sidebarInflight;
}

export type PartnerNews = {
  id: string;
  partnerId: string;
  title: string;
  body: string;
  coverUrl: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  publishedAt: string;
  partner: {
    id: string;
    name: string;
    href: string;
    accent: string;
    logoUrl: string | null;
  };
};

let newsCache: PartnerNews[] | null = null;
let newsInflight: Promise<PartnerNews[]> | null = null;
const viewedNews = new Set<string>();

/** Свежие новости партнёров для карточки в меню: по одной на партнёра. */
export function listPartnerNews(options?: { force?: boolean }): Promise<PartnerNews[]> {
  if (!options?.force && newsCache) return Promise.resolve(newsCache);
  if (!options?.force && newsInflight) return newsInflight;

  newsInflight = apiRequest<PartnerNews[]>('/partners/news', {
    skipLoading: true,
    skipAuthRefresh: true,
  })
    .then((rows) => {
      newsCache = Array.isArray(rows) ? rows : [];
      return newsCache;
    })
    .catch(() => {
      newsCache = [];
      return [];
    })
    .finally(() => {
      newsInflight = null;
    });

  return newsInflight;
}

export function getPartnerNewsCache(): PartnerNews[] | null {
  return newsCache;
}

export function getPartnerNews(id: string): Promise<PartnerNews> {
  const cached = newsCache?.find((item) => item.id === id);
  if (cached) return Promise.resolve(cached);
  return apiRequest<PartnerNews>(`/partners/news/${encodeURIComponent(id)}`, {
    skipLoading: true,
    skipAuthRefresh: true,
  });
}

/** Показ считается раз за сессию; переход по кнопке — каждый раз. */
export function trackPartnerNews(id: string, kind: 'view' | 'click'): void {
  if (kind === 'view') {
    if (viewedNews.has(id)) return;
    viewedNews.add(id);
  }
  void apiRequest(`/partners/news/${encodeURIComponent(id)}/${kind}`, {
    method: 'POST',
    skipLoading: true,
    skipAuthRefresh: true,
  }).catch(() => undefined);
}

export function getPartnersCache(): Partner[] | null {
  return cache;
}

export function getSidebarPartnersCache(): Partner[] | null {
  return sidebarCache;
}
