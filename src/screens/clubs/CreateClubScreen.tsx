import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ClubGalleryGrid, type FileDropTarget } from '@/components/clubs/ClubGalleryGrid';
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
  deleteClub,
  deleteClubCover,
  defaultClubSchedule,
  getClub,
  normalizeClubSchedule,
  saveClubGallery,
  updateClub,
  uploadClubCover,
  type ClubScheduleDay,
  type ClubLink,
} from '@/services/clubs/clubsApi';
import { isGifImage } from '@/utils/image-format';
import { getImageSize } from '@/utils/image-size';
import { localizeErrorMessage } from '@/utils/localizeError';
import { filesFromDataTransfer, isFileDragEvent, isInsideWebNode } from '@/utils/web-file-drop';

const DESKTOP_CONTENT_MAX = 960;
const MAX_GALLERY = 8;

type PendingCrop = {
  uri: string;
  width: number;
  height: number;
};

function isGifFile(file: File) {
  return file.type === 'image/gif' || isGifImage(file.name, file.type);
}

function isSupportedImageFile(file: File) {
  if (isGifFile(file)) {
    return false;
  }
  if (file.type.startsWith('image/')) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, topPadding: number) {
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
    coverFrameDragging: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
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
    coverDropOverlay: {
      ...StyleSheet.absoluteFill,
      zIndex: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.72)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(2px)',
        } as object,
        default: {},
      }),
    },
    coverDropOverlayLabel: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    galleryDropWrap: {
      position: 'relative',
      borderRadius: 16,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
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
    dangerZone: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.42)',
      borderRadius: 16,
      backgroundColor: 'rgba(220, 38, 38, 0.06)',
    },
    dangerTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: '#DC2626',
    },
    dangerText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    dangerButton: {
      borderColor: 'rgba(220, 38, 38, 0.55)',
    },
    dangerButtonLabel: {
      color: '#DC2626',
    },
  });
}

export default function CreateClubScreen() {
  const router = useRouter();
  const { id: rawClubId } = useLocalSearchParams<{ id?: string }>();
  const clubId = typeof rawClubId === 'string' ? rawClubId : null;
  const isEditing = Boolean(clubId);
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
  const [originalGalleryUrls, setOriginalGalleryUrls] = useState<string[]>([]);
  const [coverChanged, setCoverChanged] = useState(false);
  const [galleryChanged, setGalleryChanged] = useState(false);
  const [galleryDragging, setGalleryDragging] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [linksInput, setLinksInput] = useState('');
  const [confirmationName, setConfirmationName] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [saving, setSaving] = useState(false);
  const coverDropRef = useRef<View>(null);
  const galleryDropRef = useRef<View>(null);
  const galleryUrisRef = useRef(galleryUris);

  useEffect(() => {
    galleryUrisRef.current = galleryUris;
  }, [galleryUris]);

  useEffect(() => {
    if (!clubId) {
      return;
    }
    let active = true;
    void getClub(clubId)
      .then((club) => {
        if (!active) return;
        if (!club.canManage) {
          toast.error('У вас нет прав на редактирование клуба');
          router.replace(`/clubs/${clubId}`);
          return;
        }
        setName(club.name);
        setDescription(club.description ?? '');
        setAddress(club.address);
        setCityId(club.city?.id ?? null);
        setCityLabel([club.city?.name, club.city?.region].filter(Boolean).join(', '));
        setLat(club.lat);
        setLng(club.lng);
        setSchedule(normalizeClubSchedule(club.schedule));
        setCoverUri(club.coverUrl);
        setGalleryUris(club.galleryUrls);
        setOriginalGalleryUrls(club.galleryUrls);
        setGalleryChanged(false);
        setTagsInput(club.tags.join(', '));
        setLinksInput(club.links.map((link) => `${link.label} | ${link.url}`).join('\n'));
      })
      .catch((error) => {
        toast.error(localizeErrorMessage(error, 'Не удалось загрузить клуб'));
        router.back();
      })
      .finally(() => {
        if (active) setLoadingInitial(false);
      });
    return () => { active = false; };
  }, [clubId, router]);

  const openCoverFromUri = useCallback(async (uri: string, mimeType?: string | null) => {
    if (isGifImage(uri, mimeType)) {
      toast.warning('GIF не подходит для обложки — выберите JPEG или PNG');
      return;
    }

    try {
      const size = await getImageSize(uri);
      setPendingCrop({ uri, width: size.width, height: size.height });
    } catch {
      toast.error('Не удалось открыть фото');
    }
  }, []);

  const appendGalleryUris = useCallback((uris: string[]) => {
    if (!uris.length) return;
    const base = galleryUrisRef.current;
    const remaining = MAX_GALLERY - base.length;
    if (remaining <= 0) {
      toast.error('В галерее уже 8 фото');
      return;
    }
    const next = [...base, ...uris].slice(0, MAX_GALLERY);
    setGalleryChanged(true);
    setGalleryUris(next);
  }, []);

  const acceptDroppedCover = useCallback(
    (file: File) => {
      if (isGifFile(file)) {
        toast.warning('GIF не подходит для обложки — выберите JPEG или PNG');
        return;
      }
      if (!isSupportedImageFile(file)) {
        toast.error('Нужно изображение JPEG или PNG');
        return;
      }
      void openCoverFromUri(URL.createObjectURL(file), file.type);
    },
    [openCoverFromUri],
  );

  const acceptDroppedGallery = useCallback(
    (target: FileDropTarget, files: File[]) => {
      const images = files.filter(isSupportedImageFile);
      if (!images.length) {
        if (files.some(isGifFile)) {
          toast.warning('GIF не подходит — выберите JPEG или PNG');
          return;
        }
        toast.error('Нужны изображения JPEG или PNG');
        return;
      }

      const base = galleryUrisRef.current;

      if (target.mode === 'replace' && target.index >= 0 && target.index < base.length) {
        const [first, ...rest] = images;
        const next = [...base];
        next[target.index] = URL.createObjectURL(first);
        const remaining = Math.max(0, MAX_GALLERY - next.length);
        next.splice(
          target.index + 1,
          0,
          ...rest.slice(0, remaining).map((file) => URL.createObjectURL(file)),
        );
        setGalleryChanged(true);
        setGalleryUris(next.slice(0, MAX_GALLERY));
        return;
      }

      const remaining = MAX_GALLERY - base.length;
      if (remaining <= 0) {
        toast.error('В галерее уже 8 фото');
        return;
      }

      const uris = images.slice(0, remaining).map((file) => URL.createObjectURL(file));
      const index = Math.max(0, Math.min(target.index, base.length));
      const next = [...base];
      next.splice(index, 0, ...uris);
      setGalleryChanged(true);
      setGalleryUris(next.slice(0, MAX_GALLERY));
    },
    [],
  );

  const pickCover = useCallback(async () => {
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
    if (asset.width && asset.height && !isGifImage(asset.uri, asset.mimeType)) {
      setPendingCrop({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      return;
    }

    await openCoverFromUri(asset.uri, asset.mimeType);
  }, [openCoverFromUri]);

  const pickGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Нужен доступ к фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: MAX_GALLERY,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const uris = result.assets
      .filter((asset) => !isGifImage(asset.uri, asset.mimeType))
      .map((asset) => asset.uri);
    if (!uris.length) {
      toast.warning('GIF не подходит — выберите JPEG или PNG');
      return;
    }

    appendGalleryUris(uris);
  }, [appendGalleryUris]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const onDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }
      event.preventDefault();
      const overCover = isInsideWebNode(coverDropRef.current, event.target);
      if (event.dataTransfer && overCover) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setIsDraggingCover(overCover);
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget == null) {
        setIsDraggingCover(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }
      event.preventDefault();
      setIsDraggingCover(false);

      if (!isInsideWebNode(coverDropRef.current, event.target)) {
        return;
      }

      const files = filesFromDataTransfer(event.dataTransfer);
      if (files[0]) {
        acceptDroppedCover(files[0]);
      }
    };

    document.addEventListener('dragenter', onDragOver);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);

    return () => {
      document.removeEventListener('dragenter', onDragOver);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [acceptDroppedCover]);

  const parseTags = () =>
    [...new Set(tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);

  const parseLinks = (): ClubLink[] =>
    linksInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('|');
        if (separator < 1) {
          throw new Error('Ссылки указываются в формате «Название | https://…»');
        }
        const label = line.slice(0, separator).trim();
        const rawUrl = line.slice(separator + 1).trim();
        const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        if (!label || !rawUrl || !/^[^\s]+\.[^\s]+/.test(rawUrl.replace(/^https?:\/\//i, ''))) {
          throw new Error('Проверьте название и адрес ссылки');
        }
        return { label, url };
      })
      .slice(0, 8);

  const reorderGalleryItems = (nextUris: string[]) => {
    setGalleryUris(nextUris);
    setGalleryChanged(true);
  };

  const removeGalleryItem = (index: number) => {
    setGalleryUris((current) => current.filter((_, item) => item !== index));
    setGalleryChanged(true);
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
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        lat,
        lng,
        cityId,
        schedule,
        tags: parseTags(),
        links: parseLinks(),
        isPublished: true,
      };
      const club = isEditing && clubId
        ? await updateClub(clubId, payload)
        : await createClub(payload);

      if (coverChanged && coverUri && !/^https?:\/\//i.test(coverUri)) {
        await uploadClubCover(club.id, coverUri);
      }
      if (coverChanged && !coverUri && isEditing) {
        await deleteClubCover(club.id);
      }
      if (galleryChanged) {
        await saveClubGallery(club.id, galleryUris, originalGalleryUrls);
      }

      toast.success(isEditing ? 'Изменения сохранены' : 'Клуб создан');
      router.replace(isEditing ? `/clubs/${club.id}` : '/my-clubs');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось сохранить клуб'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!clubId) {
      return;
    }
    if (confirmationName.trim() !== name.trim()) {
      toast.error('Введите точное название клуба');
      return;
    }

    const runDelete = () => {
      setSaving(true);
      void deleteClub(clubId, confirmationName.trim())
        .then(() => {
          toast.success('Клуб удалён');
          router.replace('/my-clubs');
        })
        .catch((error) => toast.error(localizeErrorMessage(error, 'Не удалось удалить клуб')))
        .finally(() => setSaving(false));
    };

    // Alert.alert on web is a no-op in Expo — confirm explicitly.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (
        window.confirm(
          'Удалить клуб? Он исчезнет из каталога. Данные останутся в архиве, участники получат уведомление.',
        )
      ) {
        runDelete();
      }
      return;
    }

    Alert.alert(
      'Удалить клуб?',
      'Клуб исчезнет из каталога. Данные останутся в архиве, а участники получат уведомление.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: runDelete,
        },
      ],
    );
  };

  const visibleGalleryUris = galleryUris;

  if (loadingInitial) {
    return (
      <View style={[styles.scroll, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenTransition>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!galleryDragging}>
        <View style={styles.header}>
          {hideBack ? null : <MobileBackButton />}
          <Text style={styles.title}>{isEditing ? 'Настройки клуба' : 'Новый клуб'}</Text>
        </View>

        <View style={styles.desktopGrid}>
          <View style={styles.mediaColumn}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Обложка клуба</Text>
              <Text style={styles.coverSectionHint}>
                Формат 16:9 — как в ленте «Мои клубы». Можно выбрать файл или перетащить
                изображение на обложку.
              </Text>
            </View>

            <View
              ref={coverDropRef}
              collapsable={false}
              style={[
                styles.coverFrame,
                coverUri ? styles.coverFrameFilled : styles.coverFrameEmpty,
                isDraggingCover && styles.coverFrameDragging,
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
                        onPress={() => {
                          setCoverUri(null);
                          setCoverChanged(true);
                        }}
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
                      {isDesktopWeb
                        ? 'Перетащите изображение или выберите файл — откроется кадрирование 16:9'
                        : 'Выберите фото — откроется кадрирование 16:9 под карточку клуба'}
                    </Text>
                  </View>
                </Pressable>
              )}

              {isDraggingCover ? (
                <View style={styles.coverDropOverlay} pointerEvents="none">
                  <Text style={styles.coverDropOverlayLabel}>Отпустите файл</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Галерея</Text>
              <View ref={galleryDropRef} collapsable={false} style={styles.galleryDropWrap}>
                <ClubGalleryGrid
                  uris={visibleGalleryUris}
                  disabled={saving}
                  canAdd={isEditing || visibleGalleryUris.length < MAX_GALLERY}
                  onReorder={reorderGalleryItems}
                  onRemove={removeGalleryItem}
                  onAdd={() => void pickGallery()}
                  onDraggingChange={setGalleryDragging}
                  onDropFiles={acceptDroppedGallery}
                />
              </View>
              <Text style={styles.hint}>
                Перетащите файл на обложку, на конкретное фото или между снимками. Порядок и
                удаление сохраняются только по кнопке «Сохранить изменения».
              </Text>
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
            <Input
              label="Теги и жанры"
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="НРИ, ваншоты, фэнтези"
            />
            <TextArea
              label="Контакты и ссылки"
              value={linksInput}
              onChangeText={setLinksInput}
              placeholder={'Telegram | https://t.me/club\nСайт | https://example.ru'}
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
              label={saving ? 'Сохраняем…' : isEditing ? 'Сохранить изменения' : 'Создать клуб'}
              onPress={() => void onSave()}
              disabled={saving}
            />
          </View>
        </View>

        {isEditing ? (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Опасная зона</Text>
            <Text style={styles.dangerText}>
              Удалённый клуб исчезнет из каталога. Участники получат уведомление, а данные
              останутся в архиве. Для подтверждения введите точное название: «{name}».
            </Text>
            <Input
              label="Название клуба для удаления"
              value={confirmationName}
              onChangeText={setConfirmationName}
              placeholder={name}
            />
            <Button
              label="Удалить клуб"
              variant="outline"
              onPress={onDelete}
              disabled={saving}
              style={styles.dangerButton}
            />
          </View>
        ) : null}
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
            setCoverChanged(true);
            setPendingCrop(null);
          }}
        />
      ) : null}
    </ScreenTransition>
  );
}
