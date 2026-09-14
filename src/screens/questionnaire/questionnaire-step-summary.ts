import {
  QUESTIONNAIRE_STEP_TITLES,
  QUESTIONNAIRE_TOTAL_STEPS,
  ROLES_STEP,
} from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { formatAvailability } from '@/screens/questionnaire/availability';
import { formatTimezoneLabel } from '@/utils/timezones';

export type QuestionnaireMapNodeStatus = 'completed' | 'current' | 'upcoming';

export type QuestionnaireMapNode = {
  index: number;
  title: string;
  status: QuestionnaireMapNodeStatus;
  lines: string[];
};

function getRoleLabel(draft: QuestionnaireDraft): string | null {
  if (!draft.role) {
    return null;
  }

  return ROLES_STEP.options.find((option) => option.key === draft.role)?.label ?? null;
}

function getRoleSummaryLines(draft: QuestionnaireDraft): string[] {
  const roleLabel = getRoleLabel(draft);

  return roleLabel ? [roleLabel] : ['Не выбрана'];
}

function getProfileSummaryLines(draft: QuestionnaireDraft): string[] {
  const lines: string[] = [];

  if (draft.nickname.trim()) {
    lines.push(draft.nickname.trim());
  }

  if (draft.status.trim()) {
    lines.push(draft.status.trim());
  }

  if (draft.description.trim()) {
    lines.push('Описание добавлено');
  }

  if (draft.age.trim()) {
    lines.push(`${draft.age.trim()} лет`);
  }

  if (draft.profileCardUri) {
    lines.push('Фото добавлено');
  }

  lines.push(draft.isPublic ? 'Публичная анкета' : 'Приватная анкета');

  return lines;
}

function getExperienceSummaryLines(draft: QuestionnaireDraft): string[] {
  const lines: string[] = [];

  if (draft.experienceTypeLabel.trim()) {
    lines.push(draft.experienceTypeLabel.trim());
  }

  const availability = formatAvailability(draft.availability);
  if (availability) {
    lines.push(availability);
  }
  if (draft.timezone.trim()) {
    lines.push(formatTimezoneLabel(draft.timezone));
  }

  return lines;
}

function getLocationSummaryLines(draft: QuestionnaireDraft): string[] {
  const lines: string[] = [];

  for (const city of draft.cities) {
    const label = city.label.trim();
    if (label) {
      lines.push(label);
    }
  }

  if (draft.playsOnline) {
    lines.push('Играю онлайн');
  }

  return lines;
}

function getSystemsSummaryLines(draft: QuestionnaireDraft): string[] {
  const lines = [...draft.systems];

  if (draft.openToAnySystem) {
    lines.push('Любая система');
  }

  if (draft.readyToLearnNew) {
    lines.push('Готов изучить новое');
  }

  return lines;
}

function getCompletedStepLines(stepIndex: number, draft: QuestionnaireDraft): string[] {
  switch (stepIndex) {
    case 0:
      return getRoleSummaryLines(draft);
    case 1:
      return getProfileSummaryLines(draft).length > 0
        ? getProfileSummaryLines(draft)
        : ['Пока пусто'];
    case 2:
      return getExperienceSummaryLines(draft).length > 0
        ? getExperienceSummaryLines(draft)
        : ['Пока пусто'];
    case 3:
      return getLocationSummaryLines(draft).length > 0
        ? getLocationSummaryLines(draft)
        : ['Пока пусто'];
    case 4:
      return getSystemsSummaryLines(draft).length > 0
        ? getSystemsSummaryLines(draft)
        : ['Пока пусто'];
    case 5:
      return ['Карточка готова'];
    default:
      return [];
  }
}

export function getQuestionnaireStepMap(
  draft: QuestionnaireDraft,
  currentStepIndex: number,
  totalSteps: number = QUESTIONNAIRE_TOTAL_STEPS,
): QuestionnaireMapNode[] {
  return Array.from({ length: totalSteps }, (_, index) => {
    const title = QUESTIONNAIRE_STEP_TITLES[index] ?? `Шаг ${index + 1}`;
    let status: QuestionnaireMapNodeStatus = 'upcoming';

    if (index < currentStepIndex) {
      status = 'completed';
    } else if (index === currentStepIndex) {
      status = 'current';
    }

    const lines =
      status === 'completed' && index < QUESTIONNAIRE_STEP_TITLES.length
        ? getCompletedStepLines(index, draft)
        : [];

    return {
      index,
      title,
      status,
      lines,
    };
  });
}
