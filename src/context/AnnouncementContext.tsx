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
import { AppState, Platform } from 'react-native';

import { SiteAnnouncementModal } from '@/components/announcements/SiteAnnouncementModal';
import { useAuth } from '@/context/AuthContext';
import { useNews } from '@/context/NewsContext';
import { useRealtime } from '@/context/RealtimeContext';
import {
  dismissAnnouncement,
  fetchPendingAnnouncements,
  type SiteAnnouncement,
} from '@/services/announcements/announcementsApi';
import { incrementNewsViews } from '@/services/news/newsApi';
import {
  claimAnnouncementRead,
  releaseAnnouncementRead,
} from '@/utils/announcement-read-session';
import { claimAnnouncementView } from '@/utils/announcement-view-session';
import {
  clearAnnouncementsSoftClose,
  loadAnnouncementsSoftClose,
  saveAnnouncementsSoftClose,
} from '@/utils/announcements-soft-close-storage';

type AnnouncementContextValue = {
  refreshAnnouncements: () => void;
  /** Непрочитанные новости для бейджа (pending на сервере). */
  unreadNewsCount: number;
  /** Модалка объявлений открыта — лента не должна параллельно считать прочтение. */
  isModalVisible: boolean;
  /** Засчитать прочтение (dismiss) после ≥2 с просмотра. */
  markAnnouncementRead: (id: string, publicationVersion: number) => void;
};

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

const POLL_MS = 60_000;
/** Минимальное время на слайде / в деталке, чтобы засчитать прочтение. */
export const ANNOUNCEMENT_READ_DWELL_MS = 2_000;

function itemKey(item: SiteAnnouncement) {
  return `${item.id}:${item.publicationVersion}`;
}

/**
 * X / backdrop only hides the overlay until a new announcement is published.
 * Soft-close is persisted so refresh does not reopen the same pack.
 * Soft-close ≠ read: badge stays until dismiss after ≥2s dwell.
 */
export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { markItemRead } = useNews();
  const { dataResyncAt, lastAnnouncementPublished } = useRealtime();
  const [queue, setQueue] = useState<SiteAnnouncement[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [unreadNewsCount, setUnreadNewsCount] = useState(0);
  const fetchGenRef = useRef(0);
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const knownKeysRef = useRef(new Set<string>());
  /** After soft-close — quiet until a new publication. */
  const waitForNewPublishRef = useRef(false);
  const sessionUserIdRef = useRef<string | null>(null);
  const softCloseHydratedRef = useRef(false);
  const lastPublishSignalRef = useRef<string | null>(null);
  const visibleRef = useRef(false);

  queueRef.current = queue;
  indexRef.current = index;
  visibleRef.current = visible;

  const resetSessionIfNeeded = useCallback((userId: string | null) => {
    if (sessionUserIdRef.current !== userId) {
      sessionUserIdRef.current = userId;
      waitForNewPublishRef.current = false;
      knownKeysRef.current = new Set();
      lastPublishSignalRef.current = null;
      softCloseHydratedRef.current = false;
    }
  }, []);

  const persistSoftClose = useCallback((userId: string | null | undefined) => {
    if (!userId) return;
    void saveAnnouncementsSoftClose({
      userId,
      waiting: true,
      knownKeys: [...knownKeysRef.current],
    });
  }, []);

  const clearSoftClose = useCallback((userId: string | null | undefined) => {
    if (!userId) return;
    void clearAnnouncementsSoftClose(userId);
  }, []);

  const markAnnouncementRead = useCallback(
    (id: string, publicationVersion: number) => {
      if (!isAuthenticated) return;
      if (!claimAnnouncementRead(id, publicationVersion)) return;

      // Сразу снимаем чип в ленте — не ждём ответ dismiss.
      markItemRead(id);
      setUnreadNewsCount((count) => Math.max(0, count - 1));

      void dismissAnnouncement(id, publicationVersion)
        .then(async () => {
          const items = await fetchPendingAnnouncements();
          setUnreadNewsCount(items.length);
        })
        .catch(() => {
          releaseAnnouncementRead(id, publicationVersion);
        });
    },
    [isAuthenticated, markItemRead],
  );

  const markReadRef = useRef(markAnnouncementRead);
  markReadRef.current = markAnnouncementRead;
  const modalDwellStartedAtRef = useRef<number | null>(null);
  const modalDwellKeyRef = useRef<string | null>(null);

  /** Full server unread list; keep current slide if it still exists. */
  const syncPack = useCallback((items: SiteAnnouncement[], resetToStart: boolean) => {
    if (items.length === 0) {
      setQueue([]);
      setIndex(0);
      setVisible(false);
      return;
    }

    let nextIndex = 0;
    if (!resetToStart) {
      const current = queueRef.current[indexRef.current];
      if (current) {
        const found = items.findIndex((item) => itemKey(item) === itemKey(current));
        if (found >= 0) nextIndex = found;
      }
    }

    setQueue(items);
    setIndex(nextIndex);
    setVisible(true);
    for (const item of items) {
      knownKeysRef.current.add(itemKey(item));
    }
  }, []);

  const refreshAnnouncements = useCallback(
    (options?: { forceOpen?: boolean }) => {
      if (!isAuthenticated || isLoading) {
        setQueue([]);
        setIndex(0);
        setVisible(false);
        setUnreadNewsCount(0);
        return;
      }

      const userId = user?.id ?? null;
      resetSessionIfNeeded(userId);

      const gen = ++fetchGenRef.current;
      void (async () => {
        if (!softCloseHydratedRef.current && userId) {
          const stored = await loadAnnouncementsSoftClose(userId);
          if (gen !== fetchGenRef.current) return;
          softCloseHydratedRef.current = true;
          if (stored?.waiting) {
            waitForNewPublishRef.current = true;
            knownKeysRef.current = new Set(stored.knownKeys);
          }
        }

        const items = await fetchPendingAnnouncements();
        if (gen !== fetchGenRef.current) return;

        const forceOpen = Boolean(options?.forceOpen);
        const hasNew = items.some((item) => !knownKeysRef.current.has(itemKey(item)));

        // Бейдж всегда = непрочитанные на сервере (dismiss после ≥2 с).
        setUnreadNewsCount(items.length);

        if (items.length === 0) {
          setQueue([]);
          setIndex(0);
          setVisible(false);
          return;
        }

        // New publication / seed → reopen with full unread list (old + new).
        if (forceOpen || hasNew) {
          waitForNewPublishRef.current = false;
          clearSoftClose(userId);
          syncPack(items, !visibleRef.current);
          return;
        }

        if (waitForNewPublishRef.current) {
          return;
        }

        if (!visibleRef.current) {
          syncPack(items, true);
        }
      })();
    },
    [
      clearSoftClose,
      isAuthenticated,
      isLoading,
      resetSessionIfNeeded,
      syncPack,
      user?.id,
    ],
  );

  useEffect(() => {
    refreshAnnouncements();
  }, [refreshAnnouncements, dataResyncAt]);

  useEffect(() => {
    if (!lastAnnouncementPublished) return;
    const signal = `${lastAnnouncementPublished.id}:${lastAnnouncementPublished.publicationVersion}`;
    if (lastPublishSignalRef.current === signal) return;
    lastPublishSignalRef.current = signal;
    waitForNewPublishRef.current = false;
    knownKeysRef.current.delete(signal);
    clearSoftClose(user?.id);
    refreshAnnouncements({ forceOpen: true });
  }, [clearSoftClose, lastAnnouncementPublished, refreshAnnouncements, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    const timer = setInterval(() => {
      refreshAnnouncements();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, isLoading, refreshAnnouncements]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshAnnouncements();
      }
    });
    return () => sub.remove();
  }, [refreshAnnouncements]);

  const current = queue[index] ?? null;
  const total = queue.length;
  const currentRef = useRef(current);
  currentRef.current = current;

  const flushModalDwellIfReady = useCallback(() => {
    const slide = currentRef.current;
    const startedAt = modalDwellStartedAtRef.current;
    if (
      !slide ||
      startedAt == null ||
      Date.now() - startedAt < ANNOUNCEMENT_READ_DWELL_MS
    ) {
      return;
    }
    markReadRef.current(slide.id, slide.publicationVersion);
  }, []);

  const handlePrev = useCallback(() => {
    flushModalDwellIfReady();
    setIndex((value) => Math.max(0, value - 1));
  }, [flushModalDwellIfReady]);

  const handleNext = useCallback(() => {
    flushModalDwellIfReady();
    setIndex((value) => Math.min(queueRef.current.length - 1, value + 1));
  }, [flushModalDwellIfReady]);

  /** Soft close: hide until the next new announcement. Flush read if already ≥2s on slide. */
  const handleClose = useCallback(() => {
    flushModalDwellIfReady();
    waitForNewPublishRef.current = true;
    setVisible(false);
    persistSoftClose(user?.id);
  }, [flushModalDwellIfReady, persistSoftClose, user?.id]);

  // Просмотр в модалке тоже идёт в счётчик (раз за сессию на id).
  useEffect(() => {
    if (!visible || !current?.id) return;
    if (!claimAnnouncementView(current.id)) return;

    setQueue((items) =>
      items.map((item) =>
        item.id === current.id
          ? { ...item, views: Math.max(0, (item.views ?? 0) + 1) }
          : item,
      ),
    );

    void incrementNewsViews(current.id)
      .then((result) => {
        setQueue((items) =>
          items.map((item) =>
            item.id === current.id ? { ...item, views: result.views } : item,
          ),
        );
      })
      .catch(() => undefined);
  }, [visible, current?.id]);

  // Прочтение: ≥2 с на текущем слайде модалки (таймер + учёт при закрытии).
  useEffect(() => {
    if (!visible || !current?.id) {
      modalDwellStartedAtRef.current = null;
      modalDwellKeyRef.current = null;
      return;
    }
    const { id, publicationVersion } = current;
    const key = `${id}:${publicationVersion}`;
    modalDwellKeyRef.current = key;
    modalDwellStartedAtRef.current = Date.now();
    const timer = setTimeout(() => {
      if (modalDwellKeyRef.current !== key) return;
      markReadRef.current(id, publicationVersion);
    }, ANNOUNCEMENT_READ_DWELL_MS);
    return () => clearTimeout(timer);
  }, [visible, current?.id, current?.publicationVersion]);

  const value = useMemo(
    () => ({
      refreshAnnouncements: () => refreshAnnouncements(),
      unreadNewsCount,
      isModalVisible: visible,
      markAnnouncementRead,
    }),
    [refreshAnnouncements, unreadNewsCount, visible, markAnnouncementRead],
  );

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
      <SiteAnnouncementModal
        announcement={current}
        visible={visible && Boolean(current)}
        index={index}
        total={total}
        onPrev={handlePrev}
        onNext={handleNext}
        onClose={handleClose}
      />
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) {
    throw new Error('useAnnouncements must be used within AnnouncementProvider');
  }
  return ctx;
}

export function useAnnouncementsOptional() {
  return useContext(AnnouncementContext);
}
