import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { Spacing, type ThemeColors } from '@/constants/theme';
import type { HandbookEntry } from '@/data/handbook/types';
import { useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import { raceSourceLabel, usableRaceSubtitle } from './race-tile-utils';

type HandbookRaceVariantsSheetProps = {
  race: HandbookEntry | null;
  visible: boolean;
  onClose: () => void;
  onSelect: (entry: HandbookEntry) => void;
};

/** Базовая раса первой, затем подрасы с полными названиями. */
function buildOptions(race: HandbookEntry): HandbookEntry[] {
  return [race, ...(race.variants ?? [])];
}

function createStyles(colors: ThemeColors, isDark: boolean, isDesktopWeb: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isDesktopWeb ? Spacing.xl : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 440 : undefined,
      maxHeight: isDesktopWeb ? '80%' : '88%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      borderWidth: isDesktopWeb ? 1 : 0,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    list: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      gap: Spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 88,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
    },
    optionHovered: {
      borderColor: 'rgba(21, 122, 254, 0.4)',
      backgroundColor: isDark ? 'rgba(21, 122, 254, 0.12)' : 'rgba(21, 122, 254, 0.06)',
    },
    optionPressed: {
      opacity: 0.9,
    },
    optionPortrait: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
      flexShrink: 0,
    },
    optionPortraitImage: {
      width: '100%',
      height: '100%',
    },
    optionBody: {
      flex: 1,
      minWidth: 0,
      gap: 3,
      justifyContent: 'center',
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.25,
      lineHeight: 20,
      flexShrink: 1,
      ...Platform.select({
        web: { overflowWrap: 'break', wordBreak: 'keep-all' } as object,
        default: {},
      }),
    },
    optionSubtitle: {
      fontSize: 13,
      fontStyle: 'italic',
      fontWeight: '500',
      color: colors.textMuted,
      lineHeight: 16,
    },
    optionSource: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.45,
      color: colors.primary,
      textTransform: 'uppercase',
    },
    optionChevron: {
      flexShrink: 0,
    },
  });
}

export function HandbookRaceVariantsSheet({
  race,
  visible,
  onClose,
  onSelect,
}: HandbookRaceVariantsSheetProps) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const styles = useThemedStyles((c) => createStyles(c, isDark, isDesktopWeb));

  if (!race) return null;

  const options = buildOptions(race);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktopWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: isDesktopWeb ? Spacing.lg : insets.bottom + Spacing.md },
          ]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              onPress={onClose}
              style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={isDark ? '#FFFFFF' : '#1A1A1A'} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}>
            {options.map((entry) => {
              const subtitle = usableRaceSubtitle(entry.title, entry.subtitle);
              const source = raceSourceLabel(entry);
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={entry.title}
                  onPress={() => onSelect(entry)}
                  style={({ pressed, hovered }) => [
                    styles.option,
                    hovered && styles.optionHovered,
                    pressed && styles.optionPressed,
                  ]}>
                  <View style={styles.optionPortrait}>
                    {entry.coverSource != null ? (
                      <FadeInImage
                        source={entry.coverSource}
                        style={styles.optionPortraitImage}
                        contentFit="cover"
                        contentPosition="center"
                      />
                    ) : null}
                  </View>
                  <View style={styles.optionBody}>
                    <Text style={styles.optionTitle}>{entry.title}</Text>
                    {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
                    {source ? <Text style={styles.optionSource}>{source}</Text> : null}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.3)'}
                    style={styles.optionChevron}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
