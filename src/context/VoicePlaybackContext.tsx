import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { preload } from 'expo-audio';

import type { ChatAttachment } from '@/services/chats/chatsApi';

export type ChatVoiceQueueItem = { key: string; attachment: ChatAttachment };

type VoicePlaybackContextValue = {
  queue: ChatVoiceQueueItem[];
  activeKey: string | null;
  playingKey: string | null;
  sessionId: number;
  toggleRequest: number;
  visible: boolean;
  play: (key: string, queue: ChatVoiceQueueItem[]) => void;
  toggle: (key: string) => void;
  setActiveKey: (key: string | null) => void;
  setPlayingKey: (key: string | null) => void;
  syncQueue: (queue: ChatVoiceQueueItem[]) => void;
};

const VoicePlaybackContext = createContext<VoicePlaybackContextValue | null>(null);

export function VoicePlaybackProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ChatVoiceQueueItem[]>([]);
  const [activeKey, setActiveKeyState] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(0);
  const [toggleRequest, setToggleRequest] = useState(0);
  const activeKeyRef = useRef<string | null>(null);
  activeKeyRef.current = activeKey;

  const setActiveKey = useCallback((key: string | null) => {
    setActiveKeyState(key);
    if (!key) {
      setPlayingKey(null);
    }
  }, []);

  const play = useCallback((key: string, nextQueue: ChatVoiceQueueItem[]) => {
    // Start downloading the following voice in the same user interaction that
    // selects this one. This is earlier than waiting for the player's first
    // status tick, which matters for very short recordings.
    const selectedIndex = nextQueue.findIndex((item) => item.key === key);
    const following = selectedIndex >= 0 ? nextQueue[selectedIndex + 1] : undefined;
    if (following) {
      void preload(following.attachment.url);
    }
    setQueue(nextQueue);
    setSessionId((current) => current + 1);
    // Give immediate visual feedback on the pressed bubble while the browser
    // is still opening/buffering the audio stream.
    setPlayingKey(key);
    setActiveKeyState(key);
  }, []);

  const toggle = useCallback((key: string) => {
    if (activeKeyRef.current !== key) return;
    setToggleRequest((current) => current + 1);
  }, []);

  const syncQueue = useCallback((nextQueue: ChatVoiceQueueItem[]) => {
    const key = activeKeyRef.current;
    if (!key || !nextQueue.some((item) => item.key === key)) return;
    setQueue(nextQueue);
  }, []);

  const value = useMemo<VoicePlaybackContextValue>(
    () => ({
      queue,
      activeKey,
      playingKey,
      sessionId,
      toggleRequest,
      visible: Boolean(activeKey),
      play,
      toggle,
      setActiveKey,
      setPlayingKey,
      syncQueue,
    }),
    [activeKey, play, playingKey, queue, sessionId, setActiveKey, syncQueue, toggle, toggleRequest],
  );

  return <VoicePlaybackContext.Provider value={value}>{children}</VoicePlaybackContext.Provider>;
}

export function useVoicePlayback() {
  const value = useContext(VoicePlaybackContext);
  if (!value) {
    throw new Error('useVoicePlayback must be used within VoicePlaybackProvider');
  }
  return value;
}
