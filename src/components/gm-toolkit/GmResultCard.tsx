import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  categoryLabel,
  type GeneratorCard,
} from '@/services/gm-toolkit';

type GmResultCardProps = {
  card: GeneratorCard;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.22)',
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    title: {
      flex: 1,
      minWidth: 120,
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chipGroup: {
      gap: 4,
      maxWidth: '100%',
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.24)',
      alignSelf: 'flex-start',
    },
    chipSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.14)',
      borderColor: 'rgba(52, 199, 89, 0.28)',
    },
    chipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    chipTextSuccess: {
      color: '#2F9E4F',
    },
    rows: {
      gap: 8,
    },
    row: {
      gap: 2,
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primaryLight,
    },
    value: {
      fontSize: FontSize.label,
      color: colors.text,
      lineHeight: FontSize.label * 1.4,
    },
  });
}

function Chip({
  label,
  success,
  styles,
}: {
  label: string;
  success?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.chip, success && styles.chipSuccess]}>
      <Text style={[styles.chipText, success && styles.chipTextSuccess]}>{label}</Text>
    </View>
  );
}

function LabeledChip({
  caption,
  label,
  success,
  styles,
}: {
  caption: string;
  label: string;
  success?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.label}>{caption}</Text>
      <Chip label={label} success={success} styles={styles} />
    </View>
  );
}

function Detail({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function GmResultCard({ card }: GmResultCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.topRow}>
        <Text style={styles.title}>{card.name}</Text>
        <Badge variant="outline" label={categoryLabel(card.category)} />
      </View>

      {card.category === 'npc' ? (
        <>
          <View style={styles.chips}>
            <LabeledChip caption="Раса" label={card.raceLabel} styles={styles} />
            <LabeledChip caption="Возраст" label={String(card.age)} styles={styles} />
            <LabeledChip caption="Профессия" label={card.occupation} success styles={styles} />
            <LabeledChip
              caption="Пол"
              label={card.gender === 'm' ? 'М' : 'Ж'}
              styles={styles}
            />
          </View>
          <View style={styles.rows}>
            <Detail label="Внешность" value={card.appearance} styles={styles} />
            <Detail label="Манера" value={card.mannerism} styles={styles} />
            <Detail label="Секрет" value={card.secret} styles={styles} />
            <Detail label="Цель" value={card.goal} styles={styles} />
          </View>
        </>
      ) : null}

      {card.category === 'tavern' ? (
        <>
          <View style={styles.chips}>
            <LabeledChip caption="Тип" label={card.typeLabel} styles={styles} />
            <LabeledChip caption="Фирменное" label={card.signature} success styles={styles} />
          </View>
          <View style={styles.rows}>
            <Detail label="Хозяин" value={card.keeper} styles={styles} />
            <Detail label="Атмосфера" value={card.atmosphere} styles={styles} />
            <Detail label="Сейчас" value={card.event} styles={styles} />
            <Detail label="Слух" value={card.rumor} styles={styles} />
          </View>
        </>
      ) : null}

      {card.category === 'kingdom' ? (
        <>
          <View style={styles.chips}>
            <LabeledChip caption="Правление" label={card.government} styles={styles} />
            <LabeledChip
              caption="Фракция"
              label={`${card.faction} · ${card.factionSphere}`}
              success
              styles={styles}
            />
          </View>
          <View style={styles.rows}>
            <Detail
              label="Как устроено"
              value={card.governmentDescription || '—'}
              styles={styles}
            />
            <Detail label="Правитель" value={card.ruler} styles={styles} />
            <Detail label="Кризис" value={card.crisis} styles={styles} />
            <Detail label="Герб" value={card.emblem} styles={styles} />
            <Detail label="Девиз" value={`«${card.motto}»`} styles={styles} />
            <Detail label="Скрытая повестка" value={card.hiddenAgenda} styles={styles} />
          </View>
        </>
      ) : null}

      {card.category === 'settlement' ? (
        <>
          <View style={styles.chips}>
            <LabeledChip caption="Масштаб" label={card.sizeLabel} styles={styles} />
          </View>
          <View style={styles.rows}>
            <Detail label="Особенность" value={card.landmark} styles={styles} />
            <Detail label="Проблема" value={card.problem} styles={styles} />
          </View>
        </>
      ) : null}

      {card.category === 'dungeon' ? (
        <View style={styles.rows}>
          <Detail label="Назначение" value={card.originalPurpose} styles={styles} />
          <Detail label="Обитатели" value={card.currentThreat} styles={styles} />
          <Detail label="Опасность" value={card.trap} styles={styles} />
          <Detail label="Сокровище" value={card.treasure} styles={styles} />
        </View>
      ) : null}
    </View>
  );
}
