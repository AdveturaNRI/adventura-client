import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { QUESTIONNAIRE_STEP_INDEX } from '@/screens/questionnaire/questionnaire.config';

export const QUESTIONNAIRE_AGE_MIN = 1;
export const QUESTIONNAIRE_AGE_MAX = 99;

export function parseQuestionnaireAgeValue(age: string): number | null {
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

export function isQuestionnaireAgeValid(age: string): boolean {
  const parsed = parseQuestionnaireAgeValue(age);

  return (
    parsed != null && parsed >= QUESTIONNAIRE_AGE_MIN && parsed <= QUESTIONNAIRE_AGE_MAX
  );
}

export function isRolesStepValid(value: Pick<QuestionnaireDraft, 'role'>): boolean {
  return value.role != null;
}

export const ROLES_STEP_VALIDATION_MESSAGE = 'Выберите роль, чтобы продолжить';

export function isProfileStepValid(
  value: Pick<QuestionnaireDraft, 'status' | 'age'>,
): boolean {
  return Boolean(value.status.trim()) && isQuestionnaireAgeValid(value.age);
}

export const PROFILE_STEP_VALIDATION_MESSAGE =
  'Укажите статус и возраст (от 1 до 99), чтобы продолжить';

export function isLocationStepValid(
  value: Pick<QuestionnaireDraft, 'cityId' | 'playsOnline'>,
): boolean {
  return Boolean(value.cityId) || value.playsOnline;
}

export const LOCATION_STEP_VALIDATION_MESSAGE =
  'Выберите город или отметьте «Играю онлайн»';

export function isExperienceStepValid(
  value: Pick<QuestionnaireDraft, 'timezone'>,
): boolean {
  return Boolean(value.timezone?.trim());
}

export const EXPERIENCE_STEP_VALIDATION_MESSAGE = 'Укажите часовой пояс';

export function isSystemsStepValid(
  value: Pick<QuestionnaireDraft, 'systems' | 'readyToLearnNew' | 'openToAnySystem'>,
): boolean {
  return value.systems.length > 0 || value.readyToLearnNew || value.openToAnySystem;
}

export const SYSTEMS_STEP_VALIDATION_MESSAGE =
  'Выберите хотя бы одну систему или отметьте «Любая система»';

export function isQuestionnaireStepReady(
  stepIndex: number,
  draft: QuestionnaireDraft,
): boolean {
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
