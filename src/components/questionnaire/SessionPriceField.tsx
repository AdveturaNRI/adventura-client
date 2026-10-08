import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { ROLES_STEP } from '@/screens/questionnaire/questionnaire.config';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import type { SessionPriceKind } from '@/utils/questionnaire-payment';
import {
  formatSessionPriceInput,
  getPriceFieldsValidationMessage,
  isPriceFieldsFilled,
} from '@/utils/questionnaire-payment';

import { QuestionnaireChoiceChip } from './QuestionnaireChoiceChip';

type SessionPriceFieldProps = {
  kind: SessionPriceKind | null;
  min: string;
  max: string;
  onChange: (next: { kind: SessionPriceKind | null; min: string; max: string }) => void;
  title?: string;
  hint?: string;
  required?: boolean;
  showRequiredError?: boolean;
  requiredMessage?: string;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    root: {
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    controls: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      flexShrink: 0,
    },
    inputs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.sm,
      flexGrow: isDesktopWeb ? 0 : 1,
      flexShrink: 1,
      minWidth: isDesktopWeb ? undefined : '100%',
    },
    field: {
      flexGrow: isDesktopWeb ? 0 : 1,
      flexBasis: isDesktopWeb ? 148 : 120,
      width: isDesktopWeb ? 148 : undefined,
      minWidth: isDesktopWeb ? 132 : 108,
      maxWidth: isDesktopWeb ? 180 : '100%',
    },
    inputWrap: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    inputWrapError: {
      borderColor: colors.destructive,
    },
    input: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: 12,
      ...Platform.select({
        web: {
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        } as object,
        default: {},
      }),
    },
    suffix: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    divider: {
      fontSize: FontSize.button,
      color: colors.textMuted,
      paddingTop: 2,
    },
    error: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      lineHeight: FontSize.caption * 1.4,
    },
  });
}

export function SessionPriceField({
  kind,
  min,
  max,
  onChange,
  title = ROLES_STEP.sessionPriceTitle,
  hint = ROLES_STEP.sessionPriceHint,
  required = false,
  showRequiredError = false,
  requiredMessage = 'Укажите сумму',
}: SessionPriceFieldProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const formatError = getPriceFieldsValidationMessage({
    kind,
    min,
    max,
  });
  const missingRequired =
    required &&
    !isPriceFieldsFilled({
      kind,
      min,
      max,
    });
  const error =
    formatError ?? (showRequiredError && missingRequired ? requiredMessage : null);
  const highlightError = Boolean(error);

  const patchMin = (raw: string) => {
    const nextMin = formatSessionPriceInput(raw);
    onChange({
      kind: kind ?? 'fixed',
      min: nextMin,
      max: kind === 'range' ? max : '',
    });
  };

  const patchMax = (raw: string) => {
    const nextMax = formatSessionPriceInput(raw);
    onChange({
      kind: 'range',
      min,
      max: nextMax,
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <QuestionnaireHint>{hint}</QuestionnaireHint> : null}

      <View style={styles.controls}>
        <View style={styles.chips}>
          {ROLES_STEP.sessionPriceKinds.map((option) => (
            <QuestionnaireChoiceChip
              key={option.key}
              label={option.label}
              selected={kind === option.key}
              onPress={() =>
                onChange({
                  kind: kind === option.key ? null : option.key,
                  min,
                  max: option.key === 'range' ? max : '',
                })
              }
            />
          ))}
        </View>

        <View style={styles.inputs}>
          <View style={styles.field}>
            <View style={[styles.inputWrap, highlightError ? styles.inputWrapError : null]}>
              {kind === 'from' ? <Text style={styles.suffix}>от</Text> : null}
              <TextInput
                value={min}
                onChangeText={patchMin}
                keyboardType="number-pad"
                placeholder="1500"
                placeholderTextColor={colors.textSubtle}
                style={styles.input}
                maxLength={7}
              />
              <Text style={styles.suffix}>₽</Text>
            </View>
          </View>

          {kind === 'range' ? (
            <>
              <Text style={styles.divider}>–</Text>
              <View style={styles.field}>
                <View style={[styles.inputWrap, highlightError ? styles.inputWrapError : null]}>
                  <TextInput
                    value={max}
                    onChangeText={patchMax}
                    keyboardType="number-pad"
                    placeholder="2500"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    maxLength={7}
                  />
                  <Text style={styles.suffix}>₽</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
