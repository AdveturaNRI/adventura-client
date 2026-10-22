import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import {
  getNewsItem,
  incrementNewsViews,
  listNews,
  toggleNewsLike,
  type NewsItem,
} from '@/services/news/newsApi';
import { localizeErrorMessage } from '@/utils/localizeError';

type NewsContextValue = {
  items: NewsItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => NewsItem | undefined;
  ensureItem: (id: string) => Promise<NewsItem | null>;
  toggleLike: (id: string) => Promise<void>;
  incrementViews: (id: string) => Promise<void>;
  /** Снять локальный бейдж «Новая» после прочтения. */
  markItemRead: (id: string) => void;
};

const NewsContext = createContext<NewsContextValue | null>(null);

function upsertItem(list: NewsItem[], next: NewsItem): NewsItem[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) return [next, ...list];
  const copy = [...list];
  copy[index] = next;
  return copy;
}

/** Только при загрузке с сервера: непрочитанные сверху, внутри — как пришло (новые→старые). */
function orderUnreadFirst(list: NewsItem[]): NewsItem[] {
  const unread: NewsItem[] = [];
  const read: NewsItem[] = [];
  for (const item of list) {
    if (item.unread) unread.push(item);
    else read.push(item);
  }
  return [...unread, ...read];
}

export function NewsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const next = await listNews();
      setItems(
        orderUnreadFirst(
          next.map((item) => ({
            ...item,
            unread: Boolean(item.unread),
            publicationVersion: item.publicationVersion ?? 0,
          })),
        ),
      );
    } catch (err) {
      setError(localizeErrorMessage(err, 'Не удалось загрузить новости'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  const getById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items],
  );

  const ensureItem = useCallback(
    async (id: string) => {
      const cached = items.find((item) => item.id === id);
      if (cached) return cached;
      const fetched = await getNewsItem(id);
      if (fetched) {
        setItems((current) => upsertItem(current, fetched));
      }
      return fetched;
    },
    [items],
  );

  const toggleLike = useCallback(
    async (id: string) => {
      if (!requireAuth()) return;

      let snapshot: NewsItem | undefined;
      setItems((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          snapshot = item;
          const liked = !item.liked;
          return {
            ...item,
            liked,
            likes: Math.max(0, item.likes + (liked ? 1 : -1)),
          };
        }),
      );

      try {
        const result = await toggleNewsLike(id);
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, liked: result.liked, likes: result.likes }
              : item,
          ),
        );
      } catch (err) {
        if (snapshot) {
          setItems((current) =>
            current.map((item) => (item.id === id ? snapshot! : item)),
          );
        }
        toast.error(localizeErrorMessage(err, 'Не удалось обновить лайк'));
      }
    },
    [requireAuth],
  );

  const incrementViews = useCallback(async (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, views: item.views + 1 } : item,
      ),
    );
    try {
      const result = await incrementNewsViews(id);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, views: result.views } : item,
        ),
      );
    } catch {
      // просмотры не критичны
    }
  }, []);

  const markItemRead = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.unread ? { ...item, unread: false } : item,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      items,
      isLoading,
      isRefreshing,
      error,
      refresh,
      getById,
      ensureItem,
      toggleLike,
      incrementViews,
      markItemRead,
    }),
    [
      items,
      isLoading,
      isRefreshing,
      error,
      refresh,
      getById,
      ensureItem,
      toggleLike,
      incrementViews,
      markItemRead,
    ],
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews() {
  const value = useContext(NewsContext);
  if (!value) {
    throw new Error('useNews must be used within NewsProvider');
  }
  return value;
}
