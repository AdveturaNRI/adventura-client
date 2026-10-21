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

export function getPartnersCache(): Partner[] | null {
  return cache;
}

export function getSidebarPartnersCache(): Partner[] | null {
  return sidebarCache;
}
