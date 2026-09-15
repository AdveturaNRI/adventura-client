import type { ArtPresetOption, ArtStyleId } from '../types';

export const ART_STYLES: ArtPresetOption<ArtStyleId>[] = [
  {
    id: 'dnd5e',
    label: 'D&D 5e',
    hint: 'Официальный артбук',
    token:
      'official D&D 5e sourcebook illustration, painted digital art, fantasy book illustration style',
  },
  {
    id: 'grimdark',
    label: 'Grimdark',
    hint: 'Тёмное фэнтези',
    token:
      'dark fantasy, gritty aesthetic, high contrast shadows, muted desaturated palette, dark realism',
  },
  {
    id: 'watercolor',
    label: 'Акварель',
    hint: 'Скетч',
    token:
      'expressive watercolor concept art, visible pencil linework, fluid color washes, parchment texture',
  },
  {
    id: 'oil',
    label: 'Масло',
    hint: 'Классика',
    token:
      'traditional oil painting, classical renaissance composition, visible brushstrokes, chiaroscuro',
  },
  {
    id: 'anime',
    label: 'Аниме',
    hint: 'JRPG',
    token:
      'modern anime fantasy key visual, vibrant colors, clean linework, cel shading style',
  },
  {
    id: 'pixel',
    label: 'Пиксель',
    hint: 'Ретро-RPG',
    token: '16-bit detailed pixel art, isometric retro rpg sprite, limited palette',
  },
];

export function getStylePreset(id: string): ArtPresetOption<ArtStyleId> {
  return ART_STYLES.find((item) => item.id === id) ?? ART_STYLES[0];
}
