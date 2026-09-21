import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PhotoCropEditor } from '@/components/questionnaire/PhotoCropEditor';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import type { AvatarFrameId, RewardBadgeType } from '@/data/rewards/catalog';
import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { uploadAvatar } from '@/services/profile/profileApi';
import { isGifImage } from '@/utils/image-format';
import { getImageSize } from '@/utils/image-size';
import { localizeErrorMessage } from '@/utils/localizeError';

type ProfileAvatarEditorProps = {
  nickname: string;
  avatarUrl: string | null;
  size?: number;
  badges?: RewardBadgeType[];
  frameId?: AvatarFrameId | string | null;
};

type PendingCrop = {
  uri: string;
  width: number;
  height: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: Spacing.sm,
    },
    changeButton: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    changeButtonPressed: {
      opacity: 0.75,
    },
    changeLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

export function ProfileAvatarEditor({
  nickname,
  avatarUrl,
  size = 96,
  badges,
  frameId,
}: ProfileAvatarEditorProps) {
  const styles = useThemedStyles(createStyles);
  const { applyProfile } = useProfile();
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickPhoto = async () => {
    if (isUploading) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Нужен доступ к галерее, чтобы загрузить фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    if (isGifImage(asset.uri, asset.mimeType)) {
      await saveAvatar(asset.uri);
      return;
    }

    try {
      const dimensions =
        asset.width && asset.height
          ? { width: asset.width, height: asset.height }
          : await getImageSize(asset.uri);

      setPendingCrop({
        uri: asset.uri,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch {
      toast.error('Не удалось открыть фото для редактирования');
    }
  };

  const saveAvatar = async (uri: string) => {
    setIsUploading(true);

    try {
      const profile = await uploadAvatar(uri);
      await applyProfile(profile);
      toast.success('Аватар обновлён');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить аватар'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditorSave = async (uri: string) => {
    setPendingCrop(null);
    await saveAvatar(uri);
  };

  return (
    <>
      <View style={styles.container}>
        <UserAvatar nickname={nickname} avatarUrl={avatarUrl} size={size} badges={badges} frameId={frameId} />
        <Pressable
          accessibilityRole="button"
          onPress={pickPhoto}
          disabled={isUploading}
          style={({ pressed }) => [styles.changeButton, pressed && styles.changeButtonPressed]}>
          <Text style={styles.changeLabel}>{isUploading ? 'Загружаем...' : 'Изменить фото'}</Text>
        </Pressable>
      </View>

      {pendingCrop ? (
        <PhotoCropEditor
          visible
          variant="avatar"
          imageUri={pendingCrop.uri}
          imageWidth={pendingCrop.width}
          imageHeight={pendingCrop.height}
          onCancel={() => setPendingCrop(null)}
          onSave={handleEditorSave}
        />
      ) : null}
    </>
  );
}
