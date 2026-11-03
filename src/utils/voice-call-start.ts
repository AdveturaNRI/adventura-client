export function isEndedCallError(error: unknown): boolean {
  const value = error as { status?: unknown; message?: unknown } | null;
  return value?.status === 404 && typeof value.message === 'string' && /^Звонок уже заверш[её]н$/i.test(value.message.trim());
}

export function isCallAlreadyActiveError(error: unknown): boolean {
  const value = error as { status?: unknown; message?: unknown } | null;
  return value?.status === 400 && typeof value.message === 'string' && value.message.trim() === 'В этом чате уже идёт звонок';
}

/** Resolve stale call snapshots and concurrent invites without losing the user's call gesture. */
export async function resolveVoiceCallStart<A extends {
  callId: string;
  isJoined?: boolean;
  joinedCount: number;
}, I>(operations: {
  getActive: () => Promise<A | null>;
  isGroup: (active: A) => boolean;
  end: (active: A) => Promise<unknown>;
  join: (active: A) => Promise<'joined' | 'ended' | 'failed'>;
  invite: () => Promise<I>;
  isAlreadyActiveError: (error: unknown) => boolean;
  markEnded: (callId: string) => void;
  clearEnded: (callId: string) => void;
}): Promise<{ kind: 'joined' | 'failed' } | { kind: 'invited'; invite: I }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const active = await operations.getActive().catch(() => null);
    if (active?.callId) {
      const aloneLobby = Boolean(active.isJoined) && active.joinedCount <= 1;
      if (!aloneLobby) {
        const result = await operations.join(active);
        if (result === 'ended') continue;
        return { kind: result };
      }
      operations.markEnded(active.callId);
      await operations.end(active).catch(() => undefined);
      if (operations.isGroup(active)) {
        const still = await operations.getActive().catch(() => null);
        if (still?.callId) {
          operations.clearEnded(still.callId);
          const result = await operations.join(still);
          if (result === 'ended') continue;
          return { kind: result };
        }
      }
    }
    try {
      return { kind: 'invited', invite: await operations.invite() };
    } catch (error) {
      if (attempt < 2 && operations.isAlreadyActiveError(error)) continue;
      throw error;
    }
  }
  throw new Error('Не удалось начать звонок. Попробуйте ещё раз.');
}
