export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  isGuest: boolean;
};

export type NicknameResponse = {
  nickname: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export type ImageUrls = Partial<
  Record<
    | 'thumb'
    | 'small'
    | 'medium'
    | 'large'
    | 'cardThumb'
    | 'card'
    | 'original',
    string
  >
>;

export type ProfileCatalogItem = {
  id: string;
  name: string;
};

export type GameSystemReferenceItem = {
  id: string;
  name: string;
  description: string | null;
  isOfficial: boolean;
};

export type UserGameSystemAuthor = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export type UserGameSystemItem = {
  id: string;
  name: string;
  gamesCount: number;
  canEdit: boolean;
  canDelete: boolean;
  author: UserGameSystemAuthor;
};

export type ProfileCity = {
  id: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string;
};

export type UserProfile = {
  id: string;
  email: string;
  nickname: string;
  isGuest: boolean;
  statuses: ProfileCatalogItem[];
  experienceTypes: ProfileCatalogItem[];
  availability: string | null;
  age: number | null;
  city: ProfileCity | null;
  cities?: ProfileCity[];
  location: string | null;
  playsOnline: boolean;
  timezone?: string;
  isPublic: boolean;
  systems: string[];
  readyToLearnNew: boolean;
  openToAnySystem: boolean;
  about: string | null;
  description: string | null;
  roles: string[];
  questionnaireStep: number;
  questionnaireCompletionPercent?: number;
  avatar: ImageUrls | null;
  profileCard: ImageUrls | null;
  rewards?: UserReward[];
  perks?: UnlockedPerks;
  createdAt: string;
  updatedAt: string;
};

export type UserReward = {
  id: string;
  userId: string;
  badgeType: 'alpha_tester' | 'bug_hunter' | 'founding_dm' | 'early_arrival' | 'tavern_keeper';
  customDiceSkinId: string | null;
  bonusCharacterSlots: number;
  grantedAt: string;
};

export type UnlockedPerks = {
  badges: UserReward['badgeType'][];
  diceSkinIds: string[];
  bonusCharacterSlots: number;
  bonusPortraitGenerationsPerDay: number;
  avatarFrameId: string | null;
  questionnaireAuraId: string | null;
  visibleBadges?: UserReward['badgeType'][];
  ownedFrameIds?: string[];
  ownedAuraIds?: string[];
  unlockAllAvatarFrames?: boolean;
  unlockAllAuras?: boolean;
  unlockAllDiceSkins?: boolean;
};
