export type CreativityCategory = 'arts' | 'maps' | 'materials' | 'forGames' | 'memes' | 'other';

/** @deprecated Use CreativityCategory — оставлено как алиас для совместимости */
export type AuthorCategory = CreativityCategory;

export type AuthorContactType =
  | 'telegram'
  | 'vk'
  | 'discord'
  | 'youtube'
  | 'twitch'
  | 'boosty'
  | 'email'
  | 'website'
  | 'other';

export type AuthorContact = {
  type: AuthorContactType;
  label: string;
  url: string;
};

export type AuthorPostFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  previewUrl?: string;
};

export type AuthorPost = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  category: CreativityCategory;
  images: string[];
  files: AuthorPostFile[];
  createdAt: string;
  views: number;
  likes: number;
  liked: boolean;
  isForSale: boolean;
  price?: number;
  currency?: string;
  purchaseDescription?: string;
  purchaseUrl?: string;
};

export type Author = {
  id: string;
  name: string;
  avatar: string;
  badges?: string[];
  avatarFrameId?: string | null;
  /** Одна или несколько категорий творчества */
  categories: CreativityCategory[];
  description: string;
  contacts: AuthorContact[];
  postIds: string[];
};

export type CreativityCategoryFilter = 'all' | CreativityCategory;

/** @deprecated Use CreativityCategoryFilter */
export type AuthorCategoryFilter = CreativityCategoryFilter;

export type CreateAuthorPostInput = {
  authorId: string;
  title: string;
  content: string;
  category: CreativityCategory;
  images: string[];
  files: AuthorPostFile[];
  isForSale: boolean;
  price?: number;
  currency?: string;
  purchaseDescription?: string;
  purchaseUrl?: string;
};

export type UpdateAuthorPostInput = {
  postId: string;
  title: string;
  content: string;
  category: CreativityCategory;
  images: string[];
  files: AuthorPostFile[];
  isForSale: boolean;
  price?: number;
  currency?: string;
  purchaseDescription?: string;
  purchaseUrl?: string;
};

export type UpdateAuthorInput = {
  authorId: string;
  description: string;
  categories: CreativityCategory[];
  contacts: AuthorContact[];
};
