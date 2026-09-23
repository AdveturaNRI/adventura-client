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
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import {
  MusicPlayerBar,
  type MusicPlaybackSession,
} from '@/components/music/MusicPlayerBar';
import { toast } from '@/components/ui/feedback/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MusicTrack } from '@/services/music/musicApi';

type ActivePlayback = {
  trackId: string;
  playing: boolean;
} | null;

type MusicPlayerContextValue = {
  session: MusicPlaybackSession | null;
  activePlayback: ActivePlayback;
  startPlayback: (
    queue: MusicTrack[],
    startIndex: number,
    label?: string,
  ) => void;
  stopPlayback: () => void;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const [session, setSession] = useState<MusicPlaybackSession | null>(null);
  const [activePlayback, setActivePlayback] = useState<ActivePlayback>(null);
  const [expanded, setExpanded] = useState(false);
  const sessionSeqRef = useRef(0);

  const startPlayback = useCallback(
    (queue: MusicTrack[], startIndex: number, label?: string) => {
      if (!queue.length) {
        toast.error('Нет треков для воспроизведения');
        return;
      }
      const target = queue[startIndex] ?? queue[0];
      const index = Math.max(
        0,
        queue.findIndex((track) => track.id === target?.id),
      );
      sessionSeqRef.current += 1;
      setSession({
        id: sessionSeqRef.current,
        tracks: queue,
        startIndex: index >= 0 ? index : 0,
        label,
      });
      // Mobile: floating pill so the dock doesn't cover the screen.
      setExpanded(false);
    },
    [],
  );

  const stopPlayback = useCallback(() => {
    setSession(null);
    setActivePlayback(null);
    setExpanded(false);
  }, []);

  useEffect(() => {
    if (isDesktopWeb) {
      setExpanded(true);
    }
  }, [isDesktopWeb]);

  const value = useMemo(
    () => ({
      session,
      activePlayback,
      startPlayback,
      stopPlayback,
    }),
    [session, activePlayback, startPlayback, stopPlayback],
  );

  const compact = Boolean(session) && !isDesktopWeb && !expanded;

  return (
    <MusicPlayerContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {session ? (
          <View
            pointerEvents="box-none"
            style={
              compact
                ? [
                    styles.pillAnchor,
                    {
                      bottom: Math.max(insets.bottom, Spacing.md) + 8,
                      right: Spacing.md,
                    },
                  ]
                : [
                    styles.dockOverlay,
                    { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
                  ]
            }>
            <View
              style={
                compact
                  ? undefined
                  : [styles.dock, { backgroundColor: colors.surface }]
              }>
              <MusicPlayerBar
                session={session}
                compact={compact}
                onActiveTrackChange={setActivePlayback}
                onClose={stopPlayback}
                onExpand={isDesktopWeb ? undefined : () => setExpanded(true)}
                onCollapse={isDesktopWeb ? undefined : () => setExpanded(false)}
              />
            </View>
          </View>
        ) : null}
      </View>
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pillAnchor: {
    position: 'absolute',
    zIndex: 40,
    alignItems: 'flex-end',
  },
  dockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  dock: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
});
