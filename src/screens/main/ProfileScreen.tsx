import { useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ProfileCompletionBanner } from '@/components/profile/ProfileCompletionBanner';
import { ProfileHeaderCard } from '@/components/profile/ProfileHeaderCard';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { Menu, MenuItem, PROFILE_MENU_SECTIONS, toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfile, useMyAvatarUrl } from '@/context/ProfileContext';
import { getQuestionnaireCompletion } from '@/utils/questionnaire-completion';

import { useProfileScreenStyles } from './profile-screen.styles';

function getProfileTagline(isGuest: boolean, email: string) {
  if (isGuest) {
    return 'Гостевой аккаунт';
  }

  return email;
}

function handleMenuPress(key: string, router: ReturnType<typeof useRouter>) {
  switch (key) {
    case 'notifications':
      router.push('/notifications');
      return;
    case 'games':
      router.push('/my-games');
      return;
    case 'master-room':
      router.push('/master-room');
      return;
    case 'my-clubs':
      router.push('/my-clubs');
      return;
    case 'profile':
      router.push('/questionnaire');
      return;
    case 'settings':
      router.push('/settings');
      return;
    default:
      toast.info('Скоро будет доступно');
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const avatarUrl = useMyAvatarUrl();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useProfileScreenStyles();
  const completion = useMemo(() => getQuestionnaireCompletion(profile), [profile]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  if (!user) {
    return null;
  }

  const logoutButton = (
    <Pressable
      accessibilityRole="button"
      onPress={handleSignOut}
      style={({ pressed }) => [
        styles.logoutButton,
        !isDesktopWeb && styles.logoutButtonMobile,
        pressed && styles.logoutButtonPressed,
      ]}>
      <Text style={styles.logoutLabel}>Выход</Text>
    </Pressable>
  );

  return (
    <ScreenTransition animateOnFocus>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {showCompactNav ? (
          <MobileScreenHeader title="Профиль" />
        ) : (
          <Text style={styles.title}>Профиль</Text>
        )}

        <ProfileHeaderCard
          nickname={user.nickname}
          avatarUrl={avatarUrl}
          accountLabel={getProfileTagline(user.isGuest, user.email)}
          isDesktopWeb={isDesktopWeb}
          logoutButton={isDesktopWeb ? logoutButton : undefined}
        />

        <ProfileCompletionBanner completion={completion} />

        {PROFILE_MENU_SECTIONS.map((section) => (
          <View key={section.key} style={styles.sectionCard}>
            <Menu title={section.title}>
              {section.items.map((item) => (
                <MenuItem
                  key={item.key}
                  label={item.label}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  badge={item.badge}
                  variant={item.variant}
                  onPress={() => handleMenuPress(item.key, router)}
                />
              ))}
            </Menu>
          </View>
        ))}

        {!isDesktopWeb ? logoutButton : null}
      </ScrollView>
    </ScreenTransition>
  );
}
