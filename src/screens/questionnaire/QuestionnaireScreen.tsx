import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { DeleteQuestionnaireDialog } from '@/components/questionnaire/DeleteQuestionnaireDialog';
import {
  QuestionnaireFooterActions,
  QuestionnaireLayout,
} from '@/components/questionnaire/QuestionnaireLayout';
import { QuestionnaireStepMap } from '@/components/questionnaire/QuestionnaireStepMap';
import { UnsavedChangesDialog } from '@/components/questionnaire/UnsavedChangesDialog';
import { ExperienceStep } from '@/components/questionnaire/steps/ExperienceStep';
import { FinalStep } from '@/components/questionnaire/steps/FinalStep';
import { LocationStep } from '@/components/questionnaire/steps/LocationStep';
import { ProfileStep } from '@/components/questionnaire/steps/ProfileStep';
import { RolesStep } from '@/components/questionnaire/steps/RolesStep';
import { SystemsStep } from '@/components/questionnaire/steps/SystemsStep';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import {
  isQuestionnaireDraftDirty,
  profileToQuestionnaireDraft,
  resolveQuestionnaireStepIndex,
} from '@/screens/questionnaire/questionnaire-mapper';
import { getQuestionnaireStepMap } from '@/screens/questionnaire/questionnaire-step-summary';
import {
  EXPERIENCE_STEP_VALIDATION_MESSAGE,
  isExperienceStepValid,
  isLocationStepValid,
  isProfileStepValid,
  isQuestionnaireStepReady,
  isSystemsStepValid,
  LOCATION_STEP_VALIDATION_MESSAGE,
  PROFILE_STEP_VALIDATION_MESSAGE,
  ROLES_STEP_VALIDATION_MESSAGE,
  SYSTEMS_STEP_VALIDATION_MESSAGE,
} from '@/screens/questionnaire/questionnaire-validation';
import {
  QUESTIONNAIRE_CONTINUE_LABEL,
  QUESTIONNAIRE_AFTER_FINISH_HREF,
  QUESTIONNAIRE_DELETE_LABEL,
  QUESTIONNAIRE_DELETED_TOAST,
  QUESTIONNAIRE_FINISH_LABEL,
  QUESTIONNAIRE_FINISHED_TOAST,
  QUESTIONNAIRE_SAVE_EXIT_LABEL,
  QUESTIONNAIRE_SAVED_TOAST,
  QUESTIONNAIRE_SAVING_LABEL,
  QUESTIONNAIRE_UNSAVED_CANCEL_LABEL,
  QUESTIONNAIRE_UNSAVED_DISCARD_LABEL,
  QUESTIONNAIRE_UNSAVED_MESSAGE,
  QUESTIONNAIRE_UNSAVED_SAVE_LABEL,
  QUESTIONNAIRE_UNSAVED_TITLE,
  QUESTIONNAIRE_STEP_INDEX,
  QUESTIONNAIRE_STEPS,
  QUESTIONNAIRE_TOTAL_STEPS,
} from '@/screens/questionnaire/questionnaire.config';
import {
  INITIAL_QUESTIONNAIRE_DRAFT,
  type QuestionnaireDraft,
} from '@/screens/questionnaire/types';
import {
  QuestionnaireGifUploadSkippedError,
  deleteQuestionnaire,
  saveQuestionnaireToServer,
} from '@/services/profile/profileApi';
import { localizeErrorMessage } from '@/utils/localizeError';

import { useQuestionnaireScreenStyles, getQuestionnaireColumnWidth } from './questionnaire-screen.styles';

const LAST_IMPLEMENTED_STEP_INDEX = QUESTIONNAIRE_STEPS.length - 1;

export default function QuestionnaireScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ edit?: string }>();
  const startInEditMode = params.edit === '1' || params.edit === 'true';
  const { user, clearPostSignUpRedirect } = useAuth();
  const { profile, isLoading: isProfileLoading, applyProfile } = useProfile();
  const [shellWidth, setShellWidth] = useState(0);
  const styles = useQuestionnaireScreenStyles();
  const isDesktopWeb = useIsDesktopWeb();
  const columnWidth = getQuestionnaireColumnWidth(shellWidth, isDesktopWeb);
  const columnStyle = {
    width: columnWidth ?? '100%',
    maxWidth: '100%' as const,
    alignSelf: 'center' as const,
    ...(Platform.OS === 'web'
      ? ({ marginLeft: 'auto', marginRight: 'auto' } as const)
      : null),
  };
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<QuestionnaireDraft>(INITIAL_QUESTIONNAIRE_DRAFT);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [locationValidationAttempted, setLocationValidationAttempted] = useState(false);
  const [experienceValidationAttempted, setExperienceValidationAttempted] = useState(false);
  const [systemsValidationAttempted, setSystemsValidationAttempted] = useState(false);
  const [isExitPromptVisible, setIsExitPromptVisible] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hydratedProfileIdRef = useRef<string | null>(null);
  const allowLeaveWithoutPromptRef = useRef(false);
  const pendingNavigationActionRef = useRef<NavigationAction | null>(null);
  const consumedEditParamRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const savedDraft = useMemo(
    () => (profile ? profileToQuestionnaireDraft(profile) : null),
    [profile],
  );

  const hasUnsavedChanges = useMemo(
    () => (savedDraft ? isQuestionnaireDraftDirty(draft, savedDraft) : false),
    [draft, savedDraft],
  );

  const isLocationStepComplete = isLocationStepValid({
    cities: draft.cities,
    playsOnline: draft.playsOnline,
  });

  const isProfileStepComplete = isProfileStepValid({
    status: draft.status,
    age: draft.age,
  });

  const isExperienceStepComplete = isExperienceStepValid({
    timezone: draft.timezone,
  });

  const isSystemsStepComplete = isSystemsStepValid({
    systems: draft.systems,
    readyToLearnNew: draft.readyToLearnNew,
    openToAnySystem: draft.openToAnySystem,
  });

  useEffect(() => {
    if (isLocationStepComplete) {
      setLocationValidationAttempted(false);
    }
  }, [isLocationStepComplete]);

  useEffect(() => {
    if (isExperienceStepComplete) {
      setExperienceValidationAttempted(false);
    }
  }, [isExperienceStepComplete]);

  useEffect(() => {
    if (isSystemsStepComplete) {
      setSystemsValidationAttempted(false);
    }
  }, [isSystemsStepComplete]);

  useEffect(() => {
    clearPostSignUpRedirect();
  }, [clearPostSignUpRedirect]);

  useEffect(() => {
    if (!profile) {
      hydratedProfileIdRef.current = null;
      setIsHydrated(false);
      return;
    }

    if (hydratedProfileIdRef.current === profile.id) {
      return;
    }

    hydratedProfileIdRef.current = profile.id;
    setDraft(profileToQuestionnaireDraft(profile));
    setStepIndex(
      startInEditMode
        ? QUESTIONNAIRE_STEP_INDEX.roles
        : resolveQuestionnaireStepIndex(profile),
    );

    if (startInEditMode) {
      consumedEditParamRef.current = true;
    }

    setIsHydrated(true);
  }, [profile, startInEditMode]);

  useEffect(() => {
    if (!startInEditMode) {
      consumedEditParamRef.current = false;
      return;
    }

    if (!isHydrated || consumedEditParamRef.current) {
      return;
    }

    consumedEditParamRef.current = true;
    setStepIndex(QUESTIONNAIRE_STEP_INDEX.roles);
  }, [isHydrated, startInEditMode]);

  const completeLeave = useCallback(() => {
    allowLeaveWithoutPromptRef.current = true;
    setIsExitPromptVisible(false);

    const pendingAction = pendingNavigationActionRef.current;
    pendingNavigationActionRef.current = null;

    if (pendingAction) {
      navigation.dispatch(pendingAction);
      return;
    }

    router.back();
  }, [navigation, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveWithoutPromptRef.current || !hasUnsavedChanges || isSaving) {
        return;
      }

      event.preventDefault();
      pendingNavigationActionRef.current = event.data.action;
      setIsExitPromptVisible(true);
    });

    return unsubscribe;
  }, [hasUnsavedChanges, isSaving, navigation]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const applySavedProfile = useCallback(
    async (profile: Awaited<ReturnType<typeof saveQuestionnaireToServer>>) => {
      setDraft(profileToQuestionnaireDraft(profile));
      await applyProfile(profile);
    },
    [applyProfile],
  );

  const validateCurrentStep = useCallback((): boolean => {
    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.roles && !draft.role) {
      toast.error(ROLES_STEP_VALIDATION_MESSAGE);
      return false;
    }

    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.profile && !isProfileStepComplete) {
      toast.error(PROFILE_STEP_VALIDATION_MESSAGE);
      return false;
    }

    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.experience && !isExperienceStepComplete) {
      setExperienceValidationAttempted(true);
      toast.error(EXPERIENCE_STEP_VALIDATION_MESSAGE);
      return false;
    }

    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.location && !isLocationStepComplete) {
      setLocationValidationAttempted(true);
      toast.error(LOCATION_STEP_VALIDATION_MESSAGE);
      return false;
    }

    if (stepIndex === QUESTIONNAIRE_STEP_INDEX.systems && !isSystemsStepComplete) {
      setSystemsValidationAttempted(true);
      toast.error(SYSTEMS_STEP_VALIDATION_MESSAGE);
      return false;
    }

    return true;
  }, [
    draft.role,
    isExperienceStepComplete,
    isLocationStepComplete,
    isProfileStepComplete,
    isSystemsStepComplete,
    stepIndex,
  ]);

  const canSaveCurrentStep = isQuestionnaireStepReady(stepIndex, draft);
  const handlePersist = useCallback(
    async (
      mode: 'continue' | 'exit',
      options?: {
        navigateAwayOnExit?: boolean;
      },
    ): Promise<boolean> => {
      const navigateAwayOnExit = options?.navigateAwayOnExit ?? true;

      if (!user || isSaving) {
        return false;
      }

      if ((mode === 'continue' || mode === 'exit') && !validateCurrentStep()) {
        return false;
      }

      setIsSaving(true);

      let savedStepIndex = stepIndex;
      let nextUiStepIndex = stepIndex;
      const savedProfileCardUri = savedDraft?.profileCardUri ?? null;

      try {
        if (mode === 'exit') {
          savedStepIndex = stepIndex;
        } else if (stepIndex === 0) {
          savedStepIndex = 1;
          nextUiStepIndex = 1;
        } else if (stepIndex < LAST_IMPLEMENTED_STEP_INDEX) {
          savedStepIndex = stepIndex + 1;
          nextUiStepIndex = stepIndex + 1;
        } else {
          const profile = await saveQuestionnaireToServer(draft, stepIndex, {
            savedProfileCardUri,
          });
          await applySavedProfile(profile);
          toast.success(QUESTIONNAIRE_FINISHED_TOAST);
          allowLeaveWithoutPromptRef.current = true;
          router.replace(QUESTIONNAIRE_AFTER_FINISH_HREF);
          return true;
        }

        const profile = await saveQuestionnaireToServer(draft, savedStepIndex, {
          activeStepIndex: stepIndex,
          savedProfileCardUri,
        });
        await applySavedProfile(profile);

        if (mode === 'exit') {
          toast.success(QUESTIONNAIRE_SAVED_TOAST);

          if (navigateAwayOnExit) {
            allowLeaveWithoutPromptRef.current = true;
            router.back();
          }

          return true;
        }

        setStepIndex(nextUiStepIndex);
        toast.success(QUESTIONNAIRE_SAVED_TOAST);
        return true;
      } catch (error) {
        if (error instanceof QuestionnaireGifUploadSkippedError) {
          await applySavedProfile(error.profile);

          if (mode === 'exit') {
            if (navigateAwayOnExit) {
              allowLeaveWithoutPromptRef.current = true;
              router.back();
            }
          } else if (stepIndex < LAST_IMPLEMENTED_STEP_INDEX) {
            setStepIndex(nextUiStepIndex);
          }

          toast.warning(
            'Текст и роль сохранены. Анимированные GIF пока нельзя загрузить на сервер — выберите JPEG или PNG.',
          );

          if (mode === 'continue' && stepIndex >= LAST_IMPLEMENTED_STEP_INDEX) {
            allowLeaveWithoutPromptRef.current = true;
            router.replace(QUESTIONNAIRE_AFTER_FINISH_HREF);
          }
          return true;
        }

        toast.error(localizeErrorMessage(error, 'Не удалось сохранить анкету'));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      applySavedProfile,
      draft,
      isSaving,
      router,
      savedDraft,
      stepIndex,
      user,
      validateCurrentStep,
    ],
  );

  const handleContinue = useCallback(() => {
    void handlePersist('continue');
  }, [handlePersist]);

  const handleEdit = useCallback(() => {
    setStepIndex(QUESTIONNAIRE_STEP_INDEX.roles);
  }, []);

  const handleSaveExit = useCallback(() => {
    void handlePersist('exit');
  }, [handlePersist]);

  const handleDeletePress = useCallback(() => {
    if (isSaving || isDeleting) {
      return;
    }

    setIsDeleteDialogVisible(true);
  }, [isDeleting, isSaving]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteDialogVisible(false);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    void (async () => {
      if (isSaving || isDeleting || !user) {
        return;
      }

      setIsDeleting(true);

      try {
        const nextProfile = await deleteQuestionnaire();
        await applySavedProfile(nextProfile);
        setDraft(INITIAL_QUESTIONNAIRE_DRAFT);
        setStepIndex(0);
        setIsDeleteDialogVisible(false);
        allowLeaveWithoutPromptRef.current = true;
        toast.success(QUESTIONNAIRE_DELETED_TOAST);
        router.back();
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось удалить анкету'));
      } finally {
        setIsDeleting(false);
      }
    })();
  }, [applySavedProfile, isDeleting, isSaving, router, user]);

  const handleExitPromptSave = useCallback(() => {
    void (async () => {
      const saved = await handlePersist('exit', { navigateAwayOnExit: false });

      if (saved) {
        completeLeave();
      }
    })();
  }, [completeLeave, handlePersist]);

  const handleExitPromptDiscard = useCallback(() => {
    if (savedDraft) {
      setDraft(savedDraft);
    }

    completeLeave();
  }, [completeLeave, savedDraft]);

  const handleExitPromptCancel = useCallback(() => {
    pendingNavigationActionRef.current = null;
    setIsExitPromptVisible(false);
  }, []);

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      return;
    }

    router.back();
  };

  const handleStepPress = useCallback(
    async (targetStepIndex: number) => {
      if (isSaving || targetStepIndex === stepIndex || !user) {
        return;
      }

      if (targetStepIndex > LAST_IMPLEMENTED_STEP_INDEX) {
        return;
      }

      const savedDraft = profile ? profileToQuestionnaireDraft(profile) : null;
      const hasChanges = savedDraft ? isQuestionnaireDraftDirty(draft, savedDraft) : true;

      if (!hasChanges) {
        setStepIndex(targetStepIndex);
        return;
      }

      setIsSaving(true);

      try {
        const savedProfile = await saveQuestionnaireToServer(draft, targetStepIndex, {
          activeStepIndex: stepIndex,
          savedProfileCardUri: savedDraft?.profileCardUri ?? null,
        });
        await applySavedProfile(savedProfile);
        setStepIndex(targetStepIndex);
      } catch (error) {
        if (error instanceof QuestionnaireGifUploadSkippedError) {
          await applySavedProfile(error.profile);
          setStepIndex(targetStepIndex);
          toast.warning(
            'Текст и роль сохранены. Анимированные GIF пока нельзя загрузить на сервер — выберите JPEG или PNG.',
          );
          return;
        }

        toast.error(localizeErrorMessage(error, 'Не удалось сохранить анкету'));
      } finally {
        setIsSaving(false);
      }
    },
    [applySavedProfile, draft, isSaving, profile, stepIndex, user],
  );

  const stepMap = useMemo(
    () => getQuestionnaireStepMap(draft, stepIndex, QUESTIONNAIRE_TOTAL_STEPS),
    [draft, stepIndex],
  );

  const continueLabel =
    stepIndex === QUESTIONNAIRE_STEP_INDEX.final
      ? QUESTIONNAIRE_FINISH_LABEL
      : QUESTIONNAIRE_CONTINUE_LABEL;
  const isFinalStep = stepIndex === QUESTIONNAIRE_STEP_INDEX.final;

  const showDesktopMap = isDesktopWeb && stepMap.length > 0;

  useEffect(() => {
    // Remount via key resets most cases; still pin to top after layout —
    // otherwise RN Web can restore the previous step's offset.
    const scrollTop = () => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    };

    scrollTop();
    const frame = requestAnimationFrame(() => {
      scrollTop();
      requestAnimationFrame(scrollTop);
    });
    const timer = setTimeout(scrollTop, 80);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [stepIndex]);

  if (!user || isProfileLoading || !isHydrated) {
    return null;
  }

  return (
    <ScreenTransition animateOnFocus>
      <View
        style={styles.shell}
        onLayout={(event) => {
          const nextWidth = Math.floor(event.nativeEvent.layout.width);
          setShellWidth((current) => (current === nextWidth ? current : nextWidth));
        }}>
        <ScrollView
          key={stepIndex}
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          horizontal={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never">
          <View style={[styles.page, showDesktopMap ? styles.pageWithMap : null]}>
            {showDesktopMap ? (
              <View style={styles.mapAside}>
                <QuestionnaireStepMap
                  nodes={stepMap}
                  variant="sidebar"
                  disabled={isSaving}
                  maxNavigableStepIndex={LAST_IMPLEMENTED_STEP_INDEX}
                  onStepPress={handleStepPress}
                />
              </View>
            ) : null}

            <View
              // @ts-expect-error RN Web className
              className="questionnaire-column"
              style={[styles.content, showDesktopMap ? styles.contentWithMap : null, columnStyle]}>
              <Text style={styles.greeting}>Привет, {user.nickname}!</Text>

              <QuestionnaireLayout
                stepIndex={stepIndex}
                totalSteps={QUESTIONNAIRE_TOTAL_STEPS}
                continueLabel={continueLabel}
                saveExitLabel={QUESTIONNAIRE_SAVE_EXIT_LABEL}
                savingLabel={QUESTIONNAIRE_SAVING_LABEL}
                isSaving={isSaving || isDeleting}
                canSave={canSaveCurrentStep}
                stepMap={stepMap}
                renderStepMap={!isDesktopWeb}
                maxNavigableStepIndex={LAST_IMPLEMENTED_STEP_INDEX}
                showFooter={false}
                onBack={handleBack}
                onStepPress={handleStepPress}
                onContinue={handleContinue}
                onSaveExit={handleSaveExit}>
                {stepIndex === 0 ? (
                  <RolesStep
                    value={draft.role}
                    onChange={(role) => setDraft((current) => ({ ...current, role }))}
                  />
                ) : stepIndex === 1 ? (
                  <ProfileStep
                    value={{
                      profileCardUri: draft.profileCardUri,
                      profileCardRevision: draft.profileCardRevision,
                      nickname: draft.nickname,
                      status: draft.status,
                      description: draft.description,
                      age: draft.age,
                      isPublic: draft.isPublic,
                    }}
                    onChange={(profile) => setDraft((current) => ({ ...current, ...profile }))}
                  />
                ) : stepIndex === 2 ? (
                  <ExperienceStep
                    value={{
                      experienceTypeId: draft.experienceTypeId,
                      experienceTypeLabel: draft.experienceTypeLabel,
                      availability: draft.availability,
                      timezone: draft.timezone,
                    }}
                    showValidationError={experienceValidationAttempted}
                    onChange={(experience) => setDraft((current) => ({ ...current, ...experience }))}
                  />
                ) : stepIndex === QUESTIONNAIRE_STEP_INDEX.location ? (
                  <LocationStep
                    value={{
                      cities: draft.cities,
                      playsOnline: draft.playsOnline,
                    }}
                    showValidationError={locationValidationAttempted}
                    onChange={(location) => setDraft((current) => ({ ...current, ...location }))}
                  />
                ) : stepIndex === QUESTIONNAIRE_STEP_INDEX.systems ? (
                  <SystemsStep
                    value={{
                      systems: draft.systems,
                      readyToLearnNew: draft.readyToLearnNew,
                      openToAnySystem: draft.openToAnySystem,
                    }}
                    showValidationError={systemsValidationAttempted}
                    onChange={(systems) => setDraft((current) => ({ ...current, ...systems }))}
                  />
                ) : (
                  <FinalStep
                    draft={draft}
                    isSaving={isSaving || isDeleting}
                    onContinue={handleContinue}
                    onEdit={handleEdit}
                    onDelete={handleDeletePress}
                  />
                )}
              </QuestionnaireLayout>
            </View>
          </View>
        </ScrollView>

        {!isFinalStep ? (
          <View
            // @ts-expect-error RN Web className
            className="questionnaire-column"
            style={[styles.stickyFooter, columnStyle]}>
            <QuestionnaireFooterActions
              continueLabel={continueLabel}
              saveExitLabel={QUESTIONNAIRE_SAVE_EXIT_LABEL}
              savingLabel={QUESTIONNAIRE_SAVING_LABEL}
              isSaving={isSaving || isDeleting}
              canSave={canSaveCurrentStep}
              onContinue={handleContinue}
              onSaveExit={handleSaveExit}
            />
          </View>
        ) : null}
      </View>

      <UnsavedChangesDialog
        visible={isExitPromptVisible}
        title={QUESTIONNAIRE_UNSAVED_TITLE}
        message={QUESTIONNAIRE_UNSAVED_MESSAGE}
        saveLabel={QUESTIONNAIRE_UNSAVED_SAVE_LABEL}
        discardLabel={QUESTIONNAIRE_UNSAVED_DISCARD_LABEL}
        cancelLabel={QUESTIONNAIRE_UNSAVED_CANCEL_LABEL}
        isSaving={isSaving}
        onSave={handleExitPromptSave}
        onDiscard={handleExitPromptDiscard}
        onCancel={handleExitPromptCancel}
      />

      <DeleteQuestionnaireDialog
        visible={isDeleteDialogVisible}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </ScreenTransition>
  );
}
