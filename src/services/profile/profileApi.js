import { apiRequest, apiUpload } from '@/services/api/client';
import { formatAvailability } from '@/screens/questionnaire/availability';
import { QUESTIONNAIRE_STEP_INDEX } from '@/screens/questionnaire/questionnaire.config';
import { QUESTIONNAIRE_AGE_MAX, QUESTIONNAIRE_AGE_MIN, } from '@/screens/questionnaire/questionnaire-validation';
import { roleChoiceToRoles } from '@/screens/questionnaire/types';
import { isGifImage } from '@/utils/image-format';
import { prepareImageForUpload } from '@/utils/prepare-image-upload';
function parseQuestionnaireAge(age) {
    const trimmed = age.trim();
    if (!trimmed) {
        return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) ||
        parsed < QUESTIONNAIRE_AGE_MIN ||
        parsed > QUESTIONNAIRE_AGE_MAX) {
        return null;
    }
    return parsed;
}
let inflightProfileRequest = null;
export function getProfile() {
    if (!inflightProfileRequest) {
        inflightProfileRequest = apiRequest('/users/me', {
            skipLoading: true,
        }).finally(() => {
            inflightProfileRequest = null;
        });
    }
    return inflightProfileRequest;
}
export function updateProfile(payload) {
    inflightProfileRequest = null;
    return apiRequest('/users/me', {
        method: 'PATCH',
        body: payload,
    });
}
export async function uploadAvatar(localUri) {
    const preparedUri = await prepareImageForUpload(localUri, 'avatar');
    return apiUpload('/users/me/avatar', 'avatar', preparedUri, {
        fileName: 'avatar.jpg',
        mimeType: 'image/jpeg',
    });
}
export async function uploadProfileCard(localUri) {
    const preparedUri = await prepareImageForUpload(localUri, 'profileCard');
    return apiUpload('/users/me/profile-card', 'profileCard', preparedUri, {
        fileName: 'profile-card.jpg',
        mimeType: 'image/jpeg',
    });
}
function isPresignedObjectUrl(url) {
    return (url.includes('X-Amz-Signature=') ||
        url.includes('X-Amz-Algorithm=') ||
        url.includes('x-amz-signature='));
}
function withCacheBust(baseUrl, cacheKey) {
    if (!cacheKey || isPresignedObjectUrl(baseUrl)) {
        // Extra query params invalidate S3/Yandex SigV4 signatures.
        return baseUrl;
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}v=${encodeURIComponent(cacheKey)}`;
}
export function pickAvatarUrl(avatar, cacheKey) {
    if (!avatar) {
        return null;
    }
    const baseUrl = avatar.large ?? avatar.medium ?? avatar.small ?? avatar.thumb ?? null;
    if (!baseUrl) {
        return null;
    }
    return withCacheBust(baseUrl, cacheKey);
}
export function pickProfileCardUrl(profileCard, cacheKey) {
    if (!profileCard) {
        return null;
    }
    const baseUrl = profileCard.card ?? profileCard.cardThumb ?? profileCard.large ?? profileCard.original ?? null;
    if (!baseUrl) {
        return null;
    }
    return withCacheBust(baseUrl, cacheKey);
}
export function isLocalImageUri(uri) {
    return !uri.startsWith('http://') && !uri.startsWith('https://');
}
export function isRemoteImageUri(uri) {
    return Boolean(uri && !isLocalImageUri(uri));
}
export function deleteProfileCard() {
    inflightProfileRequest = null;
    return apiRequest('/users/me/profile-card', {
        method: 'DELETE',
    });
}
export async function uploadNotificationSound(localUri, options) {
    inflightProfileRequest = null;
    return apiUpload('/users/me/notification-sound', 'sound', localUri, {
        fileName: options?.fileName ?? 'notify.mp3',
        mimeType: options?.mimeType ?? 'audio/mpeg',
    });
}
export function deleteNotificationSound() {
    inflightProfileRequest = null;
    return apiRequest('/users/me/notification-sound', {
        method: 'DELETE',
    });
}
export function deleteQuestionnaire() {
    inflightProfileRequest = null;
    return apiRequest('/users/me/questionnaire', {
        method: 'DELETE',
    });
}
export async function saveQuestionnaireToServer(draft, stepIndex, options) {
    const skippedGifs = [];
    if (draft.profileCardUri && isLocalImageUri(draft.profileCardUri)) {
        if (isGifImage(draft.profileCardUri)) {
            skippedGifs.push('карточку профиля');
        }
        else {
            await uploadProfileCard(draft.profileCardUri);
        }
    }
    else if (!draft.profileCardUri &&
        isRemoteImageUri(options?.savedProfileCardUri)) {
        await deleteProfileCard();
    }
    const payload = {
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
    }
    else if (trimmedDescription) {
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
    }
    else {
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
    skipped;
    profile;
    constructor(skipped, profile) {
        super(`GIF не загружен: ${skipped.join(', ')}`);
        this.name = 'QuestionnaireGifUploadSkippedError';
        this.skipped = skipped;
        this.profile = profile;
    }
}
