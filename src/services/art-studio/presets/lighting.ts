import type { ArtLightingId, ArtPresetOption } from '../types';

export const ART_LIGHTING: ArtPresetOption<ArtLightingId>[] = [
  {
    id: 'cinematic',
    label: 'Кинематограф',
    token: 'cinematic dramatic lighting, volumetric god rays, rim light',
  },
  {
    id: 'candle',
    label: 'Камин / свечи',
    token: 'warm ambient candlelight, cozy fireplace glow, deep warm shadows',
  },
  {
    id: 'mystic-night',
    label: 'Мистическая ночь',
    token: 'nocturnal moonlight, glowing magical runes, bio-luminescence, cold blue mist',
  },
  {
    id: 'crimson',
    label: 'Багровый',
    token: 'eerie blood-red fog, ominous shadows, high dynamic range',
  },
  {
    id: 'daylight',
    label: 'Солнечный день',
    token: 'bright natural daylight, golden hour sunlight, soft diffuse shadows',
  },
];

export function getLightingPreset(id: string): ArtPresetOption<ArtLightingId> {
  return ART_LIGHTING.find((item) => item.id === id) ?? ART_LIGHTING[0];
}
