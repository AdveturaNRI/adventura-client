import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { DiceRollPayload } from '@/utils/chat-dice-roll';

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
    dieFaceText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    dieFaceTextMine: {
      color: colors.onPrimary,
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
  const rollLabel = mine ? 'Ваш бросок' : 'Бросок';
  const badgeIconColor = mine ? colors.onPrimary : colors.primary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.badge, mine ? styles.badgeMine : null]}>
          <Ionicons name="dice-outline" size={12} color={badgeIconColor} />
          <Text style={[styles.badgeText, mine ? styles.badgeTextMine : null]}>{rollLabel}</Text>
        </View>
        {payload.hidden ? (
          <View style={[styles.badge, mine ? styles.badgeMine : null]}>
            <Ionicons name="eye-off-outline" size={12} color={badgeIconColor} />
            <Text style={[styles.badgeText, mine ? styles.badgeTextMine : null]}>Скрытый</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.formula, mine ? styles.formulaMine : null]}>{payload.formula}</Text>

      {redacted ? (
        <View style={styles.hiddenBox}>
          <Text style={[styles.hiddenTitle, mine ? styles.hiddenTitleMine : null]}>
            Результат скрыт
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.groups}>
            {payload.groups.map((group) => (
              <View key={`${group.sides}-${group.values.join(',')}`} style={styles.groupRow}>
                <Text style={[styles.groupLabel, mine ? styles.groupLabelMine : null]}>
                  d{group.sides}
                </Text>
                {group.values.map((value, index) => (
                  <View
                    key={`${group.sides}-${index}-${value}`}
                    style={[styles.dieFace, mine ? styles.dieFaceMine : null]}>
                    <Text style={[styles.dieFaceText, mine ? styles.dieFaceTextMine : null]}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {payload.modifier !== 0 ? (
            <Text style={[styles.modLine, mine ? styles.modLineMine : null]}>
              Модификатор {payload.modifier > 0 ? `+${payload.modifier}` : payload.modifier}
            </Text>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, mine ? styles.totalLabelMine : null]}>Итого</Text>
            <Text style={[styles.totalValue, mine ? styles.totalValueMine : null]}>
              {payload.sum ?? '—'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
