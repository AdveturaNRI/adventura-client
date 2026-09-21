/** Mug size on feed cards (`overlay={false}` → wide). Keep in sync with OakCardExtras. */
export const CARD_FX_MUG_SIZE_WIDE = 64;
export const CARD_FX_MUG_SIZE_NARROW = 40;
/** How much of the mug hangs below the card edge (AleMugs `variant="card"`). */
export const CARD_FX_MUG_HANG_RATIO = 0.5;
export function cardMugHang(size) {
    return Math.round(size * CARD_FX_MUG_HANG_RATIO);
}
/**
 * Layout padding so absolute FX (dragon peek, oak mugs, glow) don't paint over
 * siblings under the card.
 */
export function getCardFxOverhang(auraId, wide) {
    if (!auraId || auraId === 'none') {
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }
    if (auraId === 'void_runes') {
        return wide
            ? { top: 122, bottom: 10, left: 10, right: 28 }
            : { top: 58, bottom: 6, left: 6, right: 10 };
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
