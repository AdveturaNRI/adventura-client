import { apiRequest } from '@/services/api/client';
export function fetchUploadLimits() {
    return apiRequest('/reference/upload-limits', {
        skipAuthRefresh: true,
        skipLoading: true,
    });
}
export function fetchExperienceTypes() {
    return apiRequest('/reference/experience-types', {
        skipLoading: true,
    });
}
export function fetchGameSystems() {
    return apiRequest('/reference/game-systems', {
        skipLoading: true,
    });
}
export function fetchCities({ q, country = 'RU,BY', limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (q?.trim()) {
        params.set('q', q.trim());
    }
    if (country) {
        params.set('country', country);
    }
    if (limit) {
        params.set('limit', String(limit));
    }
    const query = params.toString();
    return apiRequest(`/reference/cities${query ? `?${query}` : ''}`, {
        skipLoading: true,
    });
}
