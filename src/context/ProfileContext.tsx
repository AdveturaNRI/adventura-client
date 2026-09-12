import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import type { UserProfile } from '@/services/api/types';
import { getProfile } from '@/services/profile/profileApi';
import { getProfileAvatarUrl } from '@/utils/profile-mapper';

type ProfileContextValue = {
  profile: UserProfile | null;
  isLoading: boolean;
  /** URL аватара текущего пользователя — единый источник для всего приложения. */
  avatarUrl: string | null;
  refreshProfile: () => Promise<UserProfile | null>;
  applyProfile: (profile: UserProfile) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: isAuthLoading, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const userRef = useRef(user);

  userRef.current = user;

  const syncNickname = useCallback(
    async (nickname: string) => {
      if (userRef.current?.nickname === nickname) {
        return;
      }

      await updateUser({ nickname });
    },
    [updateUser],
  );

  const applyProfile = useCallback(
    async (nextProfile: UserProfile) => {
      setProfile(nextProfile);
      await syncNickname(nextProfile.nickname);
    },
    [syncNickname],
  );

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
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, syncNickname]);

  const refreshProfileRef = useRef(refreshProfile);
  refreshProfileRef.current = refreshProfile;

  const loadedForUserIdRef = useRef<string | null>(null);

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

  const value = useMemo(
    () => ({
      profile,
      isLoading,
      avatarUrl,
      refreshProfile,
      applyProfile,
    }),
    [profile, isLoading, avatarUrl, refreshProfile, applyProfile],
  );

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
export function useMyAvatarUrl(): string | null {
  return useProfile().avatarUrl;
}
