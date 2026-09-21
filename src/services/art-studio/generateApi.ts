import { apiRequest } from '@/services/api/client';

import {
  buildKandinskyPrompt,
  kandinskyTypeFromEntity,
  orientationFromEntity,
  sizeFromOrientation,
} from './kandinskyPrompt';
import type { ArtBuildInput, ArtBuildResult } from './types';

export type ArtTaskStatus = 'queued' | 'running' | 'done' | 'fail' | 'cancelled';

export type ArtTaskView = {
  taskId: string;
  status: ArtTaskStatus;
  queuePosition: number;
  progress: number;
  width: number;
  height: number;
  url?: string;
  error?: string;
  message?: string;
};

export type ArtQualityMode = 'fast' | 'quality';

const CLIENT_POLL_MS = 1500;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function composeStudioPrompt(input: ArtBuildInput): string {
  const type = kandinskyTypeFromEntity(input.entityId);
  return buildKandinskyPrompt(input.userPrompt, type);
}

/**
 * Старт задачи + поллинг статуса до DONE/FAIL.
 * Отмена через AbortSignal — снимает клиентский опрос и шлёт DELETE на сервер.
 */
export async function generateArtViaApi(
  input: ArtBuildInput,
  options: {
    signal?: AbortSignal;
    onProgress?: (view: ArtTaskView) => void;
    quality?: ArtQualityMode;
  } = {},
): Promise<ArtBuildResult> {
  const orientation = orientationFromEntity(input.entityId);
  const size = sizeFromOrientation(orientation);
  const prompt = composeStudioPrompt(input);

  const started = await apiRequest<ArtTaskView>('/art/generate', {
    method: 'POST',
    body: {
      prompt,
      orientation,
      entityId: input.entityId,
    },
    skipLoading: true,
  });

  options.onProgress?.(started);

  if (options.signal?.aborted) {
    void apiRequest<ArtTaskView>(`/art/tasks/${started.taskId}`, {
      method: 'DELETE',
      skipLoading: true,
    }).catch(() => undefined);
    throw new DOMException('Aborted', 'AbortError');
  }

  if (started.status === 'fail') {
    throw new Error(started.error || 'Не удалось сгенерировать арт');
  }

  if (started.status === 'done' && started.url) {
    return toResult(input, prompt, started);
  }

  const taskId = started.taskId;
  let current = started;

  const abortHandler = () => {
    void apiRequest<ArtTaskView>(`/art/tasks/${taskId}`, {
      method: 'DELETE',
      skipLoading: true,
    }).catch(() => undefined);
  };
  options.signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    while (current.status === 'queued' || current.status === 'running') {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      await sleep(CLIENT_POLL_MS, options.signal);
      current = await apiRequest<ArtTaskView>(`/art/status/${taskId}`, {
        skipLoading: true,
      });
      options.onProgress?.(current);
    }

    if (current.status === 'cancelled') {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (current.status !== 'done' || !current.url) {
      throw new Error(current.error || 'Не удалось сгенерировать арт');
    }

    return toResult(input, prompt, current);
  } finally {
    options.signal?.removeEventListener('abort', abortHandler);
  }
}

function toResult(
  input: ArtBuildInput,
  prompt: string,
  view: ArtTaskView,
): ArtBuildResult {
  const orientation = orientationFromEntity(input.entityId);
  const fallback = sizeFromOrientation(orientation);
  return {
    prompt,
    url: view.url!,
    seed: Date.now() % 2_147_483_647,
    entityId: input.entityId,
    styleId: input.styleId,
    lightingId: input.lightingId,
    cameraId: input.cameraId,
    userPrompt: input.userPrompt.trim(),
    width: view.width || fallback.width,
    height: view.height || fallback.height,
  };
}

/** @deprecated алиас для совместимости */
export const ART_HF_MODELS = {
  fast: 'kandinsky-fast',
  quality: 'kandinsky',
} as const;
