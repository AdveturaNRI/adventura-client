import { QUESTIONNAIRE_STEP_INDEX } from '@/screens/questionnaire/questionnaire.config';
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
    return value.role != null;
}
export const ROLES_STEP_VALIDATION_MESSAGE = 'Выберите роль, чтобы продолжить';
export function isProfileStepValid(value) {
    return Boolean(value.status.trim()) && isQuestionnaireAgeValid(value.age);
}
export const PROFILE_STEP_VALIDATION_MESSAGE = 'Укажите статус и возраст (от 1 до 99), чтобы продолжить';
export function isLocationStepValid(value) {
    return value.cities.length > 0 || value.playsOnline;
}
export const LOCATION_STEP_VALIDATION_MESSAGE = 'Выберите город или отметьте «Играю онлайн»';
export const MAX_QUESTIONNAIRE_CITIES = 3;
export function isExperienceStepValid(value) {
    return Boolean(value.timezone?.trim());
}
export const EXPERIENCE_STEP_VALIDATION_MESSAGE = 'Укажите часовой пояс';
export function isSystemsStepValid(value) {
    return value.systems.length > 0 || value.readyToLearnNew || value.openToAnySystem;
}
export const SYSTEMS_STEP_VALIDATION_MESSAGE = 'Выберите хотя бы одну систему или отметьте «Любая система»';
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
