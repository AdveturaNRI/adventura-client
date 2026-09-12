/** Дефолтный акцент метки — primary Adventura */
export const CLUB_MARKER_DEFAULT_ACCENT = '#157AFE';

export type ClubMarkerVisual = {
  title?: string;
  /** Своя иконка клуба (будущая кастомизация) */
  iconUrl?: string | null;
  /** Обложка — fallback, если нет iconUrl */
  coverUrl?: string | null;
  accentColor?: string | null;
};

export const CLUB_MARKER_SIZE = {
  width: 44,
  height: 56,
  anchorX: 22,
  anchorY: 54,
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveFaceImage(visual: ClubMarkerVisual): string | null {
  const custom = visual.iconUrl?.trim();
  if (custom) {
    return custom;
  }
  const cover = visual.coverUrl?.trim();
  return cover || null;
}

function resolveInitial(title?: string) {
  const letter = title?.trim().charAt(0);
  return letter ? letter.toUpperCase() : 'A';
}

/** HTML для Leaflet DivIcon — общий для web и native WebView */
export function buildClubMarkerHtml(visual: ClubMarkerVisual): string {
  const accent = visual.accentColor?.trim() || CLUB_MARKER_DEFAULT_ACCENT;
  const imageUrl = resolveFaceImage(visual);
  const initial = escapeHtml(resolveInitial(visual.title));
  const titleAttr = visual.title ? ` title="${escapeHtml(visual.title)}"` : '';

  const face = imageUrl
    ? `<img class="club-marker__img" src="${escapeHtml(imageUrl)}" alt="" draggable="false" />`
    : `<span class="club-marker__initial">${initial}</span>`;

  return `<div class="club-marker"${titleAttr} style="--club-accent:${escapeHtml(accent)}">
  <div class="club-marker__pin">
    <div class="club-marker__face">${face}</div>
  </div>
  <div class="club-marker__dot"></div>
</div>`;
}

export const CLUB_MARKER_CSS = `
.club-marker {
  position: relative;
  width: ${CLUB_MARKER_SIZE.width}px;
  height: ${CLUB_MARKER_SIZE.height}px;
  margin: 0;
  padding: 0;
  pointer-events: auto;
}
.club-marker__pin {
  position: absolute;
  left: 50%;
  top: 0;
  width: 40px;
  height: 40px;
  margin-left: -20px;
  border-radius: 50% 50% 50% 4px;
  transform: rotate(-45deg);
  background: var(--club-accent, ${CLUB_MARKER_DEFAULT_ACCENT});
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.28);
  border: 2px solid #ffffff;
  box-sizing: border-box;
}
.club-marker__face {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  overflow: hidden;
  transform: rotate(45deg);
  background: #0b4fad;
  display: flex;
  align-items: center;
  justify-content: center;
}
.club-marker__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.club-marker__initial {
  color: #ffffff;
  font: 700 14px/1 system-ui, -apple-system, sans-serif;
  letter-spacing: -0.02em;
  user-select: none;
}
.club-marker__dot {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.28);
  filter: blur(1px);
}
.leaflet-marker-icon.club-marker-icon {
  background: transparent !important;
  border: none !important;
}
`;
