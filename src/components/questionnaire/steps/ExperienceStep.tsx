import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View, type ScrollView } from 'react-native';

import { AvailabilityPicker } from '@/components/questionnaire/AvailabilityPicker';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { TimezoneField } from '@/components/questionnaire/TimezoneField';
import { SelectField } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useQuestionnaireFieldFocus } from '@/hooks/use-questionnaire-field-focus';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { EXPERIENCE_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { isExperienceStepValid } from '@/screens/questionnaire/questionnaire-validation';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';
import { fetchExperienceTypes } from '@/services/reference/referenceApi';
import { scheduleScrollAttempts, scrollScrollViewToChild } from '@/utils/scroll-scrollview-to-child';

type ExperienceStepProps = {
  value: Pick<
    QuestionnaireDraft,
    'experienceTypeId' | 'experienceTypeLabel' | 'availability' | 'timezone'
  >;
  onChange: (
    value: Pick<
      QuestionnaireDraft,
      'experienceTypeId' | 'experienceTypeLabel' | 'availability' | 'timezone'
    >,
  ) => void;
  showValidationError?: boolean;
  validationScrollKey?: number;
  focusField?: 'experience' | 'availability' | 'timezone' | null;
  scrollRef?: RefObject<ScrollView | null>;
  onFocusScrollComplete?: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panels: {
      gap: Spacing.md,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    panel: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      alignSelf: 'stretch',
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      width: '100%',
      minWidth: 0,
    },
    panelIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    panelHeaderText: {
      flex: 1,
      minWidth: 0,
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
    timezoneHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      marginTop: -4,
    },
  });
}

export function ExperienceStep({
  value,
  onChange,
  showValidationError = false,
  validationScrollKey = 0,
  focusField = null,
  scrollRef,
  onFocusScrollComplete,
}: ExperienceStepProps) {
  const screenStyles = useQuestionnaireScreenStyles();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const experiencePanelRef = useRef<View>(null);
  const availabilityPanelRef = useRef<View>(null);
  const timezoneFieldRef = useRef<View>(null);
  const pendingAvailabilityScrollRef = useRef(false);
  const [experienceOptions, setExperienceOptions] = useState<{ id: string; label: string }[]>([]);
  const [openedField, setOpenedField] = useState<'experience' | 'availability' | 'timezone' | null>(
    null,
  );
  const isValid = isExperienceStepValid(value);
  const showError = showValidationError && !isValid;

  const scrollToView = useCallback(
    (target: View | null, animated = true) => {
      if (!scrollRef?.current || !target) {
        return false;
      }

      return scrollScrollViewToChild(scrollRef.current, target, 20, animated);
    },
    [scrollRef],
  );

  const scrollToAvailability = useCallback(() => {
    return scrollToView(availabilityPanelRef.current);
  }, [scrollToView]);

  useEffect(() => {
    let isMounted = true;

    fetchExperienceTypes()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setExperienceOptions(items.map((item) => ({ id: item.id, label: item.name })));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setExperienceOptions([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showError || validationScrollKey <= 0) {
      return;
    }

    return scheduleScrollAttempts(() => scrollToAvailability());
  }, [scrollToAvailability, showError, validationScrollKey]);

  useQuestionnaireFieldFocus({
    active: Boolean(focusField),
    scroll: () => {
      const target =
        focusField === 'experience'
          ? experiencePanelRef.current
          : focusField === 'timezone'
            ? timezoneFieldRef.current ?? availabilityPanelRef.current
            : availabilityPanelRef.current;

      return scrollToView(target, true);
    },
    onReady: () => {
      if (focusField) {
        setOpenedField(focusField);
      }
    },
    onComplete: onFocusScrollComplete,
  });

  useEffect(() => {
    if (!pendingAvailabilityScrollRef.current) {
      return;
    }

    return scheduleScrollAttempts(() => {
      if (!pendingAvailabilityScrollRef.current) {
        return true;
      }

      if (!scrollToAvailability()) {
        return false;
      }

      pendingAvailabilityScrollRef.current = false;
      return true;
    });
  }, [scrollToAvailability, value.experienceTypeId]);

  return (
    <View style={screenStyles.stepBody}>
      <View>
        <Text style={screenStyles.title}>{EXPERIENCE_STEP.title}</Text>
        <Text style={screenStyles.subtitle}>{EXPERIENCE_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{EXPERIENCE_STEP.hint}</QuestionnaireHint>

      <View style={styles.panels}>
        <View ref={experiencePanelRef} collapsable={false} style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIconWrap}>
              <Ionicons name="stats-chart-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.panelHeaderText}>
              <Text style={styles.panelTitle}>{EXPERIENCE_STEP.experiencePanelTitle}</Text>
              <Text style={styles.panelSubtitle}>{EXPERIENCE_STEP.experiencePanelSubtitle}</Text>
            </View>
          </View>

          <SelectField
            label={EXPERIENCE_STEP.experienceLabel}
            placeholder={EXPERIENCE_STEP.experiencePlaceholder}
            value={value.experienceTypeId}
            options={experienceOptions}
            autoOpen={openedField === 'experience'}
            onChange={(experienceTypeId) => {
              const experienceTypeLabel =
                experienceOptions.find((option) => option.id === experienceTypeId)?.label ?? '';

              pendingAvailabilityScrollRef.current = true;
              onChange({ ...value, experienceTypeId, experienceTypeLabel });
            }}
          />
        </View>

        <View ref={availabilityPanelRef} collapsable={false} style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIconWrap}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.panelHeaderText}>
              <Text style={styles.panelTitle}>{EXPERIENCE_STEP.availabilityPanelTitle}</Text>
              <Text style={styles.panelSubtitle}>{EXPERIENCE_STEP.availabilityPanelSubtitle}</Text>
            </View>
          </View>

          <View ref={timezoneFieldRef} collapsable={false}>
            <TimezoneField
              label={EXPERIENCE_STEP.timezoneLabel}
              labelHint={EXPERIENCE_STEP.timezoneLabelHint}
              placeholder={EXPERIENCE_STEP.timezonePlaceholder}
              value={value.timezone}
              autoOpen={openedField === 'timezone'}
              onChange={(timezone) => onChange({ ...value, timezone })}
              error={showError ? 'Обязательное поле' : undefined}
            />
          </View>
          <Text style={styles.timezoneHint}>{EXPERIENCE_STEP.timezoneHint}</Text>

          <AvailabilityPicker
            value={value.availability}
            onChange={(availability) => onChange({ ...value, availability })}
          />
        </View>
      </View>
    </View>
  );
}
