export const GAME_COST_FORMATS = ['free', 'paid', 'both'] as const;
export const SESSION_PRICE_KINDS = ['fixed', 'from', 'range'] as const;
export const PLAYER_PAYMENT_FORMATS = ['free_only', 'free_and_paid'] as const;

export type GameCostFormat = (typeof GAME_COST_FORMATS)[number];
export type SessionPriceKind = (typeof SESSION_PRICE_KINDS)[number];
export type PlayerPaymentFormat = (typeof PLAYER_PAYMENT_FORMATS)[number];

export const SESSION_PRICE_MIN = 1;
export const SESSION_PRICE_MAX = 1_000_000;

export type QuestionnairePaymentState = {
  gameCostFormat: GameCostFormat | null;
  sessionPriceKind: SessionPriceKind | null;
  sessionPriceMin: string;
  sessionPriceMax: string;
  playerPaymentFormat: PlayerPaymentFormat | null;
  playerBudgetKind: SessionPriceKind | null;
  playerBudgetMin: string;
  playerBudgetMax: string;
};

export const EMPTY_QUESTIONNAIRE_PAYMENT: QuestionnairePaymentState = {
  gameCostFormat: null,
  sessionPriceKind: null,
  sessionPriceMin: '',
  sessionPriceMax: '',
  playerPaymentFormat: null,
  playerBudgetKind: null,
  playerBudgetMin: '',
  playerBudgetMax: '',
};

export function isGameCostFormat(value: unknown): value is GameCostFormat {
  return value === 'free' || value === 'paid' || value === 'both';
}

export function isSessionPriceKind(value: unknown): value is SessionPriceKind {
  return value === 'fixed' || value === 'from' || value === 'range';
}

export function isPlayerPaymentFormat(value: unknown): value is PlayerPaymentFormat {
  return value === 'free_only' || value === 'free_and_paid';
}

export function parseSessionPriceValue(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');

  if (!digits) {
    return null;
  }

  const parsed = Number.parseInt(digits, 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function formatSessionPriceInput(raw: string): string {
  const parsed = parseSessionPriceValue(raw);

  return parsed == null ? '' : String(parsed);
}

export function formatRubAmount(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

type PriceValidationInput = {
  kind: SessionPriceKind | null;
  min: string;
  max: string;
};

export function isPriceFieldsFilled(input: PriceValidationInput): boolean {
  const min = parseSessionPriceValue(input.min);
  const max = parseSessionPriceValue(input.max);

  if (input.kind === 'range') {
    return min != null && max != null;
  }

  return min != null;
}

export function getPriceFieldsValidationMessage(input: PriceValidationInput): string | null {
  const min = parseSessionPriceValue(input.min);
  const max = parseSessionPriceValue(input.max);

  if (min != null && min < SESSION_PRICE_MIN) {
    return 'Стоимость должна быть больше нуля';
  }

  if (max != null && max < SESSION_PRICE_MIN) {
    return 'Стоимость должна быть больше нуля';
  }

  if (min != null && min > SESSION_PRICE_MAX) {
    return 'Стоимость слишком большая';
  }

  if (max != null && max > SESSION_PRICE_MAX) {
    return 'Стоимость слишком большая';
  }

  if (input.kind === 'range') {
    if ((min != null && max == null) || (min == null && max != null)) {
      return 'Укажите обе границы диапазона';
    }

    if (min != null && max != null && min > max) {
      return 'Минимальная стоимость не может быть больше максимальной';
    }
  }

  return null;
}

export function getSessionPriceValidationMessage(input: {
  gameCostFormat: GameCostFormat | null;
  sessionPriceKind: SessionPriceKind | null;
  sessionPriceMin: string;
  sessionPriceMax: string;
}): string | null {
  if (input.gameCostFormat !== 'paid' && input.gameCostFormat !== 'both') {
    return null;
  }

  return getPriceFieldsValidationMessage({
    kind: input.sessionPriceKind,
    min: input.sessionPriceMin,
    max: input.sessionPriceMax,
  });
}

export function isSessionPriceValid(input: {
  gameCostFormat: GameCostFormat | null;
  sessionPriceKind: SessionPriceKind | null;
  sessionPriceMin: string;
  sessionPriceMax: string;
}): boolean {
  return getSessionPriceValidationMessage(input) == null;
}

export function getPlayerBudgetValidationMessage(input: {
  playerPaymentFormat: PlayerPaymentFormat | null;
  playerBudgetKind: SessionPriceKind | null;
  playerBudgetMin: string;
  playerBudgetMax: string;
}): string | null {
  if (input.playerPaymentFormat !== 'free_and_paid') {
    return null;
  }

  const fields = {
    kind: input.playerBudgetKind,
    min: input.playerBudgetMin,
    max: input.playerBudgetMax,
  };
  const formatError = getPriceFieldsValidationMessage(fields);

  if (formatError) {
    return formatError;
  }

  if (!isPriceFieldsFilled(fields)) {
    return 'Укажите комфортную сумму за игру';
  }

  return null;
}

export function isPlayerBudgetValid(input: {
  playerPaymentFormat: PlayerPaymentFormat | null;
  playerBudgetKind: SessionPriceKind | null;
  playerBudgetMin: string;
  playerBudgetMax: string;
}): boolean {
  return getPlayerBudgetValidationMessage(input) == null;
}

export function formatSessionPriceLabel(input: {
  kind?: SessionPriceKind | null;
  min?: number | null;
  max?: number | null;
}): string | null {
  const min = typeof input.min === 'number' && Number.isFinite(input.min) ? input.min : null;
  const max = typeof input.max === 'number' && Number.isFinite(input.max) ? input.max : null;
  const kind = input.kind ?? null;

  if (kind === 'range' && min != null && max != null) {
    return `${min.toLocaleString('ru-RU')} – ${max.toLocaleString('ru-RU')} ₽`;
  }

  if (kind === 'from' && min != null) {
    return `от ${formatRubAmount(min)}`;
  }

  if (min != null) {
    if (kind === 'fixed' || kind == null) {
      return formatRubAmount(min);
    }
  }

  if (max != null) {
    return formatRubAmount(max);
  }

  return null;
}

export function formatMasterGameCostLabel(input: {
  format?: GameCostFormat | null;
  kind?: SessionPriceKind | null;
  min?: number | null;
  max?: number | null;
}): string | null {
  if (input.format !== 'free' && input.format !== 'paid' && input.format !== 'both') {
    return null;
  }

  const price = input.format === 'free' ? null : formatSessionPriceLabel(input);

  if (input.format === 'free') {
    return 'Бесплатно';
  }

  if (input.format === 'paid') {
    return price ? `Платно — ${price}` : 'Платно';
  }

  return price ? `Бесплатно и платно — ${price}` : 'Бесплатно и платно';
}

export function formatPlayerPaymentLabel(input: {
  format?: PlayerPaymentFormat | null;
  kind?: SessionPriceKind | null;
  min?: number | null;
  max?: number | null;
}): string | null {
  if (!isPlayerPaymentFormat(input.format)) {
    return null;
  }

  if (input.format === 'free_only') {
    return playerPaymentFormatLabel(input.format);
  }

  const price = formatSessionPriceLabel(input);
  return price
    ? `Бесплатно и платно — ${price}`
    : playerPaymentFormatLabel(input.format);
}

export function hasMasterRole(roles: string[]): boolean {
  return roles.includes('Мастер');
}

export function shouldShowMasterGameCost(
  roles: string[],
  format?: GameCostFormat | null,
): boolean {
  return hasMasterRole(roles) && (format === 'free' || format === 'paid' || format === 'both');
}

export function gameCostFormatLabel(format: GameCostFormat): string {
  switch (format) {
    case 'free':
      return 'Бесплатно';
    case 'paid':
      return 'Платно';
    case 'both':
      return 'Бесплатно и платно';
  }
}

export function playerPaymentFormatLabel(format: PlayerPaymentFormat): string {
  switch (format) {
    case 'free_only':
      return 'Играю только бесплатно';
    case 'free_and_paid':
      return 'Рассматриваю бесплатные и платные варианты';
  }
}

/** Short labels for user card chips (full sentences are too long in a pill). */
export function playerPaymentFormatChipLabel(format: PlayerPaymentFormat): string {
  switch (format) {
    case 'free_only':
      return 'Только бесплатно';
    case 'free_and_paid':
      return 'Бесплатно и платно';
  }
}

export function hasPlayerRole(roles: string[]): boolean {
  return roles.includes('Игрок');
}

export function shouldShowPlayerPayment(
  roles: string[],
  format?: PlayerPaymentFormat | null,
): boolean {
  return hasPlayerRole(roles) && isPlayerPaymentFormat(format);
}

function toStoredPriceTriple(input: {
  kind: SessionPriceKind | null;
  min: string;
  max: string;
}): {
  kind: SessionPriceKind | null;
  min: number | null;
  max: number | null;
} {
  const min = parseSessionPriceValue(input.min);
  const max = parseSessionPriceValue(input.max);
  const kind = input.kind;

  if (kind === 'range' && min != null && max != null) {
    return { kind: 'range', min, max };
  }

  if (kind === 'from' && min != null) {
    return { kind: 'from', min, max: null };
  }

  if (min != null) {
    return {
      kind: kind === 'from' ? 'from' : 'fixed',
      min,
      max: null,
    };
  }

  return { kind: null, min: null, max: null };
}

export function toStoredSessionPrice(input: {
  gameCostFormat: GameCostFormat | null;
  sessionPriceKind: SessionPriceKind | null;
  sessionPriceMin: string;
  sessionPriceMax: string;
}): {
  sessionPriceKind: SessionPriceKind | null;
  sessionPriceMin: number | null;
  sessionPriceMax: number | null;
} {
  if (input.gameCostFormat !== 'paid' && input.gameCostFormat !== 'both') {
    return {
      sessionPriceKind: null,
      sessionPriceMin: null,
      sessionPriceMax: null,
    };
  }

  const stored = toStoredPriceTriple({
    kind: input.sessionPriceKind,
    min: input.sessionPriceMin,
    max: input.sessionPriceMax,
  });

  return {
    sessionPriceKind: stored.kind,
    sessionPriceMin: stored.min,
    sessionPriceMax: stored.max,
  };
}

export function toStoredPlayerBudget(input: {
  playerPaymentFormat: PlayerPaymentFormat | null;
  playerBudgetKind: SessionPriceKind | null;
  playerBudgetMin: string;
  playerBudgetMax: string;
}): {
  playerBudgetKind: SessionPriceKind | null;
  playerBudgetMin: number | null;
  playerBudgetMax: number | null;
} {
  if (input.playerPaymentFormat !== 'free_and_paid') {
    return {
      playerBudgetKind: null,
      playerBudgetMin: null,
      playerBudgetMax: null,
    };
  }

  const stored = toStoredPriceTriple({
    kind: input.playerBudgetKind,
    min: input.playerBudgetMin,
    max: input.playerBudgetMax,
  });

  return {
    playerBudgetKind: stored.kind,
    playerBudgetMin: stored.min,
    playerBudgetMax: stored.max,
  };
}
