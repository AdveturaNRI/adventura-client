import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  DICE_CRIT_FAIL_LABEL,
  DICE_CRIT_SUCCESS_LABEL,
  collectD20Values,
  diceFaceMark,
  diceRollCritLabels,
  diceRollModeLabel,
  keptDiceValue,
  type DiceRollPayload,
} from '@/utils/chat-dice-roll';

type ChatDiceBubbleProps = {
  payload: DiceRollPayload;
  mine?: boolean;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      minWidth: 180,
      maxWidth: 280,
      gap: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: 'rgba(21, 122, 254, 0.14)',
    },
    badgeMine: {
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    badgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    badgeTextMine: {
      color: colors.onPrimary,
    },
    badgeCritFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.16)',
    },
    badgeCritFailMine: {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    badgeCritFailText: {
      color: colors.destructive,
    },
    badgeCritFailTextMine: {
      color: '#FFD1CE',
    },
    badgeCritSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.16)',
    },
    badgeCritSuccessMine: {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    badgeCritSuccessText: {
      color: colors.success,
    },
    badgeCritSuccessTextMine: {
      color: '#C8F5D2',
    },
    formula: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    formulaMine: {
      color: colors.onPrimary,
    },
    groups: {
      gap: 6,
    },
    groupRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 4,
    },
    groupLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
      marginRight: 2,
    },
    groupLabelMine: {
      color: 'rgba(255,255,255,0.9)',
    },
    dieFace: {
      minWidth: 24,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      alignItems: 'center',
    },
    dieFaceMine: {
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    dieFaceCritFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.18)',
    },
    dieFaceCritFailMine: {
      backgroundColor: 'rgba(255, 59, 48, 0.42)',
    },
    dieFaceCritSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.18)',
    },
    dieFaceCritSuccessMine: {
      backgroundColor: 'rgba(52, 199, 89, 0.42)',
    },
    dieFaceText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    dieFaceTextMine: {
      color: colors.onPrimary,
    },
    dieFaceTextCritFail: {
      color: colors.destructive,
    },
    dieFaceTextCritFailMine: {
      color: '#FFFFFF',
    },
    dieFaceTextCritSuccess: {
      color: colors.success,
    },
    dieFaceTextCritSuccessMine: {
      color: '#FFFFFF',
    },
    dieFaceKept: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dieFaceKeptMine: {
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.85)',
    },
    dieFaceDiscarded: {
      opacity: 0.42,
    },
    dieFaceDiscardedMine: {
      opacity: 0.5,
    },
    modLine: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
    },
    modLineMine: {
      color: 'rgba(255,255,255,0.78)',
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: 2,
    },
    totalLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    totalLabelMine: {
      color: 'rgba(255,255,255,0.78)',
    },
    totalValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.5,
    },
    totalValueMine: {
      color: colors.onPrimary,
    },
    totalValueCritFail: {
      color: colors.destructive,
    },
    totalValueCritFailMine: {
      color: '#FFD1CE',
    },
    totalValueCritSuccess: {
      color: colors.success,
    },
    totalValueCritSuccessMine: {
      color: '#C8F5D2',
    },
    hiddenBox: {
      paddingVertical: Spacing.sm,
    },
    hiddenTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primary,
    },
    hiddenTitleMine: {
      color: colors.onPrimary,
    },
  });
}

export function ChatDiceBubble({ payload, mine }: ChatDiceBubbleProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const redacted = payload.hidden && (payload.redacted || payload.sum == null);
  const keepMode = payload.mode === 'advantage' || payload.mode === 'disadvantage';
  const rollLabel = keepMode
    ? (diceRollModeLabel(payload.mode) ?? (mine ? 'Ваш бросок' : 'Бросок'))
    : mine
      ? 'Ваш бросок'
      : 'Бросок';
  const badgeIconColor = mine ? colors.onPrimary : colors.primary;
  const critLabels = redacted
    ? []
    : diceRollCritLabels(payload.groups, payload.mode, payload.modifier);
  const keptValue = keepMode
    ? keptDiceValue(collectD20Values(payload.groups), payload.mode)
    : null;
  const singleDie =
    !redacted &&
    payload.groups.length === 1 &&
    payload.groups[0]?.values.length === 1
      ? payload.groups[0]
      : null;
  const singleMark = singleDie
    ? diceFaceMark(singleDie.sides, singleDie.values[0] ?? 0, payload.modifier)
    : keptValue != null
      ? diceFaceMark(20, keptValue, payload.modifier)
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.badge, mine ? styles.badgeMine : null]}>
          <Ionicons name="dice-outline" size={12} color={badgeIconColor} />
          <Text selectable={false} style={[styles.badgeText, mine ? styles.badgeTextMine : null]}>
            {rollLabel}
          </Text>
        </View>
        {payload.hidden ? (
          <View style={[styles.badge, mine ? styles.badgeMine : null]}>
            <Ionicons name="eye-off-outline" size={12} color={badgeIconColor} />
            <Text selectable={false} style={[styles.badgeText, mine ? styles.badgeTextMine : null]}>
              Скрытый
            </Text>
          </View>
        ) : null}
        {critLabels.includes(DICE_CRIT_FAIL_LABEL) ? (
          <View
            style={[
              styles.badge,
              styles.badgeCritFail,
              mine ? styles.badgeCritFailMine : null,
            ]}>
            <Text
              selectable={false}
              style={[
                styles.badgeText,
                styles.badgeCritFailText,
                mine ? styles.badgeCritFailTextMine : null,
              ]}>
              {DICE_CRIT_FAIL_LABEL}
            </Text>
          </View>
        ) : null}
        {critLabels.includes(DICE_CRIT_SUCCESS_LABEL) ? (
          <View
            style={[
              styles.badge,
              styles.badgeCritSuccess,
              mine ? styles.badgeCritSuccessMine : null,
            ]}>
            <Text
              selectable={false}
              style={[
                styles.badgeText,
                styles.badgeCritSuccessText,
                mine ? styles.badgeCritSuccessTextMine : null,
              ]}>
              {DICE_CRIT_SUCCESS_LABEL}
            </Text>
          </View>
        ) : null}
      </View>

      <Text selectable={false} style={[styles.formula, mine ? styles.formulaMine : null]}>
        {payload.formula}
      </Text>

      {redacted ? (
        <View style={styles.hiddenBox}>
          <Text selectable={false} style={[styles.hiddenTitle, mine ? styles.hiddenTitleMine : null]}>
            Результат скрыт
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.groups}>
            {payload.groups.map((group, groupIndex) => (
              <View key={`group-${groupIndex}-${group.sides}`} style={styles.groupRow}>
                <Text
                  selectable={false}
                  style={[styles.groupLabel, mine ? styles.groupLabelMine : null]}>
                  d{group.sides}
                </Text>
                {group.values.map((value, index) => {
                  const mark = diceFaceMark(group.sides, value, payload.modifier);
                  const isKeepGroup = keepMode && group.sides === 20 && keptValue != null;
                  const keptIndex =
                    isKeepGroup && keptValue != null
                      ? group.values.indexOf(keptValue)
                      : -1;
                  const keptHighlight = isKeepGroup && index === keptIndex;
                  const discardedHighlight = isKeepGroup && index !== keptIndex;
                  const showCrit = !isKeepGroup || keptHighlight;
                  return (
                    <View
                      key={`face-${groupIndex}-${index}`}
                      style={[
                        styles.dieFace,
                        mine ? styles.dieFaceMine : null,
                        mark === 'crit_fail' && showCrit
                          ? mine
                            ? styles.dieFaceCritFailMine
                            : styles.dieFaceCritFail
                          : null,
                        mark === 'crit_success' && showCrit
                          ? mine
                            ? styles.dieFaceCritSuccessMine
                            : styles.dieFaceCritSuccess
                          : null,
                        keptHighlight
                          ? mine
                            ? styles.dieFaceKeptMine
                            : styles.dieFaceKept
                          : null,
                        discardedHighlight
                          ? mine
                            ? styles.dieFaceDiscardedMine
                            : styles.dieFaceDiscarded
                          : null,
                      ]}>
                      <Text
                        selectable={false}
                        style={[
                          styles.dieFaceText,
                          mine ? styles.dieFaceTextMine : null,
                          mark === 'crit_fail' && showCrit
                            ? mine
                              ? styles.dieFaceTextCritFailMine
                              : styles.dieFaceTextCritFail
                            : null,
                          mark === 'crit_success' && showCrit
                            ? mine
                              ? styles.dieFaceTextCritSuccessMine
                              : styles.dieFaceTextCritSuccess
                            : null,
                        ]}>
                        {value}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {payload.modifier !== 0 ? (
            <Text selectable={false} style={[styles.modLine, mine ? styles.modLineMine : null]}>
              Модификатор {payload.modifier > 0 ? `+${payload.modifier}` : payload.modifier}
            </Text>
          ) : null}

          <View style={styles.totalRow}>
            <Text selectable={false} style={[styles.totalLabel, mine ? styles.totalLabelMine : null]}>
              Итого
            </Text>
            <Text
              selectable={false}
              style={[
                styles.totalValue,
                mine ? styles.totalValueMine : null,
                singleMark === 'crit_fail'
                  ? mine
                    ? styles.totalValueCritFailMine
                    : styles.totalValueCritFail
                  : null,
                singleMark === 'crit_success'
                  ? mine
                    ? styles.totalValueCritSuccessMine
                    : styles.totalValueCritSuccess
                  : null,
              ]}>
              {payload.sum ?? '—'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
