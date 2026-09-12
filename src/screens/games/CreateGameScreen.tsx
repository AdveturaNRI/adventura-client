import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { CitySearchField } from '@/components/questionnaire/CitySearchField';
import { TimezoneField } from '@/components/questionnaire/TimezoneField';
import {
  GameSystemsPicker,
  type GameSystemOption,
} from '@/components/questionnaire/GameSystemsPicker';
import { PhotoCropEditor } from '@/components/questionnaire/PhotoCropEditor';
import { SystemAuthorBadge } from '@/components/questionnaire/SystemAuthorBadge';
import { Button, DateField, Input, SelectField, Switcher, TextArea, TimeField, toast } from '@/components/ui';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { UserGameSystemItem } from '@/services/api/types';
import {
  createGame,
  deleteGameCover,
  getGame,
  updateGame,
  uploadGameCover,
  type GameKind,
  type GameListItem,
} from '@/services/games/gamesApi';
import {
  isLocalImageUri,
  isRemoteImageUri,
  pickProfileCardUrl,
} from '@/services/profile/profileApi';
import {
  createUserGameSystem,
  deleteUserGameSystem,
  fetchUserGameSystems,
  updateUserGameSystem,
} from '@/services/profile/userGameSystemsApi';
import { fetchExperienceTypes, fetchGameSystems } from '@/services/reference/referenceApi';
import { formatCityLabel } from '@/utils/city-label';
import { formatDateRu, pad2, parseDateRu } from '@/utils/date-format';
import { isGifImage } from '@/utils/image-format';
import { getImageSize } from '@/utils/image-size';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  DEFAULT_TIMEZONE,
  formatTimezoneLabel,
  getZonedDateTimeParts,
  wallTimeToUtcIso,
} from '@/utils/timezones';
import { normalizeUserGameSystemItem, normalizeUserGameSystemItems } from '@/utils/user-game-system';

type PendingCrop = {
  uri: string;
  width: number;
  height: number;
};

type Draft = {
  coverUri: string | null;
  title: string;
  maxPlayers: string;
  systemName: string;
  cityId: string | null;
  cityLabel: string;
  isOnline: boolean;
  kind: GameKind;
  date: string;
  time: string;
  noSpecificDate: boolean;
  timezone: string;
  durationHours: string;
  price: string;
  isFree: boolean;
  experienceTypeId: string | null;
  beginnersWelcome: boolean;
  minAge: string;
  anyAge: boolean;
  description: string;
};

const INITIAL_DRAFT: Draft = {
  coverUri: null,
  title: '',
  maxPlayers: '5',
  systemName: '',
  cityId: null,
  cityLabel: '',
  isOnline: false,
  kind: 'ONESHOT',
  date: '',
  time: '19:00',
  noSpecificDate: false,
  timezone: DEFAULT_TIMEZONE,
  durationHours: '',
  price: '',
  isFree: false,
  experienceTypeId: null,
  beginnersWelcome: false,
  minAge: '18',
  anyAge: false,
  description: '',
};

function draftFromGame(game: GameListItem): Draft {
  const timezone = game.timezone?.trim() || DEFAULT_TIMEZONE;
  const zoned = game.scheduledAt ? getZonedDateTimeParts(game.scheduledAt, timezone) : null;
  const hasSchedule = zoned != null;

  return {
    coverUri: pickProfileCardUrl(game.cover, game.updatedAt),
    title: game.title,
    maxPlayers: String(game.maxPlayers),
    systemName: game.systemName,
    cityId: game.city?.id ?? null,
    cityLabel: game.city
      ? formatCityLabel({
          name: game.city.name,
          region: game.city.region,
          countryCode: 'RU',
        })
      : '',
    isOnline: game.isOnline,
    kind: game.kind,
    date:
      hasSchedule && zoned
        ? formatDateRu(new Date(zoned.year, zoned.month - 1, zoned.day))
        : '',
    time: hasSchedule && zoned ? `${pad2(zoned.hour)}:${pad2(zoned.minute)}` : '19:00',
    noSpecificDate: !hasSchedule,
    timezone,
    durationHours:
      game.durationHours != null && game.durationHours >= 1 && game.durationHours <= 24
        ? String(game.durationHours)
        : '',
    price: game.isFree || game.priceRub == null ? '' : String(game.priceRub),
    isFree: game.isFree,
    experienceTypeId: game.experienceTypeId,
    beginnersWelcome: game.beginnersWelcome,
    minAge: game.minAge != null ? String(game.minAge) : '18',
    anyAge: game.anyAge,
    description: game.description ?? '',
  };
}

function isFileDragEvent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes('Files') || (event.dataTransfer?.files?.length ?? 0) > 0;
}

function getWebHostNode(ref: View | null): HTMLElement | null {
  if (!ref || typeof document === 'undefined') {
    return null;
  }

  const host = ref as unknown as HTMLElement & {
    _nativeNode?: HTMLElement;
    getNode?: () => unknown;
  };

  if (host instanceof HTMLElement) {
    return host;
  }

  if (host._nativeNode instanceof HTMLElement) {
    return host._nativeNode;
  }

  const node = host.getNode?.();
  return node instanceof HTMLElement ? node : null;
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, topPadding: number) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      width: '100%',
      maxWidth: isDesktopWeb ? 720 : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      paddingHorizontal: Spacing.lg,
      paddingTop: topPadding,
      paddingBottom: Spacing.xl,
      gap: Spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      gap: Spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: isDesktopWeb ? 28 : 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      textAlign: isDesktopWeb ? 'left' : 'center',
    },
    section: {
      gap: Spacing.sm,
    },
    sectionLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    fieldHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      marginTop: -4,
    },
    coverSectionHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
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
      borderColor: colors.textSecondary,
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
      maxWidth: 280,
    },
    coverEmptyCta: {
      marginTop: Spacing.xs,
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
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
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    flexGrow: {
      flex: 1,
      minWidth: 0,
    },
    playersField: {
      width: 128,
      gap: Spacing.sm,
    },
    timeField: {
      width: 120,
    },
    playersLabel: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
      lineHeight: FontSize.label * 1.2,
    },
    playersStepper: {
      height: Sizes.controlHeight,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    playersStepBtn: {
      width: 40,
      height: Sizes.controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    playersStepBtnDisabled: {
      opacity: 0.35,
    },
    playersValue: {
      flex: 1,
      textAlign: 'center',
      fontSize: FontSize.input,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    systemPanel: {
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    systemPanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    systemPanelIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    systemPanelHeaderText: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    systemPanelTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    systemPanelSubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.35,
    },
    systemSelectedWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      alignItems: 'center',
    },
    systemChip: {
      maxWidth: '100%',
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    systemChipUser: {
      borderColor: colors.primaryLight,
    },
    systemChipContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    systemChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    systemAction: {
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    systemActionText: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.primary,
    },
    toggleChip: {
      minHeight: Sizes.controlHeight,
      marginTop: FontSize.label + Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    toggleChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    toggleChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    toggleChipLabelActive: {
      color: colors.primary,
    },
    fieldWithToggle: {
      gap: Spacing.sm,
    },
    fieldToggleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    priceField: {
      width: 140,
      flexGrow: 0,
      flexShrink: 0,
      gap: Spacing.sm,
    },
    priceLabel: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
    },
    priceInputWrap: {
      position: 'relative',
      justifyContent: 'center',
    },
    priceInput: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingLeft: Spacing.md,
      paddingRight: 36,
      fontSize: FontSize.input,
      fontWeight: '600',
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      textAlign: 'center',
    },
    priceSuffix: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    priceSuffixText: {
      fontSize: FontSize.input,
      fontWeight: '600',
      color: colors.textMuted,
    },
    toggleChipGrow: {
      flex: 1,
      minWidth: 0,
    },
  });
}

function ToggleChip({
  label,
  icon,
  active,
  onPress,
  style,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  style?: object;
}) {
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, false, 0));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleChip,
        active && styles.toggleChipActive,
        style,
        pressed && { opacity: 0.88 },
      ]}>
      <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.toggleChipLabel, active && styles.toggleChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function CreateGameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const gameIdParam = params.id;
  const gameId =
    typeof gameIdParam === 'string'
      ? gameIdParam
      : Array.isArray(gameIdParam)
        ? gameIdParam[0]
        : undefined;
  const isEdit = Boolean(gameId);

  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const colors = useTheme();
  const { profile, avatarUrl } = useProfile();
  const topPadding = isDesktopWeb ? Spacing.lg : insets.top + Spacing.md;
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb, topPadding));

  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [savedCoverUri, setSavedCoverUri] = useState<string | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isSystemsPickerOpen, setIsSystemsPickerOpen] = useState(false);
  const [systemOptions, setSystemOptions] = useState<GameSystemOption[]>([]);
  const [userSystems, setUserSystems] = useState<UserGameSystemItem[]>([]);
  const [isUserSystemsLoading, setIsUserSystemsLoading] = useState(false);
  const [experienceOptions, setExperienceOptions] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const coverDropRef = useRef<View>(null);

  const currentUserAuthor = useMemo(
    () =>
      profile
        ? {
            id: profile.id,
            nickname: profile.nickname,
            avatarUrl,
          }
        : undefined,
    [avatarUrl, profile],
  );

  const officialNameSet = useMemo(
    () => new Set(systemOptions.filter((item) => item.isOfficial).map((item) => item.name)),
    [systemOptions],
  );
  const userSystemByName = useMemo(
    () => new Map(userSystems.map((system) => [system.name, system])),
    [userSystems],
  );
  const selectedUserSystem = draft.systemName
    ? userSystemByName.get(draft.systemName)
    : undefined;
  const isOfficialSystem = draft.systemName ? officialNameSet.has(draft.systemName) : false;

  const loadUserSystems = useCallback(async () => {
    setIsUserSystemsLoading(true);

    try {
      const items = await fetchUserGameSystems();
      setUserSystems(normalizeUserGameSystemItems(items, currentUserAuthor));
    } catch {
      setUserSystems([]);
    } finally {
      setIsUserSystemsLoading(false);
    }
  }, [currentUserAuthor]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [systems, experiences] = await Promise.all([
        fetchGameSystems().catch(() => []),
        fetchExperienceTypes().catch(() => []),
      ]);

      if (cancelled) {
        return;
      }

      setSystemOptions(
        systems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          isOfficial: item.isOfficial,
        })),
      );
      setExperienceOptions(experiences.map((item) => ({ id: item.id, label: item.name })));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadUserSystems();
  }, [loadUserSystems]);

  useEffect(() => {
    if (gameId || !profile?.timezone?.trim()) {
      return;
    }

    setDraft((current) =>
      current.timezone === DEFAULT_TIMEZONE
        ? { ...current, timezone: profile.timezone!.trim() }
        : current,
    );
  }, [gameId, profile?.timezone]);

  useEffect(() => {
    if (!gameId) {
      setIsLoadingGame(false);
      return;
    }

    let cancelled = false;
    setIsLoadingGame(true);

    void (async () => {
      try {
        const game = await getGame(gameId);
        if (cancelled) {
          return;
        }

        const next = draftFromGame(game);
        setDraft(next);
        setSavedCoverUri(isRemoteImageUri(next.coverUri) ? next.coverUri : null);
      } catch (error) {
        if (!cancelled) {
          toast.error(localizeErrorMessage(error, 'Не удалось загрузить игру'));
          router.replace('/master-room');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGame(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, router]);

  const patch = useCallback((next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
  }, []);

  const handleCreateUserSystem = useCallback(
    async (name: string) => {
      try {
        const created = normalizeUserGameSystemItem(
          await createUserGameSystem(name),
          currentUserAuthor,
        );
        setUserSystems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        return created;
      } catch (error) {
        throw new Error(localizeErrorMessage(error, 'Не удалось добавить систему'));
      }
    },
    [currentUserAuthor],
  );

  const handleUpdateUserSystem = useCallback(
    async (id: string, name: string) => {
      try {
        const updated = normalizeUserGameSystemItem(
          await updateUserGameSystem(id, name),
          currentUserAuthor,
        );
        setUserSystems((current) =>
          current.map((item) => (item.id === id ? updated : item)),
        );
        setDraft((current) => {
          const previous = current.systemName;
          const previousItem = userSystems.find((item) => item.id === id);
          if (previousItem && previous === previousItem.name) {
            return { ...current, systemName: updated.name };
          }
          return current;
        });
        return updated;
      } catch (error) {
        throw new Error(localizeErrorMessage(error, 'Не удалось сохранить систему'));
      }
    },
    [currentUserAuthor, userSystems],
  );

  const handleDeleteUserSystem = useCallback(async (id: string) => {
    try {
      await deleteUserGameSystem(id);
      setUserSystems((current) => {
        const removed = current.find((item) => item.id === id);
        setDraft((draftCurrent) => {
          if (removed && draftCurrent.systemName === removed.name) {
            return { ...draftCurrent, systemName: '' };
          }
          return draftCurrent;
        });
        return current.filter((item) => item.id !== id);
      });
    } catch (error) {
      throw new Error(localizeErrorMessage(error, 'Не удалось удалить систему'));
    }
  }, []);

  const maxPlayersValue = useMemo(() => {
    const parsed = Number.parseInt(draft.maxPlayers, 10);
    return Number.isFinite(parsed) ? parsed : 5;
  }, [draft.maxPlayers]);

  const bumpMaxPlayers = useCallback(
    (delta: number) => {
      const next = Math.min(20, Math.max(1, maxPlayersValue + delta));
      patch({ maxPlayers: String(next) });
    },
    [maxPlayersValue, patch],
  );

  const openCoverFromUri = useCallback(async (uri: string, mimeType?: string | null) => {
    if (isGifImage(uri, mimeType)) {
      toast.warning('GIF для обложки пока не поддерживается — выберите JPEG или PNG');
      return;
    }

    try {
      const size = await getImageSize(uri);
      setPendingCrop({
        uri,
        width: size.width,
        height: size.height,
      });
    } catch {
      toast.error('Не удалось открыть изображение');
    }
  }, []);

  const acceptDroppedCover = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Нужно изображение JPEG или PNG');
        return;
      }

      if (file.type === 'image/gif' || isGifImage(file.name, file.type)) {
        toast.warning('GIF для обложки пока не поддерживается — выберите JPEG или PNG');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      void openCoverFromUri(objectUrl, file.type);
    },
    [openCoverFromUri],
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
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    if (isGifImage(asset.uri, asset.mimeType)) {
      toast.warning('GIF для обложки пока не поддерживается — выберите JPEG или PNG');
      return;
    }

    if (asset.width && asset.height) {
      setPendingCrop({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      return;
    }

    await openCoverFromUri(asset.uri, asset.mimeType);
  }, [openCoverFromUri]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const isInsideDropZone = (target: EventTarget | null) => {
      const node = getWebHostNode(coverDropRef.current);
      if (!node) {
        return false;
      }
      return target instanceof Node && node.contains(target);
    };

    const onDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }

      event.preventDefault();

      if (isInsideDropZone(event.target)) {
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        setIsDraggingCover(true);
      } else {
        setIsDraggingCover(false);
      }
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

      if (!isInsideDropZone(event.target)) {
        return;
      }

      const file = event.dataTransfer?.files?.[0];
      if (file) {
        acceptDroppedCover(file);
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

  const validate = useCallback((): string | null => {
    if (!draft.title.trim()) {
      return 'Укажите название игры';
    }

    const maxPlayers = Number.parseInt(draft.maxPlayers, 10);
    if (!Number.isFinite(maxPlayers) || maxPlayers < 1 || maxPlayers > 20) {
      return 'Макс. игроков — число от 1 до 20';
    }

    if (!draft.systemName.trim()) {
      return 'Выберите систему игры';
    }

    if (!draft.isOnline && !draft.cityId) {
      return 'Укажите город или отметьте онлайн-игру';
    }

    if (!draft.noSpecificDate && !draft.date.trim()) {
      return 'Укажите дату или отметьте «Нет конкретной даты»';
    }

    if (!draft.noSpecificDate && !parseDateRu(draft.date)) {
      return 'Выберите корректную дату';
    }

    if (!draft.noSpecificDate && !/^\d{2}:\d{2}$/.test(draft.time.trim())) {
      return 'Укажите время игры';
    }

    if (!draft.timezone.trim()) {
      return 'Укажите часовой пояс';
    }

    if (draft.durationHours.trim()) {
      const durationHours = Number.parseInt(draft.durationHours, 10);
      if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 24) {
        return 'Укажите длительность от 1 до 24 часов или оставьте пустым';
      }
    }

    if (!draft.isFree) {
      const price = Number.parseInt(draft.price.replace(/\D/g, ''), 10);
      if (!Number.isFinite(price) || price < 0) {
        return 'Укажите стоимость или отметьте бесплатную игру';
      }
    }

    if (!draft.beginnersWelcome && !draft.experienceTypeId) {
      return 'Укажите опыт или отметьте «Опыт не важен»';
    }

    if (!draft.anyAge) {
      const allowed = new Set([12, 16, 18]);
      const age = Number.parseInt(draft.minAge, 10);
      if (!allowed.has(age)) {
        return 'Выберите возраст 12+, 16+ или 18+';
      }
    }

    return null;
  }, [draft]);

  const handleSave = useCallback(async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    if (isSaving || isLoadingGame) {
      return;
    }

    setIsSaving(true);

    try {
      const maxPlayers = Number.parseInt(draft.maxPlayers, 10);
      const durationHours = draft.durationHours.trim()
        ? Number.parseInt(draft.durationHours, 10)
        : null;
      const priceRub = draft.isFree
        ? null
        : Number.parseInt(draft.price.replace(/\D/g, ''), 10);
      const minAge = draft.anyAge ? null : Number.parseInt(draft.minAge, 10);

      const scheduledAt = (() => {
        if (draft.noSpecificDate) {
          return null;
        }

        const date = parseDateRu(draft.date.trim());
        const timeMatch = /^(\d{2}):(\d{2})$/.exec(draft.time.trim());
        if (!date || !timeMatch) {
          return null;
        }

        return wallTimeToUtcIso(
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate(),
          Number(timeMatch[1]),
          Number(timeMatch[2]),
          draft.timezone.trim() || DEFAULT_TIMEZONE,
        );
      })();

      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        maxPlayers,
        durationHours,
        systemName: draft.systemName.trim(),
        kind: draft.kind,
        isOnline: draft.isOnline,
        cityId: draft.isOnline ? null : draft.cityId,
        scheduledAt,
        timezone: draft.timezone.trim() || DEFAULT_TIMEZONE,
        isFree: draft.isFree,
        priceRub,
        beginnersWelcome: draft.beginnersWelcome,
        experienceTypeId: draft.beginnersWelcome ? null : draft.experienceTypeId,
        anyAge: draft.anyAge,
        minAge,
      };

      if (isEdit && gameId) {
        await updateGame(gameId, payload);

        if (draft.coverUri && isLocalImageUri(draft.coverUri)) {
          await uploadGameCover(gameId, draft.coverUri);
        } else if (!draft.coverUri && isRemoteImageUri(savedCoverUri)) {
          await deleteGameCover(gameId);
        }
      } else {
        const created = await createGame(payload);

        if (draft.coverUri && isLocalImageUri(draft.coverUri)) {
          await uploadGameCover(created.id, draft.coverUri);
        }
      }

      toast.success(isEdit ? 'Изменения сохранены' : 'Игра сохранена');
      if (isEdit && gameId) {
        router.replace({ pathname: '/games-manage', params: { id: gameId } });
      } else {
        router.replace('/master-room');
      }
    } catch (saveError) {
      toast.error(localizeErrorMessage(saveError, 'Не удалось сохранить игру'));
    } finally {
      setIsSaving(false);
    }
  }, [draft, gameId, isEdit, isLoadingGame, isSaving, router, savedCoverUri, validate]);

  const kindOptions = useMemo(
    () => [
      { key: 'ONESHOT', label: 'Ваншот' },
      { key: 'CAMPAIGN', label: 'Кампания' },
    ],
    [],
  );

  const ageOptions = useMemo(
    () => [
      { id: '12', label: '12+' },
      { id: '16', label: '16+' },
      { id: '18', label: '18+' },
    ],
    [],
  );

  const durationOptions = useMemo(
    () => [
      { id: '', label: 'Не указана' },
      ...Array.from({ length: 24 }, (_, index) => {
        const hours = index + 1;
        const mod10 = hours % 10;
        const mod100 = hours % 100;
        let unit = 'часов';
        if (mod100 < 11 || mod100 > 14) {
          if (mod10 === 1) {
            unit = 'час';
          } else if (mod10 >= 2 && mod10 <= 4) {
            unit = 'часа';
          }
        }
        return { id: String(hours), label: `${hours} ${unit}` };
      }),
    ],
    [],
  );

  return (
    <ScreenTransition>
      {isLoadingGame ? (
        <View style={[styles.scroll, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          {!hasDesktopSidebar ? <MobileBackButton /> : null}
          <Text style={styles.headerTitle}>{isEdit ? 'Редактирование' : 'Новая игра'}</Text>
          {!hasDesktopSidebar ? <View style={{ width: 40 }} /> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Обложка игры</Text>
          <Text style={styles.coverSectionHint}>
            Широкое фото 16:9. Можно выбрать файл или перетащить сюда.
          </Text>

          <View
            ref={coverDropRef}
            collapsable={false}
            style={[
              styles.coverFrame,
              draft.coverUri ? styles.coverFrameFilled : styles.coverFrameEmpty,
              isDraggingCover && styles.coverFrameDragging,
            ]}>
            {draft.coverUri ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Изменить обложку"
                  onPress={() => void pickCover()}
                  style={StyleSheet.absoluteFill}>
                  <Image
                    source={{ uri: draft.coverUri }}
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
                      onPress={() => patch({ coverUri: null })}
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
                style={({ pressed }) => [
                  StyleSheet.absoluteFill,
                  pressed && { opacity: 0.92 },
                ]}>
                <View style={styles.coverEmptyContent}>
                  <View style={styles.coverIconBadge}>
                    <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                  </View>
                  <Text style={styles.coverEmptyTitle}>Обложка</Text>
                  <Text style={styles.coverEmptyHint}>
                    {isDesktopWeb
                      ? 'Перетащите изображение или выберите файл'
                      : 'Выберите изображение для карточки игры'}
                  </Text>
                  <Text style={styles.coverEmptyCta}>Выбрать фото</Text>
                </View>
              </Pressable>
            )}

            {isDraggingCover ? (
              <View style={styles.coverDropOverlay} pointerEvents="none">
                <Text style={styles.coverDropOverlayLabel}>Отпустите файл</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flexGrow}>
            <Input
              label="Название игры"
              value={draft.title}
              onChangeText={(title) => patch({ title })}
              placeholder="Например: Забытый храм"
            />
          </View>
          <View style={styles.playersField}>
            <Text style={styles.playersLabel}>Игроки</Text>
            <View style={styles.playersStepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Меньше игроков"
                disabled={maxPlayersValue <= 1}
                onPress={() => bumpMaxPlayers(-1)}
                style={({ pressed }) => [
                  styles.playersStepBtn,
                  maxPlayersValue <= 1 && styles.playersStepBtnDisabled,
                  pressed && maxPlayersValue > 1 && { opacity: 0.75 },
                ]}>
                <Ionicons
                  name="remove"
                  size={18}
                  color={maxPlayersValue <= 1 ? colors.textMuted : colors.primary}
                />
              </Pressable>
              <Text style={styles.playersValue}>{maxPlayersValue}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Больше игроков"
                disabled={maxPlayersValue >= 20}
                onPress={() => bumpMaxPlayers(1)}
                style={({ pressed }) => [
                  styles.playersStepBtn,
                  maxPlayersValue >= 20 && styles.playersStepBtnDisabled,
                  pressed && maxPlayersValue < 20 && { opacity: 0.75 },
                ]}>
                <Ionicons
                  name="add"
                  size={18}
                  color={maxPlayersValue >= 20 ? colors.textMuted : colors.primary}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.systemPanel}>
          <View style={styles.systemPanelHeader}>
            <View style={styles.systemPanelIcon}>
              <Ionicons name="layers-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.systemPanelHeaderText}>
              <Text style={styles.systemPanelTitle}>Система игры</Text>
              <Text style={styles.systemPanelSubtitle} numberOfLines={1}>
                Из каталога или добавьте свою
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={draft.systemName ? 'Изменить систему' : 'Добавить систему'}
              onPress={() => setIsSystemsPickerOpen(true)}
              style={({ pressed }) => [styles.systemAction, pressed && { opacity: 0.75 }]}>
              <Text style={styles.systemActionText}>
                {draft.systemName ? 'Изменить' : 'Добавить'}
              </Text>
            </Pressable>
          </View>

          {draft.systemName ? (
            <View style={styles.systemSelectedWrap}>
              <View
                style={[
                  styles.systemChip,
                  selectedUserSystem && !isOfficialSystem ? styles.systemChipUser : null,
                ]}>
                <View style={styles.systemChipContent}>
                  <Text style={styles.systemChipText}>{draft.systemName}</Text>
                  {selectedUserSystem?.author && !isOfficialSystem ? (
                    <SystemAuthorBadge author={selectedUserSystem.author} size={18} />
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.row}>
          <View
            pointerEvents={draft.isOnline ? 'none' : 'auto'}
            style={[styles.flexGrow, draft.isOnline && { opacity: 0.45 }]}>
            <CitySearchField
              label="Локация"
              placeholder="Город"
              value={draft.cityId}
              selectedLabel={draft.cityLabel || 'Пока не выбран'}
              onChange={(cityId, cityLabel) =>
                patch({
                  cityId,
                  cityLabel,
                  isOnline: false,
                })
              }
            />
          </View>
          <ToggleChip
            label="Онлайн игра"
            icon="wifi-outline"
            active={draft.isOnline}
            onPress={() => patch({ isOnline: !draft.isOnline })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Вид игры</Text>
          <Switcher
            options={kindOptions}
            value={draft.kind}
            onChange={(key) => patch({ kind: key as GameKind })}
            stretch
          />
        </View>

        <View style={styles.fieldWithToggle}>
          <View style={styles.fieldToggleRow}>
            <View
              pointerEvents={draft.noSpecificDate ? 'none' : 'auto'}
              style={[styles.flexGrow, draft.noSpecificDate && { opacity: 0.45 }]}>
              <DateField
                label="Дата игры"
                value={draft.date}
                onChange={(date) => patch({ date, noSpecificDate: false })}
                placeholder="Выберите дату"
                disabled={draft.noSpecificDate}
              />
            </View>
            <View
              pointerEvents={draft.noSpecificDate ? 'none' : 'auto'}
              style={[styles.timeField, draft.noSpecificDate && { opacity: 0.45 }]}>
              <TimeField
                label="Время"
                value={draft.time}
                onChange={(time) => patch({ time, noSpecificDate: false })}
                placeholder="ЧЧ:ММ"
                disabled={draft.noSpecificDate}
              />
            </View>
          </View>
          <ToggleChip
            label="Нет конкретной даты"
            icon="calendar-clear-outline"
            active={draft.noSpecificDate}
            onPress={() => patch({ noSpecificDate: !draft.noSpecificDate })}
            style={{ marginTop: 0, alignSelf: 'flex-start' }}
          />
        </View>

        <TimezoneField
          label="Часовой пояс"
          labelHint="Обязательное поле"
          placeholder="Выберите часовой пояс"
          value={draft.timezone}
          onChange={(timezone) => patch({ timezone })}
        />
        <Text style={styles.fieldHint}>
          Дата и время стола — в поясе из списка (Россия и Беларусь). Сейчас: {formatTimezoneLabel(draft.timezone)}.
        </Text>

        <SelectField
          label="Примерная длительность"
          placeholder="Не указана"
          value={draft.durationHours || null}
          options={durationOptions}
          onChange={(durationHours) => patch({ durationHours: durationHours ?? '' })}
        />

        <View style={styles.fieldWithToggle}>
          <View style={styles.fieldToggleRow}>
            <View style={[styles.priceField, draft.isFree && { opacity: 0.45 }]}>
              <Text style={styles.priceLabel}>Стоимость</Text>
              <View style={styles.priceInputWrap}>
                <TextInput
                  value={draft.price}
                  onChangeText={(price) =>
                    patch({
                      price: price.replace(/[^\d]/g, ''),
                      isFree: false,
                    })
                  }
                  placeholder="1000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  editable={!draft.isFree}
                  style={styles.priceInput}
                />
                <View style={styles.priceSuffix} pointerEvents="none">
                  <Text style={styles.priceSuffixText}>₽</Text>
                </View>
              </View>
            </View>
            <ToggleChip
              label="Бесплатная игра"
              icon="pricetag-outline"
              active={draft.isFree}
              onPress={() =>
                patch({
                  isFree: !draft.isFree,
                  price: !draft.isFree ? '' : draft.price,
                })
              }
              style={styles.toggleChipGrow}
            />
          </View>
        </View>

        <View style={styles.fieldWithToggle}>
          <View style={styles.fieldToggleRow}>
            <View style={[styles.flexGrow, draft.beginnersWelcome && { opacity: 0.45 }]}>
              <SelectField
                label="Требования к опыту"
                placeholder="Выберите опыт"
                value={draft.beginnersWelcome ? null : draft.experienceTypeId}
                options={experienceOptions}
                onChange={(experienceTypeId) =>
                  patch({
                    experienceTypeId,
                    beginnersWelcome: false,
                  })
                }
              />
            </View>
            <ToggleChip
              label="Опыт не важен"
              icon="leaf-outline"
              active={draft.beginnersWelcome}
              onPress={() =>
                patch({
                  beginnersWelcome: !draft.beginnersWelcome,
                })
              }
            />
          </View>
        </View>

        <View style={styles.fieldWithToggle}>
          <View style={styles.fieldToggleRow}>
            <View
              pointerEvents={draft.anyAge ? 'none' : 'auto'}
              style={[styles.flexGrow, draft.anyAge && { opacity: 0.45 }]}>
              <SelectField
                label="Требования к возрасту"
                placeholder="Выберите"
                value={draft.minAge || null}
                options={ageOptions}
                onChange={(minAge) =>
                  patch({
                    minAge: minAge ?? '',
                    anyAge: false,
                  })
                }
              />
            </View>
            <ToggleChip
              label="Любой возраст"
              icon="people-outline"
              active={draft.anyAge}
              onPress={() => patch({ anyAge: !draft.anyAge })}
            />
          </View>
        </View>

        <TextArea
          label="Об игре"
          value={draft.description}
          onChangeText={(description) => patch({ description })}
          placeholder="Расскажите о атмосфере, правилах стола и чего ждать игрокам"
          maxLength={4000}
        />

        <Button
          label={isSaving ? 'Сохраняем...' : 'Сохранить'}
          onPress={() => void handleSave()}
          disabled={isSaving || isLoadingGame}
        />
      </ScrollView>
      )}

      {pendingCrop ? (
        <PhotoCropEditor
          visible
          variant="gameCover"
          imageUri={pendingCrop.uri}
          imageWidth={pendingCrop.width}
          imageHeight={pendingCrop.height}
          onCancel={() => setPendingCrop(null)}
          onSave={(uri) => {
            patch({ coverUri: uri });
            setPendingCrop(null);
          }}
        />
      ) : null}

      <GameSystemsPicker
        visible={isSystemsPickerOpen}
        options={systemOptions}
        selectedNames={draft.systemName ? [draft.systemName] : []}
        userSystems={userSystems}
        isUserSystemsLoading={isUserSystemsLoading}
        selectionMode="single"
        title="Выберите систему"
        onChange={(names) => patch({ systemName: names[0] ?? '' })}
        onCreateUserSystem={handleCreateUserSystem}
        onUpdateUserSystem={handleUpdateUserSystem}
        onDeleteUserSystem={handleDeleteUserSystem}
        onClose={() => setIsSystemsPickerOpen(false)}
      />
    </ScreenTransition>
  );
}
