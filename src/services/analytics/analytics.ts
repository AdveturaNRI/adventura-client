import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';
import { ApiError } from '@/services/api/api-error';
import { reachYandexMetrikaGoal } from '@/services/analytics/yandex-metrika';

export type AnalyticsPlatform = 'WEB' | 'ANDROID' | 'IOS';
export type AnalyticsEntityKind = 'club' | 'player' | 'game';

export const IMPRESSION_DWELL_MS = 3000;

const CLIENT_ANALYTICS_EVENTS = {
  USER_SESSION_STARTED: 'user_session_started',
} as const;

/** Map product events → Metrika goal names (create same goals in Metrika UI). */
const METRIKA_GOAL_BY_EVENT: Record<string, string> = {
  user_session_started: 'session_started',
  user_registered: 'register',
  player_profile_created: 'profile_created',
  game_listing_created: 'listing_created',
  game_application_sent: 'application_sent',
  player_match_completed: 'match_completed',
  club_profile_created: 'club_created',
  landing_view: 'landing_view',
  cta_click: 'cta_click',
  registration_started: 'registration_started',
};

type TrackPayload = {
  name: string;
  props?: Record<string, string | number | boolean | string[]>;
  occurredAt?: string;
};

const QUEUE_FLUSH_MS = 1500;
const MAX_BATCH = 20;

let queue: TrackPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastSessionAt = 0;

/** Client-side dedupe before hitting rate-limited routes. */
const localViewSentAt = new Map<string, number>();
const localTransitionSentAt = new Map<string, number>();
const LOCAL_DEDUP_MS = 60 * 60 * 1000;

function resolvePlatform(): AnalyticsPlatform {
  if (Platform.OS === 'android') {
    return 'ANDROID';
  }
  if (Platform.OS === 'ios') {
    return 'IOS';
  }
  return 'WEB';
}

function resolveAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0'
  );
}

function entityKey(entity: AnalyticsEntityKind, id: string) {
  return `${entity}:${id}`;
}

function shouldSendLocal(
  map: Map<string, number>,
  entity: AnalyticsEntityKind,
  id: string,
): boolean {
  const key = entityKey(entity, id);
  const last = map.get(key) ?? 0;
  if (Date.now() - last < LOCAL_DEDUP_MS) {
    return false;
  }
  map.set(key, Date.now());
  return true;
}

function scheduleFlush() {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsQueue();
  }, QUEUE_FLUSH_MS);
}

function mirrorToYandexMetrika(
  name: string,
  props?: TrackPayload['props'],
): void {
  if (Platform.OS !== 'web') {
    return;
  }
  const goal = METRIKA_GOAL_BY_EVENT[name];
  if (!goal) {
    return;
  }
  const flat: Record<string, string | number | boolean> = {};
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        flat[key] = value;
      }
    }
  }
  reachYandexMetrikaGoal(goal, flat);
}

export function trackAnalyticsEvent(
  name: string,
  props?: TrackPayload['props'],
): void {
  queue.push({
    name,
    props,
    occurredAt: new Date().toISOString(),
  });
  mirrorToYandexMetrika(name, props);
  if (queue.length >= MAX_BATCH) {
    void flushAnalyticsQueue();
    return;
  }
  scheduleFlush();
}

export async function flushAnalyticsQueue(): Promise<void> {
  if (queue.length === 0) {
    return;
  }

  const batch = queue.splice(0, MAX_BATCH);
  try {
    await apiRequest<{ accepted: number }>('/analytics/events', {
      method: 'POST',
      body: {
        platform: resolvePlatform(),
        appVersion: resolveAppVersion(),
        events: batch,
      },
      skipLoading: true,
    });
  } catch {
    queue = [...batch.slice(0, 10), ...queue].slice(0, 50);
  }
}

/** Deduped session ping for DAU / retention (client-side). */
export function trackUserSessionStarted(method: string = 'app_open'): void {
  const now = Date.now();
  if (now - lastSessionAt < 30 * 60 * 1000) {
    return;
  }
  lastSessionAt = now;
  trackAnalyticsEvent(CLIENT_ANALYTICS_EVENTS.USER_SESSION_STARTED, {
    method,
    platform: resolvePlatform(),
  });
}

/** Impression: card visible ≥3s. Server rate-limits 1/hour/entity. */
export function trackEntityView(
  entity: AnalyticsEntityKind,
  id: string,
): void {
  const trimmed = id.trim();
  if (!trimmed || !shouldSendLocal(localViewSentAt, entity, trimmed)) {
    return;
  }

  void apiRequest<{ recorded: boolean }>('/analytics/views', {
    method: 'POST',
    body: {
      entity,
      id: trimmed,
      platform: resolvePlatform(),
      appVersion: resolveAppVersion(),
    },
    skipLoading: true,
  }).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 429) {
      return;
    }
    localViewSentAt.delete(entityKey(entity, trimmed));
  });
}

/** Transition: opened detail route. Server rate-limits 1/hour/entity. */
export function trackEntityTransition(
  entity: AnalyticsEntityKind,
  id: string,
): void {
  const trimmed = id.trim();
  if (!trimmed || !shouldSendLocal(localTransitionSentAt, entity, trimmed)) {
    return;
  }

  if (Platform.OS === 'web') {
    reachYandexMetrikaGoal(`open_${entity}`, { id: trimmed });
  }

  void apiRequest<{ recorded: boolean }>('/analytics/transitions', {
    method: 'POST',
    body: {
      entity,
      id: trimmed,
      platform: resolvePlatform(),
      appVersion: resolveAppVersion(),
    },
    skipLoading: true,
  }).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 429) {
      return;
    }
    localTransitionSentAt.delete(entityKey(entity, trimmed));
  });
}
