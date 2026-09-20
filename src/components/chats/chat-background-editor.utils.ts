import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { CropFrame } from '@/components/questionnaire/photo-crop.utils';
import { computeCropRect } from '@/components/questionnaire/photo-crop.utils';

export type ChatBgEffect = 'photo' | 'blur' | 'gradient';

export const CHAT_BG_CROP = {
  aspectRatio: 9 / 16,
  outputWidth: 720,
  outputHeight: 1280,
  title: 'Фон чата',
  hint: 'Выберите область, которая будет видна за сообщениями.',
} as const;

export const CHAT_BG_EFFECTS: {
  id: ChatBgEffect;
  label: string;
  hint: string;
}[] = [
  { id: 'photo', label: 'Фото', hint: 'Обрезанное изображение как есть' },
  { id: 'blur', label: 'Блюр', hint: 'Размытый фон — текст читается лучше' },
  {
    id: 'gradient',
    label: 'Градиент',
    hint: 'Цвета из фото → мягкий градиент',
  },
];

export function resolveChatCropFrame(
  canvasWidth: number,
  canvasHeight: number,
  aspectRatio: number,
  padding: number,
): CropFrame {
  const maxWidth = canvasWidth - padding * 2;
  const maxHeight = canvasHeight - padding * 2;

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  const left = (canvasWidth - width) / 2;
  const top = (canvasHeight - height) / 2;

  return {
    width,
    height,
    left,
    top,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    image.src = uri;
  });
}

function averageRegion(
  data: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number] {
  const { width, data: px } = data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(data.width, Math.ceil(x1));
  const bottom = Math.min(data.height, Math.ceil(y1));

  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const i = (y * width + x) * 4;
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n += 1;
    }
  }

  if (n === 0) return [40, 44, 52];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${r},${g},${b})`;
}

function darken(c: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(c[0] * (1 - amount)),
    Math.round(c[1] * (1 - amount)),
    Math.round(c[2] * (1 - amount)),
  ];
}

async function renderViaCanvas(opts: {
  imageUri: string;
  crop: { originX: number; originY: number; width: number; height: number };
  effect: ChatBgEffect;
  outputWidth: number;
  outputHeight: number;
  blurPx: number;
}): Promise<string> {
  const image = await loadHtmlImage(opts.imageUri);
  const canvas = document.createElement('canvas');
  canvas.width = opts.outputWidth;
  canvas.height = opts.outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas недоступен');
  }

  const drawCropped = (filter?: string) => {
    if (filter) {
      ctx.filter = filter;
    } else {
      ctx.filter = 'none';
    }
    ctx.drawImage(
      image,
      opts.crop.originX,
      opts.crop.originY,
      opts.crop.width,
      opts.crop.height,
      0,
      0,
      opts.outputWidth,
      opts.outputHeight,
    );
    ctx.filter = 'none';
  };

  if (opts.effect === 'photo') {
    drawCropped();
  } else if (opts.effect === 'blur') {
    // Draw oversized then blur for smoother edges
    const pad = Math.ceil(opts.blurPx * 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, opts.outputWidth, opts.outputHeight);
    ctx.clip();
    ctx.filter = `blur(${opts.blurPx}px)`;
    ctx.drawImage(
      image,
      opts.crop.originX,
      opts.crop.originY,
      opts.crop.width,
      opts.crop.height,
      -pad,
      -pad,
      opts.outputWidth + pad * 2,
      opts.outputHeight + pad * 2,
    );
    ctx.restore();
    ctx.filter = 'none';
    // Soft dimmer for readability
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, opts.outputWidth, opts.outputHeight);
  } else {
    // Sample colors from a temporary unfiltered draw
    drawCropped();
    const sample = ctx.getImageData(0, 0, opts.outputWidth, opts.outputHeight);
    const band = Math.max(8, Math.floor(opts.outputHeight * 0.12));
    const top = darken(averageRegion(sample, 0, 0, opts.outputWidth, band), 0.08);
    const bottom = darken(
      averageRegion(sample, 0, opts.outputHeight - band, opts.outputWidth, opts.outputHeight),
      0.18,
    );
    const mid = darken(
      averageRegion(
        sample,
        0,
        opts.outputHeight * 0.4,
        opts.outputWidth,
        opts.outputHeight * 0.6,
      ),
      0.12,
    );

    ctx.clearRect(0, 0, opts.outputWidth, opts.outputHeight);

    // Soft blurred photo underlay
    ctx.filter = `blur(${Math.max(opts.blurPx, 18)}px)`;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(
      image,
      opts.crop.originX,
      opts.crop.originY,
      opts.crop.width,
      opts.crop.height,
      -20,
      -20,
      opts.outputWidth + 40,
      opts.outputHeight + 40,
    );
    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    const gradient = ctx.createLinearGradient(0, 0, 0, opts.outputHeight);
    gradient.addColorStop(0, rgb(top));
    gradient.addColorStop(0.45, rgb(mid));
    gradient.addColorStop(1, rgb(bottom));
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.88;
    ctx.fillRect(0, 0, opts.outputWidth, opts.outputHeight);
    ctx.globalAlpha = 1;
  }

  const webp = canvas.toDataURL('image/webp', 0.82);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function renderViaManipulator(opts: {
  imageUri: string;
  crop: { originX: number; originY: number; width: number; height: number };
  effect: ChatBgEffect;
  outputWidth: number;
  outputHeight: number;
}): Promise<string> {
  // Native: crop + resize. Blur/gradient baked effects need canvas — approximate
  // blur by downscale/upscale; gradient falls back to photo.
  const cropped = await manipulateAsync(
    opts.imageUri,
    [
      {
        crop: {
          originX: opts.crop.originX,
          originY: opts.crop.originY,
          width: opts.crop.width,
          height: opts.crop.height,
        },
      },
      { resize: { width: opts.outputWidth, height: opts.outputHeight } },
    ],
    { compress: 0.85, format: SaveFormat.WEBP },
  );

  if (opts.effect === 'blur') {
    const tiny = await manipulateAsync(
      cropped.uri,
      [{ resize: { width: 48 } }],
      { compress: 0.6, format: SaveFormat.JPEG },
    );
    const up = await manipulateAsync(
      tiny.uri,
      [{ resize: { width: opts.outputWidth, height: opts.outputHeight } }],
      { compress: 0.8, format: SaveFormat.WEBP },
    );
    return up.uri;
  }

  return cropped.uri;
}

export async function renderChatBackgroundImage(input: {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  baseScale: number;
  userScale: number;
  translateX: number;
  translateY: number;
  cropFrame: CropFrame;
  effect: ChatBgEffect;
  blurPx?: number;
}): Promise<string> {
  const crop = computeCropRect(
    input.imageWidth,
    input.imageHeight,
    input.baseScale,
    input.userScale,
    input.translateX,
    input.translateY,
    input.cropFrame,
  );

  if (crop.width < 2 || crop.height < 2) {
    throw new Error('Выберите область побольше');
  }

  const payload = {
    imageUri: input.imageUri,
    crop,
    effect: input.effect,
    outputWidth: CHAT_BG_CROP.outputWidth,
    outputHeight: CHAT_BG_CROP.outputHeight,
    blurPx: input.blurPx ?? 14,
  };

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return renderViaCanvas(payload);
  }

  return renderViaManipulator(payload);
}
