import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ChatAttachment } from '@/services/chats/chatsApi';
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ChatAlbumGridProps = {
  images: ChatAttachment[];
  onOpen: (index: number) => void;
};

function previewUrlFor(attachment: ChatAttachment): string | null {
  return (
    attachment.image?.medium ??
    attachment.image?.large ??
    attachment.image?.thumb ??
    attachment.image?.original ??
    attachment.url
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: {
      width: 220,
      maxWidth: '100%',
      gap: 3,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      gap: 3,
    },
    cell: {
      overflow: 'hidden',
      borderRadius: 8,
      backgroundColor: colors.placeholderAlt,
    },
    single: {
      width: '100%',
      aspectRatio: 4 / 3,
    },
    half: {
      flex: 1,
      aspectRatio: 1,
    },
    third: {
      flex: 1,
      aspectRatio: 1,
    },
    image: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export function ChatAlbumGrid({ images, onOpen }: ChatAlbumGridProps) {
  const styles = useThemedStyles(createStyles);

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    const uri = previewUrlFor(images[0]);
    if (!uri) {
      return null;
    }
    return (
      <View style={styles.grid}>
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Открыть фото"
          onPress={() => onOpen(0)}
          style={[styles.cell, styles.single]}>
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
        </Pressable>
      </View>
    );
  }

  const columns = images.length === 2 || images.length === 4 ? 2 : 3;
  const rows = chunk(
    images.map((image, index) => ({ image, index })),
    columns,
  );

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map(({ image, index }) => {
            const uri = previewUrlFor(image);
            if (!uri) {
              return <View key={`empty-${index}`} style={[styles.cell, styles.third]} />;
            }
            return (
              <Pressable
                key={`img-${index}`}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Открыть фото ${index + 1}`}
                onPress={() => onOpen(index)}
                style={[styles.cell, columns === 2 ? styles.half : styles.third]}>
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
