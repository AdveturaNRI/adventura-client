import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Button, Switcher } from '@/components/ui';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { SystemAuthorBadge } from '@/components/questionnaire/SystemAuthorBadge';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { SYSTEMS_STEP } from '@/screens/questionnaire/questionnaire.config';
import { DESKTOP_CONTENT_MAX_WIDTH } from '@/screens/questionnaire/questionnaire-screen.styles';
import type { UserGameSystemItem } from '@/services/api/types';
import {
  MAX_GAME_SYSTEM_NAME_LENGTH,
  matchesGameSystemSearch,
  validateCustomGameSystemName,
} from '@/utils/game-system-name';

export type GameSystemOption = {
  id: string;
  name: string;
  description: string | null;
  isOfficial: boolean;
};

const TOOLTIP_SHOW_DELAY_MS = 250;
const TOOLTIP_GAP = 6;
const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_ESTIMATED_HEIGHT = 96;

type TooltipAnchor = {
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PickerTabKey = 'official' | 'other' | 'user';

type GameSystemsPickerProps = {
  visible: boolean;
  options: GameSystemOption[];
  selectedNames: string[];
  userSystems?: UserGameSystemItem[];
  isUserSystemsLoading?: boolean;
  /** When false, only catalog tabs — no custom/user systems. Default true. */
  allowCustomSystems?: boolean;
  /** `single` keeps at most one selected system (for game creation). Default `multiple`. */
  selectionMode?: 'multiple' | 'single';
  /**
   * `filter` — компактный шит как у фильтров ленты (центр на десктопе, 560px).
   * Default `default`.
   */
  layout?: 'default' | 'filter';
  title?: string;
  initialTab?: PickerTabKey;
  onChange: (selectedNames: string[]) => void;
  onCreateUserSystem?: (name: string) => Promise<UserGameSystemItem>;
  onUpdateUserSystem?: (id: string, name: string) => Promise<UserGameSystemItem>;
  onDeleteUserSystem?: (id: string) => Promise<void>;
  onClose: () => void;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, layout: 'default' | 'filter') {
  const isFilter = layout === 'filter';

  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: isFilter ? 'rgba(15, 18, 24, 0.4)' : colors.overlay,
      justifyContent: isFilter
        ? isDesktopWeb
          ? 'center'
          : 'flex-end'
        : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isFilter && isDesktopWeb ? Spacing.xl : 0,
      position: 'relative',
    },
    modalSheet: {
      width: isDesktopWeb || isFilter ? '100%' : undefined,
      maxWidth: isDesktopWeb
        ? isFilter
          ? 560
          : DESKTOP_CONTENT_MAX_WIDTH
        : undefined,
      maxHeight: isFilter
        ? isDesktopWeb
          ? '82%'
          : '88%'
        : isDesktopWeb
          ? '80%'
          : '85%',
      flexDirection: 'column',
      borderTopLeftRadius: isFilter ? 20 : 24,
      borderTopRightRadius: isFilter ? 20 : 24,
      borderBottomLeftRadius: isDesktopWeb ? (isFilter ? 20 : 24) : 0,
      borderBottomRightRadius: isDesktopWeb ? (isFilter ? 20 : 24) : 0,
      marginBottom: isDesktopWeb && !isFilter ? Spacing.lg : 0,
      backgroundColor: colors.surface,
      borderWidth: isFilter ? 1 : 0,
      borderColor: isFilter ? colors.borderLight : undefined,
      overflow: 'hidden',
      paddingBottom: Spacing.lg,
      ...(isFilter && isDesktopWeb
        ? ({
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
          } as object)
        : {}),
    },
    modalHeader: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    bodyScroll: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
    },
    modalBody: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.lg,
    },
    tabsWrap: {
      flexShrink: 0,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    searchWrap: {
      flexShrink: 0,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
    },
    searchField: {
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      color: colors.text,
      paddingVertical: Spacing.xs,
    },
    searchClearButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: {
      gap: Spacing.sm,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    chip: {
      minHeight: 40,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    chipOfficial: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    chipCustom: {
      borderColor: colors.primaryLight,
      backgroundColor: colors.surfaceMuted,
    },
    chipPressed: {
      opacity: 0.9,
    },
    floatingTooltip: {
      position: Platform.OS === 'web' ? ('fixed' as const) : 'absolute',
      maxWidth: TOOLTIP_MAX_WIDTH,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 8,
      zIndex: 1000,
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'opacity',
            transitionDuration: '120ms',
            transitionTimingFunction: 'ease-out',
          } as object)
        : null),
    },
    floatingTooltipText: {
      fontSize: FontSize.caption,
      lineHeight: FontSize.caption * 1.45,
      color: colors.textSecondary,
    },
    chipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipLabelOfficial: {
      fontWeight: '700',
      color: colors.primary,
    },
    chipLabelSelected: {
      color: colors.primary,
    },
    emptyText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    customInputError: {
      borderColor: colors.destructive,
    },
    customError: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      paddingLeft: Spacing.xs,
    },
    userList: {
      gap: Spacing.xs,
    },
    userRow: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 12,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      backgroundColor: colors.surface,
      gap: Spacing.xs,
    },
    userRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      minHeight: 36,
    },
    userRowSelect: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    userRowName: {
      flex: 1,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    userRowInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 32,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      fontSize: FontSize.caption,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    userRowIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    },
    iconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonMuted: {
      opacity: 0.45,
    },
    iconButtonPressed: {
      opacity: 0.75,
      backgroundColor: colors.surfaceMuted,
    },
    addCustomButton: {
      marginTop: Spacing.sm,
    },
    addModalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
    },
    addModalSheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 480 : undefined,
      borderRadius: 20,
      backgroundColor: colors.surface,
      paddingBottom: Spacing.lg,
      overflow: 'hidden',
    },
    addModalBody: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.sm,
    },
    addModalInput: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      fontSize: FontSize.input,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    addModalActions: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.sm,
    },
    footer: {
      flexShrink: 0,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
  });
}

type CatalogChipProps = {
  option: GameSystemOption;
  isSelected: boolean;
  onToggle: (name: string) => void;
  onTooltipShow: (anchor: TooltipAnchor) => void;
  onTooltipHide: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
};

function CatalogChip({
  option,
  isSelected,
  onToggle,
  onTooltipShow,
  onTooltipHide,
  styles,
  colors,
}: CatalogChipProps) {
  const chipRef = useRef<View>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';
  const hasDescription = Boolean(option.description?.trim());

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (!isWeb || !hasDescription || !option.description) {
      return;
    }

    tooltipTimerRef.current = setTimeout(() => {
      chipRef.current?.measureInWindow((x, y, width, height) => {
        onTooltipShow({
          description: option.description!,
          x,
          y,
          width,
          height,
        });
      });
    }, TOOLTIP_SHOW_DELAY_MS);
  };

  const hideTooltip = () => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

    onTooltipHide();
  };

  return (
    <View ref={chipRef} collapsable={false}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityHint={option.description ?? undefined}
        onPress={() => onToggle(option.name)}
        onHoverIn={showTooltip}
        onHoverOut={hideTooltip}
        style={({ pressed }) => [
          styles.chip,
          option.isOfficial ? styles.chipOfficial : null,
          isSelected ? styles.chipSelected : null,
          pressed ? styles.chipPressed : null,
        ]}>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={isSelected || option.isOfficial ? colors.primary : colors.textMuted}
        />
        <Text
          style={[
            styles.chipLabel,
            option.isOfficial ? styles.chipLabelOfficial : null,
            isSelected ? styles.chipLabelSelected : null,
          ]}>
          {option.name}
        </Text>
      </Pressable>
    </View>
  );
}

function getTooltipStyle(
  anchor: TooltipAnchor,
  windowWidth: number,
  windowHeight: number,
): { top: number; left: number; maxWidth: number } {
  const maxWidth = Math.min(TOOLTIP_MAX_WIDTH, windowWidth - Spacing.md * 2);
  const left = Math.min(Math.max(Spacing.md, anchor.x), windowWidth - maxWidth - Spacing.md);
  const spaceBelow = windowHeight - (anchor.y + anchor.height);
  const placeAbove =
    spaceBelow < TOOLTIP_ESTIMATED_HEIGHT + TOOLTIP_GAP &&
    anchor.y > TOOLTIP_ESTIMATED_HEIGHT + TOOLTIP_GAP;
  const top = placeAbove
    ? anchor.y - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP
    : anchor.y + anchor.height + TOOLTIP_GAP;

  return { top, left, maxWidth };
}

export function GameSystemsPicker({
  visible,
  options,
  selectedNames,
  userSystems = [],
  isUserSystemsLoading = false,
  allowCustomSystems = true,
  selectionMode = 'multiple',
  layout = 'default',
  title = SYSTEMS_STEP.pickerTitle,
  initialTab = 'official',
  onChange,
  onCreateUserSystem,
  onUpdateUserSystem,
  onDeleteUserSystem,
  onClose,
}: GameSystemsPickerProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, isDesktopWeb, layout),
  );
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [customError, setCustomError] = useState<string | undefined>();
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [addCustomName, setAddCustomName] = useState('');
  const [addCustomError, setAddCustomError] = useState<string | undefined>();
  const [activeTooltip, setActiveTooltip] = useState<TooltipAnchor | null>(null);
  const [activeTab, setActiveTab] = useState<PickerTabKey>(initialTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const catalogNames = useMemo(() => options.map((option) => option.name), [options]);
  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const officialOptions = useMemo(
    () => options.filter((option) => option.isOfficial),
    [options],
  );
  const otherOptions = useMemo(
    () => options.filter((option) => !option.isOfficial),
    [options],
  );
  const tabOptions = useMemo(() => {
    const tabs = [{ key: 'official', label: SYSTEMS_STEP.pickerOfficialTitle }];

    if (otherOptions.length > 0) {
      tabs.push({ key: 'other', label: SYSTEMS_STEP.pickerOtherTitle });
    }

    if (allowCustomSystems) {
      tabs.push({ key: 'user', label: SYSTEMS_STEP.pickerUserTitle });
    }

    return tabs;
  }, [allowCustomSystems, otherOptions.length]);

  const filteredOfficialOptions = useMemo(
    () => officialOptions.filter((option) => matchesGameSystemSearch(option.name, searchQuery)),
    [officialOptions, searchQuery],
  );
  const filteredOtherOptions = useMemo(
    () => otherOptions.filter((option) => matchesGameSystemSearch(option.name, searchQuery)),
    [otherOptions, searchQuery],
  );
  const filteredUserSystems = useMemo(
    () =>
      userSystems.filter(
        (system) =>
          matchesGameSystemSearch(system.name, searchQuery) ||
          (system.author?.nickname
            ? matchesGameSystemSearch(system.author.nickname, searchQuery)
            : false),
      ),
    [searchQuery, userSystems],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  const toggleSystem = (name: string) => {
    if (selectionMode === 'single') {
      onChange(selectedSet.has(name) ? [] : [name]);
      return;
    }

    if (selectedSet.has(name)) {
      onChange(selectedNames.filter((item) => item !== name));
      return;
    }

    onChange([...selectedNames, name]);
  };

  const selectOnly = (name: string) => {
    if (selectionMode === 'single') {
      onChange([name]);
      return;
    }

    if (!selectedSet.has(name)) {
      onChange([...selectedNames, name]);
    }
  };

  const replaceSelectedName = (previousName: string, nextName: string) => {
    onChange(
      selectedNames.map((name) => (name === previousName ? nextName : name)),
    );
  };

  const removeSelectedName = (name: string) => {
    onChange(selectedNames.filter((item) => item !== name));
  };

  const renderCatalogChip = (option: GameSystemOption) => (
    <CatalogChip
      key={option.id}
      option={option}
      isSelected={selectedSet.has(option.name)}
      onToggle={toggleSystem}
      onTooltipShow={setActiveTooltip}
      onTooltipHide={() => setActiveTooltip(null)}
      styles={styles}
      colors={colors}
    />
  );

  const renderCatalogSection = (sectionOptions: GameSystemOption[]) => {
    if (sectionOptions.length === 0) {
      return (
        <Text style={styles.emptyText}>
          {hasSearchQuery ? SYSTEMS_STEP.pickerSearchEmpty : 'Список систем пока пуст'}
        </Text>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.chips}>{sectionOptions.map(renderCatalogChip)}</View>
      </View>
    );
  };

  useEffect(() => {
    if (!visible) {
      setIsAddCustomOpen(false);
      setAddCustomName('');
      setAddCustomError(undefined);
      setCustomError(undefined);
      setActiveTooltip(null);
      setEditingId(null);
      setEditName('');
      setEditError(undefined);
      setSearchQuery('');
      return;
    }

    const preferredTab =
      initialTab === 'other' && otherOptions.length === 0 ? 'official' : initialTab;
    const nextTab =
      !allowCustomSystems && preferredTab === 'user' ? 'official' : preferredTab;
    setActiveTab(nextTab);
  }, [allowCustomSystems, initialTab, otherOptions.length, visible]);

  const closeAddCustomModal = () => {
    setIsAddCustomOpen(false);
    setAddCustomName('');
    setAddCustomError(undefined);
  };

  const openAddCustomModal = () => {
    if (!allowCustomSystems) {
      return;
    }

    setAddCustomName('');
    setAddCustomError(undefined);
    setIsAddCustomOpen(true);
  };

  useEffect(() => {
    if (!tabOptions.some((tab) => tab.key === activeTab)) {
      setActiveTab((tabOptions[0]?.key as PickerTabKey) ?? 'official');
    }
  }, [activeTab, tabOptions]);

  const handleAddCustomSystem = async () => {
    const existingUserNames = userSystems.map((system) => system.name);
    const validation = validateCustomGameSystemName(
      addCustomName,
      catalogNames,
      selectedNames,
      existingUserNames,
    );

    if (!validation.ok) {
      setAddCustomError(validation.error);
      return;
    }

    if (validation.name !== addCustomName.trim() && catalogNames.includes(validation.name)) {
      selectOnly(validation.name);
      closeAddCustomModal();
      return;
    }

    if (!onCreateUserSystem) {
      setAddCustomError('Создание систем здесь недоступно');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await onCreateUserSystem(validation.name);
      selectOnly(created.name);

      setActiveTab('user');
      closeAddCustomModal();
    } catch (error) {
      setAddCustomError(error instanceof Error ? error.message : 'Не удалось добавить систему');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (system: UserGameSystemItem) => {
    setEditingId(system.id);
    setEditName(system.name);
    setEditError(undefined);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditError(undefined);
  };

  const handleSaveEdit = async (system: UserGameSystemItem) => {
    const otherUserNames = userSystems
      .filter((item) => item.id !== system.id)
      .map((item) => item.name);
    const validation = validateCustomGameSystemName(
      editName,
      catalogNames,
      selectedNames.filter((name) => name !== system.name),
      otherUserNames,
    );

    if (!validation.ok) {
      setEditError(validation.error);
      return;
    }

    if (!onUpdateUserSystem) {
      setEditError('Изменение систем здесь недоступно');
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await onUpdateUserSystem(system.id, validation.name);
      replaceSelectedName(system.name, updated.name);
      cancelEditing();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Не удалось сохранить систему');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSystem = async (system: UserGameSystemItem) => {
    if (!onDeleteUserSystem) {
      setCustomError('Удаление систем здесь недоступно');
      return;
    }

    setIsSubmitting(true);

    try {
      await onDeleteUserSystem(system.id);
      removeSelectedName(system.name);

      if (editingId === system.id) {
        cancelEditing();
      }
    } catch (error) {
      setCustomError(error instanceof Error ? error.message : 'Не удалось удалить систему');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUserTab = () => (
    <View style={styles.section}>
      {customError ? <Text style={styles.customError}>{customError}</Text> : null}
      {isUserSystemsLoading ? (
        <Text style={styles.emptyText}>Загружаем ваши системы...</Text>
      ) : filteredUserSystems.length > 0 ? (
        <View style={styles.userList}>
          {filteredUserSystems.map((system) => {
            const isSelected = selectedSet.has(system.name);
            const isEditing = editingId === system.id;

            return (
              <View key={system.id} style={styles.userRow}>
                {isEditing ? (
                  <View style={styles.userRowMain}>
                    <TextInput
                      value={editName}
                      onChangeText={(value) => {
                        setEditName(value);
                        if (editError) {
                          setEditError(undefined);
                        }
                      }}
                      placeholder={SYSTEMS_STEP.pickerCustomPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      maxLength={MAX_GAME_SYSTEM_NAME_LENGTH}
                      style={[styles.userRowInput, editError ? styles.customInputError : null]}
                      autoFocus
                    />
                    <View style={styles.userRowIcons}>
                      <Pressable
                        disabled={isSubmitting}
                        accessibilityRole="button"
                        accessibilityLabel={SYSTEMS_STEP.pickerSaveLabel}
                        onPress={() => handleSaveEdit(system)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed ? styles.iconButtonPressed : null,
                        ]}>
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      </Pressable>
                      <Pressable
                        disabled={isSubmitting}
                        accessibilityRole="button"
                        accessibilityLabel={SYSTEMS_STEP.pickerCancelLabel}
                        onPress={cancelEditing}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed ? styles.iconButtonPressed : null,
                        ]}>
                        <Ionicons name="close" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.userRowMain}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => toggleSystem(system.name)}
                      style={({ pressed }) => [
                        styles.userRowSelect,
                        pressed ? styles.chipPressed : null,
                      ]}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={16}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                      <Text style={styles.userRowName} numberOfLines={1}>
                        {system.name}
                      </Text>
                    </Pressable>

                    {system.author ? (
                      <SystemAuthorBadge author={system.author} size={18} compact />
                    ) : null}

                    <View style={styles.userRowIcons}>
                      {system.canEdit ? (
                        <Pressable
                          disabled={isSubmitting}
                          accessibilityRole="button"
                          accessibilityLabel={SYSTEMS_STEP.pickerEditLabel}
                          onPress={() => startEditing(system)}
                          style={({ pressed }) => [
                            styles.iconButton,
                            pressed ? styles.iconButtonPressed : null,
                          ]}>
                          <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
                        </Pressable>
                      ) : (
                        <View
                          style={[styles.iconButton, styles.iconButtonMuted]}
                          accessibilityRole="text"
                          accessibilityLabel={SYSTEMS_STEP.pickerUserLockedHint}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={14}
                            color={colors.textMuted}
                          />
                        </View>
                      )}
                      {system.canDelete ? (
                        <Pressable
                          disabled={isSubmitting}
                          accessibilityRole="button"
                          accessibilityLabel={SYSTEMS_STEP.pickerDeleteLabel}
                          onPress={() => handleDeleteSystem(system)}
                          style={({ pressed }) => [
                            styles.iconButton,
                            pressed ? styles.iconButtonPressed : null,
                          ]}>
                          <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )}

                {isEditing && editError ? (
                  <Text style={styles.customError}>{editError}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {hasSearchQuery ? SYSTEMS_STEP.pickerSearchEmpty : SYSTEMS_STEP.pickerUserEmpty}
        </Text>
      )}

      <Button
        label={SYSTEMS_STEP.pickerCustomOpenLabel}
        variant="outline"
        onPress={openAddCustomModal}
        style={styles.addCustomButton}
      />
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'official':
        return renderCatalogSection(filteredOfficialOptions);
      case 'other':
        return renderCatalogSection(filteredOtherOptions);
      case 'user':
        return allowCustomSystems ? renderUserTab() : null;
      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType={layout === 'filter' && isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {activeTooltip ? (
          <View
            pointerEvents="none"
            style={[
              styles.floatingTooltip,
              getTooltipStyle(activeTooltip, windowWidth, windowHeight),
            ]}>
            <Text style={styles.floatingTooltipText}>{activeTooltip.description}</Text>
          </View>
        ) : null}
        <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {tabOptions.length > 1 ? (
            <View style={styles.tabsWrap}>
              <Switcher
                options={tabOptions}
                value={activeTab}
                onChange={(key) => {
                  setActiveTab(key as PickerTabKey);
                  setCustomError(undefined);
                }}
                disabled={isSubmitting}
              />
            </View>
          ) : null}

          <View style={styles.searchWrap}>
            <View style={styles.searchField}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={SYSTEMS_STEP.pickerSearchPlaceholder}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Очистить поиск"
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                  style={styles.searchClearButton}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.modalBody}
            onScroll={() => setActiveTooltip(null)}
            scrollEventThrottle={16}>
            {renderTabContent()}
          </ScrollView>

          <View style={styles.footer}>
            <Button label={SYSTEMS_STEP.pickerDoneLabel} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
      </Modal>

      <Modal
        visible={allowCustomSystems && isAddCustomOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAddCustomModal}>
        <Pressable style={styles.addModalBackdrop} onPress={closeAddCustomModal}>
          <Pressable style={styles.addModalSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{SYSTEMS_STEP.pickerCustomTitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                onPress={closeAddCustomModal}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.addModalBody}>
              <TextInput
                value={addCustomName}
                onChangeText={(value) => {
                  setAddCustomName(value);
                  if (addCustomError) {
                    setAddCustomError(undefined);
                  }
                }}
                placeholder={SYSTEMS_STEP.pickerCustomPlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_GAME_SYSTEM_NAME_LENGTH}
                returnKeyType="done"
                onSubmitEditing={() => void handleAddCustomSystem()}
                autoFocus
                style={[styles.addModalInput, addCustomError ? styles.customInputError : null]}
              />
              {addCustomError ? <Text style={styles.customError}>{addCustomError}</Text> : null}
            </View>

            <View style={styles.addModalActions}>
              <Button
                label={SYSTEMS_STEP.pickerCustomAddLabel}
                onPress={() => void handleAddCustomSystem()}
              />
              <Button
                label={SYSTEMS_STEP.pickerCancelLabel}
                variant="outline"
                onPress={closeAddCustomModal}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
