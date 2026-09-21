export const REWARD_BADGE_TYPES = [
  'alpha_tester',
  'bug_hunter',
  'founding_dm',
  'early_arrival',
  'tavern_keeper',
] as const;

export type RewardBadgeType = (typeof REWARD_BADGE_TYPES)[number];

export const DICE_SKIN_IDS = [
  'standard',
  'alpha_pioneer',
  'neon_glitch',
  'founding_obsidian',
  'tavern_oak',
] as const;

export type DiceSkinId = (typeof DICE_SKIN_IDS)[number];

export const AVATAR_FRAME_IDS = [
  'none',
  'steel_band',
  'alpha_runes',
  'neon_scan',
  'founding_embers',
  'solar_flare',
  'frost_ring',
  'hex_circuit',
  'void_orbit',
  'sakura_fall',
  'storm_arc',
  'blood_moon',
  'prism_halo',
  'pixel_spark',
  'leaf_crown',
  'tide_ring',
  'ghost_veil',
  'copper_gear',
  'star_orbit',
  'oak_tankard',
] as const;

export const QUESTIONNAIRE_AURA_IDS = [
  'none',
  'aurora',
  'neon_grid',
  'void_runes',
  'sakura_mist',
  'storm_veil',
  'blood_haze',
  'prism_shift',
  'pixel_rain',
  'forest_glow',
  'tide_caustic',
  'ghost_fog',
  'magma_flow',
  'star_field',
  'oak_shield',
] as const;

export type AvatarFrameId = (typeof AVATAR_FRAME_IDS)[number];
export type QuestionnaireAuraId = (typeof QUESTIONNAIRE_AURA_IDS)[number];

export type UserReward = {
  id: string;
  userId: string;
  badgeType: RewardBadgeType;
  customDiceSkinId: string | null;
  bonusCharacterSlots: number;
  grantedAt: string;
};

export type UnlockedPerks = {
  badges: RewardBadgeType[];
  visibleBadges: RewardBadgeType[];
  diceSkinIds: DiceSkinId[];
  bonusCharacterSlots: number;
  bonusPortraitGenerationsPerDay: number;
  avatarFrameId: string | null;
  questionnaireAuraId: string | null;
  ownedFrameIds: Exclude<AvatarFrameId, 'none'>[];
  ownedAuraIds: Exclude<QuestionnaireAuraId, 'none'>[];
  unlockAllAvatarFrames: boolean;
  unlockAllAuras: boolean;
  unlockAllDiceSkins: boolean;
};

export type AccountLimits = {
  maxActiveCharacters: number;
  dailyPortraitGenerations: number;
  usedPortraitGenerationsToday: number;
  remainingPortraitGenerations: number;
};

export type RewardBadgeSpec = {
  id: RewardBadgeType;
  label: string;
  shortLabel: string;
  tooltip: string;
  emoji: string;
  icon: 'sparkles' | 'bug' | 'flame' | 'compass' | 'beer';
  accent: string;
  accentSoft: string;
  /** Readable on white. Neon `accent` is for dark UI and FX. */
  ink: string;
  inkSoft: string;
  glow: string;
  frameId: AvatarFrameId;
  auraId: QuestionnaireAuraId;
  diceSkinId: DiceSkinId;
};

export type RewardUiTone = {
  fg: string;
  bg: string;
  border: string;
};

export type UniqueGoldTone = RewardUiTone & {
  bgLocked: string;
  borderLocked: string;
  well: string;
};

export function rewardUiTone(
  spec: Pick<RewardBadgeSpec, 'accent' | 'accentSoft' | 'ink' | 'inkSoft'>,
  isDark: boolean,
): RewardUiTone {
  if (isDark) {
    return { fg: spec.accent, bg: spec.accentSoft, border: spec.accent };
  }
  return { fg: spec.ink, bg: spec.inkSoft, border: spec.ink };
}

export function uniqueGoldTone(isDark: boolean): UniqueGoldTone {
  if (isDark) {
    return {
      fg: '#E8C36A',
      bg: 'rgba(232, 195, 106, 0.14)',
      border: '#E8C36A',
      bgLocked: 'rgba(232, 195, 106, 0.08)',
      borderLocked: 'rgba(232, 195, 106, 0.5)',
      well: 'rgba(232, 195, 106, 0.18)',
    };
  }
  return {
    fg: '#8B6914',
    bg: 'rgba(201, 162, 39, 0.2)',
    border: 'rgba(139, 105, 20, 0.5)',
    bgLocked: 'rgba(201, 162, 39, 0.1)',
    borderLocked: 'rgba(139, 105, 20, 0.34)',
    well: 'rgba(201, 162, 39, 0.24)',
  };
}

export type DiceSkinSpec = {
  id: DiceSkinId;
  label: string;
  hint: string;
  exclusive: boolean;
  requiredBadge: RewardBadgeType | null;
  accent: string;
  secondary: string;
  shader: 'none' | 'aurora' | 'glitch' | 'obsidian' | 'oak';
};

export type AvatarFrameSpec = {
  id: AvatarFrameId;
  label: string;
  hint: string;
  badge: RewardBadgeType | null;
  accent: string;
  unique?: boolean;
  purchasable?: boolean;
};

export type QuestionnaireAuraSpec = {
  id: QuestionnaireAuraId;
  label: string;
  hint: string;
  badge: RewardBadgeType | null;
  accent: string;
  unique?: boolean;
  purchasable?: boolean;
};

export const BASE_CHARACTER_SLOTS = 3;
export const BASE_PORTRAIT_GENERATIONS_PER_DAY = 5;

export const REWARD_BADGES: Record<RewardBadgeType, RewardBadgeSpec> = {
  alpha_tester: {
    id: 'alpha_tester',
    label: 'Первопроходец',
    shortLabel: 'Альфа',
    tooltip: 'Открыл платформу одним из первых, когда её границы ещё только предстояло исследовать.',
    emoji: '✨',
    icon: 'sparkles',
    accent: '#E8C36A',
    accentSoft: 'rgba(232, 195, 106, 0.18)',
    ink: '#8B6914',
    inkSoft: 'rgba(139, 105, 20, 0.14)',
    glow: 'rgba(232, 195, 106, 0.55)',
    frameId: 'alpha_runes',
    auraId: 'aurora',
    diceSkinId: 'alpha_pioneer',
  },
  bug_hunter: {
    id: 'bug_hunter',
    label: 'Истребитель багов',
    shortLabel: 'Баги',
    tooltip: 'Выслеживал ошибки и помогал очищать платформу от первых проблем.',
    emoji: '🐞',
    icon: 'bug',
    accent: '#39F3FF',
    accentSoft: 'rgba(57, 243, 255, 0.16)',
    ink: '#0F7A84',
    inkSoft: 'rgba(15, 122, 132, 0.14)',
    glow: 'rgba(57, 243, 255, 0.5)',
    frameId: 'neon_scan',
    auraId: 'neon_grid',
    diceSkinId: 'neon_glitch',
  },
  founding_dm: {
    id: 'founding_dm',
    label: 'Первый мастер',
    shortLabel: 'Мастер',
    tooltip: 'Вёл первые игры и оставил свой след в истории платформы.',
    emoji: '🔥',
    icon: 'flame',
    accent: '#C084FC',
    accentSoft: 'rgba(192, 132, 252, 0.18)',
    ink: '#6D28D9',
    inkSoft: 'rgba(109, 40, 217, 0.12)',
    glow: 'rgba(192, 132, 252, 0.55)',
    frameId: 'founding_embers',
    auraId: 'void_runes',
    diceSkinId: 'founding_obsidian',
  },
  early_arrival: {
    id: 'early_arrival',
    label: 'Первая волна',
    shortLabel: 'Волна',
    tooltip: 'Вошёл в альфу одним из первых и стал частью её истории.',
    emoji: '🧭',
    icon: 'compass',
    accent: '#6BA4E8',
    accentSoft: 'rgba(107, 164, 232, 0.16)',
    ink: '#157AFE',
    inkSoft: 'rgba(21, 122, 254, 0.12)',
    glow: 'rgba(107, 164, 232, 0.28)',
    frameId: 'steel_band',
    auraId: 'none',
    diceSkinId: 'standard',
  },
  tavern_keeper: {
    id: 'tavern_keeper',
    label: 'Хозяин таверны',
    shortLabel: 'Таверна',
    tooltip: 'Владелец клуба. Выдаётся вручную из админки.',
    emoji: '🍺',
    icon: 'beer',
    accent: '#C47A3A',
    accentSoft: 'rgba(196, 122, 58, 0.18)',
    ink: '#8A4A16',
    inkSoft: 'rgba(138, 74, 22, 0.14)',
    glow: 'rgba(196, 122, 58, 0.5)',
    frameId: 'oak_tankard',
    auraId: 'oak_shield',
    diceSkinId: 'tavern_oak',
  },
};

export const DICE_SKINS: Record<DiceSkinId, DiceSkinSpec> = {
  standard: {
    id: 'standard',
    label: 'Обычные',
    hint: 'Стандартный цвет из палитры',
    exclusive: false,
    requiredBadge: null,
    accent: '#157AFE',
    secondary: '#84B9FF',
    shader: 'none',
  },
  alpha_pioneer: {
    id: 'alpha_pioneer',
    label: 'Первопроходец',
    hint: 'Золотой аура-шейдер. На крите d20 — вспышка рун.',
    exclusive: true,
    requiredBadge: 'alpha_tester',
    accent: '#E8C36A',
    secondary: '#FFF1C2',
    shader: 'aurora',
  },
  neon_glitch: {
    id: 'neon_glitch',
    label: 'Истребитель багов',
    hint: 'Циан-маджента хроматика, сканлайны на грани.',
    exclusive: true,
    requiredBadge: 'bug_hunter',
    accent: '#39F3FF',
    secondary: '#FF4DDB',
    shader: 'glitch',
  },
  founding_obsidian: {
    id: 'founding_obsidian',
    label: 'Первый мастер',
    hint: 'Обсидиан и фиолетовое пламя. Крит горит, как очаг мастера.',
    exclusive: true,
    requiredBadge: 'founding_dm',
    accent: '#7C3AED',
    secondary: '#F5D0FE',
    shader: 'obsidian',
  },
  tavern_oak: {
    id: 'tavern_oak',
    label: 'Хозяин таверны',
    hint: 'Тёплый дуб и пена эля. На крите d20 кружки стукаются.',
    exclusive: true,
    requiredBadge: 'tavern_keeper',
    accent: '#C47A3A',
    secondary: '#F6E2B3',
    shader: 'oak',
  },
};

export const QUESTIONNAIRE_AURAS: Record<QuestionnaireAuraId, QuestionnaireAuraSpec> = {
  none: { id: 'none', label: 'Без ауры', hint: 'Чистый фон', badge: null, accent: '#888888' },
  aurora: {
    id: 'aurora',
    label: 'Северное сияние',
    hint: 'Золотой край бежит вокруг анкеты',
    badge: 'alpha_tester',
    accent: '#E8C36A',
    unique: true,
  },
  neon_grid: {
    id: 'neon_grid',
    label: 'Неоновая сетка',
    hint: 'Циан-маджента сканирует контур',
    badge: 'bug_hunter',
    accent: '#39F3FF',
    unique: true,
  },
  void_runes: {
    id: 'void_runes',
    label: 'Пламя основателя',
    hint: 'Огонь по рамке, дракон с критом сидит на карточке',
    badge: 'founding_dm',
    accent: '#FF6A00',
    unique: true,
  },
  sakura_mist: {
    id: 'sakura_mist',
    label: 'Сакура',
    hint: 'Лепестки сыплются по карточке',
    badge: null,
    accent: '#F9A8D4',
    purchasable: true,
  },
  storm_veil: {
    id: 'storm_veil',
    label: 'Гроза',
    hint: 'Дождь и редкие вспышки',
    badge: null,
    accent: '#93C5FD',
    purchasable: true,
  },
  blood_haze: {
    id: 'blood_haze',
    label: 'Багровая дымка',
    hint: 'Края темнеют и пульсируют',
    badge: null,
    accent: '#FB7185',
    purchasable: true,
  },
  prism_shift: {
    id: 'prism_shift',
    label: 'Призма',
    hint: 'Голограмма едет по поверхности',
    badge: null,
    accent: '#C4B5FD',
    purchasable: true,
  },
  pixel_rain: {
    id: 'pixel_rain',
    label: 'Пиксельный дождь',
    hint: 'Колонки, как в старом терминале',
    badge: null,
    accent: '#4ADE80',
    purchasable: true,
  },
  forest_glow: {
    id: 'forest_glow',
    label: 'Светлячки',
    hint: 'Точки вспыхивают в траве',
    badge: null,
    accent: '#A3E635',
    purchasable: true,
  },
  tide_caustic: {
    id: 'tide_caustic',
    label: 'Каустика',
    hint: 'Блики, как под водой',
    badge: null,
    accent: '#22D3EE',
    purchasable: true,
  },
  ghost_fog: {
    id: 'ghost_fog',
    label: 'Туман',
    hint: 'Дым ползёт по углам',
    badge: null,
    accent: '#CBD5E1',
    purchasable: true,
  },
  magma_flow: {
    id: 'magma_flow',
    label: 'Магма',
    hint: 'Жар снизу, как из трещины',
    badge: null,
    accent: '#FB923C',
    purchasable: true,
  },
  star_field: {
    id: 'star_field',
    label: 'Звёздное поле',
    hint: 'Мелкие звёзды на фоне',
    badge: null,
    accent: '#FDE68A',
    purchasable: true,
  },
  oak_shield: {
    id: 'oak_shield',
    label: 'Дубовый щит',
    hint: 'Деревянная кайма, как у трактирного щита, и кружки с элем',
    badge: 'tavern_keeper',
    accent: '#C47A3A',
    unique: true,
  },
};

export const AVATAR_FRAMES: Record<AvatarFrameId, AvatarFrameSpec> = {
  none: {
    id: 'none',
    label: 'Без рамки',
    hint: 'Обычный круг',
    badge: null,
    accent: '#888888',
  },
  steel_band: {
    id: 'steel_band',
    label: 'Первая волна',
    hint: 'Бледное голубое кольцо, тихий блик по ободу',
    badge: 'early_arrival',
    accent: '#6BA4E8',
    purchasable: false,
  },
  alpha_runes: {
    id: 'alpha_runes',
    label: 'Первопроходец',
    hint: 'Золотые руны и искры',
    badge: 'alpha_tester',
    accent: '#E8C36A',
    unique: true,
    purchasable: false,
  },
  neon_scan: {
    id: 'neon_scan',
    label: 'Истребитель багов',
    hint: 'Неон и сканлайн',
    badge: 'bug_hunter',
    accent: '#39F3FF',
    unique: true,
    purchasable: false,
  },
  founding_embers: {
    id: 'founding_embers',
    label: 'Первый мастер',
    hint: 'Фиолетовое пламя',
    badge: 'founding_dm',
    accent: '#FF6A00',
    unique: true,
    purchasable: false,
  },
  solar_flare: {
    id: 'solar_flare',
    label: 'Solar Flare',
    hint: 'Солнечная корона',
    badge: null,
    accent: '#FFB020',
    purchasable: true,
  },
  frost_ring: {
    id: 'frost_ring',
    label: 'Frost Ring',
    hint: 'Иней и осколки',
    badge: null,
    accent: '#7DD3FC',
    purchasable: true,
  },
  hex_circuit: {
    id: 'hex_circuit',
    label: 'Hex Circuit',
    hint: 'Схема и ток',
    badge: null,
    accent: '#2DD4BF',
    purchasable: true,
  },
  void_orbit: {
    id: 'void_orbit',
    label: 'Void Orbit',
    hint: 'Орбита бездны',
    badge: null,
    accent: '#A78BFA',
    purchasable: true,
  },
  sakura_fall: {
    id: 'sakura_fall',
    label: 'Сакура',
    hint: 'Лепестки кружат вокруг',
    badge: null,
    accent: '#F472B6',
    purchasable: true,
  },
  storm_arc: {
    id: 'storm_arc',
    label: 'Гроза',
    hint: 'Молнии бьют по ободу',
    badge: null,
    accent: '#60A5FA',
    purchasable: true,
  },
  blood_moon: {
    id: 'blood_moon',
    label: 'Багровая луна',
    hint: 'Тусклый пульс, как затмение',
    badge: null,
    accent: '#E11D48',
    purchasable: true,
  },
  prism_halo: {
    id: 'prism_halo',
    label: 'Призма',
    hint: 'Радужная плёнка на кольце',
    badge: null,
    accent: '#A78BFA',
    purchasable: true,
  },
  pixel_spark: {
    id: 'pixel_spark',
    label: 'Пиксель',
    hint: 'Восьмибитные искры',
    badge: null,
    accent: '#4ADE80',
    purchasable: true,
  },
  leaf_crown: {
    id: 'leaf_crown',
    label: 'Крона',
    hint: 'Листья по кругу',
    badge: null,
    accent: '#65A30D',
    purchasable: true,
  },
  tide_ring: {
    id: 'tide_ring',
    label: 'Прилив',
    hint: 'Волна бежит по ободу',
    badge: null,
    accent: '#06B6D4',
    purchasable: true,
  },
  ghost_veil: {
    id: 'ghost_veil',
    label: 'Призрак',
    hint: 'Дымка то собирается, то тает',
    badge: null,
    accent: '#E2E8F0',
    purchasable: true,
  },
  copper_gear: {
    id: 'copper_gear',
    label: 'Шестерни',
    hint: 'Медь и два кольца в разные стороны',
    badge: null,
    accent: '#D97706',
    purchasable: true,
  },
  star_orbit: {
    id: 'star_orbit',
    label: 'Созвездие',
    hint: 'Звёзды на орбите',
    badge: null,
    accent: '#FBBF24',
    purchasable: true,
  },
  oak_tankard: {
    id: 'oak_tankard',
    label: 'Дубовый обод',
    hint: 'Дуб, заклёпки и кружки с элем',
    badge: 'tavern_keeper',
    accent: '#C47A3A',
    unique: true,
    purchasable: false,
  },
};

export const SHOWCASE_AVATAR_FRAME_IDS = AVATAR_FRAME_IDS.filter(
  (id): id is Exclude<AvatarFrameId, 'none'> => id !== 'none',
);

export function isStaticAvatarFrame(_id: AvatarFrameId) {
  return false;
}

export function isUniqueAvatarFrame(id: AvatarFrameId) {
  return Boolean(AVATAR_FRAMES[id]?.unique);
}

export function isPurchasableAvatarFrame(id: AvatarFrameId) {
  return Boolean(AVATAR_FRAMES[id]?.purchasable);
}

export function isUniqueAura(id: QuestionnaireAuraId) {
  return Boolean(QUESTIONNAIRE_AURAS[id]?.unique);
}

export function isPurchasableAura(id: QuestionnaireAuraId) {
  return Boolean(QUESTIONNAIRE_AURAS[id]?.purchasable);
}

export function wildcardAvatarFrameIds(): Exclude<AvatarFrameId, 'none'>[] {
  return SHOWCASE_AVATAR_FRAME_IDS.filter((id) => isPurchasableAvatarFrame(id));
}

export function wildcardAuraIds(): Exclude<QuestionnaireAuraId, 'none'>[] {
  return SHOWCASE_AURA_IDS.filter((id) => isPurchasableAura(id));
}

export function wildcardDiceSkinIds(): DiceSkinId[] {
  return DICE_SKIN_IDS.filter((id) => id !== 'standard' && !DICE_SKINS[id].exclusive);
}

const FRAME_PRIORITY: RewardBadgeType[] = [
  'founding_dm',
  'alpha_tester',
  'bug_hunter',
  'tavern_keeper',
  'early_arrival',
];

export function lockedRewardToast(badge: RewardBadgeType) {
  const spec = REWARD_BADGES[badge];
  return {
    title: `${spec.emoji} ${spec.label}`,
    message: `«${spec.tooltip}»`,
  };
}

export function isRewardBadgeType(value: unknown): value is RewardBadgeType {
  return typeof value === 'string' && (REWARD_BADGE_TYPES as readonly string[]).includes(value);
}

export function isDiceSkinId(value: unknown): value is DiceSkinId {
  return typeof value === 'string' && (DICE_SKIN_IDS as readonly string[]).includes(value);
}

export function sanitizeBadges(raw: unknown): RewardBadgeType[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isRewardBadgeType);
}

export function primaryBadge(badges: RewardBadgeType[]): RewardBadgeType | null {
  return FRAME_PRIORITY.find((badge) => badges.includes(badge)) ?? null;
}

export function frameIdForBadges(badges: RewardBadgeType[]): AvatarFrameId {
  const badge = primaryBadge(badges);
  return badge ? REWARD_BADGES[badge].frameId : 'none';
}

export function auraIdForBadges(badges: RewardBadgeType[]): QuestionnaireAuraId {
  const badge = primaryBadge(badges);
  if (!badge) {
    return 'none';
  }
  return REWARD_BADGES[badge].auraId;
}

export function exclusiveSkinIds(badges: RewardBadgeType[]): DiceSkinId[] {
  return [
    ...new Set(
      badges
        .map((badge) => REWARD_BADGES[badge].diceSkinId)
        .filter((id) => id !== 'standard'),
    ),
  ];
}

export function isAvatarFrameId(value: unknown): value is AvatarFrameId {
  return typeof value === 'string' && (AVATAR_FRAME_IDS as readonly string[]).includes(value);
}

export function isQuestionnaireAuraId(value: unknown): value is QuestionnaireAuraId {
  return typeof value === 'string' && (QUESTIONNAIRE_AURA_IDS as readonly string[]).includes(value);
}

export function ownedFrameIdsForBadges(badges: RewardBadgeType[]): Exclude<AvatarFrameId, 'none'>[] {
  const ids: Exclude<AvatarFrameId, 'none'>[] = [];
  for (const badge of badges) {
    const id = REWARD_BADGES[badge].frameId;
    if (id !== 'none' && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function sanitizeOwnedFrameIds(raw: unknown): Exclude<AvatarFrameId, 'none'>[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids: Exclude<AvatarFrameId, 'none'>[] = [];
  for (const item of raw) {
    if (isAvatarFrameId(item) && item !== 'none' && !ids.includes(item)) {
      ids.push(item);
    }
  }
  return ids;
}

export function ownedFrameIdsFromPerks(
  perks:
    | {
        ownedFrameIds?: unknown;
        unlockAllAvatarFrames?: boolean;
        badges?: unknown;
      }
    | null
    | undefined,
  badges?: RewardBadgeType[],
): Exclude<AvatarFrameId, 'none'>[] {
  const ids = Array.isArray(perks?.ownedFrameIds)
    ? sanitizeOwnedFrameIds(perks.ownedFrameIds)
    : ownedFrameIdsForBadges(badges ?? sanitizeBadges(perks?.badges));
  if (!perks?.unlockAllAvatarFrames) {
    return ids;
  }
  for (const id of wildcardAvatarFrameIds()) {
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function ownedAuraIdsForBadges(
  badges: RewardBadgeType[],
): Exclude<QuestionnaireAuraId, 'none'>[] {
  const ids: Exclude<QuestionnaireAuraId, 'none'>[] = [];
  for (const badge of badges) {
    const id = REWARD_BADGES[badge].auraId;
    if (id !== 'none' && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export const SHOWCASE_AURA_IDS = QUESTIONNAIRE_AURA_IDS.filter(
  (id): id is Exclude<QuestionnaireAuraId, 'none'> => id !== 'none',
);

export const SHOWCASE_DICE_SKIN_IDS = DICE_SKIN_IDS.filter(
  (id): id is Exclude<DiceSkinId, 'standard'> => id !== 'standard',
);

export function sanitizeOwnedAuraIds(raw: unknown): Exclude<QuestionnaireAuraId, 'none'>[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids: Exclude<QuestionnaireAuraId, 'none'>[] = [];
  for (const item of raw) {
    if (isQuestionnaireAuraId(item) && item !== 'none' && !ids.includes(item)) {
      ids.push(item);
    }
  }
  return ids;
}

export function ownedAuraIdsFromPerks(
  perks:
    | {
        ownedAuraIds?: unknown;
        unlockAllAuras?: boolean;
        badges?: unknown;
      }
    | null
    | undefined,
  badges?: RewardBadgeType[],
): Exclude<QuestionnaireAuraId, 'none'>[] {
  const ids = Array.isArray(perks?.ownedAuraIds)
    ? sanitizeOwnedAuraIds(perks.ownedAuraIds)
    : ownedAuraIdsForBadges(badges ?? sanitizeBadges(perks?.badges));
  if (!perks?.unlockAllAuras) {
    return ids;
  }
  for (const id of wildcardAuraIds()) {
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function diceSkinIdsFromPerks(
  perks:
    | {
        diceSkinIds?: unknown;
        unlockAllDiceSkins?: boolean;
        badges?: unknown;
      }
    | null
    | undefined,
): DiceSkinId[] {
  const fromPerks = Array.isArray(perks?.diceSkinIds)
    ? perks.diceSkinIds.filter(isDiceSkinId)
    : [];
  const fromBadges = exclusiveSkinIds(sanitizeBadges(perks?.badges));
  const fromWildcard = perks?.unlockAllDiceSkins ? wildcardDiceSkinIds() : [];
  const ids = new Set<DiceSkinId>(['standard', ...fromPerks, ...fromBadges, ...fromWildcard]);
  return DICE_SKIN_IDS.filter((id) => ids.has(id));
}

export function hasProfileCosmetics(badges: RewardBadgeType[]): boolean {
  return ownedFrameIdsForBadges(badges).length > 0 || ownedAuraIdsForBadges(badges).length > 0;
}

export function displayedFrameId(
  _badges: RewardBadgeType[],
  equipped?: AvatarFrameId | string | null,
): AvatarFrameId {
  if (equipped == null || equipped === 'none') {
    return 'none';
  }
  return isAvatarFrameId(equipped) ? equipped : 'none';
}

export function displayedAuraId(
  _badges: RewardBadgeType[],
  equipped?: QuestionnaireAuraId | string | null,
): QuestionnaireAuraId {
  if (equipped == null || equipped === 'none') {
    return 'none';
  }
  return isQuestionnaireAuraId(equipped) ? equipped : 'none';
}

export function isExclusiveDiceSkin(id: DiceSkinId): boolean {
  return DICE_SKINS[id].exclusive;
}

export function skinAccent(id: DiceSkinId): string {
  return DICE_SKINS[id].accent;
}

export const EMPTY_PERKS: UnlockedPerks = {
  badges: [],
  visibleBadges: [],
  diceSkinIds: ['standard'],
  bonusCharacterSlots: 0,
  bonusPortraitGenerationsPerDay: 0,
  avatarFrameId: null,
  questionnaireAuraId: null,
  ownedFrameIds: [],
  ownedAuraIds: [],
  unlockAllAvatarFrames: false,
  unlockAllAuras: false,
  unlockAllDiceSkins: false,
};

export const EMPTY_LIMITS: AccountLimits = {
  maxActiveCharacters: BASE_CHARACTER_SLOTS,
  dailyPortraitGenerations: BASE_PORTRAIT_GENERATIONS_PER_DAY,
  usedPortraitGenerationsToday: 0,
  remainingPortraitGenerations: BASE_PORTRAIT_GENERATIONS_PER_DAY,
};
