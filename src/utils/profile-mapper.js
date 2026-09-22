import { pickAvatarUrl, pickProfileCardUrl } from '@/services/profile/profileApi';
export function getProfileAvatarUrl(profile) {
    if (!profile) {
        return null;
    }
    return (pickAvatarUrl(profile.avatar, profile.updatedAt) ??
        pickProfileCardUrl(profile.profileCard, profile.updatedAt));
}
