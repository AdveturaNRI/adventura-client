import type { UploadLimits } from '@/services/reference/referenceApi';
import { fetchUploadLimits } from '@/services/reference/referenceApi';

let cachedUploadLimits: UploadLimits | null = null;
let pendingLoad: Promise<UploadLimits> | null = null;

export function getCachedUploadLimits(): UploadLimits | null {
  return cachedUploadLimits;
}

export function getCachedFileTooLargeMessage(): string | null {
  return cachedUploadLimits?.fileTooLargeMessage ?? null;
}

export async function ensureUploadLimits(): Promise<UploadLimits> {
  if (cachedUploadLimits) {
    return cachedUploadLimits;
  }

  if (!pendingLoad) {
    pendingLoad = fetchUploadLimits()
      .then((limits) => {
        cachedUploadLimits = limits;
        return limits;
      })
      .finally(() => {
        pendingLoad = null;
      });
  }

  return pendingLoad;
}

export function resetUploadLimitsCache(): void {
  cachedUploadLimits = null;
  pendingLoad = null;
}
