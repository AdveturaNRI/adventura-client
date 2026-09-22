import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { filterPostsByCategory } from '@/data/authors/helpers';
import type {
  Author,
  AuthorPost,
  CreateAuthorPostInput,
  CreativityCategoryFilter,
  UpdateAuthorInput,
  UpdateAuthorPostInput,
} from '@/data/authors/types';
import {
  deleteAuthorPost,
  getAuthor,
  getAuthorPost,
  getAuthorPostsByAuthor,
  getMyAuthor,
  incrementAuthorPostViews,
  listAuthorPosts,
  listAuthors,
  saveAuthorPostWithMedia,
  toggleAuthorPostLike,
  updateMyAuthor,
} from '@/services/authors/authorsApi';
import { localizeErrorMessage } from '@/utils/localizeError';

type AuthorsContextValue = {
  authors: Author[];
  posts: AuthorPost[];
  myAuthorId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getAuthorById: (id: string) => Author | undefined;
  getPostById: (id: string) => AuthorPost | undefined;
  getPostsForAuthor: (authorId: string) => AuthorPost[];
  filterFeed: (filter: CreativityCategoryFilter) => AuthorPost[];
  ensureAuthor: (authorId: string) => Promise<Author | undefined>;
  ensurePost: (postId: string) => Promise<AuthorPost | undefined>;
  toggleLike: (postId: string) => Promise<void>;
  incrementViews: (postId: string) => Promise<void>;
  createPost: (input: CreateAuthorPostInput) => Promise<AuthorPost>;
  updatePost: (input: UpdateAuthorPostInput) => Promise<AuthorPost | undefined>;
  deletePost: (postId: string) => Promise<void>;
  updateAuthor: (input: UpdateAuthorInput) => Promise<Author | undefined>;
};

const AuthorsContext = createContext<AuthorsContextValue | null>(null);

function upsertAuthor(list: Author[], next: Author): Author[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [next, ...list];
  }
  const copy = [...list];
  copy[index] = next;
  return copy;
}

function upsertPost(list: AuthorPost[], next: AuthorPost): AuthorPost[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [next, ...list];
  }
  const copy = [...list];
  copy[index] = next;
  return copy;
}

function mergePosts(list: AuthorPost[], incoming: AuthorPost[]): AuthorPost[] {
  const byId = new Map(list.map((post) => [post.id, post]));
  for (const post of incoming) {
    byId.set(post.id, post);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function AuthorsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [myAuthorId, setMyAuthorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnceRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setAuthors([]);
      setPosts([]);
      setMyAuthorId(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const showInitial = !loadedOnceRef.current;
    if (showInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [authorsList, postsList, me] = await Promise.all([
        listAuthors(),
        listAuthorPosts('all'),
        getMyAuthor(),
      ]);
      setAuthors(upsertAuthor(authorsList, me));
      setPosts(postsList);
      setMyAuthorId(me.id);
      setError(null);
      loadedOnceRef.current = true;
    } catch (err) {
      const message = localizeErrorMessage(err, 'Не удалось загрузить публикации');
      setError(message);
      if (!loadedOnceRef.current) {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getAuthorById = useCallback(
    (id: string) => authors.find((author) => author.id === id),
    [authors],
  );

  const getPostById = useCallback(
    (id: string) => posts.find((post) => post.id === id),
    [posts],
  );

  const getPostsForAuthor = useCallback(
    (authorId: string) =>
      posts
        .filter((post) => post.authorId === authorId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [posts],
  );

  const filterFeed = useCallback(
    (filter: CreativityCategoryFilter) => filterPostsByCategory(posts, filter),
    [posts],
  );

  const ensureAuthor = useCallback(
    async (authorId: string) => {
      const cached = authors.find((author) => author.id === authorId);
      if (cached) {
        return cached;
      }
      try {
        const [author, authorPosts] = await Promise.all([
          getAuthor(authorId),
          getAuthorPostsByAuthor(authorId),
        ]);
        setAuthors((current) => upsertAuthor(current, author));
        setPosts((current) => mergePosts(current, authorPosts));
        return author;
      } catch (err) {
        toast.error(localizeErrorMessage(err, 'Не удалось загрузить автора'));
        return undefined;
      }
    },
    [authors],
  );

  const ensurePost = useCallback(
    async (postId: string) => {
      const cached = posts.find((post) => post.id === postId);
      if (cached) {
        return cached;
      }
      try {
        const post = await getAuthorPost(postId);
        setPosts((current) => upsertPost(current, post));
        void ensureAuthor(post.authorId);
        return post;
      } catch (err) {
        toast.error(localizeErrorMessage(err, 'Не удалось загрузить публикацию'));
        return undefined;
      }
    },
    [ensureAuthor, posts],
  );

  const toggleLike = useCallback(async (postId: string) => {
    let snapshot: AuthorPost | undefined;
    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) {
          return post;
        }
        snapshot = post;
        const liked = !post.liked;
        return {
          ...post,
          liked,
          likes: Math.max(0, post.likes + (liked ? 1 : -1)),
        };
      }),
    );

    try {
      const result = await toggleAuthorPostLike(postId);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, liked: result.liked, likes: result.likes }
            : post,
        ),
      );
    } catch (err) {
      if (snapshot) {
        setPosts((current) =>
          current.map((post) => (post.id === postId ? snapshot! : post)),
        );
      }
      toast.error(localizeErrorMessage(err, 'Не удалось обновить лайк'));
    }
  }, []);

  const incrementViews = useCallback(async (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, views: post.views + 1 } : post,
      ),
    );
    try {
      const result = await incrementAuthorPostViews(postId);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, views: result.views } : post,
        ),
      );
    } catch {
      // просмотры не критичны — молчим
    }
  }, []);

  const createPost = useCallback(async (input: CreateAuthorPostInput) => {
    const post = await saveAuthorPostWithMedia({
      payload: {
        title: input.title,
        content: input.content,
        category: input.category,
        isForSale: input.isForSale,
        price: input.price,
        currency: input.currency,
        purchaseDescription: input.purchaseDescription,
        purchaseUrl: input.purchaseUrl,
      },
      images: input.images,
      files: input.files,
    });

    setPosts((current) => upsertPost(current, post));
    setAuthors((current) =>
      current.map((author) =>
        author.id === post.authorId
          ? {
              ...author,
              postIds: [post.id, ...author.postIds.filter((id) => id !== post.id)],
            }
          : author,
      ),
    );
    setMyAuthorId(post.authorId);
    return post;
  }, []);

  const updatePost = useCallback(async (input: UpdateAuthorPostInput) => {
    const post = await saveAuthorPostWithMedia({
      postId: input.postId,
      payload: {
        title: input.title,
        content: input.content,
        category: input.category,
        isForSale: input.isForSale,
        price: input.price,
        currency: input.currency,
        purchaseDescription: input.purchaseDescription,
        purchaseUrl: input.purchaseUrl,
      },
      images: input.images,
      files: input.files,
    });

    setPosts((current) => upsertPost(current, post));
    return post;
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    await deleteAuthorPost(postId);
    setPosts((current) => current.filter((post) => post.id !== postId));
    setAuthors((current) =>
      current.map((author) =>
        author.postIds.includes(postId)
          ? { ...author, postIds: author.postIds.filter((id) => id !== postId) }
          : author,
      ),
    );
  }, []);

  const updateAuthor = useCallback(async (input: UpdateAuthorInput) => {
    const next = await updateMyAuthor({
      description: input.description,
      categories: input.categories,
      contacts: input.contacts,
    });
    setAuthors((current) => upsertAuthor(current, next));
    setMyAuthorId(next.id);
    return next;
  }, []);

  const value = useMemo<AuthorsContextValue>(
    () => ({
      authors,
      posts,
      myAuthorId,
      isLoading,
      isRefreshing,
      error,
      refresh,
      getAuthorById,
      getPostById,
      getPostsForAuthor,
      filterFeed,
      ensureAuthor,
      ensurePost,
      toggleLike,
      incrementViews,
      createPost,
      updatePost,
      deletePost,
      updateAuthor,
    }),
    [
      authors,
      posts,
      myAuthorId,
      isLoading,
      isRefreshing,
      error,
      refresh,
      getAuthorById,
      getPostById,
      getPostsForAuthor,
      filterFeed,
      ensureAuthor,
      ensurePost,
      toggleLike,
      incrementViews,
      createPost,
      updatePost,
      deletePost,
      updateAuthor,
    ],
  );

  return <AuthorsContext.Provider value={value}>{children}</AuthorsContext.Provider>;
}

export function useAuthors() {
  const value = useContext(AuthorsContext);
  if (!value) {
    throw new Error('useAuthors must be used within AuthorsProvider');
  }
  return value;
}
