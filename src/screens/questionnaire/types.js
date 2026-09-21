import { EMPTY_QUESTIONNAIRE_AVAILABILITY } from '@/screens/questionnaire/availability';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';
export function roleChoiceToRoles(choice) {
    switch (choice) {
        case 'player':
            return ['Игрок'];
        case 'master':
            return ['Мастер'];
        case 'both':
            return ['Игрок', 'Мастер'];
    }
}
export function rolesToChoice(roles) {
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
export const INITIAL_QUESTIONNAIRE_DRAFT = {
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
