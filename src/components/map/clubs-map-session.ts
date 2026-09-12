import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/constants/map.config';

export type ClubsMapCamera = {
  center: [number, number];
  zoom: number;
};

export type ClubsSelectedCity = {
  label: string;
  lat: number;
  lng: number;
};

function isValidCoord(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export const DEFAULT_CLUBS_CITY: ClubsSelectedCity = {
  label: 'Москва',
  lat: MAP_DEFAULT_CENTER[0],
  lng: MAP_DEFAULT_CENTER[1],
};

type ClubsMapSessionState = {
  camera: ClubsMapCamera | null;
  userLocation: { lat: number; lng: number } | null;
  locationDenied: boolean;
  selectedCity: ClubsSelectedCity | null;
  cityChosenManually: boolean;
  /** Уже делали авто-геолокацию при первом заходе */
  didInitialLocate: boolean;
  /** Уже подгоняли карту под маркеры / гео */
  didInitialCamera: boolean;
};

const state: ClubsMapSessionState = {
  camera: null,
  userLocation: null,
  locationDenied: false,
  selectedCity: DEFAULT_CLUBS_CITY,
  cityChosenManually: false,
  didInitialLocate: false,
  didInitialCamera: false,
};

export function getClubsMapSession(): ClubsMapSessionState {
  return state;
}

export function setClubsMapCamera(center: [number, number], zoom: number) {
  if (!isValidCoord(center[0], center[1]) || !Number.isFinite(zoom)) {
    return;
  }
  state.camera = { center, zoom };
  state.didInitialCamera = true;
}

export function setClubsMapUserLocation(point: { lat: number; lng: number } | null) {
  if (point && !isValidCoord(point.lat, point.lng)) {
    return;
  }
  state.userLocation = point;
  if (point) {
    state.locationDenied = false;
  }
}

export function setClubsMapLocationDenied(denied: boolean) {
  state.locationDenied = denied;
}

export function setClubsMapSelectedCity(
  city: ClubsSelectedCity | null,
  options?: { manual?: boolean },
) {
  if (city && !isValidCoord(city.lat, city.lng)) {
    state.selectedCity = {
      label: city.label,
      lat: DEFAULT_CLUBS_CITY.lat,
      lng: DEFAULT_CLUBS_CITY.lng,
    };
  } else {
    state.selectedCity = city;
  }
  if (options?.manual != null) {
    state.cityChosenManually = options.manual;
  }
}

export function markClubsMapInitialLocateDone() {
  state.didInitialLocate = true;
}

export function markClubsMapInitialCameraDone() {
  state.didInitialCamera = true;
}

export function getClubsMapInitialCamera(): ClubsMapCamera {
  const camera = state.camera;
  if (camera && isValidCoord(camera.center[0], camera.center[1])) {
    return camera;
  }
  return {
    center: MAP_DEFAULT_CENTER,
    zoom: MAP_DEFAULT_ZOOM,
  };
}

/** Сброс битых координат в сессии (NaN после кривого геокода). */
export function sanitizeClubsMapSession() {
  if (state.camera && !isValidCoord(state.camera.center[0], state.camera.center[1])) {
    state.camera = null;
  }
  if (state.userLocation && !isValidCoord(state.userLocation.lat, state.userLocation.lng)) {
    state.userLocation = null;
  }
  if (state.selectedCity && !isValidCoord(state.selectedCity.lat, state.selectedCity.lng)) {
    state.selectedCity = DEFAULT_CLUBS_CITY;
  }
}
