import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  QUESTIONNAIRE_REQUIRED_FIELDS_HINT,
  type QuestionnaireCompletion,
} from '@/utils/questionnaire-completion';

type QuestionnaireVisibilityNoticeProps = {
  completion: QuestionnaireCompletion;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    textBlock: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    title: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.label * 1.35,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    chip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    chipOk: {
      borderColor: colors.primaryLight,
    },
    chipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextOk: {
      color: colors.primary,
    },
    missingBox: {
      gap: 2,
      paddingTop: Spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    missingTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    missingItem: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    requiredHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

export function QuestionnaireVisibilityNotice({
  completion,
}: QuestionnaireVisibilityNoticeProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconName = completion.isVisibleInFeed
    ? 'eye-outline'
    : completion.isComplete
      ? 'lock-closed-outline'
      : 'alert-circle-outline';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={18} color={colors.primary} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{completion.visibilityLabel}</Text>
          <Text style={styles.subtitle}>{completion.visibilityHint}</Text>
        </View>
      </View>

      <View style={styles.chips}>
        <View style={[styles.chip, completion.isComplete && styles.chipOk]}>
          <Text style={[styles.chipText, completion.isComplete && styles.chipTextOk]}>
            {completion.isComplete ? 'Заполнена' : `Заполнена на ${completion.percent}%`}
          </Text>
        </View>
        <View style={[styles.chip, completion.isPublic && styles.chipOk]}>
          <Text style={[styles.chipText, completion.isPublic && styles.chipTextOk]}>
            {completion.isPublic ? 'Публичная' : 'Приватная'}
          </Text>
        </View>
        <View style={[styles.chip, completion.isVisibleInFeed && styles.chipOk]}>
          <Text style={[styles.chipText, completion.isVisibleInFeed && styles.chipTextOk]}>
            {completion.isVisibleInFeed ? 'В Странниках' : 'Не в ленте'}
          </Text>
        </View>
      </View>

      {completion.missingFields.length > 0 ? (
        <View style={styles.missingBox}>
          <Text style={styles.missingTitle}>Чтобы анкету увидели, заполните:</Text>
          {completion.missingFields.map((field) => (
            <Text key={field} style={styles.missingItem}>
              · {field}
            </Text>
          ))}
          <Text style={styles.requiredHint}>{QUESTIONNAIRE_REQUIRED_FIELDS_HINT}</Text>
        </View>
      ) : !completion.isPublic ? (
        <View style={styles.missingBox}>
          <Text style={styles.missingItem}>
            Включите «Публичная» на шаге «Профиль», чтобы анкета появилась в ленте.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
