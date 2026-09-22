import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AUTHOR_CONTACT_ICONS,
  AUTHOR_CONTACT_LABELS,
} from '@/data/authors/labels';
import type { AuthorContact } from '@/data/authors/types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AuthorContactsProps = {
  contacts: AuthorContact[];
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    list: {
      gap: 8,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    type: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    label: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

export function AuthorContacts({ contacts }: AuthorContactsProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  if (contacts.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Контакты</Text>
      <View style={styles.list}>
        {contacts.map((contact) => {
          const icon = AUTHOR_CONTACT_ICONS[contact.type];
          return (
            <Pressable
              key={`${contact.type}-${contact.url}`}
              accessibilityRole="link"
              accessibilityLabel={contact.label}
              onPress={() => void Linking.openURL(contact.url)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.9 }]}>
              <View style={styles.iconWrap}>
                <Ionicons name={icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.type}>{AUTHOR_CONTACT_LABELS[contact.type]}</Text>
                <Text style={styles.label} numberOfLines={1}>
                  {contact.label}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
