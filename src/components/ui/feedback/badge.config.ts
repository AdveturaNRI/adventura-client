import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';

export type BadgeVariant =
  | 'outline'
  | 'success'
  | 'danger'
  | 'role'
  | 'roleFilled'
  | 'filter'
  | 'visibilityPrivate';

export type BadgeSpec = {
  variant: BadgeVariant;
  label: string;
  description: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  minHeight: number;
  borderRadius: number;
  paddingHorizontal: number;
};

export function getBadgeSpecs(colors: ThemeColors): BadgeSpec[] {
  return [
    {
      variant: 'outline',
      label: 'Изменить',
      description: 'Контурная action-плашка',
      backgroundColor: 'transparent',
      borderColor: colors.primaryLight,
      textColor: colors.primary,
      fontSize: FontSize.badge,
      minHeight: Sizes.badgeHeight,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
    },
    {
      variant: 'danger',
      label: 'Выход',
      description: 'Контурная плашка для выхода',
      backgroundColor: 'transparent',
      borderColor: colors.primaryLight,
      textColor: colors.primary,
      fontSize: FontSize.badge,
      minHeight: Sizes.badgeHeight,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
    },
    {
      variant: 'success',
      label: 'Публичная',
      description: 'Статус видимости профиля',
      backgroundColor: colors.success,
      borderColor: 'transparent',
      textColor: colors.onPrimary,
      fontSize: FontSize.badgeLarge,
      minHeight: Sizes.badgeHeight,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
    },
    {
      variant: 'role',
      label: 'Мастер',
      description: 'Роль пользователя',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textColor: colors.text,
      fontSize: FontSize.caption,
      minHeight: 28,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
    },
    {
      variant: 'roleFilled',
      label: 'Мастер',
      description: 'Роль на карточке профиля',
      backgroundColor: colors.primary,
      borderColor: 'transparent',
      textColor: colors.onPrimary,
      fontSize: FontSize.caption,
      minHeight: 30,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
    },
    {
      variant: 'visibilityPrivate',
      label: 'Приватная',
      description: 'Статус приватной анкеты',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      textColor: colors.textSecondary,
      fontSize: FontSize.badgeLarge,
      minHeight: Sizes.badgeHeight,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
    },
    {
      variant: 'filter',
      label: 'Активные',
      description: 'Фильтр списка',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textColor: colors.textSecondary,
      fontSize: FontSize.caption,
      minHeight: 28,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
    },
  ];
}
