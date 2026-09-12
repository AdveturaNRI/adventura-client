import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PhotoCropVariant } from '@/components/questionnaire/photo-crop.config';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { isGifImage } from '@/utils/image-format';

type ProfilePhotoFieldProps = {
  variant: PhotoCropVariant;
  label: string;
  description: string;
  photoUri: string | null;
  addLabel: string;
  onPick: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
    },
    label: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    description: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.5,
      flexShrink: 1,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      width: '100%',
      maxWidth: '100%',
    },
    avatarPreview: {
      width: 88,
      height: 88,
      borderRadius: 44,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardPreview: {
      width: 96,
      height: 128,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    actions: {
      flex: 1,
      minWidth: 0,
      gap: Spacing.xs,
    },
    actionPrimary: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.primary,
    },
    actionSecondary: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    actionPressed: {
      opacity: 0.75,
    },
  });
}

export function ProfilePhotoField({
  variant,
  label,
  description,
  photoUri,
  addLabel,
  onPick,
  onEdit,
  onRemove,
}: ProfilePhotoFieldProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const isAvatar = variant === 'avatar';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.previewRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoUri ? `Изменить ${label.toLowerCase()}` : addLabel}
          onPress={photoUri ? onEdit : onPick}
          style={isAvatar ? styles.avatarPreview : styles.cardPreview}>
          {photoUri ? (
            <Image
              key={photoUri}
              source={{ uri: photoUri }}
              style={styles.previewImage}
              contentFit="cover"
              cachePolicy={photoUri.startsWith('http') ? 'memory-disk' : 'none'}
              autoplay={isGifImage(photoUri)}
            />
          ) : (
            <Ionicons
              name={isAvatar ? 'person-outline' : 'image-outline'}
              size={28}
              color={colors.textSubtle}
            />
          )}
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={photoUri ? onEdit : onPick}
            style={({ pressed }) => pressed && styles.actionPressed}>
            <Text style={styles.actionPrimary}>{photoUri ? 'Изменить' : addLabel}</Text>
          </Pressable>

          {photoUri ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRemove}
              style={({ pressed }) => pressed && styles.actionPressed}>
              <Text style={styles.actionSecondary}>Удалить</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
