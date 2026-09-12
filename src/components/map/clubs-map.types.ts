import type { StyleProp, ViewStyle } from 'react-native';

export type ClubsMapMarker = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  /** Своя иконка клуба (кастомизация позже) */
  iconUrl?: string | null;
  /** Обложка — fallback для лица метки */
  coverUrl?: string | null;
  /** Цвет пина, по умолчанию brand primary */
  accentColor?: string | null;
};

export type ClubsMapFocusTarget = {
  /** Меняйте token, чтобы повторно сфокусировать те же координаты */
  token: number;
  lat: number;
  lng: number;
  zoom?: number;
};

export type ClubsMapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ClubsMapViewState = {
  center: [number, number];
  zoom: number;
  bounds: ClubsMapBounds;
};

export type ClubsMapProps = {
  style?: StyleProp<ViewStyle>;
  /** [lat, lng] */
  center?: [number, number];
  zoom?: number;
  markers?: ClubsMapMarker[];
  focusTarget?: ClubsMapFocusTarget | null;
  userLocation?: { lat: number; lng: number } | null;
  /** Не двигать карту под маркеры (после восстановления камеры) */
  lockCamera?: boolean;
  onMarkerPress?: (id: string) => void;
  onViewChange?: (view: ClubsMapViewState) => void;
};

/** Примерный радиус обзора по зуму (км) — запасной фильтр без bounds */
export function approxRadiusKmForZoom(zoom: number): number {
  // грубо: чем больше зум, тем меньше охват
  const clamped = Math.min(18, Math.max(3, zoom));
  return 40075 / Math.pow(2, clamped) * 0.45;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isPointInBounds(
  point: { lat: number; lng: number },
  bounds: ClubsMapBounds,
): boolean {
  const latOk = point.lat <= bounds.north && point.lat >= bounds.south;
  if (!latOk) {
    return false;
  }
  // обычный случай без пересечения 180°
  if (bounds.west <= bounds.east) {
    return point.lng >= bounds.west && point.lng <= bounds.east;
  }
  return point.lng >= bounds.west || point.lng <= bounds.east;
}
