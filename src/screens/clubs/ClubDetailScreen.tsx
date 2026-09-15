import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  DAY_LABELS,
  getClub,
  type ClubListItem,
  type ClubScheduleDay,
} from '@/services/clubs/clubsApi';
import { localizeErrorMessage } from '@/utils/localizeError';

function getTodaySchedule(schedule: ClubScheduleDay[]) {
  const jsDay = new Date().getDay();
  const day = jsDay === 0 ? 7 : jsDay;
  return schedule.find((item) => item.day === day) ?? null;
}

function formatTodayHours(schedule: ClubScheduleDay[]) {
  const today = getTodaySchedule(schedule);
  if (!today || today.closed || !today.open || !today.close) {
    return { open: false, label: 'Сегодня выходной' };
  }
  return { open: true, label: `Сегодня ${today.open}–${today.close}` };
}

function formatScheduleDay(day: ClubScheduleDay) {
  if (day.closed || !day.open || !day.close) {
    return 'Выходной';
  }
  return `${day.open}–${day.close}`;
}

function createStyles(
  colors: ThemeColors,
  topPadding: number,
  bottomPadding: number,
  isDesktopWeb: boolean,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPadding,
    },
    inner: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: isDesktopWeb ? 760 : undefined,
      alignSelf: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      flexShrink: 0,
      paddingHorizontal: isDesktopWeb ? Spacing.xl : Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    headerSide: {
      width: 40,
      justifyContent: 'center',
    },
    headerAction: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    headerTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    scrollContent: {
      paddingHorizontal: isDesktopWeb ? Spacing.xl : Spacing.md,
      gap: Spacing.lg,
      paddingBottom: bottomPadding + Spacing.xl,
    },
    hero: {
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.1,
          shadowRadius: 24,
        },
        android: { elevation: 3 },
        default: {
          boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
        },
      }),
    },
    coverWrap: {
      width: '100%',
      aspectRatio: 16 / 10,
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    cover: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
    coverEmpty: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    coverGradient: {
      ...StyleSheet.absoluteFill,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0) 72%)',
        } as object,
        default: {},
      }),
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFill,
      top: '38%',
      height: '28%',
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFill,
      top: '58%',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    coverBottom: {
      position: 'absolute',
      left: Spacing.md,
      right: Spacing.md,
      bottom: Spacing.md,
      gap: Spacing.sm,
      zIndex: 2,
    },
    statusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.pill,
    },
    statusChipOpen: {
      backgroundColor: 'rgba(21, 122, 254, 0.92)',
    },
    statusChipClosed: {
      backgroundColor: 'rgba(28, 28, 30, 0.88)',
    },
    bodyStatusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.pill,
    },
    bodyStatusOpen: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
    },
    bodyStatusClosed: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
    },
    bodyStatusText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    bodyName: {
      fontSize: isDesktopWeb ? 28 : 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
    },
    statusChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    heroName: {
      fontSize: isDesktopWeb ? 30 : 26,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    bodyBlock: {
      gap: Spacing.md,
    },
    description: {
      fontSize: FontSize.input,
      color: colors.textSecondary,
      lineHeight: FontSize.input * 1.55,
    },
    metaLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    metaIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      marginTop: 1,
    },
    metaTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    metaPrimary: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      lineHeight: FontSize.label * 1.4,
    },
    metaSecondary: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      borderRadius: Radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    tagText: {
      color: colors.primary,
      fontSize: FontSize.caption,
      fontWeight: '600',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
    },
    linkText: {
      color: colors.primary,
      fontSize: FontSize.label,
      fontWeight: '600',
    },
    scheduleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    scheduleChip: {
      width: '31.5%',
      minWidth: 96,
      flexGrow: 1,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 4,
    },
    scheduleChipToday: {
      borderColor: 'rgba(21, 122, 254, 0.4)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    scheduleChipDay: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.textMuted,
    },
    scheduleChipDayToday: {
      color: colors.primary,
    },
    scheduleChipHours: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    scheduleChipHoursToday: {
      color: colors.primary,
    },
    galleryContent: {
      gap: Spacing.sm,
      paddingRight: Spacing.md,
    },
    galleryImage: {
      width: 220,
      height: 148,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    stateText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.5,
    },
    retryBtn: {
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

export default function ClubDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const clubId =
    typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hideMobileChrome = useIsDesktopSidebarVisible();
  const topPadding = hideMobileChrome ? Spacing.md : insets.top + Spacing.md;
  const bottomPadding = hideMobileChrome ? Spacing.md : Math.max(insets.bottom, Spacing.md);
  const styles = useThemedStyles((theme) =>
    createStyles(theme, topPadding, bottomPadding, isDesktopWeb),
  );

  const [club, setClub] = useState<ClubListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clubId) {
      setError('Клуб не найден');
      setClub(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setClub(await getClub(clubId));
    } catch (err) {
      const message = localizeErrorMessage(err, 'Не удалось загрузить клуб');
      setError(message);
      setClub(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const hours = formatTodayHours(club?.schedule ?? []);
  const jsDay = new Date().getDay();
  const todayDay = jsDay === 0 ? 7 : jsDay;
  const cityLine = club?.city
    ? `${club.city.name}${club.city.region ? `, ${club.city.region}` : ''}`
    : null;
  const schedule = [...(club?.schedule ?? [])].sort((a, b) => a.day - b.day);

  return (
    <ScreenTransition>
      <View style={styles.root}>
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide}>
              <MobileBackButton />
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {club?.name ?? 'Клуб'}
            </Text>
            <View style={styles.headerSide}>
              {club?.canManage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Настройки клуба"
                  onPress={() => router.push({ pathname: '/clubs-edit', params: { id: club.id } })}
                  style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="settings-outline" size={20} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error || !club ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>{error ?? 'Клуб не найден'}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.88 }]}>
                <Text style={styles.retryLabel}>Повторить</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.hero}>
                <View style={styles.coverWrap}>
                  {club.coverUrl ? (
                    <Image
                      source={{ uri: club.coverUrl }}
                      style={styles.cover}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.coverEmpty}>
                      <Ionicons name="storefront-outline" size={40} color={colors.primary} />
                    </View>
                  )}
                  {club.coverUrl ? (
                    <>
                      <View pointerEvents="none" style={styles.coverGradient}>
                        {Platform.OS !== 'web' ? (
                          <>
                            <View style={styles.coverGradientNativeMid} />
                            <View style={styles.coverGradientNativeBase} />
                          </>
                        ) : null}
                      </View>
                      <View style={styles.coverBottom} pointerEvents="none">
                        <View
                          style={[
                            styles.statusChip,
                            hours.open ? styles.statusChipOpen : styles.statusChipClosed,
                          ]}>
                          <Ionicons
                            name={hours.open ? 'time' : 'moon'}
                            size={13}
                            color="#FFFFFF"
                          />
                          <Text style={styles.statusChipText}>{hours.label}</Text>
                        </View>
                        <Text style={styles.heroName}>{club.name}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>

              <View style={styles.bodyBlock}>
                {!club.coverUrl ? (
                  <>
                    <View
                      style={[
                        styles.bodyStatusChip,
                        hours.open ? styles.bodyStatusOpen : styles.bodyStatusClosed,
                      ]}>
                      <Ionicons
                        name={hours.open ? 'time' : 'moon'}
                        size={13}
                        color={colors.primary}
                      />
                      <Text style={styles.bodyStatusText}>{hours.label}</Text>
                    </View>
                    <Text style={styles.bodyName}>{club.name}</Text>
                  </>
                ) : null}
                {club.description?.trim() ? (
                  <Text style={styles.description}>{club.description.trim()}</Text>
                ) : null}

                {club.tags.length > 0 ? (
                  <View style={styles.tagsRow}>
                    {club.tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.metaLine}>
                  <View style={styles.metaIcon}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.metaTextCol}>
                    <Text style={styles.metaPrimary}>{club.address}</Text>
                    {cityLine ? <Text style={styles.metaSecondary}>{cityLine}</Text> : null}
                  </View>
                </View>
              </View>

              {schedule.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Расписание</Text>
                  <View style={styles.scheduleGrid}>
                    {schedule.map((day) => {
                      const isToday = day.day === todayDay;
                      return (
                        <View
                          key={day.day}
                          style={[styles.scheduleChip, isToday && styles.scheduleChipToday]}>
                          <Text
                            style={[
                              styles.scheduleChipDay,
                              isToday && styles.scheduleChipDayToday,
                            ]}>
                            {DAY_LABELS[day.day] ?? `Д${day.day}`}
                          </Text>
                          <Text
                            style={[
                              styles.scheduleChipHours,
                              isToday && styles.scheduleChipHoursToday,
                            ]}>
                            {formatScheduleDay(day)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {club.links.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Контакты</Text>
                  {club.links.map((link) => (
                    <Pressable
                      key={`${link.label}:${link.url}`}
                      accessibilityRole="link"
                      onPress={() => void Linking.openURL(link.url)}
                      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.75 }]}>
                      <Ionicons name="link-outline" size={18} color={colors.primary} />
                      <Text style={styles.linkText}>{link.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {club.galleryUrls.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Фото</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.galleryContent}>
                    {club.galleryUrls.map((url) => (
                      <Image
                        key={url}
                        source={{ uri: url }}
                        style={styles.galleryImage}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </ScreenTransition>
  );
}
