export type PhotoCropVariant = 'avatar' | 'profileCard' | 'gameCover' | 'clubCover';

export type PhotoCropPreset = {
  aspectRatio: number;
  shape: 'circle' | 'rectangle';
  outputWidth: number;
  outputHeight: number;
  title: string;
  hint: string;
};

export const PHOTO_CROP_PRESETS: Record<PhotoCropVariant, PhotoCropPreset> = {
  avatar: {
    aspectRatio: 1,
    shape: 'circle',
    outputWidth: 512,
    outputHeight: 512,
    title: 'Аватар',
    hint: 'Круглое фото для профиля, чатов и списков игроков.',
  },
  profileCard: {
    aspectRatio: 3 / 4,
    shape: 'rectangle',
    outputWidth: 1200,
    outputHeight: 1600,
    title: 'Фото анкеты',
    hint: 'Вертикальное фото для вашей карточки в ленте Странники.',
  },
  gameCover: {
    aspectRatio: 16 / 9,
    shape: 'rectangle',
    outputWidth: 1600,
    outputHeight: 900,
    title: 'Обложка игры',
    hint: 'Широкое изображение для карточки вашей игры.',
  },
  clubCover: {
    aspectRatio: 16 / 9,
    shape: 'rectangle',
    outputWidth: 1600,
    outputHeight: 900,
    title: 'Обложка клуба',
    hint: 'Широкое фото 16:9 — так оно будет в списке клубов и на карточке.',
  },
};
