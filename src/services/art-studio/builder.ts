import { getEntityPreset } from './presets';
import {
  buildKandinskyPrompt,
  kandinskyTypeFromEntity,
} from './kandinskyPrompt';
import { inferCameraFromPrompt } from './sceneBoost';
import type {
  ArtBuildInput,
  ArtBuildResult,
  ArtCameraId,
  ArtEntityId,
  ArtLightingId,
  ArtStyleId,
} from './types';

export const POLLINATIONS_IMAGE_BASE = 'https://image.pollinations.ai/prompt';

export const DEFAULT_ART_INPUT: ArtBuildInput = {
  userPrompt: '',
  entityId: 'portrait',
  styleId: 'dnd5e',
  lightingId: 'daylight',
  cameraId: 'fullbody',
};

export function looksLikeRussian(text: string): boolean {
  return /[а-яёА-ЯЁ]/.test(text);
}

export function randomArtSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export function resolveCameraId(input: ArtBuildInput): ArtCameraId {
  return inferCameraFromPrompt(input.userPrompt) ?? input.cameraId;
}

/** Промпт под Kandinsky: русский ввод + русские стилевые хвосты */
export function composeArtPrompt(input: ArtBuildInput): string {
  return buildKandinskyPrompt(
    input.userPrompt,
    kandinskyTypeFromEntity(input.entityId),
  );
}

export type BuildArtUrlOptions = {
  width: number;
  height: number;
  seed?: number;
  model?: string;
  nologo?: boolean;
};

export function buildArtImageUrl(
  prompt: string,
  options: BuildArtUrlOptions,
): { url: string; seed: number } {
  const seed = options.seed ?? randomArtSeed();
  const params = new URLSearchParams({
    width: String(options.width),
    height: String(options.height),
    model: options.model ?? 'flux',
    nologo: options.nologo !== false ? 'true' : 'false',
    seed: String(seed),
  });
  const url = `${POLLINATIONS_IMAGE_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;
  return { url, seed };
}

export type BuildArtResultOptions = {
  seed?: number;
  model?: string;
};

export function buildArtResult(
  input: ArtBuildInput,
  options: BuildArtResultOptions = {},
): ArtBuildResult {
  const entity = getEntityPreset(input.entityId);
  const prompt = composeArtPrompt(input);
  const { url, seed } = buildArtImageUrl(prompt, {
    width: entity.size.width,
    height: entity.size.height,
    seed: options.seed,
    model: options.model,
  });

  return {
    prompt,
    url,
    seed,
    entityId: input.entityId,
    styleId: input.styleId,
    lightingId: input.lightingId,
    cameraId: resolveCameraId(input),
    userPrompt: input.userPrompt.trim(),
    width: entity.size.width,
    height: entity.size.height,
  };
}

export function loadExternalPrompt(
  text: string,
  categoryId: ArtEntityId | string,
  overrides: Partial<
    Pick<ArtBuildInput, 'styleId' | 'lightingId' | 'cameraId'>
  > = {},
): ArtBuildResult {
  const entityId = (getEntityPreset(categoryId).id ?? 'portrait') as ArtEntityId;
  const input: ArtBuildInput = {
    userPrompt: text.trim(),
    entityId,
    styleId: (overrides.styleId ?? DEFAULT_ART_INPUT.styleId) as ArtStyleId,
    lightingId: (overrides.lightingId ?? DEFAULT_ART_INPUT.lightingId) as ArtLightingId,
    cameraId: (overrides.cameraId ??
      (entityId === 'landscape' || entityId === 'interior'
        ? 'aerial'
        : entityId === 'token' || entityId === 'item'
          ? 'isometric'
          : 'fullbody')) as ArtCameraId,
  };
  return buildArtResult(input);
}

export function entityIdForGmCategory(
  category: 'npc' | 'tavern' | 'kingdom' | 'settlement' | 'dungeon',
): ArtEntityId {
  switch (category) {
    case 'npc':
      return 'portrait';
    case 'tavern':
    case 'dungeon':
      return 'interior';
    case 'kingdom':
    case 'settlement':
      return 'landscape';
    default:
      return 'portrait';
  }
}

type ExternalQueueListener = (payload: {
  text: string;
  categoryId: ArtEntityId;
} | null) => void;

let externalQueue: { text: string; categoryId: ArtEntityId } | null = null;
const externalListeners = new Set<ExternalQueueListener>();

function emitExternalQueue() {
  for (const listener of externalListeners) {
    listener(externalQueue);
  }
}

export function queueArtFromExternal(text: string, categoryId: ArtEntityId | string) {
  externalQueue = {
    text: text.trim(),
    categoryId: getEntityPreset(categoryId).id,
  };
  emitExternalQueue();
}

export function consumeArtFromExternal(): {
  text: string;
  categoryId: ArtEntityId;
} | null {
  const next = externalQueue;
  externalQueue = null;
  emitExternalQueue();
  return next;
}

export function peekArtFromExternal() {
  return externalQueue;
}

export function subscribeArtExternalQueue(listener: ExternalQueueListener): () => void {
  externalListeners.add(listener);
  listener(externalQueue);
  return () => {
    externalListeners.delete(listener);
  };
}

export const ArtBuilderService = {
  composePrompt: composeArtPrompt,
  buildImageUrl: buildArtImageUrl,
  buildResult: buildArtResult,
  loadExternalPrompt,
  queueFromExternal: queueArtFromExternal,
  consumeFromExternal: consumeArtFromExternal,
  entityIdForGmCategory,
  randomSeed: randomArtSeed,
  looksLikeRussian,
  defaults: DEFAULT_ART_INPUT,
};
