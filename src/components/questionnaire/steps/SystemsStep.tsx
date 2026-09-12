import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameSystemsPicker, type GameSystemOption } from '@/components/questionnaire/GameSystemsPicker';
import { SystemAuthorBadge } from '@/components/questionnaire/SystemAuthorBadge';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { useProfile } from '@/context/ProfileContext';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { SYSTEMS_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import {
  isSystemsStepValid,
  SYSTEMS_STEP_VALIDATION_MESSAGE,
} from '@/screens/questionnaire/questionnaire-validation';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';
import { fetchGameSystems } from '@/services/reference/referenceApi';
import {
  createUserGameSystem,
  deleteUserGameSystem,
  fetchUserGameSystems,
  updateUserGameSystem,
} from '@/services/profile/userGameSystemsApi';
import type { UserGameSystemItem } from '@/services/api/types';
import { localizeErrorMessage } from '@/utils/localizeError';
import { normalizeUserGameSystemItem, normalizeUserGameSystemItems } from '@/utils/user-game-system';

const STACK_ACTIONS_MAX_WIDTH = 1280;

type SystemsStepProps = {
  value: Pick<QuestionnaireDraft, 'systems' | 'readyToLearnNew' | 'openToAnySystem'>;
  onChange: (value: Pick<QuestionnaireDraft, 'systems' | 'readyToLearnNew' | 'openToAnySystem'>) => void;
  showValidationError?: boolean;
};

function createStyles(colors: ThemeColors, stackActions: boolean) {
  return StyleSheet.create({
    panel: {
      gap: Spacing.md,
      padding: Spacing.lg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    panelIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    panelHeaderText: {
      flex: 1,
      gap: 2,
    },
    panelTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    panelSubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    selectedSystems: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      minHeight: 40,
      alignItems: 'center',
    },
    selectedChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.primaryLight,
      gap: Spacing.xs,
      maxWidth: '100%',
    },
    selectedChipContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    selectedChipOfficial: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    selectedChipUser: {
      borderColor: colors.primaryLight,
    },
    selectedChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    selectedChipTextOfficial: {
      fontWeight: '700',
    },
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    systemsAction: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
    },
    systemsActionPressed: {
      opacity: 0.75,
    },
    systemsActionText: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.primary,
    },
    learnToggleWrap: {
      gap: Spacing.sm,
    },
    learnToggle: {
      minHeight: Sizes.controlHeight,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: stackActions ? undefined : 1,
      minWidth: 0,
    },
    learnToggleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    learnToggleError: {
      borderColor: colors.destructive,
    },
    learnTogglePressed: {
      opacity: 0.9,
    },
    learnToggleText: {
      flex: 1,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    learnToggleTextActive: {
      color: colors.onPrimary,
    },
    learnToggleHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    learnToggleHintError: {
      color: colors.destructive,
      fontWeight: '600',
    },
    validationError: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

export function SystemsStep({ value, onChange, showValidationError = false }: SystemsStepProps) {
  const screenStyles = useQuestionnaireScreenStyles();
  const colors = useTheme();
  const { profile, avatarUrl } = useProfile();
  const { width } = useWindowDimensions();
  const stackActions = width <= STACK_ACTIONS_MAX_WIDTH;
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, stackActions));
  const [systemOptions, setSystemOptions] = useState<GameSystemOption[]>([]);
  const [userSystems, setUserSystems] = useState<UserGameSystemItem[]>([]);
  const [isUserSystemsLoading, setIsUserSystemsLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const officialNameSet = useMemo(
    () => new Set(systemOptions.filter((option) => option.isOfficial).map((option) => option.name)),
    [systemOptions],
  );
  const userSystemNameSet = useMemo(
    () => new Set(userSystems.map((system) => system.name)),
    [userSystems],
  );
  const userSystemByName = useMemo(
    () => new Map(userSystems.map((system) => [system.name, system])),
    [userSystems],
  );
  const isValid = isSystemsStepValid(value);
  const showError = showValidationError && !isValid;
  const needsSelection = value.systems.length === 0;
  const systemsActionLabel =
    value.systems.length > 0 ? SYSTEMS_STEP.changeLabel : SYSTEMS_STEP.addLabel;
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
    let isMounted = true;

    fetchGameSystems()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setSystemOptions(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            isOfficial: item.isOfficial,
          })),
        );
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSystemOptions([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void loadUserSystems();
  }, [loadUserSystems]);

  useEffect(() => {
    if (!isPickerOpen) {
      return;
    }

    void loadUserSystems();
  }, [isPickerOpen, loadUserSystems]);

  const handleCreateUserSystem = useCallback(async (name: string) => {
    try {
      const created = normalizeUserGameSystemItem(
        await createUserGameSystem(name),
        currentUserAuthor,
      );
      setUserSystems((current) => [...current, created]);
      return created;
    } catch (error) {
      throw new Error(localizeErrorMessage(error, 'Не удалось добавить систему'));
    }
  }, [currentUserAuthor]);

  const handleUpdateUserSystem = useCallback(async (id: string, name: string) => {
    try {
      const updated = normalizeUserGameSystemItem(
        await updateUserGameSystem(id, name),
        currentUserAuthor,
      );
      setUserSystems((current) =>
        current.map((system) => (system.id === id ? updated : system)),
      );
      return updated;
    } catch (error) {
      throw new Error(localizeErrorMessage(error, 'Не удалось сохранить систему'));
    }
  }, [currentUserAuthor]);

  const handleDeleteUserSystem = useCallback(async (id: string) => {
    try {
      await deleteUserGameSystem(id);
      setUserSystems((current) => current.filter((system) => system.id !== id));
    } catch (error) {
      throw new Error(localizeErrorMessage(error, 'Не удалось удалить систему'));
    }
  }, []);

  return (
    <View style={screenStyles.stepBody}>
      <View>
        <Text style={screenStyles.title}>{SYSTEMS_STEP.title}</Text>
        <Text style={screenStyles.subtitle}>{SYSTEMS_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{SYSTEMS_STEP.hint}</QuestionnaireHint>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelIconWrap}>
            <Ionicons name="dice-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.panelHeaderText}>
            <Text style={styles.panelTitle}>{SYSTEMS_STEP.panelTitle}</Text>
            <Text style={styles.panelSubtitle}>{SYSTEMS_STEP.panelSubtitle}</Text>
          </View>
        </View>

        <View style={styles.selectedSystems}>
          {value.systems.length > 0 ? (
            value.systems.map((system) => {
              const isOfficial = officialNameSet.has(system);
              const isUserSystem = userSystemNameSet.has(system);
              const userSystem = userSystemByName.get(system);

              return (
                <View
                  key={system}
                  style={[
                    styles.selectedChip,
                    isOfficial ? styles.selectedChipOfficial : null,
                    isUserSystem && !isOfficial ? styles.selectedChipUser : null,
                  ]}>
                  <View style={styles.selectedChipContent}>
                    <Text
                      style={[
                        styles.selectedChipText,
                        isOfficial ? styles.selectedChipTextOfficial : null,
                      ]}>
                      {system}
                    </Text>
                    {userSystem?.author && !isOfficial ? (
                      <SystemAuthorBadge author={userSystem.author} size={18} />
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyHint}>{SYSTEMS_STEP.emptyHint}</Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={systemsActionLabel}
          onPress={() => setIsPickerOpen(true)}
          style={({ pressed }) => [
            styles.systemsAction,
            pressed ? styles.systemsActionPressed : null,
          ]}>
          <Text style={styles.systemsActionText}>{systemsActionLabel}</Text>
        </Pressable>

        <View style={styles.learnToggleWrap}>
          <Pressable
            onPress={() => onChange({ ...value, openToAnySystem: !value.openToAnySystem })}
            style={({ pressed }) => [
              styles.learnToggle,
              value.openToAnySystem ? styles.learnToggleActive : null,
              showError && needsSelection ? styles.learnToggleError : null,
              pressed ? styles.learnTogglePressed : null,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.openToAnySystem }}>
            <Ionicons
              name={value.openToAnySystem ? 'checkbox' : 'square-outline'}
              size={18}
              color={
                value.openToAnySystem
                  ? colors.onPrimary
                  : showError && needsSelection
                    ? colors.destructive
                    : colors.textMuted
              }
            />
            <Text
              style={[
                styles.learnToggleText,
                value.openToAnySystem ? styles.learnToggleTextActive : null,
              ]}>
              {SYSTEMS_STEP.openToAnySystemLabel}
            </Text>
          </Pressable>

          {needsSelection ? (
            <Text
              style={[styles.learnToggleHint, showError ? styles.learnToggleHintError : null]}>
              {SYSTEMS_STEP.openToAnySystemHint}
            </Text>
          ) : null}
        </View>

        <View style={styles.learnToggleWrap}>
          <Pressable
            onPress={() => onChange({ ...value, readyToLearnNew: !value.readyToLearnNew })}
            style={({ pressed }) => [
              styles.learnToggle,
              value.readyToLearnNew ? styles.learnToggleActive : null,
              pressed ? styles.learnTogglePressed : null,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.readyToLearnNew }}>
            <Ionicons
              name={value.readyToLearnNew ? 'checkbox' : 'square-outline'}
              size={18}
              color={value.readyToLearnNew ? colors.onPrimary : colors.textMuted}
            />
            <Text
              style={[
                styles.learnToggleText,
                value.readyToLearnNew ? styles.learnToggleTextActive : null,
              ]}>
              {SYSTEMS_STEP.readyToLearnNewLabel}
            </Text>
          </Pressable>

          <Text style={styles.learnToggleHint}>{SYSTEMS_STEP.readyToLearnNewHint}</Text>
        </View>

        {showError ? (
          <Text style={styles.validationError}>{SYSTEMS_STEP_VALIDATION_MESSAGE}</Text>
        ) : null}
      </View>

      <GameSystemsPicker
        visible={isPickerOpen}
        options={systemOptions}
        selectedNames={value.systems}
        userSystems={userSystems}
        isUserSystemsLoading={isUserSystemsLoading}
        onChange={(systems) => onChange({ ...value, systems })}
        onCreateUserSystem={handleCreateUserSystem}
        onUpdateUserSystem={handleUpdateUserSystem}
        onDeleteUserSystem={handleDeleteUserSystem}
        onClose={() => setIsPickerOpen(false)}
      />
    </View>
  );
}
