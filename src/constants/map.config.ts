/** Центр: Москва [lat, lng] — формат Leaflet */
export const MAP_DEFAULT_CENTER: [number, number] = [55.751244, 37.618423];

export const MAP_DEFAULT_ZOOM = 12;

/**
 * Рабочая зона СНГ / РФ (Leaflet LatLngBounds: SW → NE).
 * Юго-Запад [35, 19] — Северо-Восток [82, 190] (Берингов пролив, непрерывный восток).
 */
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [35.0, 19.0],
  [82.0, 190.0],
];

/** Нельзя ужать карту до «пятна» на пустом экране */
export const MAP_MIN_ZOOM = 3;

/** 1 = жёсткая блокировка панорамирования за пределы maxBounds */
export const MAP_MAX_BOUNDS_VISCOSITY = 1;

/**
 * OpenStreetMap — бесплатно, без ключа.
 * detectRetina: на HiDPI берёт тайлы соседнего зума, чтобы меньше мылилось.
 * В России подписи обычно уже на русском (локальные name в OSM).
 * noWrap: без копий мира по кругу (дубли меток / бесконечный скролл).
 */
export const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const MAP_TILE_OPTIONS = {
  attribution: MAP_TILE_ATTRIBUTION,
  minZoom: MAP_MIN_ZOOM,
  maxZoom: 19,
  detectRetina: true,
  noWrap: true,
  bounds: MAP_MAX_BOUNDS,
} as const;

export const MAP_LEAFLET_OPTIONS = {
  minZoom: MAP_MIN_ZOOM,
  maxBounds: MAP_MAX_BOUNDS,
  maxBoundsViscosity: MAP_MAX_BOUNDS_VISCOSITY,
  worldCopyJump: false,
} as const;

/** Мелкая полупрозрачная плашка — текст остаётся читаемым. */
export const MAP_ATTRIBUTION_CSS = `
.leaflet-control-attribution {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  margin: 0 6px 4px 0 !important;
  padding: 0 !important;
  font: 10px/1.25 system-ui, -apple-system, sans-serif !important;
  color: rgba(40, 40, 40, 0.5) !important;
  text-shadow: 0 0 3px rgba(255, 255, 255, 0.9), 0 1px 0 rgba(255, 255, 255, 0.8);
}
.leaflet-control-attribution a {
  color: rgba(40, 40, 40, 0.55) !important;
  text-decoration: none !important;
}
.leaflet-control-attribution a:hover {
  color: rgba(40, 40, 40, 0.8) !important;
}
`;
