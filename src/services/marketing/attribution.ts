import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

export const ANON_KEY = '@adventura/marketing-anonymous-id-v1';

export type MarketingQuery = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  yclid?: string;
  adv_variant?: string;
  landingSlug?: string;
};

let cachedAnonymousId: string | null = null;
let anonymousIdPromise: Promise<string> | null = null;

function softLog(...args: unknown[]) {
  // eslint-disable-next-line no-undef
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}

function safeLocalStorageGet(key: string): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomBytes(size: number): Uint8Array {
  const out = new Uint8Array(size);
  // Web crypto
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any)?.crypto;
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(out);
      return out;
    }
  } catch {
    // ignore
  }
  // Fallback
  for (let i = 0; i < size; i += 1) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

function uuidv4(): string {
  // Prefer native implementation when available
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any)?.crypto;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
  } catch {
    // ignore
  }

  const bytes = randomBytes(16);
  // RFC 4122 version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

function pickFirst(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = pickFirst(item);
      if (picked) return picked;
    }
  }
  return undefined;
}

function getParam(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  return raw?.trim() ? raw.trim() : undefined;
}

export function parseMarketingQuery(
  input: URLSearchParams | Record<string, unknown>,
): MarketingQuery {
  if (typeof (input as URLSearchParams)?.get === 'function') {
    const params = input as URLSearchParams;
    return {
      utm_source: getParam(params, 'utm_source'),
      utm_medium: getParam(params, 'utm_medium'),
      utm_campaign: getParam(params, 'utm_campaign'),
      utm_content: getParam(params, 'utm_content'),
      utm_term: getParam(params, 'utm_term'),
      utm_id: getParam(params, 'utm_id'),
      yclid: getParam(params, 'yclid'),
      adv_variant: getParam(params, 'adv_variant'),
      landingSlug: getParam(params, 'landing') ?? getParam(params, 'landingSlug'),
    };
  }

  const obj = input as Record<string, unknown>;
  return {
    utm_source: pickFirst(obj.utm_source),
    utm_medium: pickFirst(obj.utm_medium),
    utm_campaign: pickFirst(obj.utm_campaign),
    utm_content: pickFirst(obj.utm_content),
    utm_term: pickFirst(obj.utm_term),
    utm_id: pickFirst(obj.utm_id),
    yclid: pickFirst(obj.yclid),
    adv_variant: pickFirst(obj.adv_variant),
    landingSlug: pickFirst(obj.landing) ?? pickFirst(obj.landingSlug),
  };
}

export async function getMarketingAnonymousId(): Promise<string> {
  if (cachedAnonymousId) {
    return cachedAnonymousId;
  }
  if (anonymousIdPromise) {
    return anonymousIdPromise;
  }

  anonymousIdPromise = (async () => {
    const fromLocalStorage = safeLocalStorageGet(ANON_KEY);
    if (fromLocalStorage?.trim()) {
      cachedAnonymousId = fromLocalStorage.trim();
      try {
        await AsyncStorage.setItem(ANON_KEY, cachedAnonymousId);
      } catch {
        // ignore
      }
      return cachedAnonymousId;
    }

    try {
      const stored = await AsyncStorage.getItem(ANON_KEY);
      if (stored?.trim()) {
        cachedAnonymousId = stored.trim();
        safeLocalStorageSet(ANON_KEY, cachedAnonymousId);
        return cachedAnonymousId;
      }
    } catch {
      // ignore
    }

    cachedAnonymousId = uuidv4();
    safeLocalStorageSet(ANON_KEY, cachedAnonymousId);
    try {
      await AsyncStorage.setItem(ANON_KEY, cachedAnonymousId);
    } catch {
      // ignore
    }
    return cachedAnonymousId;
  })();

  return anonymousIdPromise;
}

function resolveWebReferrerOrigin(): string | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  try {
    if (typeof document === 'undefined' || !document.referrer) {
      return null;
    }
    const url = new URL(document.referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export type RecordMarketingTouchInput = {
  anonymousId?: string;
  query?: MarketingQuery;
  landingSlug?: string;
};

function optionalTrimmed(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function recordMarketingTouch(input: RecordMarketingTouchInput): Promise<void> {
  try {
    const anonymousId = input.anonymousId ?? (await getMarketingAnonymousId());
    const query = input.query ?? {};
    const referrer = resolveWebReferrerOrigin();

    await apiRequest<{ ok?: boolean }>('/marketing/attribution/touches', {
      method: 'POST',
      skipAuthRefresh: true,
      skipLoading: true,
      body: {
        anonymousId,
        ...(optionalTrimmed(query.adv_variant)
          ? { variantId: optionalTrimmed(query.adv_variant) }
          : {}),
        ...(optionalTrimmed(query.utm_source)
          ? { utmSource: optionalTrimmed(query.utm_source) }
          : {}),
        ...(optionalTrimmed(query.utm_medium)
          ? { utmMedium: optionalTrimmed(query.utm_medium) }
          : {}),
        ...(optionalTrimmed(query.utm_campaign)
          ? { utmCampaign: optionalTrimmed(query.utm_campaign) }
          : {}),
        ...(optionalTrimmed(query.utm_content)
          ? { utmContent: optionalTrimmed(query.utm_content) }
          : {}),
        ...(optionalTrimmed(query.utm_term)
          ? { utmTerm: optionalTrimmed(query.utm_term) }
          : {}),
        ...(optionalTrimmed(query.utm_id) ? { utmId: optionalTrimmed(query.utm_id) } : {}),
        ...(optionalTrimmed(query.yclid) ? { yclid: optionalTrimmed(query.yclid) } : {}),
        ...(referrer ? { referrer } : {}),
        ...(optionalTrimmed(input.landingSlug ?? query.landingSlug)
          ? { landingSlug: optionalTrimmed(input.landingSlug ?? query.landingSlug) }
          : {}),
      },
    });
  } catch (error) {
    softLog('[marketing] recordMarketingTouch failed', error);
  }
}

export type MarketingConversionType =
  | 'LANDING_VIEW'
  | 'CTA_CLICK'
  | 'REGISTRATION_STARTED';

export type RecordMarketingConversionInput = {
  type: MarketingConversionType;
  /** @deprecated use `type` */
  event?: MarketingConversionType;
  anonymousId?: string;
  landingSlug?: string;
  variantId?: string | null;
  idempotencyKey: string;
  props?: Record<string, string | number | boolean | null | undefined>;
};

export async function recordMarketingConversion(
  input: RecordMarketingConversionInput,
): Promise<void> {
  try {
    const anonymousId = input.anonymousId ?? (await getMarketingAnonymousId());
    const type = input.type ?? input.event;
    if (!type) {
      softLog('[marketing] recordMarketingConversion skipped: missing type');
      return;
    }
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      softLog('[marketing] recordMarketingConversion skipped: missing idempotencyKey');
      return;
    }

    await apiRequest<{ ok?: boolean }>('/marketing/conversions', {
      method: 'POST',
      skipAuthRefresh: true,
      skipLoading: true,
      body: {
        type,
        anonymousId,
        idempotencyKey,
        ...(optionalTrimmed(input.landingSlug)
          ? { landingSlug: optionalTrimmed(input.landingSlug) }
          : {}),
        ...(optionalTrimmed(input.variantId)
          ? { variantId: optionalTrimmed(input.variantId) }
          : {}),
        ...(input.props ? { props: input.props } : {}),
      },
    });
  } catch (error) {
    softLog('[marketing] recordMarketingConversion failed', error);
  }
}

export async function bindMarketingTouches(
  token: string,
  anonymousId?: string,
): Promise<void> {
  try {
    const id = anonymousId ?? (await getMarketingAnonymousId());
    await apiRequest<{ ok?: boolean }>('/marketing/attribution/bind', {
      method: 'POST',
      token,
      skipLoading: true,
      body: { anonymousId: id },
    });
  } catch (error) {
    softLog('[marketing] bindMarketingTouches failed', error);
  }
}

