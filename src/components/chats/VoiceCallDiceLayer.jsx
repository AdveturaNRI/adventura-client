import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Platform, StyleSheet, View } from 'react-native';
import { ChatDiceOverlay } from '@/components/chats/ChatDiceOverlay';
import { ChatDicePopover } from '@/components/chats/ChatDicePopover';
import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { sendChatDiceRoll } from '@/services/chats/chatsApi';
import { parseDiceRollPayload } from '@/utils/chat-dice-roll';
import { localizeErrorMessage } from '@/utils/localizeError';

/**
 * Same chat dice popover + local 3D roll.
 * Must sit outside the call Modal (portal on web) — WebGL under RN Modal
 * whitescreens the tab, same as under ScreenTransition(transform).
 */
export function VoiceCallDiceLayer({ conversationId, senderNickname, open, onOpenChange, }) {
  const { user } = useAuth();
  const { subscribeMessages } = useRealtime();
  const myId = user?.id ?? null;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [localRoll, setLocalRoll] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const incomingQueueRef = useRef([]);
  const skipIdsRef = useRef(new Set());
  const tokenRef = useRef(0);
  const resolveRef = useRef(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!conversationId.trim()) {
      onOpenChange(false);
    }
  }, [conversationId, onOpenChange, open]);
  useEffect(() => {
    incomingQueueRef.current = [];
    setIncoming(null);
  }, [conversationId]);
  useEffect(() => {
    return subscribeMessages((message) => {
      if (message.conversationId !== conversationId || message.kind !== 'dice_roll') {
        return;
      }
      if (skipIdsRef.current.has(message.id)) {
        return;
      }
      if (myId && message.senderId === myId) {
        return;
      }
      const payload = parseDiceRollPayload(message.body);
      if (!payload || payload.redacted || payload.sum == null) {
        return;
      }
      const request = {
        messageId: message.id,
        payload,
        senderNickname: message.sender?.nickname ?? 'Игрок',
      };
      setIncoming((current) => {
        if (current) {
          if (
            current.messageId !== request.messageId &&
            !incomingQueueRef.current.some((item) => item.messageId === request.messageId)
          ) {
            incomingQueueRef.current.push(request);
          }
          return current;
        }
        return request;
      });
    });
  }, [conversationId, myId, subscribeMessages]);
  const handleLocalComplete = useCallback((outcome) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setLocalRoll(null);
    resolve?.(outcome);
  }, []);
  const handleIncomingAdvance = useCallback(() => {
    const next = incomingQueueRef.current.shift() ?? null;
    setIncoming(next);
  }, []);
  const handleRoll = useCallback(
    async (input) => {
      if (!conversationId.trim() || busyRef.current || localRoll) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      onOpenChange(false);
      const token = ++tokenRef.current;
      const outcome = await new Promise((resolve) => {
        resolveRef.current = resolve;
        setLocalRoll({
          token,
          dice: input.dice,
          modifier: input.modifier,
          color: input.color,
          senderNickname,
          mode: input.mode,
        });
      });
      try {
        if (!outcome || outcome.groups.length === 0) {
          toast.error('Не удалось бросить кости');
          return;
        }
        const message = await sendChatDiceRoll(conversationId, {
          ...input,
          groups: outcome.groups.map((group) => ({
            sides: group.sides,
            values: group.values,
          })),
          ...(input.mode !== 'normal' ? { mode: input.mode } : {}),
        });
        skipIdsRef.current.add(message.id);
        if (skipIdsRef.current.size > 80) {
          const oldest = skipIdsRef.current.values().next().value;
          if (oldest) {
            skipIdsRef.current.delete(oldest);
          }
        }
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось бросить кости'));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [conversationId, localRoll, onOpenChange, senderNickname],
  );
  const diceActive = open || busy || Boolean(localRoll) || Boolean(incoming);
  const tree = (
    <View pointerEvents={diceActive ? 'box-none' : 'none'} style={diceActive ? styles.host : styles.hostIdle}>
      <ChatDicePopover
        visible={open}
        busy={busy}
        onClose={() => onOpenChange(false)}
        onRoll={(input) => void handleRoll(input)}
      />
      <ChatDiceOverlay
        request={localRoll ? null : incoming}
        localRoll={localRoll}
        onLocalRollComplete={handleLocalComplete}
        warm={diceActive}
        forceActive={diceActive}
        onReveal={() => undefined}
        onAdvance={handleIncomingAdvance}
      />
    </View>
  );
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return createPortal(tree, document.body);
  }
  return tree;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 11000,
  },
  hostIdle: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
});
