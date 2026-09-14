import type { QuestionnaireAvailability } from '@/screens/questionnaire/availability';
import { EMPTY_QUESTIONNAIRE_AVAILABILITY } from '@/screens/questionnaire/availability';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';

export type PlayerRoleChoice = 'player' | 'master' | 'both';

export type { QuestionnaireAvailability };

export type QuestionnaireCitySelection = {
  id: string;
  label: string;
};

export type QuestionnaireDraft = {
  role: PlayerRoleChoice | null;
  profileCardUri: string | null;
  /** Increments on each local photo pick/crop/remove; reset to 0 after server sync. */
  profileCardRevision: number;
  nickname: string;
  status: string;
  description: string;
  age: string;
  experienceTypeId: string | null;
  experienceTypeLabel: string;
  availability: QuestionnaireAvailability;
  timezone: string;
  cities: QuestionnaireCitySelection[];
  playsOnline: boolean;
  systems: string[];
  readyToLearnNew: boolean;
  openToAnySystem: boolean;
  isPublic: boolean;
};

export function roleChoiceToRoles(choice: PlayerRoleChoice): string[] {
  switch (choice) {
    case 'player':
      return ['Игрок'];
    case 'master':
      return ['Мастер'];
    case 'both':
      return ['Игрок', 'Мастер'];
  }
}

export function rolesToChoice(roles: string[]): PlayerRoleChoice | null {
  const hasPlayer = roles.includes('Игрок');
  const hasMaster = roles.includes('Мастер');

  if (hasPlayer && hasMaster) {
    return 'both';
  }

  if (hasMaster) {
    return 'master';
  }

  if (hasPlayer) {
    return 'player';
  }

  return null;
}

export const INITIAL_QUESTIONNAIRE_DRAFT: QuestionnaireDraft = {
  role: null,
  profileCardUri: null,
  profileCardRevision: 0,
  nickname: '',
  status: '',
  description: '',
  age: '',
  experienceTypeId: null,
  experienceTypeLabel: '',
  availability: { ...EMPTY_QUESTIONNAIRE_AVAILABILITY, slots: [] },
  timezone: DEFAULT_TIMEZONE,
  cities: [],
  playsOnline: false,
  systems: [],
  readyToLearnNew: false,
  openToAnySystem: false,
  isPublic: true,
};
