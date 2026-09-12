import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { Button, toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { listMyClubs, type ClubListItem } from '@/services/clubs/clubsApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { useMainScreenStyles } from '@/screens/main/main-screen.styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    subtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      marginBottom: Spacing.sm,
    },
    list: { gap: Spacing.md, paddingBottom: Spacing.xl },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cover: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.surfaceMuted,
    },
    body: {
      padding: Spacing.md,
      gap: 6,
    },
    name: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    meta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    empty: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.md,
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}

export default function MyClubsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles(createStyles);
  const hideMobileChrome = useIsDesktopSidebarVisible();
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClubs(await listMyClubs());
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить клубы'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScreenTransition>
      <View style={mainStyles.container}>
        {hideMobileChrome ? (
          <View style={styles.headerRow}>
            <Text style={mainStyles.title}>Мои клубы</Text>
            <Button label="Добавить" onPress={() => router.push('/clubs-create')} />
          </View>
        ) : (
          <MobileScreenHeader title="Мои клубы" showBack />
        )}

        <Text style={styles.subtitle}>
          Площадки, которые вы ведёте. Они появятся на вкладке «Клубы».
        </Text>

        {!hideMobileChrome ? (
          <Button label="Добавить клуб" onPress={() => router.push('/clubs-create')} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {!clubs.length ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Пока нет клубов. Создайте первый.</Text>
                <Button label="Создать клуб" onPress={() => router.push('/clubs-create')} />
              </View>
            ) : (
              clubs.map((club) => (
                <Pressable
                  key={club.id}
                  onPress={() => router.push(`/clubs/${club.id}`)}
                  style={styles.card}>
                  {club.coverUrl ? (
                    <Image source={{ uri: club.coverUrl }} style={styles.cover} contentFit="cover" />
                  ) : (
                    <View style={styles.cover} />
                  )}
                  <View style={styles.body}>
                    <Text style={styles.name}>{club.name}</Text>
                    <Text style={styles.meta}>{club.address}</Text>
                    {club.city ? (
                      <Text style={styles.meta}>
                        {club.city.name}
                        {club.city.region ? `, ${club.city.region}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </ScreenTransition>
  );
}
