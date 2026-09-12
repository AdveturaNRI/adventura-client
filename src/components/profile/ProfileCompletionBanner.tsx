import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, ProgressCircle } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { QUESTIONNAIRE_ENTRY } from '@/screens/questionnaire/questionnaire.config';
import {
  QUESTIONNAIRE_REQUIRED_FIELDS_HINT,
  type QuestionnaireCompletion,
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
      borderColor: colors.primaryLight,
      backgroundColor: colors.surfaceMuted,
    },
    statusChipWarn: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    statusChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
    },
    statusChipTextOk: {
      color: colors.primary,
    },
    statusChipTextWarn: {
      color: colors.textSecondary,
    },
    hintBox: {
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    hintTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.caption * 1.4,
    },
    hintText: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    missingList: {
      gap: 2,
    },
    missingItem: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
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

  const handleEdit = () => {
    if (completion.isComplete) {
      router.push({ pathname: QUESTIONNAIRE_ENTRY, params: { edit: '1' } });
      return;
    }

    router.push(QUESTIONNAIRE_ENTRY);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handleEdit}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <ProgressCircle value={completion.percent} />

        <View style={styles.textBlock}>
          <Text style={styles.title}>{completion.title}</Text>
          <Text style={styles.subtitle}>{completion.subtitle}</Text>
        </View>

        <Badge
          label="Изменить"
          variant="outline"
          onPress={handleEdit}
          style={styles.editBadge}
        />
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusChip,
            completion.isComplete ? styles.statusChipOk : styles.statusChipWarn,
          ]}>
          <Ionicons
            name={completion.isComplete ? 'checkmark-circle' : 'alert-circle-outline'}
            size={14}
            color={completion.isComplete ? colors.primary : colors.textMuted}
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
            completion.isVisibleInFeed ? styles.statusChipOk : styles.statusChipWarn,
          ]}>
          <Ionicons
            name={completion.isVisibleInFeed ? 'eye-outline' : 'eye-off-outline'}
            size={14}
            color={completion.isVisibleInFeed ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.statusChipText,
              completion.isVisibleInFeed ? styles.statusChipTextOk : styles.statusChipTextWarn,
            ]}>
            {completion.isVisibleInFeed ? 'В ленте' : 'Не в ленте'}
          </Text>
        </View>

        <View
          style={[
            styles.statusChip,
            completion.isPublic ? styles.statusChipOk : styles.statusChipWarn,
          ]}>
          <Ionicons
            name={completion.isPublic ? 'globe-outline' : 'lock-closed-outline'}
            size={14}
            color={completion.isPublic ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.statusChipText,
              completion.isPublic ? styles.statusChipTextOk : styles.statusChipTextWarn,
            ]}>
            {completion.isPublic ? 'Публичная' : 'Приватная'}
          </Text>
        </View>
      </View>

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>{completion.visibilityLabel}</Text>
        <Text style={styles.hintText}>{completion.visibilityHint}</Text>

        {completion.missingFields.length > 0 ? (
          <View style={styles.missingList}>
            <Text style={styles.hintText}>Осталось заполнить:</Text>
            {completion.missingFields.map((field) => (
              <Text key={field} style={styles.missingItem}>
                · {field}
              </Text>
            ))}
          </View>
        ) : null}

        {!completion.isComplete ? (
          <Text style={styles.hintText}>{QUESTIONNAIRE_REQUIRED_FIELDS_HINT}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
