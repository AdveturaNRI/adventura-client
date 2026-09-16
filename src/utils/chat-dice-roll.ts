export const DICE_ROLL_PAYLOAD_VERSION = 1 as const;

export type DiceRollGroupPayload = {
  sides: number;
  values: number[];
  sum: number;
};

export type DiceRollPayload = {
  v: typeof DICE_ROLL_PAYLOAD_VERSION;
  formula: string;
  modifier: number;
  groups: DiceRollGroupPayload[];
  values: number[];
  sum: number | null;
  hidden: boolean;
  redacted?: boolean;
  /** Hex `#RRGGBB` цвета кубов отправителя. */
  color?: string;
};

export type DiceRollDieInput = {
  sides: number;
  qty: number;
};

export const CHAT_DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type ChatDieSides = (typeof CHAT_DIE_SIDES)[number];

export const CHAT_MAX_PER_DIE = 8;
export const CHAT_MAX_TOTAL_DICE = 12;

export function formatDiceFormula(dice: DiceRollDieInput[], modifier = 0) {
  const parts = [...dice]
    .filter((die) => die.qty > 0)
    .sort((a, b) => a.sides - b.sides)
    .map((die) => `${die.qty}d${die.sides}`);
  if (parts.length === 0) {
    return '';
  }
  const base = parts.join(' + ');
  if (modifier === 0) {
    return base;
  }
  return modifier > 0 ? `${base} + ${modifier}` : `${base} − ${Math.abs(modifier)}`;
}

export function poolToDiceInputs(pool: Partial<Record<ChatDieSides, number>>): DiceRollDieInput[] {
  return CHAT_DIE_SIDES.filter((sides) => (pool[sides] ?? 0) > 0).map((sides) => ({
    sides,
    qty: pool[sides] ?? 0,
  }));
}

export function poolNotationParts(pool: Partial<Record<ChatDieSides, number>>): string[] {
  return poolToDiceInputs(pool).map((die) => `${die.qty}d${die.sides}`);
}

export function parseDiceRollPayload(body: string | null | undefined): DiceRollPayload | null {
  if (!body?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(body) as Partial<DiceRollPayload>;
    if (parsed?.v !== DICE_ROLL_PAYLOAD_VERSION || typeof parsed.formula !== 'string') {
      return null;
    }
    const color =
      typeof parsed.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(parsed.color.trim())
        ? `#${parsed.color.trim().slice(1).toUpperCase()}`
        : undefined;
    return {
      v: DICE_ROLL_PAYLOAD_VERSION,
      formula: parsed.formula,
      modifier: typeof parsed.modifier === 'number' ? parsed.modifier : 0,
      groups: Array.isArray(parsed.groups) ? (parsed.groups as DiceRollGroupPayload[]) : [],
      values: Array.isArray(parsed.values) ? (parsed.values as number[]) : [],
      sum: typeof parsed.sum === 'number' ? parsed.sum : null,
      hidden: Boolean(parsed.hidden),
      redacted: Boolean(parsed.redacted),
      ...(color ? { color } : {}),
    };
  } catch {
    return null;
  }
}

export function diceRollPreviewText(payload: DiceRollPayload | null): string {
  if (!payload) {
    return 'Бросок костей';
  }
  if (payload.hidden && (payload.redacted || payload.sum == null)) {
    return `Скрытый бросок · ${payload.formula}`;
  }
  if (typeof payload.sum === 'number') {
    return `🎲 ${payload.formula} = ${payload.sum}`;
  }
  return `🎲 ${payload.formula}`;
}

/**
 * Notation for chat (dice-box-threejs): forced faces via `@`.
 * Пример: `2d6+1d20@3,5,14` — всем падают одни и те же грани.
 */
export function payloadToForcedNotation(payload: DiceRollPayload): string {
  const parts = payload.groups
    .filter((group) => group.sides > 0 && group.values.length > 0)
    .map((group) => `${group.values.length}d${group.sides}`);
  const values = payload.groups.flatMap((group) => group.values);
  if (parts.length === 0) {
    return '1d20';
  }
  if (values.length === 0) {
    return parts.join('+');
  }
  return `${parts.join('+')}@${values.join(',')}`;
}

export function diceInputsToNotation(dice: DiceRollDieInput[]): string {
  const parts = [...dice]
    .filter((die) => die.qty > 0)
    .sort((a, b) => a.sides - b.sides)
    .map((die) => `${die.qty}d${die.sides}`);
  return parts.join('+') || '1d20';
}

/** Notation without forced values (Babylon / free roll). */
export function payloadToStageNotation(
  payload: DiceRollPayload,
): Array<{ qty: number; sides: number }> {
  return payload.groups
    .filter((group) => group.sides > 0 && group.values.length > 0)
    .map((group) => ({
      qty: group.values.length,
      sides: group.sides,
    }));
}

export function payloadToNotationParts(payload: DiceRollPayload): string[] {
  return payload.groups.map((group) => `${group.values.length}d${group.sides}`);
}
