import { isDiceSkinId } from '@/data/rewards/catalog';
export const DICE_ROLL_PAYLOAD_VERSION = 1;
/** Косметические скины кубов в чате временно скрыты. */
export const CHAT_DICE_SKINS_ENABLED = false;
/** Скины кубов на экране «Дайсы» временно скрыты. */
export const DICE_SCREEN_SKINS_ENABLED = false;
export const CHAT_DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];
export const CHAT_MAX_PER_DIE = 8;
export const CHAT_MAX_TOTAL_DICE = 12;
export const DICE_ADVANTAGE_DICE = [{ sides: 20, qty: 2 }];
export function diceRollModeLabel(mode) {
    if (mode === 'advantage') {
        return 'Бросок с преимуществом';
    }
    if (mode === 'disadvantage') {
        return 'Бросок с помехой';
    }
    return null;
}
export function formatDiceFormula(dice, modifier = 0, mode = 'normal') {
    if (mode === 'advantage' || mode === 'disadvantage') {
        const base = '1d20';
        if (modifier === 0) {
            return base;
        }
        return modifier > 0 ? `${base} + ${modifier}` : `${base} − ${Math.abs(modifier)}`;
    }
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
/** Собрать все значения d20 из групп (dice-box иногда отдаёт 1d20+1d20). */
export function collectD20Values(groups) {
    return groups.filter((g) => g.sides === 20).flatMap((g) => g.values);
}
export function poolToDiceInputs(pool) {
    return CHAT_DIE_SIDES.filter((sides) => (pool[sides] ?? 0) > 0).map((sides) => ({
        sides,
        qty: pool[sides] ?? 0,
    }));
}
export function poolNotationParts(pool) {
    return poolToDiceInputs(pool).map((die) => `${die.qty}d${die.sides}`);
}
function parseDiceRollMode(value) {
    if (value === 'advantage' || value === 'disadvantage') {
        return value;
    }
    return undefined;
}
export function parseDiceRollPayload(body) {
    if (!body?.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(body);
        if (parsed?.v !== DICE_ROLL_PAYLOAD_VERSION || typeof parsed.formula !== 'string') {
            return null;
        }
        const color = typeof parsed.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(parsed.color.trim())
            ? `#${parsed.color.trim().slice(1).toUpperCase()}`
            : undefined;
        const skin = CHAT_DICE_SKINS_ENABLED &&
            typeof parsed.skin === 'string' &&
            isDiceSkinId(parsed.skin) &&
            parsed.skin !== 'standard'
            ? parsed.skin
            : undefined;
        const mode = parseDiceRollMode(parsed.mode);
        return {
            v: DICE_ROLL_PAYLOAD_VERSION,
            formula: parsed.formula,
            modifier: typeof parsed.modifier === 'number' ? parsed.modifier : 0,
            groups: Array.isArray(parsed.groups) ? parsed.groups : [],
            values: Array.isArray(parsed.values) ? parsed.values : [],
            sum: typeof parsed.sum === 'number' ? parsed.sum : null,
            hidden: Boolean(parsed.hidden),
            redacted: Boolean(parsed.redacted),
            ...(color ? { color } : {}),
            ...(skin ? { skin } : {}),
            ...(mode ? { mode } : {}),
        };
    }
    catch {
        return null;
    }
}
export function diceRollPreviewText(payload) {
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
export function payloadToForcedNotation(payload) {
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
export function diceInputsToNotation(dice) {
    const parts = [...dice]
        .filter((die) => die.qty > 0)
        .sort((a, b) => a.sides - b.sides)
        .map((die) => `${die.qty}d${die.sides}`);
    return parts.join('+') || '1d20';
}
/** Notation without forced values (Babylon / free roll). */
export function payloadToStageNotation(payload) {
    return payload.groups
        .filter((group) => group.sides > 0 && group.values.length > 0)
        .map((group) => ({
        qty: group.values.length,
        sides: group.sides,
    }));
}
export function payloadToNotationParts(payload) {
    return payload.groups.map((group) => `${group.values.length}d${group.sides}`);
}
/** Какое значение из 2d20 учитывается при преимуществе/помехе. */
export function keptDiceValue(values, mode) {
    if (mode !== 'advantage' && mode !== 'disadvantage') {
        return null;
    }
    if (values.length < 2) {
        return null;
    }
    return mode === 'advantage' ? Math.max(...values) : Math.min(...values);
}
/**
 * После 3D-броска: при преимуществе/помехе в итоге один куб (лучший/худший),
 * обе грани остаются в groups/values для анимации и пузыря.
 */
export function applyDiceKeepMode(outcome, mode, modifier = 0) {
    if (mode !== 'advantage' && mode !== 'disadvantage') {
        const diceSum = outcome.values.reduce((a, b) => a + b, 0);
        return {
            ...outcome,
            sum: diceSum + modifier,
            notation: formatDiceFormula(outcome.groups.map((g) => ({ sides: g.sides, qty: g.values.length })), modifier, mode),
        };
    }
    const d20Values = collectD20Values(outcome.groups);
    if (d20Values.length < 2) {
        const diceSum = outcome.values.reduce((a, b) => a + b, 0);
        return {
            ...outcome,
            sum: diceSum + modifier,
            notation: formatDiceFormula(outcome.groups.map((g) => ({ sides: g.sides, qty: g.values.length })), modifier, 'normal'),
        };
    }
    const kept = mode === 'advantage' ? Math.max(...d20Values) : Math.min(...d20Values);
    const otherGroups = outcome.groups.filter((g) => g.sides !== 20);
    const groups = [
        ...otherGroups,
        {
            sides: 20,
            values: d20Values,
            sum: kept,
        },
    ];
    return {
        ...outcome,
        groups,
        values: groups.flatMap((g) => g.values),
        sum: kept + modifier,
        notation: formatDiceFormula([{ sides: 20, qty: 1 }], modifier, mode),
    };
}
export const DICE_CRIT_FAIL_LABEL = 'Крит. провал';
export const DICE_CRIT_SUCCESS_LABEL = 'Крит. удача';
/**
 * Крит по итогу грани с модификатором:
 * провал — value+mod ≤ 1, удача — value+mod ≥ 20.
 */
export function diceFaceMark(sides, value, modifier = 0) {
    if (sides !== 20) {
        return null;
    }
    const total = value + modifier;
    if (total <= 1) {
        return 'crit_fail';
    }
    if (total >= 20) {
        return 'crit_success';
    }
    return null;
}
export function diceFaceMarkLabel(mark) {
    if (mark === 'crit_fail') {
        return DICE_CRIT_FAIL_LABEL;
    }
    if (mark === 'crit_success') {
        return DICE_CRIT_SUCCESS_LABEL;
    }
    return null;
}
/** Метки для карточки: уникальные криты по всем граням броска. */
export function diceRollCritLabels(groups, mode, modifier = 0) {
    const labels = [];
    let hasFail = false;
    let hasSuccess = false;
    const consider = (sides, value) => {
        const mark = diceFaceMark(sides, value, modifier);
        if (mark === 'crit_fail') {
            hasFail = true;
        }
        if (mark === 'crit_success') {
            hasSuccess = true;
        }
    };
    const dieCount = groups.reduce((sum, group) => sum + group.values.length, 0);
    if (mode === 'advantage' || mode === 'disadvantage') {
        const d20Values = collectD20Values(groups);
        if (d20Values.length >= 2) {
            const kept = mode === 'advantage' ? Math.max(...d20Values) : Math.min(...d20Values);
            consider(20, kept);
        }
        else {
            for (const group of groups) {
                for (const value of group.values) {
                    consider(group.sides, value);
                }
            }
        }
    }
    else if (dieCount <= 1) {
        // Несколько кубов без преимущества/помехи — крит по граням не пишем.
        for (const group of groups) {
            for (const value of group.values) {
                consider(group.sides, value);
            }
        }
    }
    if (hasFail) {
        labels.push(DICE_CRIT_FAIL_LABEL);
    }
    if (hasSuccess) {
        labels.push(DICE_CRIT_SUCCESS_LABEL);
    }
    return labels;
}
/** Восстановить модификатор из итога и сумм групп. */
export function modifierFromOutcome(outcome) {
    const diceSum = outcome.groups.reduce((acc, group) => acc + group.sum, 0);
    return outcome.sum - diceSum;
}
