import type { UserProfile } from '@/services/api/types';
import { isLocalImageUri, pickProfileCardUrl } from '@/services/profile/profileApi';
import { parseAvailability, areAvailabilitiesEqual } from '@/screens/questionnaire/availability';
import { QUESTIONNAIRE_STEPS } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { rolesToChoice } from '@/screens/questionnaire/types';
import { formatCityLabel } from '@/utils/city-label';
import { getQuestionnaireCompletion } from '@/utils/questionnaire-completion';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';

const LAST_IMPLEMENTED_STEP_INDEX = QUESTIONNAIRE_STEPS.length - 1;

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.every((value, index) => value === rightSorted[index]);
}

export function resolveQuestionnaireStepIndex(profile: UserProfile): number {
  if (getQuestionnaireCompletion(profile).isComplete) {
    return LAST_IMPLEMENTED_STEP_INDEX;
  }

  return Math.min(
    Math.max(profile.questionnaireStep ?? 0, 0),
    LAST_IMPLEMENTED_STEP_INDEX,
  );
}

function stripImageCacheKey(uri: string): string {
  return uri.replace(/([?&])v=[^&]+/g, '').replace(/[?&]$/, '');
}

function isProfileCardDirty(draft: QuestionnaireDraft, saved: QuestionnaireDraft): boolean {
  const draftUri = draft.profileCardUri;
  const savedUri = saved.profileCardUri;

  if (isLocalImageUri(draftUri ?? '')) {
    return true;
  }

  if (!draftUri && savedUri) {
    return true;
  }

  if (draftUri && !savedUri) {
    return true;
  }

  if (draftUri && savedUri) {
    return stripImageCacheKey(draftUri) !== stripImageCacheKey(savedUri);
  }

  return false;
}

export function profileToQuestionnaireDraft(profile: UserProfile): QuestionnaireDraft {
  return {
    role: rolesToChoice(profile.roles),
    profileCardUri: pickProfileCardUrl(profile.profileCard, profile.updatedAt),
    profileCardRevision: 0,
    nickname: profile.nickname,
    status: profile.about ?? '',
    description: profile.description ?? '',
    age: profile.age != null ? String(profile.age) : '',
    experienceTypeId: profile.experienceTypes[0]?.id ?? null,
    experienceTypeLabel: profile.experienceTypes[0]?.name ?? '',
    availability: parseAvailability(profile.availability),
    timezone: profile.timezone?.trim() || DEFAULT_TIMEZONE,
    cityId: profile.city?.id ?? null,
    cityLabel: profile.city ? formatCityLabel(profile.city) : profile.location ?? '',
    playsOnline: profile.playsOnline,
    systems: [...profile.systems],
    readyToLearnNew: profile.readyToLearnNew,
    openToAnySystem: profile.openToAnySystem ?? false,
    isPublic: profile.isPublic,
  };
}

export function isQuestionnaireDraftDirty(
  draft: QuestionnaireDraft,
  saved: QuestionnaireDraft,
): boolean {
  return (
    draft.role !== saved.role ||
    isProfileCardDirty(draft, saved) ||
    draft.nickname.trim() !== saved.nickname.trim() ||
    draft.status.trim() !== saved.status.trim() ||
    draft.description.trim() !== saved.description.trim() ||
    draft.age.trim() !== saved.age.trim() ||
    draft.experienceTypeId !== saved.experienceTypeId ||
    draft.experienceTypeLabel !== saved.experienceTypeLabel ||
    !areAvailabilitiesEqual(draft.availability, saved.availability) ||
    draft.timezone !== saved.timezone ||
    draft.cityId !== saved.cityId ||
    draft.cityLabel !== saved.cityLabel ||
    draft.playsOnline !== saved.playsOnline ||
    !areStringArraysEqual(draft.systems, saved.systems) ||
    draft.readyToLearnNew !== saved.readyToLearnNew ||
    draft.openToAnySystem !== saved.openToAnySystem ||
    draft.isPublic !== saved.isPublic
  );
}
