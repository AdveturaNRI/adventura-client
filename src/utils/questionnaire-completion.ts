import type { UserProfile } from '@/services/api/types';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { rolesToChoice } from '@/screens/questionnaire/types';
import { formatAvailability } from '@/screens/questionnaire/availability';
import {
  isQuestionnaireAgeValid,
  QUESTIONNAIRE_AGE_MAX,
  QUESTIONNAIRE_AGE_MIN,
} from '@/screens/questionnaire/questionnaire-validation';
import { QUESTIONNAIRE_STEP_INDEX } from '@/screens/questionnaire/questionnaire.config';

export type QuestionnaireMissingField = {
  key: keyof CompletionChecks;
  label: string;
  /** Query param for `/questionnaire?focus=` */
  focus: string;
};

export type QuestionnaireCompletion = {
  percent: number;
  isComplete: boolean;
  isPublic: boolean;
  isVisibleInFeed: boolean;
  missingFields: QuestionnaireMissingField[];
  title: string;
  subtitle: string;
  visibilityLabel: string;
  visibilityHint: string;
};

type CompletionChecks = {
  roles: boolean;
  gameCost: boolean;
  playerPayment: boolean;
  age: boolean;
  experience: boolean;
  availability: boolean;
  timezone: boolean;
  location: boolean;
  systems: boolean;
};

const REQUIRED_FIELD_LABELS: Record<keyof CompletionChecks, string> = {
  roles: 'Роль',
  gameCost: 'Стоимость игр',
  playerPayment: 'Предпочтения по оплате игр',
  age: 'Возраст',
  experience: 'Опыт игры',
  availability: 'Когда удобно играть',
  timezone: 'Часовой пояс',
  location: 'Локация',
  systems: 'Системы',
};

const REQUIRED_FIELD_FOCUS: Record<keyof CompletionChecks, string> = {
  roles: 'roles',
  gameCost: 'gameCost',
  playerPayment: 'playerPayment',
  age: 'age',
  experience: 'experience',
  availability: 'availability',
  timezone: 'timezone',
  location: 'location',
  systems: 'systems',
};

const REQUIRED_FIELD_KEYS = Object.keys(REQUIRED_FIELD_LABELS) as (keyof CompletionChecks)[];

function getMissingFields(checks: CompletionChecks): QuestionnaireMissingField[] {
  return REQUIRED_FIELD_KEYS.filter((key) => !checks[key]).map((key) => ({
    key,
    label: REQUIRED_FIELD_LABELS[key],
    focus: REQUIRED_FIELD_FOCUS[key],
  }));
}

function calculatePercent(checks: CompletionChecks): number {
  const filledCount = REQUIRED_FIELD_KEYS.filter((key) => checks[key]).length;
  return Math.round((filledCount / REQUIRED_FIELD_KEYS.length) * 100);
}

function buildCompletion(input: {
  checks: CompletionChecks;
  isPublic: boolean;
  apiPercent?: number | null;
}): QuestionnaireCompletion {
  const fromChecks = calculatePercent(input.checks);
  const percent = Math.min(100, Math.max(input.apiPercent ?? 0, fromChecks));
  const isComplete = percent >= 100;
  const missingFields = getMissingFields(input.checks);
  const isVisibleInFeed = input.isPublic;

  let subtitle: string;
  if (isComplete) {
    subtitle = 'заполнена';
  } else {
    subtitle = `заполнена на ${percent}%`;
  }

  let visibilityLabel: string;
  let visibilityHint: string;

  if (isVisibleInFeed) {
    visibilityLabel = 'Показывается в Странниках';
    visibilityHint = isComplete
      ? 'Другие игроки могут найти вашу анкету в ленте.'
      : 'Анкета уже в ленте. Можно дозаполнить обязательные поля.';
  } else {
    visibilityLabel = 'Скрыта из ленты';
    visibilityHint =
      'Стоит режим «Приватная». Включите «Публичная», чтобы появиться в Странниках.';
  }

  return {
    percent,
    isComplete,
    isPublic: input.isPublic,
    isVisibleInFeed,
    missingFields,
    title: 'Ваша анкета',
    subtitle,
    visibilityLabel,
    visibilityHint,
  };
}

function paymentChecksForRole(role: ReturnType<typeof rolesToChoice>): {
  gameCost: boolean;
  playerPayment: boolean;
} {
  const needsMasterCost = role === 'master' || role === 'both';
  const needsPlayerPayment = role === 'player' || role === 'both';

  return {
    gameCost: !needsMasterCost,
    playerPayment: !needsPlayerPayment,
  };
}

function checksFromProfile(profile: UserProfile): CompletionChecks {
  const role = rolesToChoice(profile.roles);
  const paymentDefaults = paymentChecksForRole(role);

  return {
    roles: profile.roles.length > 0,
    gameCost: paymentDefaults.gameCost || Boolean(profile.gameCostFormat),
    playerPayment: paymentDefaults.playerPayment || Boolean(profile.playerPaymentFormat),
    age:
      profile.age != null &&
      profile.age >= QUESTIONNAIRE_AGE_MIN &&
      profile.age <= QUESTIONNAIRE_AGE_MAX,
    experience: profile.experienceTypes.length > 0,
    availability: Boolean(profile.availability?.trim()),
    timezone: Boolean(profile.timezone?.trim()),
    location: Boolean(profile.cities?.length || profile.city?.id) || profile.playsOnline,
    systems:
      profile.systems.length > 0 || profile.readyToLearnNew || profile.openToAnySystem,
  };
}

function checksFromDraft(draft: QuestionnaireDraft): CompletionChecks {
  const paymentDefaults = paymentChecksForRole(draft.role);

  return {
    roles: draft.role != null,
    gameCost: paymentDefaults.gameCost || Boolean(draft.gameCostFormat),
    playerPayment: paymentDefaults.playerPayment || Boolean(draft.playerPaymentFormat),
    age: isQuestionnaireAgeValid(draft.age),
    experience: Boolean(draft.experienceTypeId),
    availability: Boolean(formatAvailability(draft.availability)),
    timezone: Boolean(draft.timezone.trim()),
    location: draft.cities.length > 0 || draft.playsOnline,
    systems:
      draft.systems.length > 0 || draft.readyToLearnNew || draft.openToAnySystem,
  };
}

export function getQuestionnaireCompletion(
  profile: UserProfile | null | undefined,
): QuestionnaireCompletion {
  if (!profile) {
    return buildCompletion({
      checks: {
        roles: false,
        gameCost: true,
        playerPayment: true,
        age: false,
        experience: false,
        availability: false,
        timezone: false,
        location: false,
        systems: false,
      },
      isPublic: true,
      apiPercent: 0,
    });
  }

  return buildCompletion({
    checks: checksFromProfile(profile),
    isPublic: profile.isPublic,
    apiPercent: profile.questionnaireCompletionPercent,
  });
}

export function getQuestionnaireCompletionFromDraft(
  draft: QuestionnaireDraft,
): QuestionnaireCompletion {
  return buildCompletion({
    checks: checksFromDraft(draft),
    isPublic: draft.isPublic,
  });
}

export function getQuestionnaireStepForFocus(focus: string | undefined | null): number | null {
  if (!focus) {
    return null;
  }

  switch (focus) {
    case 'roles':
    case 'gameCost':
    case 'playerPayment':
      return QUESTIONNAIRE_STEP_INDEX.roles;
    case 'profile':
    case 'age':
      return QUESTIONNAIRE_STEP_INDEX.profile;
    case 'experience':
    case 'availability':
    case 'timezone':
      return QUESTIONNAIRE_STEP_INDEX.experience;
    case 'location':
      return QUESTIONNAIRE_STEP_INDEX.location;
    case 'systems':
      return QUESTIONNAIRE_STEP_INDEX.systems;
    default:
      return null;
  }
}

export const QUESTIONNAIRE_REQUIRED_FIELDS_HINT =
  'Обязательно: роль, стоимость/оплата (по роли), возраст, опыт, расписание, часовой пояс, локация и системы. Статус, фото и описание — по желанию.';
