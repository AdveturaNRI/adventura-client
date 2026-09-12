const loadedSlideIndices = new Set<number>();

export function isAuthSlideLoaded(index: number): boolean {
  return loadedSlideIndices.has(index);
}

export function markAuthSlideLoaded(index: number): void {
  loadedSlideIndices.add(index);
}
