import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  loadAuthorsCtaDismissed,
  saveAuthorsCtaDismissed,
} from '@/utils/authors-banner-storage';

type BecomeAuthorBannerProps = {
  onBecomeAuthor?: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.button * 1.35,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export function BecomeAuthorBanner({ onBecomeAuthor }: BecomeAuthorBannerProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadAuthorsCtaDismissed().then((dismissed) => {
      if (!cancelled) {
        setVisible(!dismissed);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>🎲 Создаёте контент для НРИ?</Text>
          <Text style={styles.subtitle}>
            Откройте кабинет автора в профиле и покажите свои публикации.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Скрыть баннер"
          hitSlop={8}
          onPress={() => {
            setVisible(false);
            void saveAuthorsCtaDismissed(true);
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Button label="Кабинет автора" onPress={onBecomeAuthor} />
    </View>
  );
}
