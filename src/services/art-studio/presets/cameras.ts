import type { ArtCameraId, ArtPresetOption } from '../types';

export const ART_CAMERAS: ArtPresetOption<ArtCameraId>[] = [
  {
    id: 'fullbody',
    label: 'Полный рост',
    hint: 'С ног до головы',
    token:
      'full-body shot, standing pose, complete figure from head to boots in frame, props and weapons visible, medium-wide camera distance',
  },
  {
    id: 'closeup',
    label: 'Крупный план',
    hint: 'Лицо / деталь',
    token:
      'close-up portrait framing, face and ears fully visible, hair tucked behind ears when needed, intimate camera distance, sharp facial detail',
  },
  {
    id: 'aerial',
    label: 'Птичий полёт',
    hint: 'Широкий угол',
    token: 'wide-angle aerial shot, elevated camera, sweeping vista perspective',
  },
  {
    id: 'isometric',
    label: 'Изометрия',
    hint: 'Макро / изо',
    token: 'isometric view, macro detail, tabletop diorama angle',
  },
];

export function getCameraPreset(id: string): ArtPresetOption<ArtCameraId> {
  return ART_CAMERAS.find((item) => item.id === id) ?? ART_CAMERAS[0];
}
