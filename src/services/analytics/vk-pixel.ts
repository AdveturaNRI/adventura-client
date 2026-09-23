import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

/**
 * VK Ads (Top.Mail.Ru) pixel integration for the web build only.
 *
 * The pixel uses the current `_tmr` queue protocol from the code snippet in
 * VK Ads: page views are `pageView`, and JS goals are `reachGoal`.
 */
export const VK_PIXEL_EVENTS = {
  registration: 'adventura_registration',
  profileCreated: 'adventura_profile_created',
  applicationSent: 'adventura_application_sent',
  applicationApproved: 'adventura_application_approved',
  landingCta: 'adventura_landing_cta',
} as const;

export type VkPixelEventName = (typeof VK_PIXEL_EVENTS)[keyof typeof VK_PIXEL_EVENTS];

type VkPixelCommand =
  | { type: 'pageView'; id: number; start: number; url?: string }
  | { type: 'reachGoal'; id: number; goal: VkPixelEventName };

declare global {
  interface Window {
    _tmr?: VkPixelCommand[];
  }
}

const VK_PIXEL_SCRIPT = 'https://top-fwz1.mail.ru/js/code.js';
const MAX_PENDING_COMMANDS = 50;

let initializedId: string | null = null;
let initPromise: Promise<boolean> | null = null;
let resolvedId: string | null = null;
let pendingCommands: VkPixelCommand[] = [];
let lastPageView: string | null = null;

function normalizePixelId(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  // VK Ads pixel identifiers are numeric. Reject malformed configuration rather
  // than creating an arbitrary third-party script request.
  return /^\d{1,20}$/.test(value) ? value : null;
}

export function getVkPixelId(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  return resolvedId;
}

export function isVkPixelAvailable(): boolean {
  return Boolean(getVkPixelId());
}

function enqueue(command: VkPixelCommand): void {
  if (typeof window === 'undefined') return;
  window._tmr = window._tmr ?? [];
  window._tmr.push(command);
}

function queueBeforeInit(command: VkPixelCommand): void {
  if (pendingCommands.length >= MAX_PENDING_COMMANDS) {
    pendingCommands.shift();
  }
  pendingCommands.push(command);
}

function loadPixelScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${VK_PIXEL_SCRIPT}"]`,
  );
  if (existing) {
    if (existing.dataset.loaded === '1' || existing.dataset.failed === '1') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = VK_PIXEL_SCRIPT;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    // A content blocker must never prevent login, registration, or navigation.
    script.onerror = () => {
      script.dataset.failed = '1';
      resolve();
    };
    document.head.appendChild(script);
  });
}

async function fetchPixelId(): Promise<string | null> {
  try {
    const payload = await apiRequest<{ vkAdsPixel?: { pixelId?: string | null } }>(
      '/config/public',
      { skipLoading: true, skipAuthRefresh: true },
    );
    return normalizePixelId(payload.vkAdsPixel?.pixelId);
  } catch {
    return null;
  }
}

/** Safely starts the async VK Ads tag once, including React Strict Mode. */
export async function initVkPixel(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const id = resolvedId ?? (await fetchPixelId());
    if (!id) return false;
    resolvedId = id;
    if (initializedId === id) return true;
    // The official tag consumes commands from this queue; create it before the
    // script is requested so calls made during loading are retained.
    if (typeof window === 'undefined') return false;
    window._tmr = window._tmr ?? [];
    await loadPixelScript();
    initializedId = id;
    const commands = pendingCommands;
    pendingCommands = [];
    commands.forEach(enqueue);
    return true;
  })().catch(() => false);

  return initPromise;
}

function dispatch(command: VkPixelCommand): void {
  const id = getVkPixelId();
  if (!id) {
    // Configuration is asynchronous. Retry this one command once the public
    // backend configuration is available; failed config remains a safe no-op.
    void initVkPixel().then((ready) => {
      if (ready) dispatch(command);
    });
    return;
  }
  if (initializedId === id) {
    enqueue(command);
    return;
  }
  queueBeforeInit(command);
  void initVkPixel();
}

/** SPA virtual pageview. `url` must already be a relative, safe URL. */
export function hitVkPixel(url: string): void {
  if (!url || lastPageView === url) return;
  lastPageView = url;
  const id = getVkPixelId();
  if (id) {
    dispatch({ type: 'pageView', id: Number(id), start: Date.now(), url });
    return;
  }
  void initVkPixel().then((ready) => {
    const resolved = getVkPixelId();
    if (ready && resolved) {
      dispatch({ type: 'pageView', id: Number(resolved), start: Date.now(), url });
    }
  });
}

/** Records a configured VK Ads JS goal without any user or profile data. */
export function trackVkEvent(eventName: VkPixelEventName): void {
  const id = getVkPixelId();
  if (id) {
    dispatch({ type: 'reachGoal', id: Number(id), goal: eventName });
    return;
  }
  void initVkPixel().then((ready) => {
    const resolved = getVkPixelId();
    if (ready && resolved) {
      dispatch({ type: 'reachGoal', id: Number(resolved), goal: eventName });
    }
  });
}

/** Test-only reset; not used by application code. */
export function __resetVkPixelForTests(): void {
  initializedId = null;
  initPromise = null;
  resolvedId = null;
  pendingCommands = [];
  lastPageView = null;
}
