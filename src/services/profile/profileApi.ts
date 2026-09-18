import { apiRequest, apiUpload } from '@/services/api/client';
import type { ImageUrls, UserProfile } from '@/services/api/types';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { formatAvailability } from '@/screens/questionnaire/availability';
import { QUESTIONNAIRE_STEP_INDEX } from '@/screens/questionnaire/questionnaire.config';
import {
  QUESTIONNAIRE_AGE_MAX,
  QUESTIONNAIRE_AGE_MIN,
} from '@/screens/questionnaire/questionnaire-validation';
import { roleChoiceToRoles } from '@/screens/questionnaire/types';
import { isGifImage } from '@/utils/image-format';
import { prepareImageForUpload } from '@/utils/prepare-image-upload';

export type UpdateProfilePayload = {
  nickname?: string;
  about?: string;
  description?: string;
  roles?: string[];
  experienceTypeIds?: string[];
  availability?: string;
  age?: number;
  cityId?: string | null;
  cityIds?: string[];
  playsOnline?: boolean;
  timezone?: string;
  systems?: string[];
  readyToLearnNew?: boolean;
  openToAnySystem?: boolean;
  prefersFreeOnly?: boolean;
  questionnaireStep?: number;
  isPublic?: boolean;
};

function parseQuestionnaireAge(age: string): number | null {
  const trimmed = age.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (
    !Number.isFinite(parsed) ||
    parsed < QUESTIONNAIRE_AGE_MIN ||
    parsed > QUESTIONNAIRE_AGE_MAX
  ) {
    return null;
  }

  return parsed;
}

let inflightProfileRequest: Promise<UserProfile> | null = null;

export function getProfile() {
  if (!inflightProfileRequest) {
    inflightProfileRequest = apiRequest<UserProfile>('/users/me').finally(() => {
      inflightProfileRequest = null;
    });
  }

  return inflightProfileRequest;
}

export function updateProfile(payload: UpdateProfilePayload) {
  inflightProfileRequest = null;

  return apiRequest<UserProfile>('/users/me', {
    method: 'PATCH',
    body: payload,
  });
}

export async function uploadAvatar(localUri: string) {
  const preparedUri = await prepareImageForUpload(localUri, 'avatar');

  return apiUpload<UserProfile>('/users/me/avatar', 'avatar', preparedUri, {
    fileName: 'avatar.jpg',
    mimeType: 'image/jpeg',
  });
}

export async function uploadProfileCard(localUri: string) {
  const preparedUri = await prepareImageForUpload(localUri, 'profileCard');

  return apiUpload<UserProfile>('/users/me/profile-card', 'profileCard', preparedUri, {
    fileName: 'profile-card.jpg',
    mimeType: 'image/jpeg',
  });
}

function isPresignedObjectUrl(url: string): boolean {
  return (
    url.includes('X-Amz-Signature=') ||
    url.includes('X-Amz-Algorithm=') ||
    url.includes('x-amz-signature=')
  );
}

function withCacheBust(baseUrl: string, cacheKey?: string | null): string {
  if (!cacheKey || isPresignedObjectUrl(baseUrl)) {
    // Extra query params invalidate S3/Yandex SigV4 signatures.
    return baseUrl;
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}v=${encodeURIComponent(cacheKey)}`;
}

export function pickAvatarUrl(
  avatar: ImageUrls | null,
  cacheKey?: string | null,
): string | null {
  if (!avatar) {
    return null;
  }

  const baseUrl =
    avatar.large ?? avatar.medium ?? avatar.small ?? avatar.thumb ?? null;

  if (!baseUrl) {
    return null;
  }

  return withCacheBust(baseUrl, cacheKey);
}

export function pickProfileCardUrl(
  profileCard: ImageUrls | null,
  cacheKey?: string | null,
): string | null {
  if (!profileCard) {
    return null;
  }

  const baseUrl =
    profileCard.card ?? profileCard.cardThumb ?? profileCard.large ?? profileCard.original ?? null;

  if (!baseUrl) {
    return null;
  }

  return withCacheBust(baseUrl, cacheKey);
}

export function isLocalImageUri(uri: string): boolean {
  return !uri.startsWith('http://') && !uri.startsWith('https://');
}

export function isRemoteImageUri(uri: string | null | undefined): uri is string {
  return Boolean(uri && !isLocalImageUri(uri));
}

export function deleteProfileCard() {
  inflightProfileRequest = null;

  return apiRequest<UserProfile>('/users/me/profile-card', {
    method: 'DELETE',
  });
}

export function deleteQuestionnaire() {
  inflightProfileRequest = null;

  return apiRequest<UserProfile>('/users/me/questionnaire', {
    method: 'DELETE',
  });
}

export async function saveQuestionnaireToServer(
  draft: QuestionnaireDraft,
  stepIndex: number,
  options?: {
    activeStepIndex?: number;
    savedProfileCardUri?: string | null;
  },
): Promise<UserProfile> {
  const skippedGifs: string[] = [];

  if (draft.profileCardUri && isLocalImageUri(draft.profileCardUri)) {
    if (isGifImage(draft.profileCardUri)) {
      skippedGifs.push('карточку профиля');
    } else {
      await uploadProfileCard(draft.profileCardUri);
    }
  } else if (
    !draft.profileCardUri &&
    isRemoteImageUri(options?.savedProfileCardUri)
  ) {
    await deleteProfileCard();
  }

  const payload: UpdateProfilePayload = {
    questionnaireStep: stepIndex,
  };

  if (draft.role) {
    payload.roles = roleChoiceToRoles(draft.role);
  }

  const trimmedNickname = draft.nickname.trim();
  if (trimmedNickname.length >= 3) {
    payload.nickname = trimmedNickname;
  }

  const trimmedStatus = draft.status.trim();
  if (trimmedStatus) {
    payload.about = trimmedStatus;
  }

  const activeStepIndex = options?.activeStepIndex ?? stepIndex;
  const trimmedDescription = draft.description.trim();
  if (activeStepIndex === QUESTIONNAIRE_STEP_INDEX.profile) {
    if (trimmedDescription) {
      payload.description = trimmedDescription;
    }
  } else if (trimmedDescription) {
    payload.description = trimmedDescription;
  }

  const parsedAge = parseQuestionnaireAge(draft.age);
  if (parsedAge !== null) {
    payload.age = parsedAge;
  }

  if (draft.experienceTypeId) {
    payload.experienceTypeIds = [draft.experienceTypeId];
  }

  const availability = formatAvailability(draft.availability);
  if (availability) {
    payload.availability = availability;
  }

  if (draft.cities.length > 0) {
    payload.cityIds = draft.cities.map((city) => city.id);
  } else {
    payload.cityIds = [];
  }

  payload.playsOnline = draft.playsOnline;
  if (draft.timezone.trim()) {
    payload.timezone = draft.timezone.trim();
  }
  payload.systems = draft.systems;
  payload.readyToLearnNew = draft.readyToLearnNew;
  payload.openToAnySystem = draft.openToAnySystem;
  payload.isPublic = draft.isPublic;

  const profile = await updateProfile(payload);

  if (skippedGifs.length > 0) {
    throw new QuestionnaireGifUploadSkippedError(skippedGifs, profile);
  }

  return profile;
}

export class QuestionnaireGifUploadSkippedError extends Error {
  readonly skipped: string[];
  readonly profile: UserProfile;

  constructor(skipped: string[], profile: UserProfile) {
    super(`GIF не загружен: ${skipped.join(', ')}`);
    this.name = 'QuestionnaireGifUploadSkippedError';
    this.skipped = skipped;
    this.profile = profile;
  }
}
