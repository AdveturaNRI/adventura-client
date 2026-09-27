import { QUESTIONNAIRE_STEP_INDEX } from '@/screens/questionnaire/questionnaire.config';
import { isSessionPriceValid } from '@/utils/questionnaire-payment';
export const QUESTIONNAIRE_AGE_MIN = 1;
export const QUESTIONNAIRE_AGE_MAX = 99;
export function parseQuestionnaireAgeValue(age) {
    const trimmed = age.trim();
    if (!trimmed) {
        return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return parsed;
}
export function isQuestionnaireAgeValid(age) {
    const parsed = parseQuestionnaireAgeValue(age);
    return (parsed != null && parsed >= QUESTIONNAIRE_AGE_MIN && parsed <= QUESTIONNAIRE_AGE_MAX);
}
export function isRolesStepValid(value) {
    if (value.role == null) {
        return false;
    }
    const needsMasterCost = value.role === 'master' || value.role === 'both';
    const needsPlayerPayment = value.role === 'player' || value.role === 'both';
    if (needsMasterCost && value.gameCostFormat == null) {
        return false;
    }
    if (needsPlayerPayment && value.playerPaymentFormat == null) {
        return false;
    }
    if (needsMasterCost && !isSessionPriceValid(value)) {
        return false;
    }
    return true;
}
export function getMissingRequiredLabelsForStep(stepIndex, draft) {
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.roles) {
        const missing = [];
        if (draft.role == null) {
            missing.push('Роль');
            return missing;
        }
        const needsMasterCost = draft.role === 'master' || draft.role === 'both';
        const needsPlayerPayment = draft.role === 'player' || draft.role === 'both';
        if (needsMasterCost && draft.gameCostFormat == null) {
            missing.push('Стоимость игр');
        }
        if (needsPlayerPayment && draft.playerPaymentFormat == null) {
            missing.push('Предпочтения по оплате игр');
        }
        return missing;
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.profile) {
        return isQuestionnaireAgeValid(draft.age) ? [] : ['Возраст'];
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.experience) {
        return draft.timezone?.trim() ? [] : ['Часовой пояс'];
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.location) {
        return isLocationStepValid(draft) ? [] : ['Локация'];
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.systems) {
        return isSystemsStepValid(draft) ? [] : ['Системы'];
    }
    return [];
}
export function formatMissingRequiredFieldsToast(labels) {
    if (labels.length === 0) {
        return '';
    }
    if (labels.length === 1) {
        return `Заполните: ${labels[0]}`;
    }
    return `Заполните: ${labels.join(', ')}`;
}
export function getRolesStepValidationMessage(value) {
    const missing = getMissingRequiredLabelsForStep(QUESTIONNAIRE_STEP_INDEX.roles, value);
    if (missing.length === 0) {
        if (value.role != null &&
            (value.role === 'master' || value.role === 'both') &&
            !isSessionPriceValid(value)) {
            return SESSION_PRICE_STEP_VALIDATION_MESSAGE;
        }
        return null;
    }
    if (missing.length === 1 && missing[0] === 'Роль') {
        return ROLES_STEP_VALIDATION_MESSAGE;
    }
    return formatMissingRequiredFieldsToast(missing);
}
export const ROLES_STEP_VALIDATION_MESSAGE = 'Выберите роль, чтобы продолжить';
export const GAME_COST_STEP_VALIDATION_MESSAGE = 'Выберите стоимость игр';
export const PLAYER_PAYMENT_STEP_VALIDATION_MESSAGE = 'Выберите предпочтения по оплате игр';
export const SESSION_PRICE_STEP_VALIDATION_MESSAGE = 'Проверьте стоимость сессии: только положительные суммы, в диапазоне минимум не больше максимума';
export function isProfileStepValid(value) {
    return isQuestionnaireAgeValid(value.age);
}
export const PROFILE_STEP_VALIDATION_MESSAGE = 'Укажите возраст (от 1 до 99), чтобы продолжить';
export function isLocationStepValid(value) {
    return value.cities.length > 0 || value.playsOnline;
}
export const LOCATION_STEP_VALIDATION_MESSAGE = 'Заполните: Локация';
export const MAX_QUESTIONNAIRE_CITIES = 3;
export function isExperienceStepValid(value) {
    return Boolean(value.timezone?.trim());
}
export const EXPERIENCE_STEP_VALIDATION_MESSAGE = 'Заполните: Часовой пояс';
export function isSystemsStepValid(value) {
    return value.systems.length > 0 || value.readyToLearnNew || value.openToAnySystem;
}
export const SYSTEMS_STEP_VALIDATION_MESSAGE = 'Заполните: Системы';
export function isQuestionnaireStepReady(stepIndex, draft) {
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.roles) {
        return isRolesStepValid(draft);
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.profile) {
        return isProfileStepValid(draft);
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.experience) {
        return isExperienceStepValid(draft);
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.location) {
        return isLocationStepValid(draft);
    }
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.systems) {
        return isSystemsStepValid(draft);
    }
    return true;
}
