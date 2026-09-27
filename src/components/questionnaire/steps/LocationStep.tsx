import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type ScrollView } from 'react-native';

import { CitySearchField } from '@/components/questionnaire/CitySearchField';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import {
  QUESTIONNAIRE_PANEL_ERROR_STYLE,
  QuestionnaireRequiredCallout,
} from '@/components/questionnaire/QuestionnaireRequiredCallout';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useQuestionnaireFieldFocus } from '@/hooks/use-questionnaire-field-focus';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LOCATION_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import {
  isLocationStepValid,
  MAX_QUESTIONNAIRE_CITIES,
} from '@/screens/questionnaire/questionnaire-validation';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';
import { scheduleScrollAttempts, scrollScrollViewToChild } from '@/utils/scroll-scrollview-to-child';

const STACK_CITY_CONTROLS_MAX_WIDTH = 720;

type LocationStepProps = {
  value: Pick<QuestionnaireDraft, 'cities' | 'playsOnline'>;
  onChange: (value: Pick<QuestionnaireDraft, 'cities' | 'playsOnline'>) => void;
  showValidationError?: boolean;
  validationScrollKey?: number;
  focusField?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  onFocusScrollComplete?: () => void;
};

function createStyles(colors: ThemeColors, stackCityControls: boolean) {
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
      // Safari сбрасывает nested scroll, если absolute-дропдаун городов
      // оказывается внутри overflow:hidden предка.
      overflow: 'visible',
    },
    panelError: {
      ...QUESTIONNAIRE_PANEL_ERROR_STYLE,
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
  });
}

export function LocationStep({
  value,
  onChange,
  showValidationError = false,
  validationScrollKey = 0,
  focusField = false,
  scrollRef,
  onFocusScrollComplete,
}: LocationStepProps) {
  const screenStyles = useQuestionnaireScreenStyles();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const stackCityControls = width <= STACK_CITY_CONTROLS_MAX_WIDTH;
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, stackCityControls),
  );
  const panelRef = useRef<View>(null);
  const [focusCity, setFocusCity] = useState(false);
  const isValid = isLocationStepValid(value);
  const showError = showValidationError && !isValid;

  useEffect(() => {
    if (!showError || validationScrollKey <= 0 || !scrollRef?.current || !panelRef.current) {
      return;
    }

    return scheduleScrollAttempts(() =>
      scrollScrollViewToChild(scrollRef.current, panelRef.current, 20),
    );
  }, [scrollRef, showError, validationScrollKey]);

  useQuestionnaireFieldFocus({
    active: focusField,
    scroll: () => {
      if (!scrollRef?.current || !panelRef.current) {
        return false;
      }

      return scrollScrollViewToChild(scrollRef.current, panelRef.current, 20, true);
    },
    onReady: () => {
      setFocusCity(true);
    },
    onComplete: onFocusScrollComplete,
  });

  return (
    <View style={screenStyles.stepBody}>
      <View>
        <Text style={screenStyles.title}>{LOCATION_STEP.title}</Text>
        <Text style={screenStyles.subtitle}>{LOCATION_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{LOCATION_STEP.hint}</QuestionnaireHint>

      <View
        ref={panelRef}
        collapsable={false}
        style={[styles.panel, showError ? styles.panelError : null]}>
        {showError ? (
          <QuestionnaireRequiredCallout />
        ) : null}
        <View style={styles.panelHeader}>
          <View style={styles.panelIconWrap}>
            <Ionicons name="location-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.panelHeaderText}>
            <Text style={styles.panelTitle}>{LOCATION_STEP.cityLabel}</Text>
            <Text style={styles.panelSubtitle}>
              Добавьте до {MAX_QUESTIONNAIRE_CITIES} городов
            </Text>
          </View>
        </View>

        <View style={styles.cityRow}>
          <View style={styles.cityField}>
            <CitySearchField
              multiple
              label=""
              placeholder={LOCATION_STEP.cityPlaceholder}
              values={value.cities}
              maxSelections={MAX_QUESTIONNAIRE_CITIES}
              limitHint={LOCATION_STEP.cityLimitHint}
              addLabel={LOCATION_STEP.addCityLabel}
              autoFocus={focusCity}
              onChange={(cities) => onChange({ ...value, cities })}
            />
          </View>

          <Pressable
            onPress={() => onChange({ ...value, playsOnline: !value.playsOnline })}
            style={({ pressed }) => [
              styles.onlineToggle,
              value.playsOnline ? styles.onlineToggleActive : null,
              pressed ? styles.onlineTogglePressed : null,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.playsOnline }}>
            <Ionicons
              name={value.playsOnline ? 'checkbox' : 'square-outline'}
              size={18}
              color={value.playsOnline ? colors.onPrimary : colors.textMuted}
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
      </View>
    </View>
  );
}
