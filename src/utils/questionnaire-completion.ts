import type { UserProfile } from '@/services/api/types';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { formatAvailability } from '@/screens/questionnaire/availability';
import {
  isQuestionnaireAgeValid,
  QUESTIONNAIRE_AGE_MAX,
  QUESTIONNAIRE_AGE_MIN,
} from '@/screens/questionnaire/questionnaire-validation';

export type QuestionnaireCompletion = {
  percent: number;
  isComplete: boolean;
  isPublic: boolean;
  isVisibleInFeed: boolean;
  missingFields: string[];
  title: string;
  subtitle: string;
  visibilityLabel: string;
  visibilityHint: string;
};

type CompletionChecks = {
  roles: boolean;
  about: boolean;
  age: boolean;
  experience: boolean;
  availability: boolean;
  timezone: boolean;
  location: boolean;
  systems: boolean;
};

const REQUIRED_FIELD_LABELS: Record<keyof CompletionChecks, string> = {
  roles: 'Роль',
  about: 'Статус',
  age: 'Возраст',
  experience: 'Опыт игры',
  availability: 'Когда удобно играть',
  timezone: 'Часовой пояс',
  location: 'Город или онлайн',
  systems: 'Системы (или «Любая система»)',
};

const REQUIRED_FIELD_KEYS = Object.keys(REQUIRED_FIELD_LABELS) as (keyof CompletionChecks)[];

const FEED_FIELD_KEYS = REQUIRED_FIELD_KEYS.filter((key) => key !== 'age');

function getMissingFields(checks: CompletionChecks): string[] {
  return REQUIRED_FIELD_KEYS.filter((key) => !checks[key]).map(
    (key) => REQUIRED_FIELD_LABELS[key],
  );
}

function calculatePercent(checks: CompletionChecks): number {
  const filledCount = REQUIRED_FIELD_KEYS.filter((key) => checks[key]).length;
  return Math.round((filledCount / REQUIRED_FIELD_KEYS.length) * 100);
}

function isFeedReady(checks: CompletionChecks): boolean {
  return FEED_FIELD_KEYS.every((key) => checks[key]);
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
  const feedReady = isFeedReady(input.checks);
  const isVisibleInFeed = feedReady && input.isPublic;

  let subtitle: string;
  if (!feedReady) {
    subtitle = `заполнен на ${percent}% · не показывается в Странниках`;
  } else if (!input.isPublic) {
    subtitle = isComplete
      ? 'заполнен · скрыт из ленты (приватная анкета)'
      : `заполнен на ${percent}% · скрыт из ленты (приватная анкета)`;
  } else if (!isComplete) {
    subtitle = 'виден в ленте · укажите возраст, чтобы завершить анкету';
  } else {
    subtitle = 'активен · виден в ленте Странники';
  }

  let visibilityLabel: string;
  let visibilityHint: string;

  if (isVisibleInFeed) {
    visibilityLabel = 'Показывается в Странниках';
    visibilityHint = isComplete
      ? 'Другие игроки могут найти вашу анкету в ленте.'
      : 'Анкета уже в ленте. Укажите возраст, чтобы завершить заполнение.';
  } else if (!feedReady) {
    visibilityLabel = 'Не показывается в ленте';
    visibilityHint =
      'Чтобы анкету увидели, заполните обязательные поля и сделайте её публичной.';
  } else {
    visibilityLabel = 'Скрыта из ленты';
    visibilityHint =
      'Анкета заполнена, но стоит режим «Приватная». Включите «Публичная», чтобы появиться в Странниках.';
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

function checksFromProfile(profile: UserProfile): CompletionChecks {
  return {
    roles: profile.roles.length > 0,
    about: Boolean(profile.about?.trim()),
    age:
      profile.age != null &&
      profile.age >= QUESTIONNAIRE_AGE_MIN &&
      profile.age <= QUESTIONNAIRE_AGE_MAX,
    experience: profile.experienceTypes.length > 0,
    availability: Boolean(profile.availability?.trim()),
    timezone: Boolean(profile.timezone?.trim()),
    location: Boolean(profile.city?.id) || profile.playsOnline,
    systems:
      profile.systems.length > 0 || profile.readyToLearnNew || profile.openToAnySystem,
  };
}

function checksFromDraft(draft: QuestionnaireDraft): CompletionChecks {
  return {
    roles: draft.role != null,
    about: Boolean(draft.status.trim()),
    age: isQuestionnaireAgeValid(draft.age),
    experience: Boolean(draft.experienceTypeId),
    availability: Boolean(formatAvailability(draft.availability)),
    timezone: Boolean(draft.timezone.trim()),
    location: Boolean(draft.cityId) || draft.playsOnline,
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
        about: false,
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

export const QUESTIONNAIRE_REQUIRED_FIELDS_HINT =
  'Обязательно: роль, статус, возраст, опыт, расписание, часовой пояс, локация (город или онлайн) и системы (или «Любая система»). Фото и описание — по желанию.';
