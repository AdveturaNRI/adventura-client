import { MAP_DEFAULT_CENTER } from '@/constants/map.config';

export function isFiniteLatLng(lat: unknown, lng: unknown): boolean {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  return (
    Number.isFinite(safeLat) &&
    Number.isFinite(safeLng) &&
    Math.abs(safeLat) <= 90 &&
    Math.abs(safeLng) <= 180
  );
}

export function toLatLng(
  lat: unknown,
  lng: unknown,
  fallback: [number, number] = MAP_DEFAULT_CENTER,
): [number, number] {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (isFiniteLatLng(safeLat, safeLng)) {
    return [safeLat, safeLng];
  }
  return fallback;
}
