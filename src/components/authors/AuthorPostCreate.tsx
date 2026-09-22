import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorPostFiles } from '@/components/authors/AuthorPostFiles';
import { AuthorRichTextEditor } from '@/components/authors/AuthorRichTextEditor';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { Button, Input, TextArea, toast } from '@/components/ui';
import {
  CREATIVITY_CATEGORY_HINTS,
  CREATIVITY_FILTER_OPTIONS,
} from '@/data/authors/labels';
import type {
  AuthorPost,
  AuthorPostFile,
  CreateAuthorPostInput,
  CreativityCategory,
  UpdateAuthorPostInput,
} from '@/data/authors/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { isAuthorImageMime } from '@/utils/authors-format';
import { localizeErrorMessage } from '@/utils/localizeError';

type AuthorPostCreateProps = {
  authorId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAuthorPostInput) => void | Promise<void>;
  onUpdate?: (input: UpdateAuthorPostInput) => void | Promise<void>;
  initialPost?: AuthorPost | null;
};

const CATEGORY_OPTIONS = CREATIVITY_FILTER_OPTIONS.filter(
  (option): option is (typeof CREATIVITY_FILTER_OPTIONS)[number] & {
    key: CreativityCategory;
  } => option.key !== 'all',
);

function filesFromPost(post: AuthorPost): AuthorPostFile[] {
  const images = post.images.map((uri, index) => ({
    id: `img-${post.id}-${index}`,
    name: `image-${index + 1}.jpg`,
    size: 0,
    type: 'image/jpeg',
    url: uri,
    previewUrl: uri,
  }));
  return [...images, ...post.files.map((file) => ({ ...file }))];
}

function createStyles(
  colors: ThemeColors,
  isDesktopWeb: boolean,
  insets: { top: number; bottom: number },
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDesktopWeb ? colors.overlay : colors.background,
      justifyContent: isDesktopWeb ? 'center' : 'flex-start',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      padding: isDesktopWeb ? Spacing.lg : 0,
    },
    sheet: {
      width: '100%',
      flex: isDesktopWeb ? undefined : 1,
      maxWidth: isDesktopWeb ? 560 : undefined,
      maxHeight: isDesktopWeb ? '90%' : undefined,
      borderTopLeftRadius: isDesktopWeb ? 20 : 0,
      borderTopRightRadius: isDesktopWeb ? 20 : 0,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.background,
      borderWidth: isDesktopWeb ? 1 : 0,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      paddingTop: isDesktopWeb ? 0 : insets.top,
      paddingBottom: isDesktopWeb ? 0 : insets.bottom,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    scroll: {
      flex: 1,
    },
    body: {
      padding: Spacing.md,
      gap: Spacing.md,
    },
    fieldLabel: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryChipActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    categoryLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    categoryLabelActive: {
      color: colors.primary,
    },
    categoryHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    saleToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    saleLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    check: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    checkOn: {
      borderColor: 'rgba(52, 199, 89, 0.45)',
      backgroundColor: 'rgba(52, 199, 89, 0.18)',
    },
    saleFields: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(52, 199, 89, 0.35)',
      backgroundColor: 'rgba(52, 199, 89, 0.08)',
    },
    footer: {
      padding: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
}

type FormProps = {
  authorId: string;
  initialPost: AuthorPost | null;
  onClose: () => void;
  onSubmit: (input: CreateAuthorPostInput) => void | Promise<void>;
  onUpdate?: (input: UpdateAuthorPostInput) => void | Promise<void>;
};

function AuthorPostCreateForm({
  authorId,
  initialPost,
  onClose,
  onSubmit,
  onUpdate,
}: FormProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((theme) =>
    createStyles(theme, isDesktopWeb, {
      top: insets.top,
      bottom: insets.bottom,
    }),
  );
  const isEditing = Boolean(initialPost);

  const [title, setTitle] = useState(initialPost?.title ?? '');
  const [content, setContent] = useState(initialPost?.content ?? '');
  const [category, setCategory] = useState<CreativityCategory>(
    initialPost?.category ?? 'arts',
  );
  const [files, setFiles] = useState<AuthorPostFile[]>(() =>
    initialPost ? filesFromPost(initialPost) : [],
  );
  const [isForSale, setIsForSale] = useState(initialPost?.isForSale ?? false);
  const [price, setPrice] = useState(() => {
    if (initialPost?.price != null && Number.isFinite(initialPost.price)) {
      return String(initialPost.price);
    }
    return '2500';
  });
  const [currency, setCurrency] = useState(initialPost?.currency || '₽');
  const [purchaseDescription, setPurchaseDescription] = useState(
    initialPost?.purchaseDescription || '',
  );
  const [purchaseUrl, setPurchaseUrl] = useState(initialPost?.purchaseUrl || '');
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => title.trim().length > 0 && !saving, [saving, title]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Добавьте заголовок');
      return;
    }

    if (isForSale) {
      const parsedPrice = Number(price.replace(',', '.'));
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        toast.error('Укажите цену');
        return;
      }
      if (!purchaseUrl.trim()) {
        toast.error('Укажите контакт или ссылку для покупки');
        return;
      }
    }

    const images = files
      .filter((file) => isAuthorImageMime(file.type, file.name))
      .map((file) => file.previewUrl || file.url)
      .filter((uri): uri is string => Boolean(uri));

    const otherFiles = files.filter((file) => !isAuthorImageMime(file.type, file.name));

    const payload = {
      title,
      content,
      category,
      images,
      files: otherFiles,
      isForSale,
      price: isForSale ? Number(price.replace(',', '.')) : undefined,
      currency: isForSale ? currency.trim() || '₽' : undefined,
      purchaseDescription: isForSale ? purchaseDescription.trim() : undefined,
      purchaseUrl: isForSale ? purchaseUrl.trim() : undefined,
    };

    setSaving(true);
    try {
      if (isEditing && initialPost && onUpdate) {
        await onUpdate({ postId: initialPost.id, ...payload });
        toast.success('Сохранили изменения');
      } else {
        await onSubmit({ authorId, ...payload });
        toast.success('Публикация вышла');
      }
      onClose();
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось сохранить публикацию'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isEditing ? 'Редактор публикации' : 'Новая публикация'}
        </Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <Input label="Заголовок" value={title} onChangeText={setTitle} />
        <AuthorRichTextEditor
          label="Текст публикации"
          value={content}
          onChangeText={setContent}
          minHeight={160}
          placeholder="Опишите работу: что это, для какой системы, как пользоваться"
        />

        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.fieldLabel}>Категория</Text>
          <View style={styles.categoryRow}>
            {CATEGORY_OPTIONS.map((option) => {
              const active = option.key === category;
              const iconColor = active ? colors.primary : colors.textMuted;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={
                    option.hint ? `${option.label}. ${option.hint}` : option.label
                  }
                  onPress={() => setCategory(option.key)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                    pressed && { opacity: 0.88 },
                  ]}>
                  {option.icon ? (
                    <Ionicons name={option.icon} size={14} color={iconColor} />
                  ) : null}
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.categoryHint}>{CREATIVITY_CATEGORY_HINTS[category]}</Text>
        </View>

        <AuthorPostFiles files={files} onChange={setFiles} />

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: isForSale }}
          onPress={() => setIsForSale((value) => !value)}
          style={({ pressed }) => [styles.saleToggle, pressed && { opacity: 0.9 }]}>
          <Text style={styles.saleLabel}>Можно приобрести</Text>
          <View style={[styles.check, isForSale && styles.checkOn]}>
            {isForSale ? <Ionicons name="checkmark" size={18} color={colors.success} /> : null}
          </View>
        </Pressable>

        {isForSale ? (
          <View style={styles.saleFields}>
            <Input
              label="Цена"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
            <Input label="Валюта" value={currency} onChangeText={setCurrency} />
            <TextArea
              label="Что получает покупатель"
              value={purchaseDescription}
              onChangeText={setPurchaseDescription}
              minHeight={90}
            />
            <Input
              label="Контакт для покупки"
              value={purchaseUrl}
              onChangeText={setPurchaseUrl}
              autoCapitalize="none"
              placeholder="https://t.me/…"
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={saving ? 'Сохраняем…' : isEditing ? 'Сохранить' : 'Опубликовать'}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={!canSubmit}
          icon={
            saving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : undefined
          }
        />
      </View>
    </View>
  );
}

export function AuthorPostCreate({
  authorId,
  visible,
  onClose,
  onSubmit,
  onUpdate,
  initialPost = null,
}: AuthorPostCreateProps) {
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((theme) =>
    createStyles(theme, isDesktopWeb, {
      top: insets.top,
      bottom: insets.bottom,
    }),
  );
  const formKey = initialPost?.id ?? 'new';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktopWeb ? 'fade' : 'slide'}
      statusBarTranslucent={!isDesktopWeb}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {visible ? (
          <AuthorPostCreateForm
            key={formKey}
            authorId={authorId}
            initialPost={initialPost}
            onClose={onClose}
            onSubmit={onSubmit}
            onUpdate={onUpdate}
          />
        ) : null}
      </View>
    </Modal>
  );
}
