import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AvailabilityPicker } from '@/components/questionnaire/AvailabilityPicker';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { TimezoneField } from '@/components/questionnaire/TimezoneField';
import { SelectField } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { EXPERIENCE_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import {
  EXPERIENCE_STEP_VALIDATION_MESSAGE,
  isExperienceStepValid,
} from '@/screens/questionnaire/questionnaire-validation';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';
import { fetchExperienceTypes } from '@/services/reference/referenceApi';

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
}: ExperienceStepProps) {
  const screenStyles = useQuestionnaireScreenStyles();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [experienceOptions, setExperienceOptions] = useState<{ id: string; label: string }[]>([]);
  const isValid = isExperienceStepValid(value);
  const showError = showValidationError && !isValid;

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

  return (
    <View style={screenStyles.stepBody}>
      <View>
        <Text style={screenStyles.title}>{EXPERIENCE_STEP.title}</Text>
        <Text style={screenStyles.subtitle}>{EXPERIENCE_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{EXPERIENCE_STEP.hint}</QuestionnaireHint>

      <View style={styles.panels}>
        <View style={styles.panel}>
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
            onChange={(experienceTypeId) => {
              const experienceTypeLabel =
                experienceOptions.find((option) => option.id === experienceTypeId)?.label ?? '';

              onChange({ ...value, experienceTypeId, experienceTypeLabel });
            }}
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIconWrap}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.panelHeaderText}>
              <Text style={styles.panelTitle}>{EXPERIENCE_STEP.availabilityPanelTitle}</Text>
              <Text style={styles.panelSubtitle}>{EXPERIENCE_STEP.availabilityPanelSubtitle}</Text>
            </View>
          </View>

          <TimezoneField
            label={EXPERIENCE_STEP.timezoneLabel}
            labelHint={EXPERIENCE_STEP.timezoneLabelHint}
            placeholder={EXPERIENCE_STEP.timezonePlaceholder}
            value={value.timezone}
            onChange={(timezone) => onChange({ ...value, timezone })}
            error={showError ? EXPERIENCE_STEP_VALIDATION_MESSAGE : undefined}
          />
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
