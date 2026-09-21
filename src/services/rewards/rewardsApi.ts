import { apiRequest } from '@/services/api/client';
import {
  EMPTY_LIMITS,
  EMPTY_PERKS,
  isDiceSkinId,
  isRewardBadgeType,
  isPurchasableAura,
  isPurchasableAvatarFrame,
  ownedAuraIdsForBadges,
  ownedFrameIdsForBadges,
  sanitizeBadges,
  sanitizeOwnedAuraIds,
  sanitizeOwnedFrameIds,
  SHOWCASE_AURA_IDS,
  SHOWCASE_AVATAR_FRAME_IDS,
  type AccountLimits,
  type DiceSkinId,
  type UnlockedPerks,
  type UserReward,
} from '@/data/rewards/catalog';

export type MyRewardsResponse = {
  rewards: UserReward[];
  perks: UnlockedPerks;
  limits: AccountLimits;
};

function normalizePerks(raw: Partial<UnlockedPerks> | null | undefined): UnlockedPerks {
  const badges = sanitizeBadges(raw?.badges);
  const unlockAllAvatarFrames = Boolean(raw?.unlockAllAvatarFrames);
  const unlockAllAuras = Boolean(raw?.unlockAllAuras);
  const unlockAllDiceSkins = Boolean(raw?.unlockAllDiceSkins);
  const ownedFrameIds = Array.isArray(raw?.ownedFrameIds)
    ? sanitizeOwnedFrameIds(raw.ownedFrameIds)
    : ownedFrameIdsForBadges(badges);
  if (unlockAllAvatarFrames) {
    for (const id of SHOWCASE_AVATAR_FRAME_IDS) {
      if (isPurchasableAvatarFrame(id) && !ownedFrameIds.includes(id)) {
        ownedFrameIds.push(id);
      }
    }
  }
  const ownedAuraIds = Array.isArray(raw?.ownedAuraIds)
    ? sanitizeOwnedAuraIds(raw.ownedAuraIds)
    : ownedAuraIdsForBadges(badges);
  if (unlockAllAuras) {
    for (const id of SHOWCASE_AURA_IDS) {
      if (isPurchasableAura(id) && !ownedAuraIds.includes(id)) {
        ownedAuraIds.push(id);
      }
    }
  }
  const resolvedDice = Array.isArray(raw?.diceSkinIds)
    ? raw.diceSkinIds.filter(isDiceSkinId)
    : ['standard' as const];
  const diceSkinIds = [...new Set<DiceSkinId>(['standard', ...resolvedDice])];
  return {
    badges,
    visibleBadges:
      raw?.visibleBadges === undefined
        ? badges
        : sanitizeBadges(raw.visibleBadges),
    diceSkinIds,
    bonusCharacterSlots: Number(raw?.bonusCharacterSlots) || 0,
    bonusPortraitGenerationsPerDay: Number(raw?.bonusPortraitGenerationsPerDay) || 0,
    avatarFrameId: raw?.avatarFrameId ?? null,
    questionnaireAuraId: raw?.questionnaireAuraId ?? null,
    ownedFrameIds,
    ownedAuraIds,
    unlockAllAvatarFrames,
    unlockAllAuras,
    unlockAllDiceSkins,
  };
}

function normalizeLimits(raw: Partial<AccountLimits> | null | undefined): AccountLimits {
  return {
    maxActiveCharacters: Number(raw?.maxActiveCharacters) || EMPTY_LIMITS.maxActiveCharacters,
    dailyPortraitGenerations:
      Number(raw?.dailyPortraitGenerations) || EMPTY_LIMITS.dailyPortraitGenerations,
    usedPortraitGenerationsToday: Number(raw?.usedPortraitGenerationsToday) || 0,
    remainingPortraitGenerations: Number(raw?.remainingPortraitGenerations) || 0,
  };
}

export async function fetchMyRewards(): Promise<MyRewardsResponse> {
  const data = await apiRequest<MyRewardsResponse>('/rewards/me', { skipLoading: true });
  return {
    rewards: Array.isArray(data.rewards)
      ? data.rewards.filter((item) => isRewardBadgeType(item.badgeType))
      : [],
    perks: normalizePerks(data.perks),
    limits: normalizeLimits(data.limits),
  };
}

export async function updateMyCosmetics(input: {
  avatarFrameId?: string | null;
  questionnaireAuraId?: string | null;
  badgeTypes?: string[];
}): Promise<MyRewardsResponse> {
  const data = await apiRequest<MyRewardsResponse>('/rewards/me/cosmetics', {
    method: 'PATCH',
    body: input,
  });
  return {
    rewards: Array.isArray(data.rewards)
      ? data.rewards.filter((item) => isRewardBadgeType(item.badgeType))
      : [],
    perks: normalizePerks(data.perks),
    limits: normalizeLimits(data.limits),
  };
}

export { EMPTY_LIMITS, EMPTY_PERKS };
