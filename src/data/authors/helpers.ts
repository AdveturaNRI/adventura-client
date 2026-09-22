import type {
  AuthorPost,
  CreativityCategory,
  CreativityCategoryFilter,
} from './types';

export function filterPostsByCategory(
  posts: AuthorPost[],
  filter: CreativityCategoryFilter,
): AuthorPost[] {
  if (filter === 'all') {
    return posts;
  }
  return posts.filter((post) => post.category === filter);
}

export function isCreativityCategory(value: string): value is CreativityCategory {
  return (
    value === 'arts' ||
    value === 'maps' ||
    value === 'materials' ||
    value === 'forGames' ||
    value === 'memes' ||
    value === 'other'
  );
}
