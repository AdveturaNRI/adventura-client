import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { Button, Input, TextArea, toast } from '@/components/ui';
import {
  AUTHOR_CONTACT_LABELS,
  AUTHOR_CONTACT_OPTIONS,
  AUTHOR_CONTACT_PLACEHOLDERS,
  CREATIVITY_FILTER_OPTIONS,
} from '@/data/authors/labels';
import type {
  Author,
  AuthorContact,
  AuthorContactType,
  CreativityCategory,
  UpdateAuthorInput,
} from '@/data/authors/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { localizeErrorMessage } from '@/utils/localizeError';

const DESCRIPTION_MAX = 500;
const CONTACTS_MAX = 8;

const CATEGORY_OPTIONS = CREATIVITY_FILTER_OPTIONS.filter(
  (option): option is (typeof CREATIVITY_FILTER_OPTIONS)[number] & {
    key: CreativityCategory;
  } => option.key !== 'all',
);

type ContactDraft = AuthorContact & { id: string };

type AuthorProfileEditProps = {
  author: Author;
  visible: boolean;
  onClose: () => void;
  onSave: (input: UpdateAuthorInput) => void | Promise<void>;
};

function createContactId() {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDrafts(contacts: AuthorContact[]): ContactDraft[] {
  return contacts.map((contact) => ({
    ...contact,
    id: createContactId(),
  }));
}

function normalizeContactUrl(type: AuthorContactType, raw: string): string {
  const value = raw.trim();
  if (!value) {
    return '';
  }
  if (type === 'email') {
    if (value.startsWith('mailto:')) {
      return value;
    }
    if (value.includes('@') && !value.includes('://')) {
      return `mailto:${value}`;
    }
  }
  if (/^https?:\/\//i.test(value) || value.startsWith('mailto:')) {
    return value;
  }
  return `https://${value}`;
}

function createStyles(
  colors: ThemeColors,
  isDesktopWeb: boolean,
  topInset: number,
  bottomInset: number,
  sheetHeight: number,
) {
  const desktopHeight = Math.round(sheetHeight * 0.92);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-start',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      padding: isDesktopWeb ? Spacing.lg : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 520 : undefined,
      height: isDesktopWeb ? desktopHeight : sheetHeight,
      maxHeight: isDesktopWeb ? desktopHeight : sheetHeight,
      borderTopLeftRadius: isDesktopWeb ? 20 : 0,
      borderTopRightRadius: isDesktopWeb ? 20 : 0,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.background,
      borderWidth: isDesktopWeb ? 1 : 0,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      flexDirection: 'column',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md + (isDesktopWeb ? 0 : topInset),
      paddingBottom: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexShrink: 0,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    scroll: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      ...(Platform.OS === 'web'
        ? ({
            // @ts-expect-error web-only scrollbar styles
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.border} transparent`,
          } as object)
        : null),
    },
    body: {
      padding: Spacing.md,
      gap: Spacing.md,
      paddingBottom: Spacing.lg,
      flexGrow: 1,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    counter: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'right',
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
    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: Spacing.xs,
    },
    contactsList: {
      gap: Spacing.sm,
    },
    contactCard: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    contactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    contactHeaderTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    removeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.3)',
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    typeChip: {
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    typeChipActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    typeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    typeLabelActive: {
      color: colors.primary,
    },
    addContactBtn: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    addContactLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primary,
    },
    footer: {
      flexShrink: 0,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Math.max(Spacing.md, isDesktopWeb ? Spacing.md : bottomInset || Spacing.md),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  });
}

type FormProps = {
  author: Author;
  onClose: () => void;
  onSave: (input: UpdateAuthorInput) => void | Promise<void>;
};

function AuthorProfileEditForm({ author, onClose, onSave }: FormProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = windowHeight;
  const styles = useThemedStyles((theme) =>
    createStyles(theme, isDesktopWeb, insets.top, insets.bottom, sheetHeight),
  );

  const [description, setDescription] = useState(author.description ?? '');
  const [categories, setCategories] = useState<CreativityCategory[]>(
    author.categories.length > 0 ? [...author.categories] : ['arts'],
  );
  const [contacts, setContacts] = useState<ContactDraft[]>(() => toDrafts(author.contacts));
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(
    () =>
      !saving && description.trim().length <= DESCRIPTION_MAX && categories.length > 0,
    [categories.length, description, saving],
  );

  const toggleCategory = (key: CreativityCategory) => {
    setCategories((current) => {
      if (current.includes(key)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  const addContact = () => {
    if (contacts.length >= CONTACTS_MAX) {
      toast.error(`Можно добавить до ${CONTACTS_MAX} контактов`);
      return;
    }
    setContacts((current) => [
      ...current,
      {
        id: createContactId(),
        type: 'telegram',
        label: '',
        url: '',
      },
    ]);
  };

  const updateContact = (id: string, patch: Partial<AuthorContact>) => {
    setContacts((current) =>
      current.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact)),
    );
  };

  const removeContact = (id: string) => {
    setContacts((current) => current.filter((contact) => contact.id !== id));
  };

  const handleSave = async () => {
    if (categories.length === 0) {
      toast.error('Выберите хотя бы одну категорию');
      return;
    }
    if (description.trim().length > DESCRIPTION_MAX) {
      toast.error(`Описание до ${DESCRIPTION_MAX} символов`);
      return;
    }

    const prepared: AuthorContact[] = [];
    for (const contact of contacts) {
      const label = contact.label.trim();
      const url = contact.url.trim();
      if (!label && !url) {
        continue;
      }
      if (!label || !url) {
        toast.error('У контакта нужны название и адрес');
        return;
      }
      prepared.push({
        type: contact.type,
        label,
        url: normalizeContactUrl(contact.type, url),
      });
    }

    setSaving(true);
    try {
      await onSave({
        authorId: author.id,
        description,
        categories,
        contacts: prepared,
      });
      toast.success('Профиль обновили');
      onClose();
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось сохранить профиль'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>О себе</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator
        persistentScrollbar
        indicatorStyle="black">
        <Text style={styles.hint}>
          Этот текст видят в вашем профиле автора и в ленте «Публикации».
        </Text>

        <View style={{ gap: 6 }}>
          <TextArea
            label="Описание"
            value={description}
            onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_MAX))}
            minHeight={140}
            placeholder="Например: рисую карты подземелий и портреты персонажей"
          />
          <Text style={styles.counter}>
            {description.trim().length}/{DESCRIPTION_MAX}
          </Text>
        </View>

        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.fieldLabel}>Категории</Text>
          <Text style={styles.hint}>Выберите категории, которые лучше всего описывают ваши публикации. Можно выбрать несколько.</Text>
          <View style={styles.categoryRow}>
            {CATEGORY_OPTIONS.map((option) => {
              const active = categories.includes(option.key);
              const iconColor = active ? colors.primary : colors.textMuted;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleCategory(option.key)}
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
        </View>

        <View style={styles.sectionDivider} />

        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.fieldLabel}>Соцсети и контакты</Text>
          <Text style={styles.hint}>
            Выберите значок, укажите название и ссылку — они появятся в профиле.
          </Text>

          <View style={styles.contactsList}>
            {contacts.map((contact, index) => {
              const placeholders = AUTHOR_CONTACT_PLACEHOLDERS[contact.type];
              return (
                <View key={contact.id} style={styles.contactCard}>
                  <View style={styles.contactHeader}>
                    <Text style={styles.contactHeaderTitle}>
                      Контакт {index + 1} · {AUTHOR_CONTACT_LABELS[contact.type]}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Удалить контакт"
                      onPress={() => removeContact(contact.id)}
                      style={({ pressed }) => [
                        styles.removeBtn,
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                    </Pressable>
                  </View>

                  <View style={styles.typeRow}>
                    {AUTHOR_CONTACT_OPTIONS.map((option) => {
                      const active = contact.type === option.key;
                      const iconColor = active ? colors.primary : colors.textMuted;
                      return (
                        <Pressable
                          key={option.key}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={option.label}
                          onPress={() => updateContact(contact.id, { type: option.key })}
                          style={({ pressed }) => [
                            styles.typeChip,
                            active && styles.typeChipActive,
                            pressed && { opacity: 0.88 },
                          ]}>
                          <Ionicons name={option.icon} size={14} color={iconColor} />
                          <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Input
                    label="Название"
                    value={contact.label}
                    onChangeText={(value) => updateContact(contact.id, { label: value })}
                    placeholder={placeholders.label}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Input
                    label="Адрес"
                    value={contact.url}
                    onChangeText={(value) => updateContact(contact.id, { url: value })}
                    placeholder={placeholders.url}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Добавить контакт"
            onPress={addContact}
            style={({ pressed }) => [styles.addContactBtn, pressed && { opacity: 0.9 }]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addContactLabel}>Добавить контакт</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={saving ? 'Сохраняем…' : 'Сохранить'}
          onPress={() => {
            void handleSave();
          }}
          disabled={!canSave}
          icon={
            saving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : undefined
          }
        />
      </View>
    </View>
  );
}

export function AuthorProfileEdit({
  author,
  visible,
  onClose,
  onSave,
}: AuthorProfileEditProps) {
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = windowHeight;
  const styles = useThemedStyles((theme) =>
    createStyles(theme, isDesktopWeb, insets.top, insets.bottom, sheetHeight),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktopWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {visible ? (
          <AuthorProfileEditForm
            key={`${author.id}-${author.contacts.length}-${author.categories.join('-')}`}
            author={author}
            onClose={onClose}
            onSave={onSave}
          />
        ) : null}
      </View>
    </Modal>
  );
}
