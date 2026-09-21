import { fetchUploadLimits } from '@/services/reference/referenceApi';
let cachedUploadLimits = null;
let pendingLoad = null;
export function getCachedUploadLimits() {
    return cachedUploadLimits;
}
export function getCachedFileTooLargeMessage() {
    return cachedUploadLimits?.fileTooLargeMessage ?? null;
}
export async function ensureUploadLimits() {
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
export function resetUploadLimitsCache() {
    cachedUploadLimits = null;
    pendingLoad = null;
}
