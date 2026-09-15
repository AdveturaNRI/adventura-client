import type { ArtEntityPreset } from '../types';

export const ART_ENTITIES: ArtEntityPreset[] = [
  {
    id: 'portrait',
    label: 'Портрет',
    hint: 'NPC / аватар',
    icon: 'person',
    size: { width: 768, height: 1024 },
    token:
      'masterpiece fantasy character portrait, species-defining facial features emphasized, detailed face, expressive eyes, sharp focus, ears and horns not hidden by hair when present',
    placeholder:
      'Эльфийка-следопыт с серебряной косой, длинные остроконечные уши, шрам через бровь, зелёный плащ…',
  },
  {
    id: 'landscape',
    label: 'Пейзаж',
    hint: 'Локация',
    icon: 'image',
    size: { width: 1024, height: 768 },
    token:
      'epic fantasy landscape vista, detailed environment, atmospheric depth, wide shot, breathtaking view',
    placeholder:
      'Горный перевал на закате, древние руины на хребте, туман в долине…',
  },
  {
    id: 'interior',
    label: 'Интерьер',
    hint: 'Таверна / подземелье',
    icon: 'home',
    size: { width: 1024, height: 768 },
    token:
      'detailed fantasy interior, atmospheric architecture, depth of field, environmental storytelling',
    placeholder:
      'Зал таверны «Пьяный василиск»: камин, дубовые столы, дым от трубок, карта на стене…',
  },
  {
    id: 'item',
    label: 'Предмет',
    hint: 'Артефакт / оружие',
    icon: 'diamond',
    size: { width: 1024, height: 1024 },
    token:
      'isolated RPG item asset, legendary artifact prop, centered composition, soft vignette, clean edges',
    placeholder:
      'Рунический клинок с синим свечением, рукоять из кости дракона…',
  },
  {
    id: 'token',
    label: 'VTT-токен',
    hint: 'Вид сверху',
    icon: 'disc',
    size: { width: 1024, height: 1024 },
    token:
      'top-down VTT character token, white background, tabletop miniature perspective, circular framing, species traits readable from above',
    placeholder:
      'Гном-воин с топором и красным щитом, вид сверху…',
  },
];

export function getEntityPreset(id: string): ArtEntityPreset {
  return ART_ENTITIES.find((item) => item.id === id) ?? ART_ENTITIES[0];
}
