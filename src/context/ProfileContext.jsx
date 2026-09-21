import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getProfile } from '@/services/profile/profileApi';
import { getProfileAvatarUrl } from '@/utils/profile-mapper';
const ProfileContext = createContext(null);
export function ProfileProvider({ children }) {
    const { user, isAuthenticated, isLoading: isAuthLoading, updateUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const userRef = useRef(user);
    userRef.current = user;
    const syncNickname = useCallback(async (nickname) => {
        if (userRef.current?.nickname === nickname) {
            return;
        }
        await updateUser({ nickname });
    }, [updateUser]);
    const applyProfile = useCallback(async (nextProfile) => {
        setProfile(nextProfile);
        await syncNickname(nextProfile.nickname);
    }, [syncNickname]);
    const refreshProfile = useCallback(async () => {
        if (!isAuthenticated) {
            setProfile(null);
            return null;
        }
        setIsLoading(true);
        try {
            const nextProfile = await getProfile();
            setProfile(nextProfile);
            await syncNickname(nextProfile.nickname);
            return nextProfile;
        }
        catch {
            return null;
        }
        finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, syncNickname]);
    const refreshProfileRef = useRef(refreshProfile);
    refreshProfileRef.current = refreshProfile;
    const loadedForUserIdRef = useRef(null);
    useEffect(() => {
        if (isAuthLoading) {
            return;
        }
        if (!isAuthenticated || !user?.id) {
            loadedForUserIdRef.current = null;
            setProfile(null);
            return;
        }
        if (loadedForUserIdRef.current === user.id) {
            return;
        }
        loadedForUserIdRef.current = user.id;
        void refreshProfileRef.current();
    }, [isAuthenticated, isAuthLoading, user?.id]);
    const avatarUrl = useMemo(() => getProfileAvatarUrl(profile), [profile]);
    const value = useMemo(() => ({
        profile,
        isLoading,
        avatarUrl,
        refreshProfile,
        applyProfile,
    }), [profile, isLoading, avatarUrl, refreshProfile, applyProfile]);
    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
export function useProfile() {
    const context = useContext(ProfileContext);
    if (!context) {
        throw new Error('useProfile must be used within ProfileProvider');
    }
    return context;
}
/** Аватар текущего пользователя — использовать в шапке, списках, чатах и профиле. */
export function useMyAvatarUrl() {
    return useProfile().avatarUrl;
}
