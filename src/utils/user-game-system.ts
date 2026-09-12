import type { UserGameSystemAuthor, UserGameSystemItem } from '@/services/api/types';

const FALLBACK_AUTHOR: UserGameSystemAuthor = {
  id: 'unknown',
  nickname: 'Игрок',
  avatarUrl: null,
};

export function normalizeUserGameSystemItem(
  item: UserGameSystemItem,
  fallbackAuthor?: UserGameSystemAuthor,
): UserGameSystemItem {
  if (item.author?.nickname) {
    return item;
  }

  return {
    ...item,
    author: fallbackAuthor ?? FALLBACK_AUTHOR,
  };
}

export function normalizeUserGameSystemItems(
  items: UserGameSystemItem[],
  fallbackAuthor?: UserGameSystemAuthor,
): UserGameSystemItem[] {
  return items.map((item) => normalizeUserGameSystemItem(item, fallbackAuthor));
}
