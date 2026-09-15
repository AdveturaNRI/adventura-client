export type ArtEntityId =
  | 'portrait'
  | 'landscape'
  | 'interior'
  | 'item'
  | 'token';

export type ArtStyleId =
  | 'dnd5e'
  | 'grimdark'
  | 'watercolor'
  | 'oil'
  | 'anime'
  | 'pixel';

export type ArtLightingId =
  | 'cinematic'
  | 'candle'
  | 'mystic-night'
  | 'crimson'
  | 'daylight';

export type ArtCameraId = 'closeup' | 'fullbody' | 'aerial' | 'isometric';

export type ArtSize = {
  width: number;
  height: number;
};

export type ArtPresetOption<T extends string> = {
  id: T;
  label: string;
  /** Короткое описание для UI */
  hint?: string;
  token: string;
  icon?: string;
};

export type ArtEntityPreset = ArtPresetOption<ArtEntityId> & {
  size: ArtSize;
  /** Пример плейсхолдера для textarea */
  placeholder: string;
};

export type ArtBuildInput = {
  userPrompt: string;
  entityId: ArtEntityId;
  styleId: ArtStyleId;
  lightingId: ArtLightingId;
  cameraId: ArtCameraId;
};

export type ArtBuildResult = {
  prompt: string;
  url: string;
  seed: number;
  entityId: ArtEntityId;
  styleId: ArtStyleId;
  lightingId: ArtLightingId;
  cameraId: ArtCameraId;
  userPrompt: string;
  width: number;
  height: number;
  /** id модели на бэке (не показываем в UI) */
  model?: string;
  provider?: string;
};

export type ArtHistoryEntry = {
  id: string;
  at: number;
  result: ArtBuildResult;
};
