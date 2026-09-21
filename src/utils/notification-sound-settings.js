import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiRequest } from '@/services/api/client';
import { getProfile, updateProfile } from '@/services/profile/profileApi';
const STORAGE_KEY = '@adventura/notification-sound-settings-v2';
const PRESETS_CACHE_KEY = '@adventura/notification-sound-presets-v3';
const FALLBACK_PRESETS = [
    {
        id: 'nsound_magic',
        slug: 'magic',
        label: 'Магия / Волшебство',
        description: 'Фэнтезийный тон по умолчанию',
        sortOrder: 0,
        isDefault: true,
        url: '/sounds/notify-magic.mp3',
    },
    {
        id: 'nsound_bell',
        slug: 'bell',
        label: 'Классический колокольчик',
        description: 'Короткий нейтральный «динь»',
        sortOrder: 1,
        isDefault: false,
        url: '/sounds/notify-bell.mp3',
    },
];
const DEFAULT_SETTINGS = {
    enabled: true,
    presetId: FALLBACK_PRESETS[0].id,
    useCustom: false,
    customUrl: null,
    effectiveUrl: FALLBACK_PRESETS[0].url,
};
let cachedSettings = { ...DEFAULT_SETTINGS };
let cachedPresets = [...FALLBACK_PRESETS];
let hydrated = false;
function writeWeb(key, value) {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
    }
}
function readWeb(key) {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage.getItem(key);
}
function parseSettings(raw) {
    if (!raw) {
        return { ...DEFAULT_SETTINGS };
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
            presetId: typeof parsed.presetId === 'string' ? parsed.presetId : DEFAULT_SETTINGS.presetId,
            useCustom: Boolean(parsed.useCustom),
            customUrl: typeof parsed.customUrl === 'string' ? parsed.customUrl : null,
            effectiveUrl: typeof parsed.effectiveUrl === 'string'
                ? parsed.effectiveUrl
                : DEFAULT_SETTINGS.effectiveUrl,
        };
    }
    catch {
        return { ...DEFAULT_SETTINGS };
    }
}
function parsePresets(raw) {
    if (!raw) {
        return [...FALLBACK_PRESETS];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return [...FALLBACK_PRESETS];
        }
        return parsed.filter((item) => item?.id && item?.url && item?.label);
    }
    catch {
        return [...FALLBACK_PRESETS];
    }
}
async function writeSettingsLocal(settings) {
    const payload = JSON.stringify(settings);
    await AsyncStorage.setItem(STORAGE_KEY, payload);
    writeWeb(STORAGE_KEY, payload);
}
async function writePresetsLocal(presets) {
    const payload = JSON.stringify(presets);
    await AsyncStorage.setItem(PRESETS_CACHE_KEY, payload);
    writeWeb(PRESETS_CACHE_KEY, payload);
}
export function getNotificationSoundSettingsSync() {
    if (!hydrated) {
        const fromWeb = parseSettings(readWeb(STORAGE_KEY));
        cachedSettings = fromWeb;
        cachedPresets = parsePresets(readWeb(PRESETS_CACHE_KEY));
        hydrated = true;
    }
    return cachedSettings;
}
export function getNotificationSoundPresetsSync() {
    getNotificationSoundSettingsSync();
    return cachedPresets;
}
export function getEffectiveNotificationSoundUrl() {
    const settings = getNotificationSoundSettingsSync();
    if (settings.useCustom && settings.customUrl) {
        return settings.customUrl;
    }
    if (settings.effectiveUrl) {
        return settings.effectiveUrl;
    }
    const preset = cachedPresets.find((item) => item.id === settings.presetId) ??
        cachedPresets.find((item) => item.isDefault) ??
        cachedPresets[0];
    return preset?.url ?? null;
}
export async function fetchNotificationSoundPresets() {
    try {
        const remote = await apiRequest('/notification-sounds', {
            skipAuthRefresh: true,
            skipLoading: true,
        });
        if (Array.isArray(remote) && remote.length > 0) {
            cachedPresets = remote;
            await writePresetsLocal(remote);
            return remote;
        }
    }
    catch {
        // keep cache / fallback
    }
    if (!cachedPresets.length) {
        cachedPresets = [...FALLBACK_PRESETS];
    }
    return cachedPresets;
}
export async function loadNotificationSoundSettings() {
    const fromStorage = parseSettings(await AsyncStorage.getItem(STORAGE_KEY));
    cachedSettings = fromStorage;
    cachedPresets = parsePresets(await AsyncStorage.getItem(PRESETS_CACHE_KEY));
    hydrated = true;
    writeWeb(STORAGE_KEY, JSON.stringify(fromStorage));
    return fromStorage;
}
export async function saveNotificationSoundSettings(next, options) {
    const settings = {
        enabled: next.enabled,
        presetId: next.presetId,
        useCustom: next.useCustom,
        customUrl: next.customUrl,
        effectiveUrl: next.effectiveUrl,
    };
    cachedSettings = settings;
    hydrated = true;
    await writeSettingsLocal(settings);
    if (options?.syncRemote !== false) {
        void updateProfile({
            notificationSoundsEnabled: settings.enabled,
            notificationSoundPresetId: settings.useCustom ? undefined : settings.presetId,
            useCustomNotificationSound: settings.useCustom,
        }).catch(() => {
            // local still applies
        });
    }
    return settings;
}
export async function hydrateNotificationSoundSettingsFromProfile() {
    const local = await loadNotificationSoundSettings();
    const presets = await fetchNotificationSoundPresets();
    try {
        const profile = await getProfile();
        const defaultPreset = presets.find((item) => item.isDefault) ?? presets[0] ?? null;
        let presetId = profile.notificationSoundPresetId ?? local.presetId;
        if (presetId && !presets.some((item) => item.id === presetId)) {
            presetId = defaultPreset?.id ?? null;
        }
        const useCustom = Boolean(profile.useCustomNotificationSound && profile.customNotificationSoundUrl);
        const settings = {
            enabled: typeof profile.notificationSoundsEnabled === 'boolean'
                ? profile.notificationSoundsEnabled
                : local.enabled,
            presetId,
            useCustom,
            customUrl: profile.customNotificationSoundUrl ?? null,
            effectiveUrl: profile.effectiveNotificationSoundUrl ??
                (useCustom
                    ? profile.customNotificationSoundUrl
                    : presets.find((item) => item.id === presetId)?.url) ??
                defaultPreset?.url ??
                null,
        };
        cachedSettings = settings;
        hydrated = true;
        await writeSettingsLocal(settings);
        return settings;
    }
    catch {
        const defaultPreset = presets.find((item) => item.isDefault) ?? presets[0];
        if (!local.effectiveUrl && defaultPreset) {
            local.effectiveUrl = defaultPreset.url;
            local.presetId = local.presetId ?? defaultPreset.id;
            cachedSettings = local;
            await writeSettingsLocal(local);
        }
        return local;
    }
}
