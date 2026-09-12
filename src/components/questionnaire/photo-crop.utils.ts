export type CropFrame = {
  width: number;
  height: number;
  left: number;
  top: number;
  centerX: number;
  centerY: number;
};

export function resolveCropFrame(
  canvasWidth: number,
  canvasHeight: number,
  aspectRatio: number,
  horizontalPadding: number,
): CropFrame {
  const maxWidth = canvasWidth - horizontalPadding * 2;
  const maxHeight = canvasHeight - horizontalPadding * 2;

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  width = Math.min(width, 320);
  height = width / aspectRatio;

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

export function resolveBaseScale(
  imageWidth: number,
  imageHeight: number,
  cropWidth: number,
  cropHeight: number,
) {
  return Math.max(cropWidth / imageWidth, cropHeight / imageHeight);
}

function clampTranslationValues(
  translateX: number,
  translateY: number,
  userScale: number,
  imageWidth: number,
  imageHeight: number,
  baseScale: number,
  cropWidth: number,
  cropHeight: number,
) {
  const effectiveScale = baseScale * userScale;
  const halfWidth = (imageWidth * effectiveScale) / 2;
  const halfHeight = (imageHeight * effectiveScale) / 2;
  const halfCropWidth = cropWidth / 2;
  const halfCropHeight = cropHeight / 2;

  const minX = halfCropWidth - halfWidth;
  const maxX = halfWidth - halfCropWidth;
  const minY = halfCropHeight - halfHeight;
  const maxY = halfHeight - halfCropHeight;

  return {
    x: maxX < minX ? 0 : Math.min(maxX, Math.max(minX, translateX)),
    y: maxY < minY ? 0 : Math.min(maxY, Math.max(minY, translateY)),
  };
}

export function clampTranslation(
  translateX: number,
  translateY: number,
  userScale: number,
  imageWidth: number,
  imageHeight: number,
  baseScale: number,
  cropWidth: number,
  cropHeight: number,
) {
  'worklet';

  return clampTranslationValues(
    translateX,
    translateY,
    userScale,
    imageWidth,
    imageHeight,
    baseScale,
    cropWidth,
    cropHeight,
  );
}

export function clampTranslationPlain(
  translateX: number,
  translateY: number,
  userScale: number,
  imageWidth: number,
  imageHeight: number,
  baseScale: number,
  cropWidth: number,
  cropHeight: number,
) {
  return clampTranslationValues(
    translateX,
    translateY,
    userScale,
    imageWidth,
    imageHeight,
    baseScale,
    cropWidth,
    cropHeight,
  );
}

export function computeCropRect(
  imageWidth: number,
  imageHeight: number,
  baseScale: number,
  userScale: number,
  translateX: number,
  translateY: number,
  cropFrame: CropFrame,
) {
  const effectiveScale = baseScale * userScale;
  const displayWidth = imageWidth * effectiveScale;
  const displayHeight = imageHeight * effectiveScale;
  const imageLeft = cropFrame.centerX - displayWidth / 2 + translateX;
  const imageTop = cropFrame.centerY - displayHeight / 2 + translateY;

  let originX = (cropFrame.left - imageLeft) / effectiveScale;
  let originY = (cropFrame.top - imageTop) / effectiveScale;
  let width = cropFrame.width / effectiveScale;
  let height = cropFrame.height / effectiveScale;

  originX = Math.max(0, Math.min(originX, imageWidth - width));
  originY = Math.max(0, Math.min(originY, imageHeight - height));
  width = Math.min(width, imageWidth - originX);
  height = Math.min(height, imageHeight - originY);

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(width),
    height: Math.round(height),
  };
}
