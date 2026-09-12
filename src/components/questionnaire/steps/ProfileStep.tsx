import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { PhotoCropEditor } from '@/components/questionnaire/PhotoCropEditor';
import { ProfilePhotoField } from '@/components/questionnaire/ProfilePhotoField';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { QuestionnaireOption } from '@/components/questionnaire/QuestionnaireOption';
import { Input, NicknameInput, TextArea, toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { PROFILE_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';
import { isGifImage } from '@/utils/image-format';
import { getImageSize } from '@/utils/image-size';

const STACK_STATUS_AGE_MAX_WIDTH = 420;

type ProfileStepValue = Pick<
  QuestionnaireDraft,
  | 'profileCardUri'
  | 'profileCardRevision'
  | 'nickname'
  | 'status'
  | 'description'
  | 'age'
  | 'isPublic'
>;

type ProfileStepProps = {
  value: ProfileStepValue;
  onChange: (value: Partial<ProfileStepValue>) => void;
};

function nextProfileCardChange(
  value: ProfileStepValue,
  profileCardUri: string | null,
): Partial<ProfileStepValue> {
  return {
    profileCardUri,
    profileCardRevision: value.profileCardRevision + 1,
  };
}

type PhotoSource = {
  uri: string;
  width: number;
  height: number;
};

type PendingCrop = PhotoSource;

function createStyles(colors: ThemeColors, stackStatusAge: boolean) {
  return StyleSheet.create({
    photosCard: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    photosCardTitle: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.textSubtle,
    },
    formCard: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    formCardTitle: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.textSubtle,
      marginBottom: Spacing.xs,
    },
    fieldsRow: {
      flexDirection: stackStatusAge ? 'column' : 'row',
      gap: Spacing.sm,
      alignItems: stackStatusAge ? 'stretch' : 'flex-start',
      width: '100%',
      maxWidth: '100%',
    },
    statusField: {
      flex: stackStatusAge ? undefined : 1,
      width: stackStatusAge ? '100%' : undefined,
      minWidth: 0,
      maxWidth: '100%',
    },
    ageField: {
      width: stackStatusAge ? '100%' : 96,
      maxWidth: stackStatusAge ? '100%' : 96,
      flexShrink: 0,
      zIndex: 1,
    },
    visibilityCard: {
      gap: Spacing.md,
      padding: Spacing.lg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    visibilityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      width: '100%',
    },
    visibilityIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    visibilityHeaderText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    visibilityTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    visibilitySubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    visibilityOptions: {
      gap: Spacing.sm,
      width: '100%',
    },
    visibilityHintBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      width: '100%',
    },
    visibilityHint: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

export function ProfileStep({ value, onChange }: ProfileStepProps) {
  const screenStyles = useQuestionnaireScreenStyles();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const stackStatusAge = width <= STACK_STATUS_AGE_MAX_WIDTH;
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, stackStatusAge));
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const isPublic = value.isPublic;

  const pickPhoto = async () => {
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
    const source = {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };

    if (isGifImage(asset.uri, asset.mimeType)) {
      onChange(nextProfileCardChange(value, source.uri));
      toast.info('GIF сохранён без обрезки — анимация останется');
      return;
    }

    await openPhotoEditor(source);
  };

  const openPhotoEditor = async (source: PhotoSource) => {
    if (isGifImage(source.uri)) {
      toast.info('GIF нельзя обрезать. Загрузите новый файл, если хотите заменить.');
      return;
    }

    try {
      const dimensions =
        source.width && source.height
          ? { width: source.width, height: source.height }
          : await getImageSize(source.uri);

      setPendingCrop({
        uri: source.uri,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch {
      toast.error('Не удалось открыть фото для редактирования');
    }
  };

  const handleEditorSave = (uri: string) => {
    onChange(nextProfileCardChange(value, uri));
    setPendingCrop(null);
  };

  return (
    <>
      <View style={screenStyles.stepBody}>
        <View>
          <Text style={screenStyles.title}>{PROFILE_STEP.title}</Text>
          <Text style={screenStyles.subtitle}>{PROFILE_STEP.subtitle}</Text>
        </View>

        <QuestionnaireHint>{PROFILE_STEP.hint}</QuestionnaireHint>

        <View style={styles.photosCard}>
          <Text style={styles.photosCardTitle}>Фото анкеты</Text>

          <ProfilePhotoField
            variant="profileCard"
            label={PROFILE_STEP.profileCardLabel}
            description={PROFILE_STEP.profileCardDescription}
            photoUri={value.profileCardUri}
            addLabel={PROFILE_STEP.addPhotoLabel}
            onPick={pickPhoto}
            onEdit={() =>
              value.profileCardUri
                ? openPhotoEditor({ uri: value.profileCardUri, width: 0, height: 0 })
                : pickPhoto()
            }
            onRemove={() => onChange(nextProfileCardChange(value, null))}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>Основное</Text>

          <NicknameInput
            label={PROFILE_STEP.nicknameLabel}
            value={value.nickname}
            onChangeText={(nickname) => onChange({ nickname })}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.fieldsRow}>
            <View style={styles.statusField}>
              <Input
                label={PROFILE_STEP.statusLabel}
                value={value.status}
                onChangeText={(status) => onChange({ status })}
                placeholder={PROFILE_STEP.statusPlaceholder}
              />
            </View>

            <View style={styles.ageField}>
              <Input
                label={PROFILE_STEP.ageLabel}
                labelHint={PROFILE_STEP.ageLabelHint}
                value={value.age}
                onChangeText={(age) => onChange({ age: age.replace(/[^\d]/g, '') })}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>

          <TextArea
            label={PROFILE_STEP.descriptionLabel}
            labelHint={PROFILE_STEP.descriptionLabelHint}
            value={value.description}
            onChangeText={(description) => onChange({ description })}
            placeholder={PROFILE_STEP.descriptionPlaceholder}
            maxLength={PROFILE_STEP.descriptionMaxLength}
          />
        </View>

        <View style={styles.visibilityCard}>
          <View style={styles.visibilityHeader}>
            <View style={styles.visibilityIconWrap}>
              <Ionicons name="eye-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.visibilityHeaderText}>
              <Text style={styles.visibilityTitle}>{PROFILE_STEP.visibilityTitle}</Text>
              <Text style={styles.visibilitySubtitle}>{PROFILE_STEP.visibilitySubtitle}</Text>
            </View>
          </View>

          <View style={styles.visibilityOptions}>
            <QuestionnaireOption
              label={PROFILE_STEP.visibilityPublicLabel}
              description={PROFILE_STEP.visibilityPublicDescription}
              icon="globe-outline"
              selected={isPublic}
              onPress={() => onChange({ isPublic: true })}
            />
            <QuestionnaireOption
              label={PROFILE_STEP.visibilityPrivateLabel}
              description={PROFILE_STEP.visibilityPrivateDescription}
              icon="lock-closed-outline"
              selected={!isPublic}
              onPress={() => onChange({ isPublic: false })}
            />
          </View>

          <View style={styles.visibilityHintBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.visibilityHint}>
              {isPublic
                ? PROFILE_STEP.visibilityPublicHint
                : PROFILE_STEP.visibilityPrivateHint}
            </Text>
          </View>
        </View>
      </View>

      {pendingCrop ? (
        <PhotoCropEditor
          visible
          variant="profileCard"
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
