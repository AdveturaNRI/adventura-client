import { apiRequest, apiUpload } from '@/services/api/client';
import type { ImageUrls } from '@/services/api/types';

export type GameKind = 'ONESHOT' | 'CAMPAIGN';
export type GameStatus = 'RECRUITING' | 'CLOSED' | 'FINISHED';

export type GameViewerRelation = 'none' | 'owner' | 'pending' | 'player' | 'rejected';

export type GameOwnerSummary = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export type GameListItem = {
  id: string;
  title: string;
  description: string | null;
  maxPlayers: number;
  durationHours: number | null;
  kind: GameKind;
  status: GameStatus;
  isOnline: boolean;
  city: { id: string; name: string; region: string | null } | null;
  scheduledAt: string | null;
  timezone: string;
  priceRub: number | null;
  isFree: boolean;
  experienceTypeId: string | null;
  experienceLabel: string | null;
  beginnersWelcome: boolean;
  minAge: number | null;
  anyAge: boolean;
  systemName: string;
  cover: ImageUrls | null;
  playersCount: number;
  pendingApplicationsCount: number;
  owner?: GameOwnerSummary | null;
  viewerRelation?: GameViewerRelation;
  createdAt: string;
  updatedAt: string;
};

export type GamePersonItem = {
  id: string;
  userId: string;
  nickname: string;
  age: number | null;
  about: string | null;
  message?: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type GameManagePayload = {
  game: GameListItem;
  applications: GamePersonItem[];
  players: GamePersonItem[];
};

export type CreateGamePayload = {
  title: string;
  description?: string | null;
  maxPlayers: number;
  durationHours?: number | null;
  systemName: string;
  kind: GameKind;
  isOnline: boolean;
  cityId?: string | null;
  scheduledAt?: string | null;
  timezone?: string;
  isFree: boolean;
  priceRub?: number | null;
  beginnersWelcome: boolean;
  experienceTypeId?: string | null;
  anyAge: boolean;
  minAge?: number | null;
};

export type UpdateGamePayload = CreateGamePayload;

export type GamesFeedStatus = Extract<GameStatus, 'RECRUITING' | 'CLOSED'>;

export type GamesFeedQuery = {
  status?: GamesFeedStatus;
  q?: string;
  kind?: GameKind;
  isOnline?: boolean;
  cityId?: string;
  cityIds?: string[];
  system?: string;
  isFree?: boolean;
  hasSeats?: boolean;
  beginnersWelcome?: boolean;
  age?: 'any' | '12' | '16' | '18';
  scheduledFrom?: string;
  scheduledTo?: string;
  schedulePreset?: 'upcoming' | 'past';
  /** IANA timezone from profile; server prefers DB value */
  timezone?: string;
};

export async function listGamesFeed(
  query: GamesFeedQuery | GamesFeedStatus = 'RECRUITING',
): Promise<GameListItem[]> {
  const params =
    typeof query === 'string'
      ? { status: query }
      : {
          status: query.status ?? 'RECRUITING',
          ...(query.q?.trim() ? { q: query.q.trim() } : {}),
          ...(query.kind ? { kind: query.kind } : {}),
          ...(typeof query.isOnline === 'boolean'
            ? { isOnline: String(query.isOnline) }
            : {}),
          ...(query.cityId?.trim() ? { cityId: query.cityId.trim() } : {}),
          ...(query.cityIds && query.cityIds.length > 0
            ? { cityIds: query.cityIds.filter(Boolean).join(',') }
            : {}),
          ...(query.system?.trim() ? { system: query.system.trim() } : {}),
          ...(typeof query.isFree === 'boolean' ? { isFree: String(query.isFree) } : {}),
          ...(query.hasSeats ? { hasSeats: 'true' } : {}),
          ...(query.beginnersWelcome ? { beginnersWelcome: 'true' } : {}),
          ...(query.age ? { age: query.age } : {}),
          ...(query.schedulePreset
            ? { schedulePreset: query.schedulePreset }
            : {}),
          ...(query.scheduledFrom?.trim()
            ? { scheduledFrom: query.scheduledFrom.trim() }
            : {}),
          ...(query.scheduledTo?.trim() ? { scheduledTo: query.scheduledTo.trim() } : {}),
          ...(query.timezone?.trim() ? { timezone: query.timezone.trim() } : {}),
        };

  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, value]),
  );
  return apiRequest<GameListItem[]>(`/games?${search.toString()}`);
}

export async function listMyGames(): Promise<GameListItem[]> {
  return apiRequest<GameListItem[]>('/games/me');
}

export async function getGame(gameId: string): Promise<GameListItem> {
  return apiRequest<GameListItem>(`/games/${encodeURIComponent(gameId)}`);
}

export async function getGameManage(gameId: string): Promise<GameManagePayload> {
  return apiRequest<GameManagePayload>(`/games/${encodeURIComponent(gameId)}/manage`);
}

export async function createGame(payload: CreateGamePayload): Promise<GameListItem> {
  return apiRequest<GameListItem>('/games', {
    method: 'POST',
    body: payload,
  });
}

export async function updateGame(
  gameId: string,
  payload: UpdateGamePayload,
): Promise<GameListItem> {
  return apiRequest<GameListItem>(`/games/${encodeURIComponent(gameId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteGame(
  gameId: string,
  options?: { deleteChat?: boolean },
): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/games/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
    body: { deleteChat: Boolean(options?.deleteChat) },
  });
}

export async function updateGameStatus(
  gameId: string,
  status: GameStatus,
): Promise<GameManagePayload> {
  return apiRequest<GameManagePayload>(`/games/${encodeURIComponent(gameId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function applyToGame(
  gameId: string,
  message?: string | null,
): Promise<GameListItem> {
  return apiRequest<GameListItem>(`/games/${encodeURIComponent(gameId)}/apply`, {
    method: 'POST',
    body: { message: message?.trim() || null },
  });
}

export async function cancelGameApplication(gameId: string): Promise<GameListItem> {
  return apiRequest<GameListItem>(`/games/${encodeURIComponent(gameId)}/application`, {
    method: 'DELETE',
  });
}

export async function acceptGameApplication(
  gameId: string,
  applicationId: string,
): Promise<GameManagePayload> {
  return apiRequest<GameManagePayload>(
    `/games/${encodeURIComponent(gameId)}/applications/${encodeURIComponent(applicationId)}/accept`,
    { method: 'POST' },
  );
}

export async function rejectGameApplication(
  gameId: string,
  applicationId: string,
): Promise<GameManagePayload> {
  return apiRequest<GameManagePayload>(
    `/games/${encodeURIComponent(gameId)}/applications/${encodeURIComponent(applicationId)}/reject`,
    { method: 'POST' },
  );
}

export async function removeGamePlayer(
  gameId: string,
  userId: string,
): Promise<GameManagePayload> {
  return apiRequest<GameManagePayload>(
    `/games/${encodeURIComponent(gameId)}/players/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

export async function uploadGameCover(gameId: string, localUri: string): Promise<GameListItem> {
  return apiUpload<GameListItem>(`/games/${encodeURIComponent(gameId)}/cover`, 'cover', localUri);
}

export async function deleteGameCover(gameId: string): Promise<GameListItem> {
  return apiRequest<GameListItem>(`/games/${encodeURIComponent(gameId)}/cover`, {
    method: 'DELETE',
  });
}
