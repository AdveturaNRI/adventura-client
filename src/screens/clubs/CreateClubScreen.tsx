import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressSuggestField } from '@/components/clubs/AddressSuggestField';
import { ClubScheduleEditor } from '@/components/clubs/ClubScheduleEditor';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { CitySearchField } from '@/components/questionnaire/CitySearchField';
import { PhotoCropEditor } from '@/components/questionnaire/PhotoCropEditor';
import { Button, Input, TextArea, toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  createClub,
  defaultClubSchedule,
  uploadClubCover,
  uploadClubGallery,
  type ClubScheduleDay,
} from '@/services/clubs/clubsApi';
import { isGifImage } from '@/utils/image-format';
import { getImageSize } from '@/utils/image-size';
import { localizeErrorMessage } from '@/utils/localizeError';

const DESKTOP_CONTENT_MAX = 960;

type PendingCrop = {
  uri: string;
  width: number;
  height: number;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, topPadding: number) {
  const gallerySize = isDesktopWeb ? 96 : 88;

  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      paddingHorizontal: isDesktopWeb ? Spacing.xl : Spacing.lg,
      paddingTop: topPadding,
      paddingBottom: Spacing.xl,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 40,
    },
    title: {
      flex: 1,
      fontSize: isDesktopWeb ? 28 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      textAlign: isDesktopWeb ? 'left' : 'left',
    },
    desktopGrid: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: 'stretch',
      gap: isDesktopWeb ? Spacing.xl : Spacing.md,
    },
    mediaColumn: {
      flex: isDesktopWeb ? 1.05 : undefined,
      minWidth: 0,
      gap: Spacing.md,
    },
    fieldsColumn: {
      flex: isDesktopWeb ? 1 : undefined,
      minWidth: 0,
      gap: Spacing.md,
      zIndex: 2,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    coverSectionHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      marginTop: -4,
    },
    coverFrame: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
    },
    coverFrameEmpty: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    coverFrameFilled: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
    },
    coverImage: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
    coverGradient: {
      ...StyleSheet.absoluteFill,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0) 68%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.28)',
        },
      }),
    },
    coverEmptyContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    coverIconBadge: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    coverEmptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    coverEmptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
      maxWidth: 300,
    },
    coverBottomBar: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      bottom: Spacing.sm,
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    coverMetaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    coverMetaChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    coverActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    coverActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    coverActionPillLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    coverActionGhost: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    galleryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    galleryItem: {
      width: gallerySize,
      height: gallerySize,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    galleryThumb: { width: '100%', height: '100%' },
    galleryAdd: {
      width: gallerySize,
      height: gallerySize,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    coords: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    scheduleBlock: {
      gap: Spacing.sm,
      zIndex: 1,
    },
    footer: {
      marginTop: Spacing.sm,
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      justifyContent: isDesktopWeb ? 'flex-end' : 'flex-start',
      gap: Spacing.md,
    },
    submitWrap: {
      width: isDesktopWeb ? 240 : '100%',
    },
  });
}

export default function CreateClubScreen() {
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hideBack = useIsDesktopSidebarVisible();
  const topPadding = hideBack ? Spacing.lg : insets.top + Spacing.md;
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb, topPadding));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);
  const [cityLabel, setCityLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<ClubScheduleDay[]>(defaultClubSchedule);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [saving, setSaving] = useState(false);

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Нужен доступ к фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (isGifImage(asset.uri)) {
      toast.error('GIF не подходит для обложки');
      return;
    }

    try {
      const size = await getImageSize(asset.uri);
      setPendingCrop({ uri: asset.uri, width: size.width, height: size.height });
    } catch {
      toast.error('Не удалось открыть фото');
    }
  };

  const pickGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Нужен доступ к фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const uris = result.assets.map((a) => a.uri).filter((uri) => !isGifImage(uri));
    if (!uris.length) {
      toast.error('GIF не подходит');
      return;
    }

    setGalleryUris((prev) => [...prev, ...uris].slice(0, 8));
  };

  const onSave = async () => {
    if (name.trim().length < 2) {
      toast.error('Укажите название');
      return;
    }
    if (address.trim().length < 5) {
      toast.error('Укажите адрес');
      return;
    }
    if (lat == null || lng == null) {
      toast.error('Выберите адрес из подсказок');
      return;
    }

    const working = schedule.filter((day) => !day.closed);
    if (!working.length) {
      toast.error('Выберите хотя бы один рабочий день');
      return;
    }

    for (const day of working) {
      if (!day.open || !day.close) {
        toast.error('Заполните часы для рабочих дней');
        return;
      }
    }

    setSaving(true);
    try {
      const club = await createClub({
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        lat,
        lng,
        cityId,
        schedule,
        isPublished: true,
      });

      if (coverUri) {
        await uploadClubCover(club.id, coverUri);
      }
      if (galleryUris.length) {
        await uploadClubGallery(club.id, galleryUris);
      }

      toast.success('Клуб создан');
      router.replace('/my-clubs');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось сохранить клуб'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenTransition>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {hideBack ? null : <MobileBackButton />}
          <Text style={styles.title}>Новый клуб</Text>
        </View>

        <View style={styles.desktopGrid}>
          <View style={styles.mediaColumn}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Обложка клуба</Text>
              <Text style={styles.coverSectionHint}>
                Формат 16:9 — как в ленте «Мои клубы». Лучше горизонтальное фото зала или фасада,
                без важных деталей по краям: при кадрировании края могут обрезаться.
              </Text>
            </View>

            <View
              style={[
                styles.coverFrame,
                coverUri ? styles.coverFrameFilled : styles.coverFrameEmpty,
              ]}>
              {coverUri ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Изменить обложку"
                    onPress={() => void pickCover()}
                    style={StyleSheet.absoluteFill}>
                    <Image
                      source={{ uri: coverUri }}
                      style={styles.coverImage}
                      contentFit="cover"
                      pointerEvents="none"
                    />
                    <View pointerEvents="none" style={styles.coverGradient} />
                  </Pressable>

                  <View style={styles.coverBottomBar} pointerEvents="box-none">
                    <View style={styles.coverMetaChip}>
                      <Ionicons name="crop-outline" size={13} color="#FFFFFF" />
                      <Text style={styles.coverMetaChipText}>16:9</Text>
                    </View>
                    <View style={styles.coverActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Изменить обложку"
                        onPress={() => void pickCover()}
                        style={({ pressed }) => [
                          styles.coverActionPill,
                          pressed && { opacity: 0.88 },
                        ]}>
                        <Ionicons name="image-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.coverActionPillLabel}>Изменить</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Удалить обложку"
                        onPress={() => setCoverUri(null)}
                        style={({ pressed }) => [
                          styles.coverActionGhost,
                          pressed && { opacity: 0.88 },
                        ]}>
                        <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Добавить обложку"
                  onPress={() => void pickCover()}
                  style={({ pressed }) => [StyleSheet.absoluteFill, pressed && { opacity: 0.92 }]}>
                  <View style={styles.coverEmptyContent}>
                    <View style={styles.coverIconBadge}>
                      <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                    </View>
                    <Text style={styles.coverEmptyTitle}>Обложка</Text>
                    <Text style={styles.coverEmptyHint}>
                      Выберите фото — откроется кадрирование 16:9 под карточку клуба
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Галерея</Text>
              <View style={styles.galleryRow}>
                {galleryUris.map((uri) => (
                  <Pressable
                    key={uri}
                    style={styles.galleryItem}
                    onLongPress={() =>
                      setGalleryUris((prev) => prev.filter((item) => item !== uri))
                    }>
                    <Image source={{ uri }} style={styles.galleryThumb} contentFit="cover" />
                  </Pressable>
                ))}
                {galleryUris.length < 8 ? (
                  <Pressable style={styles.galleryAdd} onPress={() => void pickGallery()}>
                    <Ionicons name="add" size={28} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.hint}>Долгое нажатие — убрать фото из галереи</Text>
            </View>
          </View>

          <View style={styles.fieldsColumn}>
            <Input
              label="Название"
              value={name}
              onChangeText={setName}
              placeholder="Название клуба"
            />
            <TextArea
              label="Описание"
              value={description}
              onChangeText={setDescription}
              placeholder="Расскажите о вашем клубе"
            />

            <CitySearchField
              label="Город"
              placeholder="Начните вводить город"
              value={cityId}
              selectedLabel={cityLabel}
              onChange={(id, label) => {
                setCityId(id);
                setCityLabel(label);
              }}
            />

            <AddressSuggestField
              label="Адрес"
              placeholder="Улица, дом"
              value={address}
              cityLabel={cityLabel}
              onChangeText={(text) => {
                setAddress(text);
                setLat(null);
                setLng(null);
              }}
              onSelect={(hit) => {
                setAddress(hit.shortName || hit.displayName);
                setLat(hit.lat);
                setLng(hit.lng);
              }}
            />
            {lat != null && lng != null ? (
              <Text style={styles.coords}>
                Координаты: {lat.toFixed(5)}, {lng.toFixed(5)}
              </Text>
            ) : (
              <Text style={styles.hint}>Начните вводить адрес — выберите вариант из списка</Text>
            )}
          </View>
        </View>

        <View style={styles.scheduleBlock}>
          <Text style={styles.sectionLabel}>Расписание</Text>
          <ClubScheduleEditor value={schedule} onChange={setSchedule} />
        </View>

        <View style={styles.footer}>
          {saving ? <ActivityIndicator color={colors.primary} /> : null}
          <View style={styles.submitWrap}>
            <Button
              label={saving ? 'Сохраняем…' : 'Создать клуб'}
              onPress={() => void onSave()}
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>

      {pendingCrop ? (
        <PhotoCropEditor
          visible
          variant="clubCover"
          imageUri={pendingCrop.uri}
          imageWidth={pendingCrop.width}
          imageHeight={pendingCrop.height}
          onCancel={() => setPendingCrop(null)}
          onSave={(uri) => {
            setCoverUri(uri);
            setPendingCrop(null);
          }}
        />
      ) : null}
    </ScreenTransition>
  );
}
