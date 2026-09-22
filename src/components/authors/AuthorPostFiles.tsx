import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { toast } from '@/components/ui';
import { MAX_UPLOAD_SIZE_MESSAGE } from '@/constants/upload.config';
import type { AuthorPostFile } from '@/data/authors/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  AUTHOR_POST_MAX_FILE_SIZE_BYTES,
  AUTHOR_POST_MAX_FILE_SIZE_HINT,
  formatAuthorFileSize,
  getAuthorFileExtension,
  isAuthorImageMime,
} from '@/utils/authors-format';

type AuthorPostFilesProps = {
  files: AuthorPostFile[];
  /** Режим просмотра — без кнопок добавления */
  readOnly?: boolean;
  onChange?: (files: AuthorPostFile[]) => void;
  /** Колбэк на будущее API-хранилище: сейчас только локальные uri */
  onUploadRequest?: (file: AuthorPostFile) => Promise<AuthorPostFile> | AuthorPostFile;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: Spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBtn: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    list: {
      gap: 8,
    },
    imageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    imageCard: {
      width: 96,
      height: 96,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    removeBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 56,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    fileIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    fileBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    fileName: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    fileMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
  });
}

function createLocalFileId() {
  return `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function resolveUpload(
  file: AuthorPostFile,
  onUploadRequest?: AuthorPostFilesProps['onUploadRequest'],
): Promise<AuthorPostFile> {
  if (!onUploadRequest) {
    return file;
  }
  return onUploadRequest(file);
}

export function AuthorPostFiles({
  files,
  readOnly = false,
  onChange,
  onUploadRequest,
}: AuthorPostFilesProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  const imageFiles = files.filter((file) => isAuthorImageMime(file.type, file.name));
  const otherFiles = files.filter((file) => !isAuthorImageMime(file.type, file.name));

  const pushFiles = async (incoming: AuthorPostFile[]) => {
    if (!onChange || incoming.length === 0) {
      return;
    }

    const accepted: AuthorPostFile[] = [];
    for (const file of incoming) {
      if (file.size > AUTHOR_POST_MAX_FILE_SIZE_BYTES) {
        toast.error(MAX_UPLOAD_SIZE_MESSAGE);
        continue;
      }
      accepted.push(await resolveUpload(file, onUploadRequest));
    }

    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }
  };

  const removeFile = (id: string) => {
    onChange?.(files.filter((file) => file.id !== id));
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Нужен доступ к галерее');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });

    if (result.canceled) {
      return;
    }

    const mapped: AuthorPostFile[] = result.assets.map((asset) => ({
      id: createLocalFileId(),
      name: asset.fileName || `image-${Date.now()}.jpg`,
      size: asset.fileSize ?? 0,
      type: asset.mimeType || 'image/jpeg',
      url: asset.uri,
      previewUrl: asset.uri,
    }));

    await pushFiles(mapped);
  };

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    const mapped: AuthorPostFile[] = result.assets.map((asset) => ({
      id: createLocalFileId(),
      name: asset.name,
      size: asset.size ?? 0,
      type: asset.mimeType || 'application/octet-stream',
      url: asset.uri,
      previewUrl: isAuthorImageMime(asset.mimeType || '', asset.name) ? asset.uri : undefined,
    }));

    await pushFiles(mapped);
  };

  return (
    <View style={styles.root}>
      {!readOnly ? (
        <>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickImages()}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.88 }]}>
              <Ionicons name="image-outline" size={16} color={colors.primary} />
              <Text style={styles.actionLabel}>Изображения</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickDocuments()}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.88 }]}>
              <Ionicons name="attach-outline" size={16} color={colors.primary} />
              <Text style={styles.actionLabel}>Файлы</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{AUTHOR_POST_MAX_FILE_SIZE_HINT}</Text>
        </>
      ) : null}

      {imageFiles.length > 0 ? (
        <View style={styles.imageRow}>
          {imageFiles.map((file) => {
            const uri = file.previewUrl || file.url;
            return (
              <View key={file.id} style={styles.imageCard}>
                {uri ? (
                  <FadeInImage uri={uri} style={styles.image} contentFit="cover" />
                ) : null}
                {!readOnly ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Удалить изображение"
                    onPress={() => removeFile(file.id)}
                    style={styles.removeBadge}
                    hitSlop={6}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {otherFiles.length > 0 ? (
        <View style={styles.list}>
          {otherFiles.map((file) => {
            const ext = getAuthorFileExtension(file.name);
            return (
              <View key={file.id} style={styles.fileCard}>
                <View style={styles.fileIcon}>
                  <Ionicons name="document-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.fileBody}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {[ext, formatAuthorFileSize(file.size)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {!readOnly ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Удалить файл"
                    onPress={() => removeFile(file.id)}
                    hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
