import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/navigation/UserAvatar';
import { CreativityCategoryBadges } from '@/components/authors/CreativityCategoryBadge';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { AUTHOR_CONTACT_ICONS } from '@/data/authors/labels';
import type { Author, AuthorContact, AuthorPost } from '@/data/authors/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AuthorCardProps = {
  author: Author;
  recentPosts?: AuthorPost[];
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: '100%',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    name: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    description: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    contacts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    contactChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    contactLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      maxWidth: 140,
    },
    previews: {
      flexDirection: 'row',
      gap: 8,
    },
    preview: {
      width: 72,
      height: 72,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
  });
}

function ContactChip({ contact }: { contact: AuthorContact }) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const icon = AUTHOR_CONTACT_ICONS[contact.type];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={contact.label}
      onPress={() => {
        void Linking.openURL(contact.url);
      }}
      style={({ pressed }) => [styles.contactChip, pressed && { opacity: 0.88 }]}>
      <Ionicons name={icon} size={12} color={colors.primary} />
      <Text style={styles.contactLabel} numberOfLines={1}>
        {contact.label}
      </Text>
    </Pressable>
  );
}

export function AuthorCard({ author, recentPosts = [] }: AuthorCardProps) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const previewImages = recentPosts
    .flatMap((post) => post.images)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={author.name}
        onPress={() => router.push(`/authors/${author.id}`)}
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}>
        <View style={styles.topRow}>
          <UserAvatar nickname={author.name} avatarUrl={author.avatar} size={56} />
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {author.name}
            </Text>
            <CreativityCategoryBadges categories={author.categories} size="sm" />
          </View>
        </View>

        {author.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {author.description}
          </Text>
        ) : null}

        {previewImages.length > 0 ? (
          <View style={[styles.previews, { marginTop: Spacing.sm }]}>
            {previewImages.map((uri) => (
              <View key={uri} style={styles.preview}>
                <FadeInImage uri={uri} style={styles.previewImage} contentFit="cover" />
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>

      {author.contacts.length > 0 ? (
        <View style={styles.contacts}>
          {author.contacts.slice(0, 3).map((contact) => (
            <ContactChip key={`${contact.type}-${contact.url}`} contact={contact} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
