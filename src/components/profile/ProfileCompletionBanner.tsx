import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, ProgressCircle, toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { QUESTIONNAIRE_ENTRY } from '@/screens/questionnaire/questionnaire.config';
import {
  QUESTIONNAIRE_REQUIRED_FIELDS_HINT,
  type QuestionnaireCompletion,
  type QuestionnaireMissingField,
} from '@/utils/questionnaire-completion';

type ProfileCompletionBannerProps = {
  completion: QuestionnaireCompletion;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    textBlock: {
      flex: 1,
      gap: 2,
      minWidth: 0,
      paddingRight: Spacing.xs,
    },
    title: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      lineHeight: FontSize.label * 1.35,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    editBadge: {
      flexShrink: 0,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusChipOk: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    statusChipWarn: {
      borderColor: 'rgba(255, 59, 48, 0.42)',
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
    },
    statusChipIdle: {
      borderColor: 'rgba(21, 122, 254, 0.22)',
      backgroundColor: 'rgba(21, 122, 254, 0.04)',
    },
    statusChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
    },
    statusChipTextOk: {
      color: colors.primary,
    },
    statusChipTextWarn: {
      color: colors.destructive,
    },
    statusChipTextIdle: {
      color: colors.primary,
    },
    hintBox: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    hintBoxMissing: {
      backgroundColor: 'rgba(255, 59, 48, 0.07)',
      borderColor: 'rgba(255, 59, 48, 0.32)',
    },
    missingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    missingIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
      flexShrink: 0,
    },
    hintTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.caption * 1.4,
    },
    hintTitleMissing: {
      color: colors.destructive,
    },
    hintText: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    missingList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    missingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 7,
      paddingLeft: Spacing.sm,
      paddingRight: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.34)',
      backgroundColor: colors.surface,
    },
    missingChipPressed: {
      opacity: 0.88,
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    missingChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.destructive,
      lineHeight: FontSize.caption * 1.3,
    },
    pressed: {
      opacity: 0.92,
    },
  });
}

export function ProfileCompletionBanner({ completion }: ProfileCompletionBannerProps) {
  const router = useRouter();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasMissing = completion.missingFields.length > 0;

  const openQuestionnaire = (focus?: string) => {
    if (focus) {
      router.push({
        pathname: QUESTIONNAIRE_ENTRY,
        params: { focus },
      });
      return;
    }

    if (completion.isComplete) {
      router.push({ pathname: QUESTIONNAIRE_ENTRY, params: { edit: '1' } });
      return;
    }

    const firstMissing = completion.missingFields[0];
    if (firstMissing) {
      toast.warning(`Сначала заполните: ${firstMissing.label}`);
      router.push({
        pathname: QUESTIONNAIRE_ENTRY,
        params: { focus: firstMissing.focus },
      });
      return;
    }

    router.push(QUESTIONNAIRE_ENTRY);
  };

  const handleFieldPress = (_field: QuestionnaireMissingField) => {
    // Always start from the earliest missing required field in questionnaire order.
    openQuestionnaire();
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => openQuestionnaire()}
        style={({ pressed }) => [styles.topRow, pressed && styles.pressed]}>
        <ProgressCircle value={completion.percent} />

        <View style={styles.textBlock}>
          <Text style={styles.title}>{completion.title}</Text>
          <Text style={styles.subtitle}>{completion.subtitle}</Text>
        </View>

        <Badge
          label="Изменить"
          variant="outline"
          onPress={() => openQuestionnaire()}
          style={styles.editBadge}
        />
      </Pressable>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusChip,
            completion.isComplete ? styles.statusChipOk : styles.statusChipWarn,
          ]}>
          <Ionicons
            name={completion.isComplete ? 'checkmark-circle' : 'alert-circle'}
            size={14}
            color={completion.isComplete ? colors.primary : colors.destructive}
          />
          <Text
            style={[
              styles.statusChipText,
              completion.isComplete ? styles.statusChipTextOk : styles.statusChipTextWarn,
            ]}>
            {completion.isComplete ? 'Заполнена' : 'Не заполнена'}
          </Text>
        </View>

        <View
          style={[
            styles.statusChip,
            completion.isVisibleInFeed ? styles.statusChipOk : styles.statusChipIdle,
          ]}>
          <Ionicons
            name={completion.isVisibleInFeed ? 'eye-outline' : 'eye-off-outline'}
            size={14}
            color={colors.primary}
          />
          <Text
            style={[
              styles.statusChipText,
              completion.isVisibleInFeed ? styles.statusChipTextOk : styles.statusChipTextIdle,
            ]}>
            {completion.isVisibleInFeed ? 'В ленте' : 'Не в ленте'}
          </Text>
        </View>

        <View
          style={[
            styles.statusChip,
            completion.isPublic ? styles.statusChipOk : styles.statusChipIdle,
          ]}>
          <Ionicons
            name={completion.isPublic ? 'globe-outline' : 'lock-closed-outline'}
            size={14}
            color={colors.primary}
          />
          <Text
            style={[
              styles.statusChipText,
              completion.isPublic ? styles.statusChipTextOk : styles.statusChipTextIdle,
            ]}>
            {completion.isPublic ? 'Публичная' : 'Приватная'}
          </Text>
        </View>
      </View>

      <View style={[styles.hintBox, hasMissing ? styles.hintBoxMissing : null]}>
        {hasMissing ? (
          <>
            <View style={styles.missingHeader}>
              <View style={styles.missingIconWrap}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              </View>
              <Text style={[styles.hintTitle, styles.hintTitleMissing]}>
                Осталось заполнить
              </Text>
            </View>
            <View style={styles.missingList}>
              {completion.missingFields.map((field) => (
                <Pressable
                  key={field.key}
                  accessibilityRole="button"
                  accessibilityLabel={
                    completion.missingFields[0]
                      ? `Перейти к полю: ${completion.missingFields[0].label}`
                      : `Перейти к полю: ${field.label}`
                  }
                  hitSlop={4}
                  onPress={() => handleFieldPress(field)}
                  style={({ pressed }) => [
                    styles.missingChip,
                    pressed && styles.missingChipPressed,
                  ]}>
                  <Text style={styles.missingChipText}>{field.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.destructive} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hintTitle}>{completion.visibilityLabel}</Text>
            <Text style={styles.hintText}>{completion.visibilityHint}</Text>
          </>
        )}

        {!completion.isComplete && !hasMissing ? (
          <Text style={styles.hintText}>{QUESTIONNAIRE_REQUIRED_FIELDS_HINT}</Text>
        ) : null}
      </View>
    </View>
  );
}
