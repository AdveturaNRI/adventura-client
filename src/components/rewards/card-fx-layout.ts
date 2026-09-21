import type { QuestionnaireAuraId } from '@/data/rewards/catalog';

/** Mug size on feed cards (`overlay={false}` → wide). Keep in sync with OakCardExtras. */
export const CARD_FX_MUG_SIZE_WIDE = 64;
export const CARD_FX_MUG_SIZE_NARROW = 40;

/** How much of the mug hangs below the card edge (AleMugs `variant="card"`). */
export const CARD_FX_MUG_HANG_RATIO = 0.5;

/**
 * Founding dragon peek on void_runes cards.
 * Sized as a corner accent on the card — most of the art sits on the card so
 * feed/list layout does not need to shrink the card for overhang.
 */
export const CARD_FX_DRAGON_WIDTH_WIDE = 128;
export const CARD_FX_DRAGON_WIDTH_NARROW = 88;
export const CARD_FX_DRAGON_TOP_WIDE = 40;
export const CARD_FX_DRAGON_TOP_NARROW = 28;
export const CARD_FX_DRAGON_RIGHT_WIDE = 10;
export const CARD_FX_DRAGON_RIGHT_NARROW = 6;

export type CardFxOverhang = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function cardMugHang(size: number): number {
  return Math.round(size * CARD_FX_MUG_HANG_RATIO);
}

/**
 * Layout padding so absolute FX (dragon peek, oak mugs, glow) don't paint over
 * siblings under the card. Used by profile / questionnaire preview — not by the
 * wanderer deck (deck keeps full card size and lets FX paint into free gaps).
 */
export function getCardFxOverhang(
  auraId: QuestionnaireAuraId | 'none' | null | undefined,
  wide: boolean,
): CardFxOverhang {
  if (!auraId || auraId === 'none') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  if (auraId === 'void_runes') {
    return wide
      ? {
          top: CARD_FX_DRAGON_TOP_WIDE,
          bottom: 8,
          left: 8,
          right: CARD_FX_DRAGON_RIGHT_WIDE,
        }
      : {
          top: CARD_FX_DRAGON_TOP_NARROW,
          bottom: 6,
          left: 6,
          right: CARD_FX_DRAGON_RIGHT_NARROW,
        };
  }

  if (auraId === 'oak_shield') {
    const mugSize = wide ? CARD_FX_MUG_SIZE_WIDE : CARD_FX_MUG_SIZE_NARROW;
    const hang = cardMugHang(mugSize);
    return wide
      ? { top: 18, bottom: hang + 6, left: 12, right: 12 }
      : { top: 10, bottom: hang + 4, left: 8, right: 8 };
  }

  return wide
    ? { top: 14, bottom: 14, left: 14, right: 14 }
    : { top: 6, bottom: 6, left: 6, right: 6 };
}
