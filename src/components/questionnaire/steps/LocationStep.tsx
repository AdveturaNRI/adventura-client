import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CitySearchField } from '@/components/questionnaire/CitySearchField';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LOCATION_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import {
  isLocationStepValid,
  LOCATION_STEP_VALIDATION_MESSAGE,
} from '@/screens/questionnaire/questionnaire-validation';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';

const STACK_CITY_CONTROLS_MAX_WIDTH = 720;
const CITY_SWITCHER_OFFSET = Sizes.controlHeight + Spacing.md;

type LocationStepProps = {
  value: Pick<QuestionnaireDraft, 'cityId' | 'cityLabel' | 'playsOnline'>;
  onChange: (value: Pick<QuestionnaireDraft, 'cityId' | 'cityLabel' | 'playsOnline'>) => void;
  showValidationError?: boolean;
};

function createStyles(
  colors: ThemeColors,
  stackCityControls: boolean,
) {
  return StyleSheet.create({
    panel: {
      gap: Spacing.md,
      padding: Spacing.lg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      width: '100%',
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
    cityRow: {
      flexDirection: stackCityControls ? 'column' : 'row',
      alignItems: stackCityControls ? 'stretch' : 'flex-start',
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
    },
    cityField: {
      flex: 1,
      minWidth: 0,
      width: '100%',
      maxWidth: '100%',
    },
    onlineToggle: {
      minHeight: Sizes.controlHeight,
      marginTop: stackCityControls ? 0 : CITY_SWITCHER_OFFSET,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      alignSelf: stackCityControls ? 'flex-start' : undefined,
      flexShrink: 0,
      maxWidth: '100%',
    },
    onlineToggleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    onlineTogglePressed: {
      opacity: 0.9,
    },
    onlineToggleText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    onlineToggleTextActive: {
      color: colors.onPrimary,
    },
    onlineToggleRequired: {
      borderColor: colors.destructive,
    },
    onlineToggleHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    onlineToggleHintRequired: {
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

export function LocationStep({ value, onChange, showValidationError = false }: LocationStepProps) {
  const screenStyles = useQuestionnaireScreenStyles();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const stackCityControls = width <= STACK_CITY_CONTROLS_MAX_WIDTH;
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, stackCityControls),
  );
  const isValid = isLocationStepValid(value);
  const showError = showValidationError && !isValid;
  const isOnlineRequired = !value.cityId;

  return (
    <View style={screenStyles.stepBody}>
      <View>
        <Text style={screenStyles.title}>{LOCATION_STEP.title}</Text>
        <Text style={screenStyles.subtitle}>{LOCATION_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{LOCATION_STEP.hint}</QuestionnaireHint>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelIconWrap}>
            <Ionicons name="location-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.panelHeaderText}>
            <Text style={styles.panelTitle}>{LOCATION_STEP.cityLabel}</Text>
            <Text style={styles.panelSubtitle}>Выберите страну и начните вводить название</Text>
          </View>
        </View>

        <View style={styles.cityRow}>
          <View style={styles.cityField}>
            <CitySearchField
              label=""
              placeholder={LOCATION_STEP.cityPlaceholder}
              value={value.cityId}
              selectedLabel={value.cityLabel || LOCATION_STEP.cityEmptyHint}
              onChange={(cityId, cityLabel) => onChange({ ...value, cityId, cityLabel })}
            />
          </View>

          <Pressable
            onPress={() => onChange({ ...value, playsOnline: !value.playsOnline })}
            style={({ pressed }) => [
              styles.onlineToggle,
              value.playsOnline ? styles.onlineToggleActive : null,
              showError ? styles.onlineToggleRequired : null,
              pressed ? styles.onlineTogglePressed : null,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.playsOnline }}>
            <Ionicons
              name={value.playsOnline ? 'checkbox' : 'square-outline'}
              size={18}
              color={
                value.playsOnline
                  ? colors.onPrimary
                  : showError
                    ? colors.destructive
                    : colors.textMuted
              }
            />
            <Text
              style={[
                styles.onlineToggleText,
                value.playsOnline ? styles.onlineToggleTextActive : null,
              ]}>
              {LOCATION_STEP.playsOnlineLabel}
            </Text>
          </Pressable>
        </View>

        {isOnlineRequired ? (
          <Text
            style={[
              styles.onlineToggleHint,
              showError ? styles.onlineToggleHintRequired : null,
            ]}>
            {LOCATION_STEP.playsOnlineRequiredHint}
          </Text>
        ) : null}

        {showError ? (
          <Text style={styles.validationError}>{LOCATION_STEP_VALIDATION_MESSAGE}</Text>
        ) : null}
      </View>
    </View>
  );
}
