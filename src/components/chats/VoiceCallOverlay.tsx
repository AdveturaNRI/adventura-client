import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { avatarFrameOuterSize } from '@/components/rewards/AvatarFrame';
import { NameWithBadges, RewardBadgeRow } from '@/components/rewards/RewardBadge';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import type { RewardBadgeType } from '@/data/rewards/catalog';
import { VoiceCallDiceLayer } from '@/components/chats/VoiceCallDiceLayer';
import { CallBardSheet } from '@/components/chats/CallBardSheet';
import type { CallMusicLayerLive, CallMusicQueueEntry } from '@/hooks/use-call-shared-music';
import { CallVideoView } from '@/components/chats/CallVideoView';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import type {
  ChatLiveScreenStream,
  ChatLiveVoiceParticipant,
  ChatLiveVoiceStatus,
  ScreenShareQuality,
} from '@/hooks/use-chat-live-voice';
import { SCREEN_SHARE_QUALITY_OPTIONS } from '@/hooks/use-chat-live-voice';
import { getWebHostNode } from '@/utils/web-file-drop';
import type { VideoTrack } from 'livekit-client';

type FullscreenCapable = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

function getOsFullscreenElement(): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const doc = document as FullscreenDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function tryRequestFullscreen(target: FullscreenCapable): Promise<boolean> {
  try {
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen();
      return true;
    }
    if (typeof target.webkitRequestFullscreen === 'function') {
      await target.webkitRequestFullscreen();
      return true;
    }
    if (typeof target.msRequestFullscreen === 'function') {
      await target.msRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function requestOsFullscreen(host: HTMLElement | null): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  if (getOsFullscreenElement()) {
    return;
  }
  const root = document.documentElement as FullscreenCapable;
  if (host && (await tryRequestFullscreen(host as FullscreenCapable))) {
    return;
  }
  // Modal host can refuse FS — fall back to the page root (true monitor fullscreen).
  await tryRequestFullscreen(root);
}

async function exitOsFullscreen(): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  if (!getOsFullscreenElement()) {
    return;
  }
  const doc = document as FullscreenDocument;
  try {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
      return;
    }
    if (typeof doc.msExitFullscreen === 'function') {
      await doc.msExitFullscreen();
    }
  } catch {
    // ignore
  }
}

export const BARD_TILE_KEY = 'bard';

type OverlayTile = {
  key: string;
  /** LiveKit identity — one tile per participant; key === identity for people. */
  identity?: string;
  name: string;
  avatarUrl: string | null;
  speaking: boolean;
  muted: boolean;
  cameraOn: boolean;
  videoTrack: VideoTrack | null;
  /** Watching this participant's screen in their single tile (not a duplicate). */
  screenShareOn?: boolean;
  screenShareTrack?: VideoTrack | null;
  isLocal: boolean;
  waiting?: boolean;
  /** Accepted, still joining LiveKit. */
  connecting?: boolean;
  urgent?: boolean;
  badges?: RewardBadgeType[];
  frameId?: string | null;
  /** Local playback gain 0…1 (remote only). */
  volume?: number;
  isBard?: boolean;
  bardPlaque?: string | null;
  bardPlaying?: boolean;
  /** Local track buffering — spinner around Bard avatar. */
  bardLoading?: boolean;
  /** Dev-only fake participant for layout tests. */
  mock?: boolean;
  mockHue?: number;
};

type MockCallPeer = {
  id: string;
  name: string;
  cameraOn: boolean;
  speaking: boolean;
  hue: number;
};

const MOCK_NAMES = ['Мок_Алиса', 'Мок_Борис', 'Мок_Вера', 'Мок_Глеб', 'Мок_Дина'];

const CONTROL_BTN_SIZE = 44;
const CONTROL_BTN_GAP = 8;
/** Hangup is wider than a normal control (68 vs 44). */
const CONTROL_HANGUP_EXTRA = 24;

function playMockBeep() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 520;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // ignore — mock audio is best-effort
  }
}

function tileIdentity(tile: OverlayTile): string {
  return tile.identity ?? tile.key;
}

/** Real cam track or mock-cam demo — avatar-only never opens priority stage. */
function tileHasPriorityVideo(tile: OverlayTile): boolean {
  if (tile.waiting || tile.isBard || !tile.cameraOn) {
    return false;
  }
  return Boolean(tile.videoTrack || tile.mock);
}

/** Discord-style: fixed landscape thumb height — does not change with participant count. */
function discordRailTileHeight(tileW: number): number {
  return Math.round(tileW * (9 / 16)) + 12;
}

function discordRailTileWidth(isDesktop: boolean): number {
  return isDesktop ? 260 : 220;
}

/** How many full rows fit before the peek of the next row. */
const MOBILE_GRID_FIT_ROWS = 2;
/** Fraction of the next row kept visible so scroll is obvious. */
const MOBILE_GRID_PEEK_RATIO = 0.42;

/**
 * Mobile stack under priority: adaptive cols that always fill the row.
 * Phone (<480): 2 cols. Wider: 3 cols. Desktop side-rail is separate.
 */
function mobileStackFilmLayout(
  stageWidth: number,
  filmCount: number,
  filmGap: number,
  filmBudgetH?: number,
) {
  const cols = stageWidth < 480 ? 2 : 3;
  // Full stage width — tiles must sum to ≤100% so the row never wraps early.
  const innerW = Math.max(200, Math.floor(stageWidth));
  const gapTotal = filmGap * Math.max(0, cols - 1);
  const tileW = Math.max(96, Math.floor((innerW - gapTotal) / cols));
  const rowsTarget = MOBILE_GRID_FIT_ROWS;
  const minTileH = Math.round(tileW * 0.72);
  const budgetTileH =
    typeof filmBudgetH === 'number' && filmBudgetH > 0
      ? Math.floor((filmBudgetH - filmGap * (rowsTarget - 1)) / rowsTarget)
      : Math.round(tileW * 0.9);
  const tileH = Math.max(
    minTileH,
    Math.min(Math.round(tileW * 1.05), budgetTileH),
  );
  const totalRows = Math.max(1, Math.ceil(Math.max(1, filmCount) / cols));
  const rows = Math.min(rowsTarget, totalRows);
  const peek =
    totalRows > rowsTarget
      ? Math.max(36, Math.round(tileH * MOBILE_GRID_PEEK_RATIO))
      : 0;
  const railH = tileH * rows + filmGap * Math.max(0, rows - 1) + peek;
  const reserveH =
    tileH * rowsTarget + filmGap * (rowsTarget - 1) + peek;
  return { cols, tileW, tileH, rows, railH, reserveH, needsScroll: peek > 0 };
}

/** Voice tile height used for scroll/peek math on mobile. */
function estimateVoiceTileHeight(tileWidth: number, avatarSize: number): number {
  return Math.max(Math.round(tileWidth * 1.08), avatarSize + 76);
}

/**
 * Mobile equal-grid viewport: 2 full rows + a sliver of the next,
 * so overflow is obvious and the scrollbar has a job.
 */
function mobileGridScrollMetrics(opts: {
  stageBudget: number;
  tileH: number;
  gap: number;
  rows: number;
}) {
  const { stageBudget, tileH, gap, rows } = opts;
  if (rows <= MOBILE_GRID_FIT_ROWS) {
    return {
      scrollH: stageBudget,
      needsScroll: false,
      contentH: tileH * rows + gap * Math.max(0, rows - 1),
    };
  }
  const peek = Math.max(32, Math.round(tileH * MOBILE_GRID_PEEK_RATIO));
  const fitH =
    tileH * MOBILE_GRID_FIT_ROWS +
    gap * (MOBILE_GRID_FIT_ROWS - 1) +
    peek;
  const contentH = tileH * rows + gap * Math.max(0, rows - 1);
  return {
    scrollH: Math.min(stageBudget, fitH),
    needsScroll: contentH > fitH - 4,
    contentH,
  };
}

/** Web: keep a thin scrollbar painted so overflow isn't invisible. */
const mobileScrollBarStyle =
  Platform.OS === 'web'
    ? ({
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.5) rgba(255,255,255,0.08)',
        // @ts-expect-error RN Web scrollbar
        scrollbarGutter: 'stable',
      } as object)
    : null;

const PRIORITY_RESIZE_HANDLE_W = 20;
/** Soft floor — real min also keeps the rail grid from clipping. */
const PRIORITY_PANE_MIN_W = 360;
/** Name row under priority video (must fit in stage height). */
const PRIORITY_CAPTION_EXTRA = 40;

const CINEMA_PIP_DEFAULT_W = 208;
const CINEMA_PIP_DEFAULT_H = 118;
const CINEMA_PIP_MIN_W = 140;
const CINEMA_PIP_MAX_W = 360;
const CINEMA_PIP_GAP = 10;
const CINEMA_PIP_PAD = 12;
/** Edge tab to collapse/expand the cinema people rail. */
const CINEMA_RAIL_TAB_W = 28;
const CINEMA_RAIL_TAB_H = 56;
/** Bottom reserve so the rail never sits under the call dock. */
const CINEMA_RAIL_CONTROLS_RESERVE = 108;
/** Mobile cinema strip: space above the floating control capsule. */
const CINEMA_STRIP_CONTROLS_RESERVE = 78;
/** Collapsed reopen chip. */
const CINEMA_RAIL_CHIP_H = 36;
/** Mobile strip: landscape thumbs (readable, not edge-to-edge). */
const CINEMA_STRIP_TILE_W = 108;
const CINEMA_STRIP_TILE_H = 72;
const CINEMA_STRIP_TILE_GAP = 8;
/** Mobile cinema control button size (smaller than desktop dock). */
const CONTROL_BTN_SIZE_MOBILE = 40;
/** Mobile cinema: hide the dock after idle (PC keeps hover reveal). */
const MOBILE_CINEMA_CONTROLS_HIDE_MS = 2800;

type CinemaPipLayout = {
  w: number;
  h: number;
  x: number;
  y: number;
  /** Docked to the right/bottom edges; survives stage resize. */
  docked?: boolean;
  right?: number;
  bottom?: number;
};

function cinemaPipAspectHeight(width: number) {
  return Math.round(width * (CINEMA_PIP_DEFAULT_H / CINEMA_PIP_DEFAULT_W));
}

function clampCinemaPipSize(width: number, stageW: number) {
  const maxW = Math.min(
    CINEMA_PIP_MAX_W,
    Math.max(CINEMA_PIP_MIN_W, stageW - CINEMA_PIP_PAD),
  );
  const w = Math.max(CINEMA_PIP_MIN_W, Math.min(maxW, Math.round(width)));
  return { w, h: cinemaPipAspectHeight(w) };
}

/** Resolve stored layout → absolute frame for the current stage size. */
function resolveCinemaPipLayout(
  layout: CinemaPipLayout,
  stageW: number,
  stageH: number,
): { x: number; y: number; w: number; h: number } {
  const { w, h } = clampCinemaPipSize(layout.w, stageW);
  const maxX = Math.max(0, stageW - w);
  const maxY = Math.max(0, stageH - h);
  if (layout.docked) {
    const right = Math.max(0, layout.right ?? 0);
    const bottom = Math.max(0, layout.bottom ?? CINEMA_PIP_PAD);
    return {
      w,
      h,
      x: Math.max(0, Math.min(maxX, stageW - w - right)),
      y: Math.max(0, Math.min(maxY, stageH - h - bottom)),
    };
  }
  return {
    w,
    h,
    x: Math.max(0, Math.min(maxX, Math.round(layout.x))),
    y: Math.max(0, Math.min(maxY, Math.round(layout.y))),
  };
}

function clampCinemaPipLayout(
  layout: CinemaPipLayout,
  stageW: number,
  stageH: number,
): CinemaPipLayout {
  const frame = resolveCinemaPipLayout(layout, stageW, stageH);
  if (layout.docked) {
    return {
      ...layout,
      w: frame.w,
      h: frame.h,
      x: frame.x,
      y: frame.y,
      docked: true,
      right: Math.max(0, stageW - frame.x - frame.w),
      bottom: Math.max(0, stageH - frame.y - frame.h),
    };
  }
  return {
    w: frame.w,
    h: frame.h,
    x: frame.x,
    y: frame.y,
    docked: false,
  };
}

/**
 * Phone / narrow: horizontal strip under the stage.
 * Always on mobile — don't wait for stage onLayout (initial size was 1280).
 */
function cinemaPeopleUseBottomStrip(stageW: number, mobileLayout = false) {
  if (mobileLayout) {
    return true;
  }
  return Math.max(280, Math.round(stageW)) < 720;
}

/** Adaptive PIP card size by stage width / strip mode. */
function cinemaRailTileSize(stageW: number, bottomStrip = false) {
  const w = Math.max(280, Math.round(stageW));
  if (bottomStrip) {
    return { tileW: CINEMA_STRIP_TILE_W, tileH: CINEMA_STRIP_TILE_H };
  }
  if (w < 420) {
    return { tileW: 100, tileH: 64 };
  }
  if (w < 720) {
    return { tileW: 128, tileH: 78 };
  }
  return { tileW: CINEMA_PIP_DEFAULT_W, tileH: CINEMA_PIP_DEFAULT_H };
}

/** How many cards fit in one right-hand column for the given tile height. */
function cinemaOneColFit(availH: number, tileH: number) {
  const usable = Math.max(tileH, Math.round(availH));
  return Math.max(
    1,
    Math.floor((usable + CINEMA_PIP_GAP) / (tileH + CINEMA_PIP_GAP)),
  );
}

/**
 * Dock pack: fill column 1 top→bottom, then column 2 (to the left).
 * Overflow scrolls inside the rail when needed.
 */
function defaultCinemaPipLayout(
  index: number,
  stageH: number,
  stageW = 1280,
  mobileLayout = false,
): CinemaPipLayout {
  const bottomStrip = cinemaPeopleUseBottomStrip(stageW, mobileLayout);
  const { tileW: w, tileH: h } = cinemaRailTileSize(stageW, bottomStrip);
  if (bottomStrip) {
    const pad = CINEMA_PIP_PAD;
    return {
      w,
      h,
      x: 0,
      y: 0,
      docked: true,
      right: pad + index * (w + CINEMA_PIP_GAP),
      bottom: CINEMA_STRIP_CONTROLS_RESERVE + pad,
    };
  }
  const padTop = CINEMA_PIP_PAD;
  const padBottom = CINEMA_PIP_PAD + CINEMA_RAIL_CONTROLS_RESERVE;
  const availH = Math.max(h, Math.round(stageH) - padTop - padBottom);
  const fit = cinemaOneColFit(availH, h);
  const col = Math.floor(index / fit);
  const row = index % fit;
  const top = padTop + row * (h + CINEMA_PIP_GAP);
  return {
    w,
    h,
    x: 0,
    y: 0,
    docked: true,
    right: CINEMA_PIP_PAD + col * (w + CINEMA_PIP_GAP),
    bottom: Math.max(0, Math.round(stageH) - top - h),
  };
}

/** People dock metrics: bottom strip on phone, right rail on wide. */
function cinemaRailMetrics(
  count: number,
  stageH: number,
  stageW: number,
  edgePad: { top: number; right: number; bottom: number },
  mobileLayout = false,
) {
  const n = Math.max(0, count);
  const bottomStrip = cinemaPeopleUseBottomStrip(stageW, mobileLayout);
  const { tileW, tileH } = cinemaRailTileSize(stageW, bottomStrip);
  const padTop = Math.max(CINEMA_PIP_PAD, edgePad.top);
  const padRight = Math.max(10, edgePad.right);
  const padLeft = Math.max(10, edgePad.right);
  const padBottom = Math.max(
    CINEMA_PIP_PAD,
    edgePad.bottom + (bottomStrip ? 8 : CINEMA_RAIL_CONTROLS_RESERVE),
  );
  if (bottomStrip) {
    // One row of face chips + collapse control — no tall header panel.
    const stripH = tileH + 10;
    return {
      mode: 'strip' as const,
      tileW,
      tileH,
      cols: n,
      rows: 1,
      rowsPerCol: 1,
      railW: Math.max(1, Math.round(stageW) - padLeft - padRight),
      hostH: stripH + padBottom,
      contentH: tileH,
      scroll: true,
      availH: tileH,
      padTop,
      padRight,
      padLeft,
      padBottom,
      stripH,
      controlsReserve: CINEMA_STRIP_CONTROLS_RESERVE,
    };
  }
  const hostH = Math.max(tileH + padTop + padBottom, Math.round(stageH));
  const availH = Math.max(tileH, hostH - padTop - padBottom);
  const rowsPerCol = cinemaOneColFit(availH, tileH);
  const needScroll = n > rowsPerCol;
  const cols = needScroll ? 1 : Math.max(1, Math.ceil(n / rowsPerCol));
  const rows = needScroll ? n : Math.min(rowsPerCol, Math.max(1, n));
  const railW = cols * tileW + Math.max(0, cols - 1) * CINEMA_PIP_GAP;
  const contentH = rows * tileH + Math.max(0, rows - 1) * CINEMA_PIP_GAP;
  return {
    mode: 'rail' as const,
    tileW,
    tileH,
    cols,
    rows,
    rowsPerCol,
    railW,
    hostH,
    contentH,
    scroll: needScroll || contentH > availH,
    availH,
    padTop,
    padRight,
    padLeft,
    padBottom,
    stripH: 0,
    controlsReserve: CINEMA_RAIL_CONTROLS_RESERVE,
  };
}

function railFilmWidthBounds(isDesktop: boolean) {
  return {
    minFilmW: isDesktop ? 200 : 168,
    maxFilmW: isDesktop ? 300 : 250,
    defaultFilmW: discordRailTileWidth(isDesktop),
  };
}

/** Largest 16:9 box that fits inside maxW × maxH. */
function fitLandscape16x9(maxW: number, maxH: number) {
  const safeW = Math.max(160, maxW);
  const safeH = Math.max(120, maxH);
  const byHeightW = Math.round(safeH * (16 / 9));
  if (byHeightW <= safeW) {
    return { width: byHeightW, height: safeH };
  }
  return { width: safeW, height: Math.round(safeW * (9 / 16)) };
}

/**
 * Smallest priority width where the side rail still fits without cropping tiles.
 * Shrinking priority shortens rail height while widening tiles — 2+ rows can clip.
 */
function minPriorityWidthForRail(opts: {
  stageWidth: number;
  spotMaxH: number;
  filmCount: number;
  filmCols: number;
  filmGap: number;
  stageGap: number;
  isDesktop: boolean;
}) {
  const { stageWidth, spotMaxH, filmCount, filmCols, filmGap, stageGap, isDesktop } =
    opts;
  const { minFilmW, maxFilmW } = railFilmWidthBounds(isDesktop);
  const cols = Math.max(1, filmCols);
  const rows = Math.max(1, Math.ceil(Math.max(1, filmCount) / cols));
  const railGaps = filmGap * Math.max(0, cols - 1);
  const minRailW = minFilmW * cols + railGaps;
  const maxSpotByRail = Math.max(
    PRIORITY_PANE_MIN_W,
    stageWidth - minRailW - stageGap,
  );

  const railContentH = (tileW: number) => {
    const tileH = discordRailTileHeight(tileW);
    return tileH * rows + filmGap * Math.max(0, rows - 1);
  };

  // Binary search: smallest W where fitted height covers rail content at that W.
  let lo = PRIORITY_PANE_MIN_W;
  let hi = Math.max(lo, Math.min(Math.floor(stageWidth * 0.72), maxSpotByRail));
  let best = hi;
  for (let i = 0; i < 16; i += 1) {
    const mid = Math.round((lo + hi) / 2);
    const fitted = fitLandscape16x9(mid, spotMaxH);
    const railBudget = Math.max(minRailW, stageWidth - fitted.width - stageGap);
    const filmTileW = Math.max(
      minFilmW,
      Math.min(maxFilmW, Math.floor((railBudget - railGaps) / cols)),
    );
    if (fitted.height + 2 >= railContentH(filmTileW)) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return Math.min(maxSpotByRail, Math.max(PRIORITY_PANE_MIN_W, best));
}

/** Priority + rail widths for fullscreen side-film (optional user drag width). */
function sizePrioritySideFilm(opts: {
  stageWidth: number;
  spotMaxH: number;
  filmCount: number;
  filmCols: number;
  filmGap: number;
  stageGap: number;
  isDesktop: boolean;
  preferredSpotW: number | null;
}) {
  const {
    stageWidth,
    spotMaxH,
    filmCount,
    filmCols,
    filmGap,
    stageGap,
    isDesktop,
    preferredSpotW,
  } = opts;
  const { minFilmW, maxFilmW, defaultFilmW } = railFilmWidthBounds(isDesktop);
  const railGaps = filmGap * Math.max(0, filmCols - 1);
  const minRailW = minFilmW * filmCols + railGaps;
  const minSpotW = minPriorityWidthForRail({
    stageWidth,
    spotMaxH,
    filmCount,
    filmCols,
    filmGap,
    stageGap,
    isDesktop,
  });
  const maxSpotW = Math.max(
    minSpotW,
    Math.min(
      Math.floor(stageWidth * 0.78),
      stageWidth - minRailW - stageGap,
    ),
  );
  const autoRailW = defaultFilmW * filmCols + railGaps;
  const autoLeftover = Math.max(minSpotW, stageWidth - autoRailW - stageGap);
  // Prefer filling spotMaxH (16:9). Old 0.62×stage cap left a short island
  // at medium widths with empty black below.
  const heightFirstW = Math.round(Math.max(120, spotMaxH) * (16 / 9));
  const autoMaxSpot = Math.min(
    autoLeftover,
    Math.max(heightFirstW, Math.floor(stageWidth * 0.55)),
  );
  const autoFit = fitLandscape16x9(autoMaxSpot, spotMaxH);
  const targetSpotW = Math.max(
    minSpotW,
    Math.min(maxSpotW, preferredSpotW ?? autoFit.width),
  );
  const fitted = fitLandscape16x9(targetSpotW, spotMaxH);
  const railBudget = Math.max(minRailW, stageWidth - fitted.width - stageGap);
  const filmTileW = Math.max(
    minFilmW,
    Math.min(
      maxFilmW,
      Math.floor((railBudget - railGaps) / Math.max(1, filmCols)),
    ),
  );
  const railContentW = filmTileW * filmCols + railGaps;
  return {
    spotlightWidth: fitted.width,
    spotlightVideoHeight: fitted.height,
    filmTileW,
    railContentW,
    maxSpotW,
    minSpotW,
  };
}

const SPEAKER_HOLD_MS = 1100;
const SPEAKER_SWITCH_SILENT_MS = 350;

export type VoiceCallWaitingPeer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  connecting?: boolean;
};

type Props = {
  visible: boolean;
  minimized?: boolean;
  title: string;
  isGroup?: boolean;
  status: ChatLiveVoiceStatus;
  ringing?: boolean;
  error: string | null;
  muted: boolean;
  deafened: boolean;
  cameraOn?: boolean;
  screenShareOn?: boolean;
  /** Currently watched screen-share identity (null = not watching / need pick). */
  selectedScreenIdentity?: string | null;
  /** All published screen shares for the picker. */
  screenStreams?: ChatLiveScreenStream[];
  participants: ChatLiveVoiceParticipant[];
  /** Members still being rung / not yet in LiveKit. */
  waitingPeers?: VoiceCallWaitingPeer[];
  /** identity → urgent flag (sticky until sender clears) */
  urgentById?: Record<string, boolean>;
  /** Local playback gain per remote identity (0…1). */
  volumeById?: Record<string, number>;
  /** Chat to post dice rolls into (same conversation as the call). */
  conversationId?: string | null;
  diceSenderNickname?: string;
  onToggleMute: () => void;
  /** Web: start getUserMedia while finger is down (unmute / retry). */
  onMicGesture?: () => void;
  onToggleDeafen: () => void;
  onToggleCamera?: () => void;
  /** Flip front ↔ rear while camera is on. */
  onSwitchCameraFacing?: () => void;
  /** Share monitor / window / tab. Quality required when starting (ignored when stopping). */
  onToggleScreenShare?: (quality?: ScreenShareQuality) => void;
  /** Subscribe to one screen share (null = stop watching). */
  onSelectScreenShare?: (identity: string | null) => void;
  onHangup: () => void;
  onRetry?: () => void;
  onMinimize?: () => void;
  onExpand?: () => void;
  onUrgentRequest?: () => void;
  onSetParticipantVolume?: (identity: string, volume: number) => void;
  canControlMusic?: boolean;
  bardPresent?: boolean;
  bardTrackTitle?: string | null;
  bardPlaying?: boolean;
  bardLoading?: boolean;
  bardQueue?: CallMusicQueueEntry[];
  bardLayerLive?: Record<string, CallMusicLayerLive>;
  bardLocalVolume?: number;
  bardGlobalVolume?: number;
  bardLocalDisplayName?: string;
  onSummonBard?: () => void;
  onDismissBard?: () => void;
  onSetBardLocalVolume?: (volume: number) => void;
  onEnqueueBardTrack?: (
    trackId: string,
    title: string,
    durationSec: number | null,
    playUrl?: string | null,
  ) => void;
  onRemoveBardQueueEntry?: (entryId: string) => void;
  onToggleBardLayerPlay?: (entryId: string) => void;
  onSeekBardLayer?: (entryId: string, positionSec: number) => void;
  onSetBardLayerVolume?: (entryId: string, volume: number) => void;
  onToggleBardLayerLoop?: (entryId: string) => void;
  onToggleBardPlay?: () => void;
  onSetBardGlobalVolume?: (volume: number) => void;
  onRequestBardSync?: () => void;
  /** Unlock + retry Bard audio (web autoplay) from a user gesture. */
  onResumeBardAudio?: () => void;
};

/** Survives expand/collapse while the call is up. */
let savedMiniOffset = { x: 0, y: 0 };

function clampMiniOffset(
  offset: { x: number; y: number },
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
  anchor: { right: number; bottom: number },
) {
  const margin = 8;
  const minX = margin - (viewport.width - bar.width - anchor.right);
  const maxX = Math.max(minX, anchor.right - margin);
  const minY = margin - (viewport.height - bar.height - anchor.bottom);
  const maxY = Math.max(minY, anchor.bottom - margin);
  return {
    x: Math.min(maxX, Math.max(minX, offset.x)),
    y: Math.min(maxY, Math.max(minY, offset.y)),
  };
}

function formatCallDuration(totalSec: number) {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Ringing / waiting: soft square frame breathe (no hard scale reset — that jerks). */
function WaitingFramePulse() {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      glow.setValue(0);
    };
  }, [glow]);

  return (
    <View pointerEvents="none" style={styles.waitingFrameLayer}>
      <Animated.View
        style={[
          styles.waitingFramePulse,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.25, 0.95],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.waitingFramePulseOuter,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.45],
            }),
          },
        ]}
      />
    </View>
  );
}

function UrgentPulseRings({ size }: { size: number }) {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const loopA = makeLoop(pulseA, 0);
    const loopB = makeLoop(pulseB, 450);
    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
      pulseA.setValue(0);
      pulseB.setValue(0);
    };
  }, [pulseA, pulseB]);

  const ringStyle = (value: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: value.interpolate({
      inputRange: [0, 0.12, 1],
      outputRange: [0.7, 0.4, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.65],
        }),
      },
    ],
  });

  return (
    <View pointerEvents="none" style={[styles.pulseLayer, { width: size, height: size }]}>
      <Animated.View style={[styles.urgentPulseRing, ringStyle(pulseA)]} />
      <Animated.View style={[styles.urgentPulseRing, ringStyle(pulseB)]} />
    </View>
  );
}

/** Soft blue pulse + border shimmer while Bard is playing. */
function BardPlayingAura({ size, active }: { size: number; active: boolean }) {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulseA.setValue(0);
      pulseB.setValue(0);
      shimmer.setValue(0);
      breath.setValue(0);
      return;
    }

    const makePulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 1400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const loopA = makePulse(pulseA, 0);
    const loopB = makePulse(pulseB, 700);
    loopA.start();
    loopB.start();
    shimmerLoop.start();
    breathLoop.start();
    return () => {
      loopA.stop();
      loopB.stop();
      shimmerLoop.stop();
      breathLoop.stop();
      pulseA.setValue(0);
      pulseB.setValue(0);
      shimmer.setValue(0);
      breath.setValue(0);
    };
  }, [active, breath, pulseA, pulseB, shimmer]);

  if (!active) {
    return null;
  }

  const ringStyle = (value: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: value.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.5, 0.28, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.48],
        }),
      },
    ],
  });

  return (
    <View pointerEvents="none" style={[styles.pulseLayer, { width: size, height: size }]}>
      <Animated.View style={[styles.bardPulseRing, ringStyle(pulseA)]} />
      <Animated.View style={[styles.bardPulseRing, ringStyle(pulseB)]} />
      <Animated.View
        style={[
          styles.bardShimmerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.95],
            }),
            transform: [
              {
                scale: breath.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.04],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bardCoreGlow,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: (size * 0.72) / 2,
            opacity: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [0.22, 0.42],
            }),
            transform: [
              {
                scale: breath.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.06],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function volumeIconName(value: number): 'volume-mute' | 'volume-low' | 'volume-medium' | 'volume-high' {
  if (value < 0.02) {
    return 'volume-mute';
  }
  if (value < 0.34) {
    return 'volume-low';
  }
  if (value < 0.67) {
    return 'volume-medium';
  }
  return 'volume-high';
}

/** Glass volume dock — panel on narrow/compact tiles; bar on wide desktop tiles. */
function ParticipantVolumeDock({
  value,
  onChange,
  participantName,
  caption,
  dense = false,
  onClose,
}: {
  value: number;
  onChange: (next: number) => void;
  participantName: string;
  /** Visible Discord-style label above the slider. */
  caption?: string;
  /** Narrow / filmstrip cards: tighter chrome. */
  dense?: boolean;
  onClose?: () => void;
}) {
  const trackWidthRef = useRef(1);
  const beforeMuteRef = useRef(1);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Local draft so the thumb moves even if parent re-render lags (mocks, etc.).
  const [draft, setDraft] = useState(() => clamp01(value));
  const [dragging, setDragging] = useState(false);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dragging) {
      setDraft(clamp01(value));
    }
  }, [value, dragging]);

  useEffect(() => {
    appear.setValue(0);
    Animated.spring(appear, {
      toValue: 1,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  const commit = useCallback((next: number) => {
    const clamped = clamp01(next);
    setDraft(clamped);
    onChangeRef.current(clamped);
  }, []);

  const applyFromLocationX = useCallback(
    (locationX: number) => {
      const width = Math.max(1, trackWidthRef.current);
      if (!Number.isFinite(locationX)) {
        return;
      }
      commit(locationX / width);
    },
    [commit],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) >= Math.abs(g.dy) || Math.abs(g.dx) > 2,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          setDragging(true);
          applyFromLocationX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          applyFromLocationX(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    [applyFromLocationX],
  );

  const muted = draft < 0.02;
  const fill = Math.round(clamp01(draft) * 100);
  const iconName = volumeIconName(draft);
  const thumbOffset = dense ? -7 : -8;

  const toggleMute = () => {
    if (muted) {
      commit(beforeMuteRef.current > 0.02 ? beforeMuteRef.current : 1);
      return;
    }
    beforeMuteRef.current = draft > 0.02 ? draft : 1;
    commit(0);
  };

  const webRange =
    Platform.OS === 'web'
      ? createElement('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 1,
          value: fill,
          className: 'call-volume-range',
          'aria-label': `Громкость ${participantName}`,
          onPointerDown: (event: { stopPropagation?: () => void }) => {
            event.stopPropagation?.();
            setDragging(true);
          },
          onPointerUp: () => setDragging(false),
          onChange: (event: { target: { value: string } }) => {
            commit(Number(event.target.value) / 100);
          },
          onInput: (event: { target: { value: string } }) => {
            commit(Number(event.target.value) / 100);
          },
          style: {
            flex: 1,
            width: '100%',
            minWidth: dense ? 56 : 72,
            height: dense ? 36 : 32,
            margin: 0,
            padding: 0,
            accentColor: '#4B99FF',
            cursor: 'pointer',
            touchAction: 'none',
          },
        })
      : null;

  return (
    <Animated.View
      accessibilityLabel={
        caption
          ? `${caption}: ${fill}%`
          : `Громкость ${participantName}: ${fill}%`
      }
      {...(Platform.OS === 'web' && caption
        ? ({ title: caption } as object)
        : null)}
      style={[
        styles.volumeDock,
        styles.volumeDockHorizontal,
        caption ? styles.volumeDockWithCaption : null,
        dense && styles.volumeDockDense,
        {
          opacity: appear,
          transform: [
            {
              scale: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [0.94, 1],
              }),
            },
          ],
        },
      ]}>
      {caption ? (
        <Text style={[styles.volumeCaption, dense && styles.volumeCaptionDense]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      <View style={[styles.volumeDockControls, styles.volumeDockControlsHorizontal]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Включить звук' : 'Выключить звук'}
          accessibilityHint="Только у тебя"
          hitSlop={6}
          onPress={toggleMute}
          {...(Platform.OS === 'web'
            ? ({ title: muted ? 'Включить звук' : 'Выключить звук' } as object)
            : null)}
          style={({ pressed }) => [
            styles.volumeMuteBtn,
            dense && styles.volumeMuteBtnDense,
            muted && styles.volumeMuteBtnActive,
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name={iconName}
            size={dense ? 14 : 15}
            color={muted ? '#FFFFFF' : '#F2F3F5'}
          />
        </Pressable>

        {webRange ? (
          <View style={[styles.volumeTrackHit, styles.volumeTrackHitHorizontal, dense && styles.volumeTrackHitDenseHorizontal]}>
            {webRange}
          </View>
        ) : (
          <View
            style={[
              styles.volumeTrackHit,
              styles.volumeTrackHitHorizontal,
              dense && styles.volumeTrackHitDenseHorizontal,
            ]}
            onLayout={(event) => {
              trackWidthRef.current = Math.max(1, event.nativeEvent.layout.width);
            }}
            {...pan.panHandlers}>
            <View
              pointerEvents="none"
              style={[
                styles.volumeTrackRail,
                styles.volumeTrackRailHorizontal,
                dragging && styles.volumeTrackRailActiveHorizontal,
              ]}>
              <View
                style={[
                  styles.volumeFill,
                  { width: `${fill}%`, height: '100%' },
                  muted && styles.volumeFillMuted,
                ]}
              />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.volumeThumb,
                dense && styles.volumeThumbDense,
                dragging && styles.volumeThumbActive,
                {
                  left: `${fill}%`,
                  top: '50%',
                  marginTop: thumbOffset,
                  marginLeft: thumbOffset,
                },
              ]}
            />
          </View>
        )}

        <Text
          style={[
            styles.volumePercent,
            dense && styles.volumePercentDense,
            muted && styles.volumePercentMuted,
          ]}
          numberOfLines={1}>
          {muted ? 'выкл' : `${fill}%`}
        </Text>

        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть громкость"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.volumeCloseBtn,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.volumeCloseText}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function reorderTileKeys(keys: string[], fromKey: string, toKey: string): string[] {
  if (fromKey === toKey) {
    return keys;
  }
  const fromIndex = keys.indexOf(fromKey);
  const toIndex = keys.indexOf(toKey);
  if (fromIndex < 0 || toIndex < 0) {
    return keys;
  }
  const next = keys.slice();
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromKey);
  return next;
}

/** Compact music chip — sits under the stage, not a fake participant card. */
function BardNowPlayingStrip({
  tile,
  volumeOpen,
  onToggleVolume,
  onVolumeChange,
  onOpen,
}: {
  tile: OverlayTile;
  volumeOpen?: boolean;
  onToggleVolume?: () => void;
  onVolumeChange?: (volume: number) => void;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const volume = clamp01(tile.volume ?? 1);
  const mutedLocally = volume < 0.02;
  const title = tile.bardPlaque?.trim() || 'Выбери трек';
  const canVolume = Boolean(onToggleVolume && onVolumeChange);

  return (
    <View
      style={styles.bardChipWrap}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as object)
        : null)}>
      {canVolume && volumeOpen && onVolumeChange ? (
        <View style={styles.bardChipVolumeDock}>
          <ParticipantVolumeDock
            value={volume}
            onChange={onVolumeChange}
            participantName="Бард"
            caption="Громкость у тебя"
            onClose={onToggleVolume}
          />
        </View>
      ) : null}
      <View
        style={[
          styles.bardChip,
          tile.bardPlaying && styles.bardChipLive,
          hovered && styles.bardChipHovered,
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Открыть Барда"
          onPress={onOpen}
          style={({ pressed }) => [
            styles.bardChipMain,
            pressed && styles.pressed,
          ]}>
          <View
            style={[
              styles.bardChipIcon,
              tile.bardPlaying && styles.bardChipIconLive,
            ]}>
            {tile.bardLoading ? (
              <ActivityIndicator size="small" color="#DCDDDE" />
            ) : (
              <Ionicons
                name={tile.bardPlaying ? 'musical-notes' : 'musical-note'}
                size={15}
                color={tile.bardPlaying ? '#E8F2FF' : '#B5BAC1'}
              />
            )}
          </View>
          <View style={styles.bardChipCopy}>
            <Text style={styles.bardChipLabel} numberOfLines={1}>
              Бард
            </Text>
            <Text style={styles.bardChipTrack} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {tile.bardPlaying ? <View style={styles.bardChipLiveDot} /> : null}
        </Pressable>
        {canVolume ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              volumeOpen ? 'Скрыть громкость Барда' : 'Громкость Барда у тебя'
            }
            hitSlop={6}
            onPress={onToggleVolume}
            style={({ pressed }) => [
              styles.bardChipVolumeIn,
              mutedLocally && styles.bardChipVolumeInMuted,
              volumeOpen && styles.bardChipVolumeInOpen,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name={volumeIconName(volume)}
              size={14}
              color={mutedLocally ? '#F23F43' : '#E8F2FF'}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Cinema right-rail cell — fixed size in 1/2-col scroll grid. */
function CinemaRailPersonTile({
  tile,
  profileAvatarUrl,
  pinned,
  canPin,
  onTogglePin,
  onPress,
  width,
  height,
  isOnStage,
}: {
  tile: OverlayTile;
  profileAvatarUrl: string | null | undefined;
  pinned: boolean;
  canPin: boolean;
  onTogglePin?: () => void;
  onPress?: () => void;
  width: number;
  height: number;
  isOnStage?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const showPinBtn = canPin && (hovered || Platform.OS !== 'web');
  const showCam = Boolean(tile.cameraOn && (tile.videoTrack || tile.mock));
  const name = tile.isLocal ? `${tile.name} (вы)` : tile.name;
  const canPromote = Boolean(onPress && tile.cameraOn);
  const avatarSize = Math.max(
    28,
    Math.min(48, Math.round(Math.min(width, height) * 0.5)),
  );

  return (
    <View
      style={[
        styles.cinemaRailCell,
        {
          width,
          height,
          minWidth: width,
          maxWidth: width,
          minHeight: height,
          maxHeight: height,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          canPromote
            ? tile.isLocal
              ? 'Показать себя на весь экран'
              : `Показать ${tile.name} на весь экран`
            : name
        }
        disabled={!canPromote}
        onPress={canPromote ? onPress : undefined}
        style={({ pressed }) => [
          styles.cinemaRailTile,
          { width, height },
          tile.speaking && styles.cinemaPersonTileSpeaking,
          tile.urgent && styles.cinemaPersonTileUrgent,
          isOnStage && styles.cinemaPersonTileOnStage,
          canPromote && hovered && styles.cinemaPersonTileHot,
          canPromote && pressed && styles.pressed,
        ]}
        {...(Platform.OS === 'web'
          ? ({
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
              draggable: false,
              onDragStart: (event: { preventDefault?: () => void }) => {
                event.preventDefault?.();
              },
            } as object)
          : null)}>
        {showCam && tile.videoTrack ? (
          <CallVideoView
            track={tile.videoTrack}
            mirror={tile.isLocal}
            objectFit="cover"
            style={{ width, height }}
          />
        ) : showCam && tile.mock ? (
          <View
            style={[
              styles.cinemaPersonMock,
              {
                width,
                height,
                backgroundColor: `hsl(${tile.mockHue ?? 210} 42% 28%)`,
              },
            ]}>
            <Ionicons name="videocam" size={18} color="rgba(255,255,255,0.55)" />
          </View>
        ) : (
          <View style={[styles.cinemaPersonAvatar, { width, height }]}>
            <UserAvatar
              nickname={tile.name}
              avatarUrl={
                tile.isLocal && profileAvatarUrl
                  ? profileAvatarUrl
                  : tile.avatarUrl
              }
              size={avatarSize}
              badges={tile.badges}
              frameId={tile.frameId}
            />
          </View>
        )}
        {showPinBtn && onTogglePin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinned ? 'Снять закрепление приоритета' : 'Закрепить в приоритете'
            }
            hitSlop={8}
            onPress={(event) => {
              // @ts-expect-error RN Web stopPropagation
              event?.stopPropagation?.();
              onTogglePin();
            }}
            style={({ pressed }) => [
              styles.cinemaPersonPinBtn,
              pinned && styles.videoPinBtnActive,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name={pinned ? 'pin' : 'pin-outline'}
              size={14}
              color="#FFFFFF"
            />
          </Pressable>
        ) : null}
        {tile.urgent ? (
          <View style={styles.cinemaPersonUrgentChip} pointerEvents="none">
            <Text style={styles.cinemaPersonUrgentChipText} numberOfLines={1}>
              срочная
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.cinemaPersonChrome,
            height <= 78 && styles.cinemaPersonChromeCompact,
          ]}
          pointerEvents="none">
          <Text
            style={[
              styles.cinemaPersonName,
              height <= 78 && styles.cinemaPersonNameCompact,
            ]}
            numberOfLines={1}>
            {name}
          </Text>
          {isOnStage ? (
            <View style={styles.cinemaPersonOnStageBadge}>
              <Ionicons name="expand" size={9} color="#E8F2FF" />
            </View>
          ) : null}
          {tile.muted ? (
            <View style={styles.cinemaPersonMute}>
              <Ionicons name="mic-off" size={10} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

/** Cinema free-floating PIP — drag / resize; pin only on hover (web). */
function CinemaDockPersonTile({
  tile,
  profileAvatarUrl,
  pinned,
  canPin,
  onTogglePin,
  onPress,
  layout,
  stageSize,
  isOnStage,
  onLayoutChange,
}: {
  tile: OverlayTile;
  profileAvatarUrl: string | null | undefined;
  pinned: boolean;
  canPin: boolean;
  onTogglePin?: () => void;
  onPress?: () => void;
  layout: CinemaPipLayout;
  stageSize: { width: number; height: number };
  isOnStage?: boolean;
  onLayoutChange: (next: CinemaPipLayout) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: CinemaPipLayout;
    moved: boolean;
  } | null>(null);
  const showChromeBtns = hovered || Platform.OS !== 'web';
  const showPinBtn = canPin && showChromeBtns;
  const showCam = Boolean(tile.cameraOn && (tile.videoTrack || tile.mock));
  const name = tile.isLocal ? `${tile.name} (вы)` : tile.name;
  const canPromote = Boolean(onPress && tile.cameraOn);
  const frame = resolveCinemaPipLayout(
    layout,
    stageSize.width,
    stageSize.height,
  );
  const avatarSize = Math.max(28, Math.min(52, Math.round(frame.h * 0.42)));

  const commitPointer = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        drag.moved = true;
      }
      if (!drag.moved) {
        return;
      }
      if (drag.mode === 'move') {
        onLayoutChange(
          clampCinemaPipLayout(
            {
              w: drag.origin.w,
              h: drag.origin.h,
              x: drag.origin.x + dx,
              y: drag.origin.y + dy,
              docked: false,
            },
            stageSize.width,
            stageSize.height,
          ),
        );
        return;
      }
      const nextW = drag.origin.w + dx;
      if (drag.origin.docked) {
        onLayoutChange(
          clampCinemaPipLayout(
            {
              ...drag.origin,
              w: nextW,
              h: cinemaPipAspectHeight(nextW),
              docked: true,
            },
            stageSize.width,
            stageSize.height,
          ),
        );
        return;
      }
      onLayoutChange(
        clampCinemaPipLayout(
          {
            ...drag.origin,
            w: nextW,
            h: cinemaPipAspectHeight(nextW),
            docked: false,
          },
          stageSize.width,
          stageSize.height,
        ),
      );
    },
    [onLayoutChange, stageSize.height, stageSize.width],
  );

  const endPointer = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      commitPointer(clientX, clientY);
      const wasClick = !drag.moved;
      dragRef.current = null;
      if (wasClick && canPromote) {
        onPress?.();
      }
    },
    [canPromote, commitPointer, onPress],
  );

  const beginPointer = useCallback(
    (mode: 'move' | 'resize', clientX: number, clientY: number) => {
      const resolved = resolveCinemaPipLayout(
        layout,
        stageSize.width,
        stageSize.height,
      );
      dragRef.current = {
        mode,
        startX: clientX,
        startY: clientY,
        origin: {
          ...layout,
          ...resolved,
          docked: Boolean(layout.docked),
        },
        moved: false,
      };
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return;
      }
      const onMove = (event: PointerEvent) => {
        event.preventDefault();
        commitPointer(event.clientX, event.clientY);
      };
      const onUp = (event: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        endPointer(event.clientX, event.clientY);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [commitPointer, endPointer, layout, stageSize.height, stageSize.width],
  );

  return (
    <View
      style={[
        styles.cinemaPersonTile,
        {
          left: frame.x,
          top: frame.y,
          width: frame.w,
          height: frame.h,
        },
        tile.speaking && styles.cinemaPersonTileSpeaking,
        tile.urgent && styles.cinemaPersonTileUrgent,
        isOnStage && styles.cinemaPersonTileOnStage,
        canPromote && hovered && styles.cinemaPersonTileHot,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
            draggable: false,
            onDragStart: (event: { preventDefault?: () => void }) => {
              event.preventDefault?.();
            },
            // @ts-expect-error RN Web pointer
            onPointerDown: (event: {
              button?: number;
              clientX: number;
              clientY: number;
              preventDefault?: () => void;
            }) => {
              if (event.button != null && event.button !== 0) {
                return;
              }
              event.preventDefault?.();
              beginPointer('move', event.clientX, event.clientY);
            },
          } as object)
        : {
            onStartShouldSetResponder: () => true,
            onMoveShouldSetResponder: () => true,
            onResponderGrant: (event: {
              nativeEvent: { pageX: number; pageY: number };
            }) => {
              beginPointer(
                'move',
                event.nativeEvent.pageX,
                event.nativeEvent.pageY,
              );
            },
            onResponderMove: (event: {
              nativeEvent: { pageX: number; pageY: number };
            }) => {
              commitPointer(
                event.nativeEvent.pageX,
                event.nativeEvent.pageY,
              );
            },
            onResponderRelease: (event: {
              nativeEvent: { pageX: number; pageY: number };
            }) => {
              endPointer(event.nativeEvent.pageX, event.nativeEvent.pageY);
            },
            onResponderTerminate: (event: {
              nativeEvent: { pageX: number; pageY: number };
            }) => {
              endPointer(event.nativeEvent.pageX, event.nativeEvent.pageY);
            },
          })}>
      {showCam && tile.videoTrack ? (
        <CallVideoView
          track={tile.videoTrack}
          mirror={tile.isLocal}
          objectFit="cover"
        />
      ) : showCam && tile.mock ? (
        <View
          style={[
            styles.cinemaPersonMock,
            {
              backgroundColor: `hsl(${tile.mockHue ?? 210} 42% 28%)`,
            },
          ]}>
          <Ionicons name="videocam" size={18} color="rgba(255,255,255,0.55)" />
        </View>
      ) : (
        <View style={styles.cinemaPersonAvatar}>
          <UserAvatar
            nickname={tile.name}
            avatarUrl={
              tile.isLocal && profileAvatarUrl
                ? profileAvatarUrl
                : tile.avatarUrl
            }
            size={avatarSize}
            badges={tile.badges}
            frameId={tile.frameId}
          />
        </View>
      )}
      {showPinBtn && onTogglePin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            pinned ? 'Снять закрепление приоритета' : 'Закрепить в приоритете'
          }
          hitSlop={8}
          // @ts-expect-error RN Web pointer
          onPointerDown={(event: {
            preventDefault?: () => void;
            stopPropagation?: () => void;
          }) => {
            event.preventDefault?.();
            event.stopPropagation?.();
          }}
          onPress={(event) => {
            // @ts-expect-error RN Web stopPropagation
            event?.stopPropagation?.();
            onTogglePin();
          }}
          style={({ pressed }) => [
            styles.cinemaPersonPinBtn,
            pinned && styles.videoPinBtnActive,
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name={pinned ? 'pin' : 'pin-outline'}
            size={14}
            color="#FFFFFF"
          />
        </Pressable>
      ) : null}
      {showChromeBtns ? (
        <View
          // @ts-expect-error RN Web pointer
          onPointerDown={(event: {
            button?: number;
            clientX: number;
            clientY: number;
            preventDefault?: () => void;
            stopPropagation?: () => void;
          }) => {
            if (event.button != null && event.button !== 0) {
              return;
            }
            event.preventDefault?.();
            event.stopPropagation?.();
            beginPointer('resize', event.clientX, event.clientY);
          }}
          style={styles.cinemaPersonResizeHandle}
          accessibilityRole="adjustable"
          accessibilityLabel={`Размер карточки ${name}`}>
          <Ionicons name="resize" size={12} color="#F2F3F5" />
        </View>
      ) : null}
      {tile.urgent ? (
        <View style={styles.cinemaPersonUrgentChip} pointerEvents="none">
          <Text style={styles.cinemaPersonUrgentChipText} numberOfLines={1}>
            срочная
          </Text>
        </View>
      ) : null}
      <View style={styles.cinemaPersonChrome} pointerEvents="none">
        <Text style={styles.cinemaPersonName} numberOfLines={1}>
          {name}
        </Text>
        {isOnStage ? (
          <View style={styles.cinemaPersonOnStageBadge}>
            <Ionicons name="expand" size={9} color="#E8F2FF" />
          </View>
        ) : null}
        {tile.muted ? (
          <View style={styles.cinemaPersonMute}>
            <Ionicons name="mic-off" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ParticipantTile({
  tile,
  avatarSize,
  tileWidth,
  videoHeight,
  tileMinHeight = null,
  tileHeight = null,
  volumeOpen,
  onToggleVolume,
  onVolumeChange,
  onPress,
  onOpenMenu,
  onExpandStream,
  onExpandPriority,
  pinned = false,
  onTogglePin,
  spotlight = false,
  compact = false,
  dragEnabled = false,
  isDragging = false,
  isDropTarget = false,
  onGridPointerDown,
}: {
  tile: OverlayTile;
  avatarSize: number;
  tileWidth: number;
  videoHeight: number | null;
  /** Voice cards: fixed landscape height so the grid stays even. */
  tileMinHeight?: number | null;
  /** Side filmstrip: explicit height (hero height / N). */
  tileHeight?: number | null;
  volumeOpen?: boolean;
  onToggleVolume?: () => void;
  onVolumeChange?: (volume: number) => void;
  onPress?: () => void;
  onOpenMenu?: () => void;
  /** Screen-share only: enter stream cinema (full stage). */
  onExpandStream?: () => void;
  /** Priority camera: OS fullscreen cinema. */
  onExpandPriority?: () => void;
  /** Manual priority lock (camera or screen). */
  pinned?: boolean;
  onTogglePin?: () => void;
  spotlight?: boolean;
  /** Filmstrip: tighter padding so the name fits inside the row budget. */
  compact?: boolean;
  /** Reorder people (web pointer drag). */
  dragEnabled?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onGridPointerDown?: (clientX: number, clientY: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showPinBtn =
    Boolean(onTogglePin) && (hovered || Platform.OS !== 'web');
  const showingScreenShare = Boolean(tile.screenShareOn && tile.screenShareTrack);
  const displayTrack = showingScreenShare ? tile.screenShareTrack! : tile.videoTrack;
  // Mock cam must work in filmstrip too — don't require layout videoHeight.
  const showMockVideo = Boolean(tile.mock && tile.cameraOn);
  const showVideo = Boolean(
    (displayTrack && (videoHeight || compact) && (showingScreenShare || tile.cameraOn)) ||
      showMockVideo,
  );
  // In a video grid every card keeps the same media slot height (camera or avatar).
  const matchVideoSlot = Boolean(videoHeight) && !compact && !tile.isBard;
  const slotHeight =
    videoHeight ??
    (compact && tileHeight
      ? Math.max(56, tileHeight - 14)
      : compact && showVideo
        ? Math.max(64, Math.round(tileWidth * (9 / 16)))
        : 180);
  // No camera: fill most of the 16:9 slot — don't keep the tiny layout avatarSize.
  const mediaAvatarSize =
    matchVideoSlot && !showVideo
      ? Math.max(
          72,
          Math.min(
            Math.round(slotHeight * 0.78),
            Math.round(tileWidth * 0.58),
            slotHeight - 20,
          ),
        )
      : compact && !showVideo
        ? // Landscape filmstrip: avatar fits the short side.
          Math.min(avatarSize, Math.max(40, Math.round(tileWidth * 0.28)))
        : avatarSize;
  const avatarOuter = avatarFrameOuterSize(mediaAvatarSize);
  // Compact filmstrip: tight ring so the square card stays square.
  const ringBox = compact ? avatarOuter + 4 : avatarOuter + 8;
  const canAdjustVolume =
    Boolean(onToggleVolume && onVolumeChange) && !tile.isLocal && !tile.waiting;
  const volume = clamp01(tile.volume ?? 1);
  const mutedLocally = volume < 0.02;
  // Narrow / filmstrip: dimmed full-tile panel with horizontal slider.
  // Wide desktop: bottom bar on media only.
  const volumeNarrow = tileWidth < 320 || compact;
  const volumeDense = volumeNarrow;
  const volumePanel = volumeNarrow;
  const volumeCaption = volumeDense
    ? undefined
    : tile.isBard
      ? 'Громкость у тебя'
      : 'Громкость';
  const volumeChipTip = tile.isBard
    ? 'Громкость у тебя'
    : `Громкость · ${tile.name}`;
  const volumeDock =
    canAdjustVolume && volumeOpen && onVolumeChange ? (
      <View
        style={[
          styles.volumeDockOverlay,
          volumePanel
            ? styles.volumeDockOverlayPanel
            : styles.volumeDockOverlayBar,
        ]}
        pointerEvents="box-none">
        {volumePanel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Скрыть громкость ${tile.name}`}
            onPress={onToggleVolume}
            style={styles.volumeDockBackdrop}
          />
        ) : null}
        <View
          pointerEvents="auto"
          style={[
            styles.volumeDockFront,
            volumePanel && styles.volumeDockFrontPanel,
          ]}
          // Keep slider from ScrollView / tile press / backdrop.
          onStartShouldSetResponder={() => true}
          {...(Platform.OS === 'web'
            ? ({
                onPointerDown: (event: {
                  stopPropagation?: () => void;
                  preventDefault?: () => void;
                }) => {
                  event.stopPropagation?.();
                },
              } as object)
            : null)}>
          <ParticipantVolumeDock
            value={volume}
            onChange={onVolumeChange}
            participantName={tile.name}
            caption={volumeCaption}
            dense={volumeDense}
            onClose={onToggleVolume}
          />
        </View>
      </View>
    ) : null;

  const openMenu = () => {
    onOpenMenu?.();
  };

  const mediaPressHandlers =
    onPress || onOpenMenu
      ? {
          accessibilityRole: 'button' as const,
          accessibilityLabel: tile.isBard
            ? onPress
              ? 'Бард — открыть плеер'
              : 'Бард'
            : `Меню ${tile.name}`,
          accessibilityHint: onOpenMenu
            ? 'Удерживайте, чтобы открыть меню'
            : undefined,
          onPress,
          onLongPress: onOpenMenu ? openMenu : undefined,
          delayLongPress: onOpenMenu ? 350 : undefined,
          // @ts-expect-error RN Web: native context menu
          onContextMenu: onOpenMenu
            ? (event: GestureResponderEvent) => {
                event.preventDefault?.();
                openMenu();
              }
            : undefined,
        }
      : null;

  const wrapMenuHit = (node: ReactNode) =>
    mediaPressHandlers ? (
      <Pressable {...mediaPressHandlers} style={styles.tileMediaMenuHit}>
        {node}
      </Pressable>
    ) : (
      <View style={styles.tileMediaMenuHit}>{node}</View>
    );

  const displayName = tile.isLocal ? `${tile.name} (вы)` : tile.name;
  const tileBadges = tile.badges ?? [];
  const badgesAboveCard = showVideo && !tile.isBard && tileBadges.length > 0;
  const statusBorderColor = tile.urgent
    ? '#ED4245'
    : tile.speaking
      ? '#23A559'
      : tile.waiting
        ? 'rgba(21, 122, 254, 0.7)'
        : tile.isLocal && compact
          ? 'rgba(107, 78, 255, 0.85)'
          : null;

  return (
    <View
      style={[
        styles.tileOuter,
        dragEnabled ? styles.tileOuterNoSelect : null,
        { width: tileWidth },
        isDragging && styles.tileOuterDragging,
        isDropTarget && styles.tileOuterDropTarget,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            dataSet: { callTileKey: tile.key },
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
            // Kill Safari/Chrome native image/text drag on the card.
            draggable: false,
            onDragStart: (event: { preventDefault?: () => void }) => {
              event.preventDefault?.();
            },
          } as object)
        : null)}>
      {badgesAboveCard ? (
        <View style={styles.tileBadgesAbove} pointerEvents="box-none">
          <RewardBadgeRow badges={tileBadges} size={13} wrap align="center" />
        </View>
      ) : null}
      {dragEnabled && onGridPointerDown && tileWidth >= 160 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Перетащить ${tile.name}`}
          hitSlop={8}
          // @ts-expect-error RN Web pointer + preventDefault
          onPointerDown={(event: {
            button?: number;
            clientX: number;
            clientY: number;
            preventDefault?: () => void;
            stopPropagation?: () => void;
          }) => {
            if (event.button != null && event.button !== 0) {
              return;
            }
            event.preventDefault?.();
            event.stopPropagation?.();
            onGridPointerDown(event.clientX, event.clientY);
          }}
          style={({ pressed }) => [
            styles.tileDragHandle,
            (hovered || isDragging || pressed) && styles.tileDragHandleHot,
            isDragging && styles.tileDragHandleActive,
          ]}>
          <Ionicons name="reorder-two" size={14} color="#F2F3F5" />
        </Pressable>
      ) : null}
    <View
      style={[
        styles.tile,
        { width: tileWidth },
        !showVideo && !compact && tileMinHeight
          ? [styles.tileLandscape, { minHeight: tileMinHeight }]
          : null,
        compact && styles.tileCompact,
        compact && !tileHeight ? styles.tileCompactRatio : null,
        compact && tileHeight ? { height: tileHeight } : null,
        compact && tile.isLocal && styles.tileCompactLocal,
        // Compact filmstrip keeps its own padding — tileVideo padding breaks 16:9.
        !compact && (showVideo || matchVideoSlot) ? styles.tileVideo : null,
        spotlight && styles.tileSpotlight,
        tile.waiting && styles.tileWaiting,
        tile.urgent && styles.tileUrgent,
        tile.isBard && styles.tileBard,
        // Clip chrome on narrow / open-volume tiles so nothing paints into neighbors.
        volumeOpen || volumeNarrow ? styles.tileVolumeOpen : null,
        statusBorderColor
          ? { borderWidth: 3, borderColor: statusBorderColor }
          : null,
      ]}>
      {tile.waiting && !tile.urgent && !tile.connecting ? <WaitingFramePulse /> : null}
      {/*
        Menu hit-target is only the media (no nested volume Pressables).
        Safari/RN-web: outer Pressable wrapping volume chip → nested <button>.
      */}
      <View style={[styles.tilePressable, compact && styles.tilePressableCompact]}>
        <View style={styles.tileMedia}>
          {showVideo ? (
            <View style={styles.tileMediaMenuHost}>
              {wrapMenuHit(
                <View
                  style={[
                    styles.videoFrame,
                    showingScreenShare && styles.videoFrameScreen,
                    {
                      height: slotHeight,
                      borderColor: 'transparent',
                    },
                  ]}>
                  {showMockVideo ? (
                    <View
                      style={[
                        styles.mockVideoFill,
                        {
                          backgroundColor: `hsl(${tile.mockHue ?? 210} 42% 28%)`,
                        },
                      ]}>
                      <Ionicons name="videocam" size={28} color="rgba(255,255,255,0.55)" />
                      <Text style={styles.mockVideoLabel}>мок-камера</Text>
                    </View>
                  ) : (
                    <CallVideoView
                      track={displayTrack}
                      mirror={tile.isLocal && !showingScreenShare}
                      objectFit={showingScreenShare ? 'contain' : 'cover'}
                    />
                  )}
                  {showingScreenShare ? (
                    <View style={styles.videoScreenBadge} pointerEvents="none">
                      <Ionicons name="desktop-outline" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                  {showPinBtn ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        pinned
                          ? 'Снять закрепление приоритета'
                          : 'Закрепить в приоритете'
                      }
                      hitSlop={8}
                      onPress={onTogglePin}
                      style={({ pressed }) => [
                        styles.videoPinBtn,
                        pinned && styles.videoPinBtnActive,
                        pressed && styles.pressed,
                      ]}>
                      <Ionicons
                        name={pinned ? 'pin' : 'pin-outline'}
                        size={15}
                        color="#FFFFFF"
                      />
                    </Pressable>
                  ) : null}
                  {showingScreenShare && onExpandStream ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Развернуть стрим на весь экран"
                      hitSlop={8}
                      onPress={onExpandStream}
                      style={({ pressed }) => [
                        styles.videoExpandBtn,
                        pressed && styles.pressed,
                      ]}>
                      <Ionicons name="expand" size={16} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                  {!showingScreenShare && onExpandPriority ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Развернуть приоритет на весь экран"
                      hitSlop={8}
                      onPress={onExpandPriority}
                      style={({ pressed }) => [
                        styles.videoExpandBtn,
                        pressed && styles.pressed,
                      ]}>
                      <Ionicons name="expand" size={16} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                  {tile.muted ? (
                    <View style={styles.videoMuteBadge}>
                      <Ionicons name="mic-off" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                  {tile.urgent ? (
                    <View style={styles.videoUrgentChip} pointerEvents="none">
                      <Text style={styles.urgentBubbleText}>срочная заявка</Text>
                    </View>
                  ) : null}
                </View>,
              )}
            </View>
          ) : (
            <View
              style={[
                styles.avatarWrap,
                matchVideoSlot
                  ? [
                      styles.avatarVideoSlot,
                      {
                        height: slotHeight,
                        borderColor: 'transparent',
                      },
                    ]
                  : {
                      width: ringBox + (compact ? 0 : 20),
                      height: ringBox + (compact ? 0 : 20),
                    },
              ]}>
              {wrapMenuHit(
                <>
                  {tile.urgent ? <UrgentPulseRings size={ringBox} /> : null}
                  {tile.isBard ? (
                    <BardPlayingAura size={ringBox} active={Boolean(tile.bardPlaying)} />
                  ) : null}
                  {tile.isBard && tile.bardLoading ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.bardLoadingRing,
                        {
                          width: ringBox + 10,
                          height: ringBox + 10,
                          borderRadius: (ringBox + 10) / 2,
                        },
                      ]}>
                      <ActivityIndicator size="small" color="#84B9FF" />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.avatarRing,
                      tile.isBard && styles.bardRing,
                      tile.isBard && tile.bardPlaying && styles.bardRingPlaying,
                      tile.isBard && tile.bardLoading && styles.bardRingLoading,
                      {
                        width: ringBox,
                        height: ringBox,
                        borderRadius: ringBox / 2,
                        // Status only on the tile frame — avatar circle stays clean.
                        borderColor: tile.isBard
                          ? tile.bardPlaying
                            ? 'rgba(132, 185, 255, 0.95)'
                            : 'rgba(21, 122, 254, 0.75)'
                          : 'transparent',
                        borderWidth: tile.isBard ? undefined : 0,
                      },
                    ]}>
                    <View style={[styles.avatarSlot, { width: avatarOuter, height: avatarOuter }]}>
                      {tile.isBard ? (
                        <View
                          style={[
                            styles.bardAvatar,
                            tile.bardPlaying && styles.bardAvatarPlaying,
                            {
                              width: mediaAvatarSize,
                              height: mediaAvatarSize,
                              borderRadius: mediaAvatarSize / 2,
                            },
                          ]}>
                          <View style={styles.bardAvatarInner}>
                            <Ionicons
                              name={tile.bardPlaying ? 'musical-notes' : 'musical-note'}
                              size={Math.round(mediaAvatarSize * 0.4)}
                              color={tile.bardPlaying ? '#E8F2FF' : '#84B9FF'}
                            />
                          </View>
                        </View>
                      ) : (
                        <UserAvatar
                          nickname={tile.name}
                          avatarUrl={tile.avatarUrl}
                          size={mediaAvatarSize}
                          badges={matchVideoSlot ? undefined : tile.badges}
                          frameId={matchVideoSlot ? 'none' : tile.frameId}
                        />
                      )}
                    </View>
                    {tile.connecting ? (
                      <View style={styles.connectingOverlay} pointerEvents="none">
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    ) : null}
                    {tile.muted && !tile.waiting && !tile.isBard ? (
                      <View style={styles.muteBadge}>
                        <Ionicons name="mic-off" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  {tile.isBard ? (
                    <View
                      style={[styles.bardPlaque, tile.bardPlaying && styles.bardPlaquePlaying]}
                      pointerEvents="none">
                      <View
                        style={[
                          styles.bardPlaqueIcon,
                          tile.bardPlaying && styles.bardPlaqueIconPlaying,
                        ]}>
                        <Ionicons
                          name={tile.bardPlaying ? 'play' : 'musical-note'}
                          size={10}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.bardPlaqueText} numberOfLines={1}>
                        {tile.bardPlaque?.trim() || 'Выбери трек'}
                      </Text>
                    </View>
                  ) : null}
                  {tile.urgent ? (
                    <View style={styles.urgentBubble} pointerEvents="none">
                      <Text style={styles.urgentBubbleText}>срочная заявка</Text>
                    </View>
                  ) : null}
                </>,
              )}
              {showPinBtn ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    pinned
                      ? 'Снять закрепление приоритета'
                      : 'Закрепить в приоритете'
                  }
                  hitSlop={8}
                  onPress={onTogglePin}
                  style={({ pressed }) => [
                    styles.videoPinBtn,
                    pinned && styles.videoPinBtnActive,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons
                    name={pinned ? 'pin' : 'pin-outline'}
                    size={15}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Wide desktop: bar on media. Panel mode is rendered over the whole tile. */}
          {!volumePanel ? volumeDock : null}

          {/* Chip only when dock is closed — never covers the slider. */}
          {canAdjustVolume && !volumeOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={volumeChipTip}
              accessibilityHint={
                tile.isBard
                  ? 'Только у тебя, на остальных не влияет'
                  : 'Только у тебя, собеседник себя не слышит тише'
              }
              accessibilityState={{ expanded: false }}
              hitSlop={6}
              onPress={onToggleVolume}
              {...(Platform.OS === 'web'
                ? ({ title: volumeChipTip } as object)
                : null)}
              style={({ pressed }) => [
                styles.volumeChip,
                mutedLocally && styles.volumeChipMuted,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={volumeIconName(volume)}
                size={13}
                color={mutedLocally ? '#FFFFFF' : '#E3E5E8'}
              />
            </Pressable>
          ) : null}
        </View>

        {!tile.isBard && compact ? (
          <View
            style={[
              styles.tileCompactCaption,
              tile.isLocal && styles.tileCompactCaptionLocal,
            ]}
            pointerEvents="none">
            <View style={styles.tileCompactNameRow}>
              <Text style={styles.tileCompactName} numberOfLines={1}>
                {tile.name}
              </Text>
              {tile.isLocal ? (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>вы</Text>
                </View>
              ) : null}
            </View>
            {tile.connecting || (tile.waiting && !tile.urgent) ? (
              <Text style={styles.tileCompactHint} numberOfLines={1}>
                {tile.connecting ? 'подключение…' : 'ожидание'}
              </Text>
            ) : null}
          </View>
        ) : !tile.isBard ? (
          <View
            style={[
              styles.tileCaption,
              (showVideo || matchVideoSlot) && styles.tileCaptionVideo,
            ]}>
            {badgesAboveCard ? (
              <Text style={[styles.tileName, styles.tileNameUnderVideo]} numberOfLines={1}>
                {displayName}
              </Text>
            ) : (
              <NameWithBadges
                name={displayName}
                badges={tileBadges}
                textStyle={styles.tileName}
                badgeSize={12}
                layout="stack"
                align="center"
              />
            )}
            {tile.connecting || (tile.waiting && !tile.urgent) ? (
              <Text style={styles.tileHint} numberOfLines={1}>
                {tile.connecting ? 'подключение…' : 'ожидание'}
              </Text>
            ) : showVideo || matchVideoSlot ? null : (
              <Text style={[styles.tileHint, styles.tileHintSpacer]} numberOfLines={1}>
                {' '}
              </Text>
            )}
          </View>
        ) : null}
      </View>
      {/* Narrow / filmstrip: panel covers the whole tile. */}
      {volumePanel ? volumeDock : null}
    </View>
    </View>
  );
}

function buildConnectionUi(opts: {
  status: ChatLiveVoiceStatus;
  error: string | null;
}): {
  color: string;
  label: string;
  detail: string | null;
  tone: 'connecting' | 'ok' | 'error' | 'warn' | 'idle';
} {
  if (opts.status === 'error') {
    return {
      color: '#ED4245',
      label: 'Ошибка соединения',
      detail: opts.error || 'Не удалось подключиться к голосовому серверу',
      tone: 'error',
    };
  }
  if (opts.status === 'connecting') {
    return {
      color: '#F0B232',
      label: 'Подключение…',
      detail: 'Соединяемся с голосовым сервером',
      tone: 'connecting',
    };
  }
  if (opts.status === 'connected') {
    if (opts.error) {
      return {
        color: '#F0B232',
        label: 'Сервер ок · микрофон не поднялся',
        detail: opts.error,
        tone: 'warn',
      };
    }
    return {
      color: '#23A559',
      label: 'Соединение установлено',
      detail: null,
      tone: 'ok',
    };
  }
  return {
    color: '#B5BAC1',
    label: 'Голосовой чат',
    detail: null,
    tone: 'idle',
  };
}

function buildCallPhaseLabel(opts: {
  isGroup: boolean;
  ringing: boolean;
  mediaReady: boolean;
  liveCount: number;
  waitingCount: number;
}): string | null {
  const { isGroup, ringing, mediaReady, liveCount, waitingCount } = opts;
  if (!mediaReady) {
    return null;
  }
  if (ringing) {
    if (isGroup) {
      if (waitingCount <= 0) {
        return liveCount > 1 ? `${liveCount} в эфире` : 'Ждём, кто присоединится';
      }
      if (waitingCount === 1) {
        return 'Вызов · ждём 1';
      }
      return `Вызов · ждём ${waitingCount}`;
    }
    return waitingCount > 0 ? 'Вызов…' : 'Ждём, кто присоединится';
  }
  if (isGroup) {
    const liveLabel =
      liveCount <= 1 ? 'Ждём, кто присоединится' : `${liveCount} в эфире`;
    if (waitingCount > 0) {
      return liveCount <= 1
        ? `Вызов · ждём ${waitingCount}`
        : `${liveCount} в эфире · ждём ${waitingCount}`;
    }
    return liveLabel;
  }
  if (waitingCount > 0) {
    return 'Ждём ответа';
  }
  if (liveCount > 1) {
    return 'В эфире';
  }
  return 'Ждём, кто присоединится';
}

/** Discord-style full-screen voice overlay with avatar tiles. */
export function VoiceCallOverlay({
  visible,
  minimized = false,
  title,
  isGroup = false,
  status,
  ringing,
  error,
  muted,
  deafened,
  cameraOn = false,
  screenShareOn = false,
  selectedScreenIdentity = null,
  screenStreams = [],
  participants,
  waitingPeers = [],
  urgentById = {},
  volumeById = {},
  conversationId = null,
  diceSenderNickname = 'Вы',
  onToggleMute,
  onMicGesture,
  onToggleDeafen,
  onToggleCamera,
  onSwitchCameraFacing,
  onToggleScreenShare,
  onSelectScreenShare,
  onHangup,
  onRetry,
  onMinimize,
  onExpand,
  onUrgentRequest,
  onSetParticipantVolume,
  canControlMusic = false,
  bardPresent = false,
  bardTrackTitle = null,
  bardPlaying = false,
  bardLoading = false,
  bardQueue = [],
  bardLayerLive = {},
  bardLocalVolume = 1,
  bardGlobalVolume = 1,
  bardLocalDisplayName = 'Участник',
  onSummonBard,
  onDismissBard,
  onSetBardLocalVolume,
  onEnqueueBardTrack,
  onRemoveBardQueueEntry,
  onToggleBardLayerPlay,
  onSeekBardLayer,
  onSetBardLayerVolume,
  onToggleBardLayerLoop,
  onToggleBardPlay,
  onSetBardGlobalVolume,
  onRequestBardSync,
  onResumeBardAudio,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktopWeb();
  const { avatarUrl: profileAvatarUrl } = useProfile();
  const { width, height } = useWindowDimensions();
  const [miniOffset, setMiniOffset] = useState(savedMiniOffset);
  const miniOffsetRef = useRef(savedMiniOffset);
  const miniSizeRef = useRef({ width: 280, height: 56 });
  const suppressExpandRef = useRef(false);
  const [volumeOpenId, setVolumeOpenId] = useState<string | null>(null);
  const [bardSheetOpen, setBardSheetOpen] = useState(false);
  const failed = status === 'error';
  const mediaReady = status === 'connected';
  const linking = status === 'connecting';
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [diceOpen, setDiceOpen] = useState(false);
  const [spotlightKey, setSpotlightKey] = useState<string | null>(null);
  const spotlightKeyRef = useRef<string | null>(null);
  spotlightKeyRef.current = spotlightKey;
  /** Manual lock: auto-promote must not steal this camera stage. */
  const [pinnedSpotlightKey, setPinnedSpotlightKey] = useState<string | null>(null);
  const pinnedSpotlightKeyRef = useRef<string | null>(null);
  pinnedSpotlightKeyRef.current = pinnedSpotlightKey;
  /** Manual lock: keep this screen share selected as priority stream. */
  const [pinnedScreenIdentity, setPinnedScreenIdentity] = useState<string | null>(null);
  const pinnedScreenIdentityRef = useRef<string | null>(null);
  pinnedScreenIdentityRef.current = pinnedScreenIdentity;
  const [streamWatchHovered, setStreamWatchHovered] = useState(false);
  const spotlightHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Target identity we're already waiting to promote — avoid reset on every speak tick. */
  const pendingSpotlightRef = useRef<string | null>(null);
  /** Ordinary click chose this stage — keep self on stage even when others are present. */
  const manualSpotlightRef = useRef(false);
  /** Fill the site viewport (call shell). Stream cinema separately uses OS fullscreen. */
  const [fullscreen, setFullscreen] = useState(false);
  /** Screen-share cinema: OS fullscreen + stream fills stage; speaker HUD top-right. */
  const [streamCinema, setStreamCinema] = useState(false);
  /** Priority camera cinema: OS fullscreen + person video fills stage. */
  const [priorityCinema, setPriorityCinema] = useState(false);
  const cinemaActive = streamCinema || priorityCinema;
  const cinemaHostRef = useRef<View>(null);
  const streamCinemaRef = useRef(false);
  streamCinemaRef.current = streamCinema;
  const priorityCinemaRef = useRef(false);
  priorityCinemaRef.current = priorityCinema;
  /** Exit OS fullscreen to show Bard sheet without dropping cinema layout. */
  const suppressCinemaExitOnFsRef = useRef(false);
  /** Cinema: call controls float over video; reveal when cursor nears bottom (macOS dock). */
  const [cinemaControlsRevealed, setCinemaControlsRevealed] = useState(false);
  const cinemaControlsHoverRef = useRef(false);
  const cinemaHideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cinemaDockAnim = useRef(new Animated.Value(0)).current;
  const [screenQualityOpen, setScreenQualityOpen] = useState(false);
  const [lastScreenQuality, setLastScreenQuality] = useState<ScreenShareQuality>('1080');
  /** Available width inside the controls strip (after padding). */
  const [controlsSlotWidth, setControlsSlotWidth] = useState(0);
  const [controlsOverflowOpen, setControlsOverflowOpen] = useState(false);
  /** User-resized priority pane width; null = auto fit. */
  const [priorityPaneWidth, setPriorityPaneWidth] = useState<number | null>(null);
  const priorityDragRef = useRef<{ startX: number; startW: number } | null>(null);
  /** Resize grip arrows: web only on hover / while dragging. */
  const [priorityResizeHot, setPriorityResizeHot] = useState(false);
  const [priorityResizing, setPriorityResizing] = useState(false);
  /** Cinema PIPs: free position + size per participant (stage copy stays in list). */
  const [cinemaPipLayouts, setCinemaPipLayouts] = useState<
    Record<string, CinemaPipLayout>
  >({});
  // Start at 0 so mobile strip mode isn't blocked by a fake 1280 desktop stage.
  const [cinemaStageSize, setCinemaStageSize] = useState({
    width: 0,
    height: 0,
  });
  /** Cinema: hide the right people rail; sticker brings it back. */
  const [cinemaRailCollapsed, setCinemaRailCollapsed] = useState(false);
  /** Cinema rail edge tab: web — only while hovering the rail / right edge. */
  const [cinemaRailTabHot, setCinemaRailTabHot] = useState(false);
  /** Dev-only fake peers for layout / priority testing. */
  const [mockPeers, setMockPeers] = useState<MockCallPeer[]>([]);
  const mockSeqRef = useRef(0);
  const mockSpeakTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const connectPulse = useRef(new Animated.Value(1)).current;
  // Пока звонок на экране — не ждём LiveKit `connected` / ответ собеседника.
  const canRollDice = Boolean(conversationId?.trim()) && status !== 'error';
  const showMusicControls = canControlMusic && mediaReady;
  /** Non-controllers open the sheet via the note button when Bard is already present. */
  const showBardOpenButton = mediaReady && bardPresent && !canControlMusic;
  const showMockControls = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  const showBardControl = showMusicControls || showBardOpenButton;
  const showUrgentControl = Boolean(onUrgentRequest);
  const showRetryControl = Boolean(failed && onRetry);
  const showCameraControl = Boolean(onToggleCamera);
  const showSwitchCameraControl = Boolean(onSwitchCameraFacing && cameraOn);
  const showScreenShareControl = Boolean(onToggleScreenShare);

  const secondaryControlsCount =
    (canRollDice ? 1 : 0) +
    (showBardControl ? 1 : 0) +
    (showUrgentControl ? 1 : 0) +
    (showMockControls ? 1 : 0);

  const primaryControlsCount =
    (showRetryControl ? 1 : 0) +
    1 + // mic
    (showCameraControl ? 1 : 0) +
    (showSwitchCameraControl ? 1 : 0) +
    (showScreenShareControl ? 1 : 0) +
    1 + // deafen
    1; // hangup

  const controlsCompact = useMemo(() => {
    if (secondaryControlsCount <= 0 || controlsSlotWidth <= 0) {
      return false;
    }
    const estimate = (count: number) =>
      count * CONTROL_BTN_SIZE + Math.max(0, count - 1) * CONTROL_BTN_GAP + CONTROL_HANGUP_EXTRA;
    // Primary + all secondary + hangup already in primaryCount.
    const fullWidth = estimate(primaryControlsCount + secondaryControlsCount);
    // Phone cinema: fold into «…» early — capsule must keep side breathing room.
    const slack = isDesktop ? 12 : cinemaActive ? 56 : 32;
    return controlsSlotWidth < fullWidth + slack;
  }, [
    cinemaActive,
    controlsSlotWidth,
    isDesktop,
    primaryControlsCount,
    secondaryControlsCount,
  ]);

  useEffect(() => {
    if (!controlsCompact && controlsOverflowOpen) {
      setControlsOverflowOpen(false);
    }
  }, [controlsCompact, controlsOverflowOpen]);

  const addMockPeer = useCallback(() => {
    mockSeqRef.current += 1;
    const n = mockSeqRef.current;
    setMockPeers((prev) => [
      ...prev,
      {
        id: `mock-${n}`,
        name: MOCK_NAMES[(n - 1) % MOCK_NAMES.length] ?? `Мок_${n}`,
        cameraOn: false,
        speaking: false,
        hue: (n * 47) % 360,
      },
    ]);
  }, []);

  const removeMockPeer = useCallback((id: string) => {
    const timer = mockSpeakTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      mockSpeakTimers.current.delete(id);
    }
    setMockPeers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleMockCamera = useCallback((id: string) => {
    setMockPeers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, cameraOn: !p.cameraOn } : p)),
    );
  }, []);

  const pulseMockSpeak = useCallback((id: string) => {
    playMockBeep();
    setMockPeers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, speaking: true } : p)),
    );
    const prevTimer = mockSpeakTimers.current.get(id);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    const timer = setTimeout(() => {
      mockSpeakTimers.current.delete(id);
      setMockPeers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, speaking: false } : p)),
      );
    }, 1600);
    mockSpeakTimers.current.set(id, timer);
  }, []);

  useEffect(() => {
    if (visible) {
      return;
    }
    for (const timer of mockSpeakTimers.current.values()) {
      clearTimeout(timer);
    }
    mockSpeakTimers.current.clear();
    setMockPeers([]);
    mockSeqRef.current = 0;
  }, [visible]);

  useEffect(
    () => () => {
      for (const timer of mockSpeakTimers.current.values()) {
        clearTimeout(timer);
      }
      mockSpeakTimers.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!linking) {
      connectPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(connectPulse, {
          toValue: 0.3,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(connectPulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [connectPulse, linking]);

  useEffect(() => {
    if (!visible || failed || !mediaReady) {
      startedAtRef.current = null;
      setElapsedSec(0);
      return;
    }
    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
      setElapsedSec(0);
    }
    const tick = () => {
      const started = startedAtRef.current;
      if (started == null) {
        return;
      }
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
      setNowTick(Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [failed, mediaReady, visible]);

  useEffect(() => {
    if (!visible) {
      setDiceOpen(false);
      setVolumeOpenId(null);
      setBardSheetOpen(false);
      setSpotlightKey(null);
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
      manualSpotlightRef.current = false;
      setFullscreen(false);
      setStreamCinema(false);
      setPriorityCinema(false);
      setPinnedSpotlightKey(null);
      setPinnedScreenIdentity(null);
      setScreenQualityOpen(false);
      setCinemaPipLayouts({});
      setCinemaRailCollapsed(false);
      setCinemaRailTabHot(false);
      setPriorityPaneWidth(null);
      setPriorityResizeHot(false);
      setPriorityResizing(false);
      suppressCinemaExitOnFsRef.current = false;
      void exitOsFullscreen();
      savedMiniOffset = { x: 0, y: 0 };
      miniOffsetRef.current = savedMiniOffset;
      setMiniOffset(savedMiniOffset);
    }
  }, [visible]);

  /** Dice / Bard / sheets portal outside the FS host — leave OS FS, keep cinema UI. */
  const leaveOsFullscreenForOverlay = useCallback(() => {
    if (Platform.OS === 'web' && getOsFullscreenElement()) {
      suppressCinemaExitOnFsRef.current = true;
      void exitOsFullscreen();
    }
  }, []);

  const openBardSheet = useCallback(() => {
    onResumeBardAudio?.();
    if (!bardPresent) {
      onSummonBard?.();
      return;
    }
    setBardSheetOpen(true);
    leaveOsFullscreenForOverlay();
  }, [bardPresent, leaveOsFullscreenForOverlay, onResumeBardAudio, onSummonBard]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  const enterStreamCinema = useCallback(() => {
    setPriorityCinema(false);
    setStreamCinema(true);
    setCinemaRailCollapsed(false);
    setFullscreen(true);
    setVolumeOpenId(null);
    void requestOsFullscreen(getWebHostNode(cinemaHostRef.current));
  }, []);

  const exitStreamCinema = useCallback(() => {
    setStreamCinema(false);
    setCinemaRailCollapsed(false);
    void exitOsFullscreen();
  }, []);

  const enterPriorityCinema = useCallback(() => {
    setStreamCinema(false);
    setPriorityCinema(true);
    setCinemaRailCollapsed(false);
    setFullscreen(true);
    setVolumeOpenId(null);
    void requestOsFullscreen(getWebHostNode(cinemaHostRef.current));
  }, []);

  const exitPriorityCinema = useCallback(() => {
    setPriorityCinema(false);
    setCinemaRailCollapsed(false);
    void exitOsFullscreen();
  }, []);

  // Esc / browser exit → drop cinema mode together with OS fullscreen.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const onFsChange = () => {
      if (!getOsFullscreenElement()) {
        if (suppressCinemaExitOnFsRef.current) {
          suppressCinemaExitOnFsRef.current = false;
          return;
        }
        if (streamCinemaRef.current) {
          setStreamCinema(false);
        }
        if (priorityCinemaRef.current) {
          setPriorityCinema(false);
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener);
    };
  }, []);

  const clearCinemaHideTimer = useCallback(() => {
    if (cinemaHideControlsTimerRef.current) {
      clearTimeout(cinemaHideControlsTimerRef.current);
      cinemaHideControlsTimerRef.current = null;
    }
  }, []);

  const scheduleMobileCinemaHide = useCallback(() => {
    clearCinemaHideTimer();
    cinemaHideControlsTimerRef.current = setTimeout(() => {
      cinemaHideControlsTimerRef.current = null;
      if (controlsOverflowOpen || diceOpen) {
        return;
      }
      setCinemaControlsRevealed(false);
    }, MOBILE_CINEMA_CONTROLS_HIDE_MS);
  }, [clearCinemaHideTimer, controlsOverflowOpen, diceOpen]);

  const revealCinemaControls = useCallback(
    (opts?: { hold?: boolean }) => {
      setCinemaControlsRevealed(true);
      if (opts?.hold) {
        clearCinemaHideTimer();
        return;
      }
      if (!isDesktop) {
        scheduleMobileCinemaHide();
      }
    },
    [clearCinemaHideTimer, isDesktop, scheduleMobileCinemaHide],
  );

  const openDice = useCallback(() => {
    leaveOsFullscreenForOverlay();
    setDiceOpen(true);
    if (streamCinemaRef.current || priorityCinemaRef.current) {
      revealCinemaControls({ hold: true });
    }
  }, [leaveOsFullscreenForOverlay, revealCinemaControls]);

  // Cinema dock: PC — cursor near bottom. Mobile — show, then slide away; tap brings back.
  useEffect(() => {
    const cinemaOn = streamCinema || priorityCinema;
    if (!cinemaOn) {
      clearCinemaHideTimer();
      cinemaControlsHoverRef.current = false;
      setCinemaControlsRevealed(false);
      cinemaDockAnim.setValue(0);
      return;
    }

    if (!isDesktop) {
      // Enter cinema: show dock, then auto-hide after idle.
      setCinemaControlsRevealed(true);
      cinemaDockAnim.setValue(1);
      scheduleMobileCinemaHide();
      return () => {
        clearCinemaHideTimer();
      };
    }

    setCinemaControlsRevealed(false);
    cinemaDockAnim.setValue(0);

    // Dock sits ~56px above the safe bottom — keep reveal zone above it.
    const EDGE_PX = 160;
    const scheduleHide = () => {
      clearCinemaHideTimer();
      cinemaHideControlsTimerRef.current = setTimeout(() => {
        cinemaHideControlsTimerRef.current = null;
        if (!cinemaControlsHoverRef.current) {
          setCinemaControlsRevealed(false);
        }
      }, 520);
    };

    const onMove = (event: MouseEvent) => {
      const fromBottom = window.innerHeight - event.clientY;
      if (fromBottom <= EDGE_PX || cinemaControlsHoverRef.current) {
        clearCinemaHideTimer();
        setCinemaControlsRevealed(true);
        return;
      }
      scheduleHide();
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearCinemaHideTimer();
    };
  }, [
    cinemaDockAnim,
    clearCinemaHideTimer,
    isDesktop,
    priorityCinema,
    scheduleMobileCinemaHide,
    streamCinema,
  ]);

  useEffect(() => {
    const cinemaOn = streamCinema || priorityCinema;
    if (!cinemaOn) {
      return;
    }
    Animated.spring(cinemaDockAnim, {
      toValue: cinemaControlsRevealed ? 1 : 0,
      friction: 9,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [cinemaControlsRevealed, cinemaDockAnim, priorityCinema, streamCinema]);

  useEffect(() => {
    if ((streamCinema || priorityCinema) && (controlsOverflowOpen || diceOpen)) {
      cinemaControlsHoverRef.current = true;
      revealCinemaControls({ hold: true });
    } else if (
      (streamCinema || priorityCinema) &&
      !isDesktop &&
      !controlsOverflowOpen &&
      !diceOpen
    ) {
      scheduleMobileCinemaHide();
    }
  }, [
    controlsOverflowOpen,
    diceOpen,
    isDesktop,
    priorityCinema,
    revealCinemaControls,
    scheduleMobileCinemaHide,
    streamCinema,
  ]);

  useEffect(() => {
    if (!bardPresent) {
      setBardSheetOpen(false);
    }
  }, [bardPresent]);

  const beginMiniDrag = useCallback(
    (clientX: number, clientY: number) => {
      const origin = { ...miniOffsetRef.current };
      const startX = clientX;
      const startY = clientY;
      let moved = false;

      const anchor = {
        right: Math.max(insets.right, 16),
        bottom: Math.max(insets.bottom, 16) + 12,
      };

      const move = (nextX: number, nextY: number) => {
        const dx = nextX - startX;
        const dy = nextY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 6) {
          moved = true;
        }
        const next = clampMiniOffset(
          { x: origin.x + dx, y: origin.y + dy },
          { width, height },
          miniSizeRef.current,
          anchor,
        );
        savedMiniOffset = next;
        miniOffsetRef.current = next;
        setMiniOffset(next);
      };

      const finish = () => {
        suppressExpandRef.current = moved;
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const onMove = (event: PointerEvent) => move(event.clientX, event.clientY);
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          finish();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return;
      }

      finish();
    },
    [height, insets.bottom, insets.right, width],
  );

  const needsScreenPick =
    screenStreams.length >= 2 && !selectedScreenIdentity && Boolean(onSelectScreenShare);

  /** Selected remote/local screen track — separate from person tiles (they stay in the rail). */
  const watchedScreen = useMemo(() => {
    if (!selectedScreenIdentity) {
      return null;
    }
    const p = participants.find((x) => x.identity === selectedScreenIdentity);
    if (!p?.screenShareOn || !p.screenShareTrack) {
      return null;
    }
    return {
      identity: p.identity,
      name: p.name,
      track: p.screenShareTrack,
      isLocal: p.isLocal,
    };
  }, [participants, selectedScreenIdentity]);

  const tiles = useMemo<OverlayTile[]>(() => {
    const live: OverlayTile[] = [];
    for (const p of participants) {
      const avatarUrl = p.isLocal && profileAvatarUrl ? profileAvatarUrl : p.avatarUrl;
      const volume = p.isLocal ? undefined : clamp01(volumeById[p.identity] ?? 1);
      const urgent = Boolean(urgentById[p.identity]);
      // Person tile always stays a person (speaking/camera). Stream is `watchedScreen`.
      live.push({
        key: p.identity,
        identity: p.identity,
        name: p.name,
        avatarUrl,
        speaking: p.speaking,
        muted: p.muted,
        cameraOn: p.cameraOn,
        videoTrack: p.videoTrack,
        screenShareOn: false,
        screenShareTrack: null,
        isLocal: p.isLocal,
        badges: p.badges,
        frameId: p.avatarFrameId,
        urgent,
        volume,
      });
    }
    const liveIds = new Set(live.map((p) => tileIdentity(p)));
    for (const peer of waitingPeers) {
      if (!peer.id || liveIds.has(peer.id)) {
        continue;
      }
      live.push({
        key: peer.id,
        identity: peer.id,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
        speaking: false,
        muted: false,
        cameraOn: false,
        videoTrack: null,
        screenShareOn: false,
        screenShareTrack: null,
        isLocal: false,
        waiting: true,
        connecting: Boolean(peer.connecting),
        urgent: Boolean(urgentById[peer.id]),
      });
      liveIds.add(peer.id);
    }
    if (bardPresent) {
      live.push({
        key: BARD_TILE_KEY,
        identity: BARD_TILE_KEY,
        name: 'Бард',
        avatarUrl: null,
        speaking: Boolean(bardPlaying),
        muted: false,
        cameraOn: false,
        videoTrack: null,
        screenShareOn: false,
        screenShareTrack: null,
        isLocal: false,
        isBard: true,
        bardPlaque: bardTrackTitle,
        bardPlaying,
        bardLoading,
        volume: clamp01(bardLocalVolume),
      });
    }
    for (const mock of mockPeers) {
      if (liveIds.has(mock.id)) {
        continue;
      }
      live.push({
        key: mock.id,
        identity: mock.id,
        name: mock.name,
        avatarUrl: null,
        speaking: mock.speaking,
        muted: false,
        cameraOn: mock.cameraOn,
        videoTrack: null,
        screenShareOn: false,
        screenShareTrack: null,
        isLocal: false,
        mock: true,
        mockHue: mock.hue,
        volume: clamp01(volumeById[mock.id] ?? 1),
      });
      liveIds.add(mock.id);
    }
    // Screens first among a peer, local first, bard near end, waiting last.
    return live.sort((a, b) => {
      if (Boolean(a.screenShareOn) !== Boolean(b.screenShareOn)) {
        return a.screenShareOn ? -1 : 1;
      }
      if (a.isLocal !== b.isLocal) {
        return a.isLocal ? -1 : 1;
      }
      if (Boolean(a.waiting) !== Boolean(b.waiting)) {
        return a.waiting ? 1 : -1;
      }
      if (Boolean(a.isBard) !== Boolean(b.isBard)) {
        return a.isBard ? 1 : -1;
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [
    bardLocalVolume,
    bardLoading,
    bardPlaying,
    bardPresent,
    bardTrackTitle,
    mockPeers,
    participants,
    profileAvatarUrl,
    urgentById,
    volumeById,
    waitingPeers,
  ]);

  // Cinema: urgent peer must stay visible — expand rail + keep dock up.
  // Must sit after `tiles` — deps array reads it during render.
  useEffect(() => {
    if (!cinemaActive) {
      return;
    }
    const hasUrgent = tiles.some((t) => t.urgent && !t.isBard);
    if (!hasUrgent) {
      return;
    }
    setCinemaRailCollapsed(false);
    revealCinemaControls({ hold: true });
  }, [cinemaActive, revealCinemaControls, tiles]);

  const bardTile = useMemo(
    () => tiles.find((t) => t.isBard) ?? null,
    [tiles],
  );
  const peopleTilesLive = useMemo(
    () => tiles.filter((t) => !t.isBard),
    [tiles],
  );
  const [tileOrderKeys, setTileOrderKeys] = useState<string[]>([]);
  const [gridDragKey, setGridDragKey] = useState<string | null>(null);
  const [gridDropKey, setGridDropKey] = useState<string | null>(null);
  const gridDragMovedRef = useRef(false);

  useEffect(() => {
    const liveKeys = peopleTilesLive.map((t) => t.key);
    setTileOrderKeys((prev) => {
      const kept = prev.filter((key) => liveKeys.includes(key));
      const added = liveKeys.filter((key) => !kept.includes(key));
      if (kept.length === prev.length && added.length === 0) {
        return prev;
      }
      return [...kept, ...added];
    });
  }, [peopleTilesLive]);

  const peopleTiles = useMemo(() => {
    const byKey = new Map(peopleTilesLive.map((t) => [t.key, t]));
    const ordered: OverlayTile[] = [];
    for (const key of tileOrderKeys) {
      const tile = byKey.get(key);
      if (tile) {
        ordered.push(tile);
        byKey.delete(key);
      }
    }
    for (const tile of byKey.values()) {
      ordered.push(tile);
    }
    return ordered;
  }, [peopleTilesLive, tileOrderKeys]);

  const reorderGridTile = useCallback((fromKey: string, toKey: string) => {
    setTileOrderKeys((prev) => {
      const base =
        prev.length > 0 ? prev : peopleTilesLive.map((t) => t.key);
      return reorderTileKeys(base, fromKey, toKey);
    });
  }, [peopleTilesLive]);

  /**
   * Web pointer drag from the grip handle only.
   * Whole-tile drag on macOS/Safari starts native text/image copy instead.
   */
  const beginGridPointerDrag = useCallback(
    (tileKey: string, clientX: number, clientY: number) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
        return;
      }
      let moved = false;
      let overKey: string | null = tileKey;
      gridDragMovedRef.current = false;
      setGridDragKey(tileKey);
      setGridDropKey(tileKey);

      const body = document.body;
      const prevUserSelect = body.style.userSelect;
      const prevWebkitUserSelect = (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect;
      const prevCursor = body.style.cursor;
      body.style.userSelect = 'none';
      (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
      body.style.cursor = 'grabbing';

      const blockNativeDrag = (event: Event) => {
        event.preventDefault();
      };

      const onMove = (event: PointerEvent) => {
        event.preventDefault();
        const dist =
          Math.abs(event.clientX - clientX) + Math.abs(event.clientY - clientY);
        if (dist > 4) {
          moved = true;
          gridDragMovedRef.current = true;
        }
        if (!moved) {
          return;
        }
        const node = document.elementFromPoint(event.clientX, event.clientY);
        const host =
          node instanceof Element
            ? node.closest('[data-call-tile-key]')
            : null;
        const next = host?.getAttribute('data-call-tile-key') ?? null;
        if (next && next !== overKey) {
          overKey = next;
          setGridDropKey(next);
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('dragstart', blockNativeDrag, true);
        document.removeEventListener('selectstart', blockNativeDrag, true);
        body.style.userSelect = prevUserSelect;
        (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
          prevWebkitUserSelect ?? '';
        body.style.cursor = prevCursor;
        if (moved && overKey && overKey !== tileKey) {
          reorderGridTile(tileKey, overKey);
        }
        setGridDragKey(null);
        setGridDropKey(null);
        if (moved) {
          setTimeout(() => {
            gridDragMovedRef.current = false;
          }, 0);
        }
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('dragstart', blockNativeDrag, true);
      document.addEventListener('selectstart', blockNativeDrag, true);
    },
    [reorderGridTile],
  );

  const canReorderPeople =
    Platform.OS === 'web' && peopleTilesLive.length > 1;

  // Speaker moves between stage/rail. Watching a stream uses a separate stage (not a person tile).
  useEffect(() => {
    const clearHold = () => {
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
    };

    if (!tiles.length) {
      clearHold();
      setSpotlightKey(null);
      setPinnedSpotlightKey(null);
      return;
    }

    const people = tiles.filter((t) => !t.waiting && !t.isBard);
    const pinnedKey = pinnedSpotlightKeyRef.current;
    if (pinnedKey) {
      const pinned = people.find(
        (t) => t.key === pinnedKey && tileHasPriorityVideo(t),
      );
      if (!pinned) {
        setPinnedSpotlightKey(null);
      }
    }

    // Stream on stage — don't promote the sharer out of the people rail.
    if (watchedScreen || needsScreenPick) {
      clearHold();
      if (spotlightKeyRef.current != null) {
        setSpotlightKey(null);
      }
      return;
    }

    const prev = spotlightKeyRef.current;

    // Desktop modal: equal tiles. Expanded / mobile: camera priority on stage.
    if (!(fullscreen || !isDesktop)) {
      clearHold();
      if (spotlightKeyRef.current != null) {
        setSpotlightKey(null);
      }
      return;
    }

    // Manual pin wins over auto speaker promote.
    const pinnedStill =
      pinnedKey != null
        ? people.find((t) => t.key === pinnedKey && tileHasPriorityVideo(t))
        : null;
    if (pinnedStill) {
      clearHold();
      if (spotlightKeyRef.current !== pinnedStill.key) {
        setSpotlightKey(pinnedStill.key);
      }
      return;
    }

    const promoteSpotlight = (nextKey: string) => {
      if (!prev || !tiles.some((t) => t.key === prev)) {
        clearHold();
        setSpotlightKey(nextKey);
        return;
      }
      if (prev === nextKey) {
        clearHold();
        return;
      }
      if (pendingSpotlightRef.current === nextKey && spotlightHoldRef.current) {
        return;
      }
      const current = tiles.find((t) => t.key === prev);
      // Local speaking must not delay a remote taking priority.
      const currentHoldsStage = Boolean(
        current?.speaking &&
          tileHasPriorityVideo(current) &&
          !current.isLocal,
      );
      const delay = currentHoldsStage ? SPEAKER_HOLD_MS : SPEAKER_SWITCH_SILENT_MS;
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
      }
      pendingSpotlightRef.current = nextKey;
      spotlightHoldRef.current = setTimeout(() => {
        spotlightHoldRef.current = null;
        pendingSpotlightRef.current = null;
        setSpotlightKey(nextKey);
      }, delay);
    };

    const remotes = people.filter((t) => !t.isLocal);
    const alone = remotes.length === 0;
    const cams = people.filter((t) => tileHasPriorityVideo(t));
    // No live cam / mock-cam → equal grid (no avatar-only priority).
    if (cams.length === 0) {
      clearHold();
      manualSpotlightRef.current = false;
      if (spotlightKeyRef.current != null) {
        setSpotlightKey(null);
      }
      return;
    }
    // Never auto-promote self for speaking — only remotes (or self when alone / clicked).
    const speakingRemoteCam = cams.find((t) => t.speaking && !t.isLocal);
    if (speakingRemoteCam) {
      manualSpotlightRef.current = false;
      promoteSpotlight(speakingRemoteCam.key);
      return;
    }
    if (prev) {
      const prevCam = cams.find((t) => t.key === prev);
      if (prevCam) {
        // Self stays only if alone or user clicked themselves.
        if (
          prevCam.isLocal &&
          !alone &&
          !manualSpotlightRef.current &&
          pinnedKey !== prev
        ) {
          // fall through to seed a remote
        } else {
          clearHold();
          return;
        }
      }
    }
    // Seed: remotes with cam first; self only when alone and cam is on.
    const seed = alone
      ? cams.find((t) => t.isLocal) ?? cams[0]!
      : cams.find((t) => !t.isLocal) ?? null;
    if (seed) {
      clearHold();
      if (spotlightKeyRef.current !== seed.key) {
        setSpotlightKey(seed.key);
      }
      return;
    }
    clearHold();
    if (spotlightKeyRef.current != null) {
      setSpotlightKey(null);
    }
  }, [fullscreen, isDesktop, needsScreenPick, pinnedSpotlightKey, tiles, watchedScreen]);

  useEffect(
    () => () => {
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!volumeOpenId) {
      return;
    }
    const stillThere = tiles.some(
      (tile) =>
        tile.key === volumeOpenId &&
        !tile.isLocal &&
        !tile.waiting &&
        (tile.isBard ? Boolean(onSetBardLocalVolume) : true),
    );
    if (!stillThere) {
      setVolumeOpenId(null);
    }
  }, [onSetBardLocalVolume, tiles, volumeOpenId]);

  const liveCount = participants.length;
  const localUrgent = participants.some((p) => p.isLocal && Boolean(urgentById[p.identity]));
  const waitingCount = waitingPeers.filter(
    (peer) => peer.id && !participants.some((p) => p.identity === peer.id),
  ).length;

  const connection = buildConnectionUi({ status, error });
  const callPhase = buildCallPhaseLabel({
    isGroup,
    ringing: Boolean(ringing),
    mediaReady,
    liveCount,
    waitingCount,
  });
  const statusLine =
    connection.tone === 'ok' && callPhase
      ? `${connection.label} · ${callPhase}`
      : connection.label;
  const miniStatusLine = failed
    ? connection.detail || connection.label
    : linking || connection.tone === 'warn'
      ? connection.detail || connection.label
      : `${statusLine}${mediaReady ? ` · ${formatCallDuration(elapsedSec)}` : ''}`;

  /**
   * Modal (desktop windowed): equal grid.
   * Expanded / mobile: remote/self cam on stage; others in a width-filling rail.
   * Mobile shell is already full-bleed — don't wait for the fullscreen toggle.
   * Screen share: stream stage + people rail.
   */
  const expandedLayout = fullscreen || !isDesktop;
  const { spotlightTile, filmstripTiles, useSpotlight } = useMemo(() => {
    // Bard is a player strip, not a grid/rail participant card.
    if (watchedScreen || needsScreenPick) {
      return {
        spotlightTile: null as OverlayTile | null,
        filmstripTiles: peopleTiles,
        useSpotlight: true,
      };
    }
    if (!expandedLayout) {
      return {
        spotlightTile: null as OverlayTile | null,
        filmstripTiles: peopleTiles,
        useSpotlight: false,
      };
    }
    const people = peopleTiles.filter((t) => !t.waiting);

    // Priority person stays in the rail too — stage is a larger copy, not a removal.
    if (pinnedSpotlightKey) {
      const pinned = people.find(
        (t) => t.key === pinnedSpotlightKey && tileHasPriorityVideo(t),
      );
      if (pinned) {
        return {
          spotlightTile: pinned,
          filmstripTiles: peopleTiles,
          useSpotlight: true,
        };
      }
    }

    // Click / temporary promote — only with live/mock video.
    if (spotlightKey) {
      const manual = people.find(
        (t) => t.key === spotlightKey && tileHasPriorityVideo(t),
      );
      if (manual) {
        return {
          spotlightTile: manual,
          filmstripTiles: peopleTiles,
          useSpotlight: true,
        };
      }
    }

    const remotes = people.filter((t) => !t.isLocal);
    const alone = remotes.length === 0;
    const cams = people.filter((t) => tileHasPriorityVideo(t));
    // Mobile/desktop: no cam track and no mock-cam → equal grid, no priority.
    if (cams.length === 0) {
      return {
        spotlightTile: null as OverlayTile | null,
        filmstripTiles: peopleTiles,
        useSpotlight: false,
      };
    }
    const spot =
      cams.find((t) => t.speaking && !t.isLocal) ??
      (!alone ? cams.find((t) => !t.isLocal) : null) ??
      (alone ? cams.find((t) => t.isLocal) ?? cams[0]! : cams[0]!);
    return {
      spotlightTile: spot,
      filmstripTiles: peopleTiles,
      useSpotlight: true,
    };
  }, [
    expandedLayout,
    isDesktop,
    needsScreenPick,
    peopleTiles,
    pinnedSpotlightKey,
    spotlightKey,
    watchedScreen,
  ]);

  const streamCinemaTrack = watchedScreen?.track ?? null;
  const priorityCinemaTrack =
    spotlightTile?.cameraOn && (spotlightTile.videoTrack || spotlightTile.mock)
      ? spotlightTile.videoTrack
      : null;
  const priorityCinemaMock =
    Boolean(spotlightTile?.mock && spotlightTile.cameraOn) && !priorityCinemaTrack;

  useEffect(() => {
    if (!watchedScreen) {
      setStreamCinema(false);
      setStreamWatchHovered(false);
      if (!priorityCinemaRef.current) {
        void exitOsFullscreen();
      }
    }
  }, [watchedScreen]);

  useEffect(() => {
    if (!spotlightTile?.cameraOn) {
      setPriorityCinema(false);
      if (!streamCinemaRef.current) {
        void exitOsFullscreen();
      }
    }
  }, [spotlightTile]);

  // Keep pinned screen selected while the share is live.
  useEffect(() => {
    if (!pinnedScreenIdentity || !onSelectScreenShare) {
      return;
    }
    const stillLive = screenStreams.some((s) => s.identity === pinnedScreenIdentity);
    if (!stillLive) {
      setPinnedScreenIdentity(null);
      return;
    }
    if (selectedScreenIdentity !== pinnedScreenIdentity) {
      onSelectScreenShare(pinnedScreenIdentity);
    }
  }, [
    onSelectScreenShare,
    pinnedScreenIdentity,
    screenStreams,
    selectedScreenIdentity,
  ]);

  const showConnectionBanner =
    linking || failed || connection.tone === 'warn';

  const layout = useMemo(() => {
    const count = Math.max(peopleTiles.length, 1);
    // Mobile shell is already full-bleed — size the stage like expanded.
    const edgeToEdge = fullscreen || !isDesktop;
    // Windowed: compact modal. Expanded: near edge-to-edge (small pad).
    const stagePad = edgeToEdge ? 16 : Spacing.md * 4;
    const stageWidth = Math.min(
      width - stagePad,
      edgeToEdge
        ? width - stagePad
        : isDesktop
          ? Math.min(880, width - 48)
          : width - 48,
    );

    const rootPadY = edgeToEdge
      ? 0
      : Math.max(insets.top, Spacing.md) + Math.max(insets.bottom, Spacing.md);
    const shellCap = edgeToEdge
      ? Math.max(280, height - rootPadY)
      : Math.max(280, Math.min(height * 0.86, height - rootPadY));
    const reserved =
      (edgeToEdge ? 48 : 68) +
      (edgeToEdge ? 64 : 96) +
      (showMockControls && mockPeers.length > 0 ? 52 : 0) +
      (showConnectionBanner ? 52 : 0) +
      (screenStreams.length >= 2 ? 48 : 0) +
      (bardTile ? 56 : 0) +
      (edgeToEdge ? 4 : 12);
    // Expanded: use almost the whole stage so priority isn't a small island.
    const stageBudget = Math.max(160, shellCap - reserved);

    // Discord-style side rail — desktop only. Mobile always stacks (priority → film).
    const filmCount = filmstripTiles.length;
    const FILM_GAP = 8;
    const hasFilm = filmCount > 0;
    const sideFilm =
      hasFilm && isDesktop && (stageWidth >= 560 || fullscreen);
    const STAGE_GAP = sideFilm && fullscreen ? PRIORITY_RESIZE_HANDLE_W : 12;
    // Mobile / narrow: stacked film under priority. Desktop wide: side rail.
    const stackFilm = hasFilm && !isDesktop;
    const stackPreview = stackFilm
      ? mobileStackFilmLayout(stageWidth, filmCount, FILM_GAP)
      : null;
    // Side rail: 2 cols only when leftover still fits a tall-enough 16:9
    // priority. Medium width + 2×2 rail → short flat priority + empty below.
    const twoColRailW =
      discordRailTileWidth(isDesktop) * 2 + FILM_GAP;
    const twoColLeftover = stageWidth - twoColRailW - STAGE_GAP;
    const twoColSpotH = fitLandscape16x9(
      Math.max(160, twoColLeftover),
      Math.max(160, stageBudget - PRIORITY_CAPTION_EXTRA - 8),
    ).height;
    const filmCols = stackPreview
      ? stackPreview.cols
      : sideFilm &&
          filmCount >= 2 &&
          stageWidth >= 960 &&
          twoColSpotH >= Math.min(280, Math.round(stageBudget * 0.45))
        ? 2
        : 1;
    const filmVolumeExtra =
      volumeOpenId && filmstripTiles.some((t) => t.key === volumeOpenId) ? 22 : 0;

    /** Build rail metrics once spotlight/stream size is known. */
    const filmExtrasForSizes = (
      railH: number,
      filmTileW: number,
      railContentW: number,
      stack?: ReturnType<typeof mobileStackFilmLayout> | null,
    ) => {
      const tileH = stack?.tileH ?? discordRailTileHeight(filmTileW);
      const resolvedCols = stack?.cols ?? filmCols;
      const filmAvatarBase = filmTileW >= 160 ? (isDesktop ? 52 : 48) : 42;
      const avatar = Math.min(
        filmAvatarBase + 8,
        Math.round(tileH * 0.4),
        Math.round(filmTileW * 0.32),
      );
      const stackRailH = stack?.railH ?? tileH;
      const filmRowBudget =
        hasFilm && !sideFilm ? stackRailH + 8 + filmVolumeExtra : 0;
      return {
        tileMinHeight: null as number | null,
        gridContentWidth: stageWidth,
        gridShort: false,
        gridAlignStart: false,
        columns: 1,
        gap: FILM_GAP,
        tileWidth: filmTileW,
        avatarSize: avatar,
        videoHeight: null as number | null,
        filmGap: FILM_GAP,
        filmTileWidth: filmTileW,
        filmTileHeight: tileH,
        filmAvatar: avatar,
        filmVideoHeight: Math.max(52, tileH - 14),
        filmBandHeight: tileH,
        filmBandVideoHeight: Math.max(52, tileH - 14),
        filmRowBudget,
        sideFilm,
        filmRailHeight: sideFilm ? railH : stackRailH,
        filmCols: resolvedCols,
        filmRailWidth: railContentW,
        frameColGap: STAGE_GAP,
        discordBodyWidth: 0,
        gridScrollHeight: stageBudget,
        gridNeedsScroll: false,
      };
    };

    if (watchedScreen || needsScreenPick || (useSpotlight && spotlightTile)) {
      const stackGap = hasFilm && !sideFilm ? 12 : 0;
      const captionH =
        watchedScreen || needsScreenPick ? 0 : PRIORITY_CAPTION_EXTRA;
      // Expanded: priority runs almost to the controls (leave room for name row).
      const spotMaxH = Math.max(
        120,
        stageBudget - stackGap - captionH - (fullscreen ? 8 : 8),
      );

      if (watchedScreen || needsScreenPick) {
        let streamW: number;
        let streamH: number;
        let railContentW: number;
        let filmTileW: number;

        let priorityMinW = PRIORITY_PANE_MIN_W;
        let priorityMaxW = Math.floor(stageWidth * 0.78);
        if (sideFilm) {
          const sized = sizePrioritySideFilm({
            stageWidth,
            spotMaxH,
            filmCount,
            filmCols,
            filmGap: FILM_GAP,
            stageGap: STAGE_GAP,
            isDesktop,
            preferredSpotW: priorityPaneWidth,
          });
          streamW = sized.spotlightWidth;
          streamH = sized.spotlightVideoHeight;
          filmTileW = sized.filmTileW;
          railContentW = sized.railContentW;
          priorityMinW = sized.minSpotW;
          priorityMaxW = sized.maxSpotW;
        } else if (!isDesktop) {
          streamW = stageWidth;
          const stackGap = hasFilm ? 10 : 0;
          const avail = Math.max(160, spotMaxH - stackGap);
          // Priority ~42%; film grid fills the rest (2 or 3 adaptive cols).
          const desiredSpot = Math.max(
            148,
            Math.min(Math.round(avail * 0.42), Math.round(stageWidth * 0.62)),
          );
          const filmBudget = hasFilm ? Math.max(140, avail - desiredSpot) : 0;
          const film = mobileStackFilmLayout(
            stageWidth,
            filmCount,
            FILM_GAP,
            filmBudget,
          );
          streamH = Math.max(
            148,
            Math.min(desiredSpot, avail - (hasFilm ? film.reserveH + 8 : 0)),
          );
          filmTileW = film.tileW;
          railContentW = 0;
          return {
            mode: 'stream' as const,
            stageWidth,
            stageBudget,
            spotlightWidth: streamW,
            spotlightAvatar: isDesktop ? 52 : 46,
            spotlightVideoHeight: streamH,
            priorityMinW,
            priorityMaxW,
            ...filmExtrasForSizes(streamH, filmTileW, railContentW, film),
            discordBodyWidth: streamW,
            discordFill: false,
            discordAlignStart: false,
          };
        } else {
          const fixedFilmW = discordRailTileWidth(isDesktop);
          filmTileW = fixedFilmW;
          railContentW = 0;
          const fitted = fitLandscape16x9(stageWidth, spotMaxH);
          streamW = fitted.width;
          streamH = fitted.height;
        }

        return {
          mode: 'stream' as const,
          stageWidth,
          stageBudget,
          spotlightWidth: streamW,
          spotlightAvatar: isDesktop ? 52 : 46,
          spotlightVideoHeight: streamH,
          priorityMinW,
          priorityMaxW,
          ...filmExtrasForSizes(streamH, filmTileW, railContentW),
          discordBodyWidth:
            streamW + (sideFilm ? STAGE_GAP + railContentW : 0),
          discordFill: false,
          // Pack and center — avoids corner clip of speaking stroke.
          discordAlignStart: false,
        };
      }

      // Person spotlight
      let spotlightWidth: number;
      let spotlightVideoHeight: number;
      let railContentW: number;
      let filmTileW: number;
      let priorityMinW = PRIORITY_PANE_MIN_W;
      let priorityMaxW = Math.floor(stageWidth * 0.78);

      if (sideFilm) {
        const sized = sizePrioritySideFilm({
          stageWidth,
          spotMaxH,
          filmCount,
          filmCols,
          filmGap: FILM_GAP,
          stageGap: STAGE_GAP,
          isDesktop,
          preferredSpotW: priorityPaneWidth,
        });
        spotlightWidth = sized.spotlightWidth;
        spotlightVideoHeight = sized.spotlightVideoHeight;
        filmTileW = sized.filmTileW;
        railContentW = sized.railContentW;
        priorityMinW = sized.minSpotW;
        priorityMaxW = sized.maxSpotW;
      } else if (!isDesktop) {
        // Mobile: priority on top + adaptive film grid that fills the width.
        spotlightWidth = stageWidth;
        const stackGap = hasFilm ? 10 : 0;
        const avail = Math.max(160, spotMaxH - stackGap);
        const desiredSpot = Math.max(
          148,
          Math.min(Math.round(avail * 0.42), Math.round(stageWidth * 0.62)),
        );
        const filmBudget = hasFilm ? Math.max(140, avail - desiredSpot) : 0;
        const film = mobileStackFilmLayout(
          stageWidth,
          filmCount,
          FILM_GAP,
          filmBudget,
        );
        spotlightVideoHeight = Math.max(
          148,
          Math.min(desiredSpot, avail - (hasFilm ? film.reserveH + 8 : 0)),
        );
        filmTileW = film.tileW;
        railContentW = 0;
        return {
          mode: 'spotlight' as const,
          stageWidth,
          stageBudget,
          spotlightWidth,
          spotlightAvatar: Math.min(56, Math.round(spotlightVideoHeight * 0.28)),
          spotlightVideoHeight,
          priorityMinW,
          priorityMaxW,
          ...filmExtrasForSizes(
            spotlightVideoHeight,
            filmTileW,
            railContentW,
            film,
          ),
          discordBodyWidth: spotlightWidth,
          discordFill: false,
          discordAlignStart: false,
        };
      } else {
        // Desktop without side rail: fill available height, keep 16:9.
        const fitted = fitLandscape16x9(stageWidth, spotMaxH);
        spotlightWidth = fitted.width;
        spotlightVideoHeight = fitted.height;
        filmTileW = discordRailTileWidth(isDesktop);
        railContentW = 0;
      }

      return {
        mode: 'spotlight' as const,
        stageWidth,
        stageBudget,
        spotlightWidth,
        spotlightAvatar: isDesktop ? 52 : 46,
        spotlightVideoHeight,
        priorityMinW,
        priorityMaxW,
        ...filmExtrasForSizes(
          spotlightVideoHeight,
          filmTileW,
          railContentW,
        ),
        discordBodyWidth:
          spotlightWidth + (sideFilm ? STAGE_GAP + railContentW : 0),
        discordFill: false,
        discordAlignStart: false,
      };
    }

    // Equal grid — column count follows stage width (not window desktop flag),
    // so a phone-sized call shell never gets cramped 3-up cards.
    const FILM_W = discordRailTileWidth(isDesktop);
    const FILM_H_FALLBACK = discordRailTileHeight(FILM_W);
    const videoMode = peopleTiles.some((tile) => tile.cameraOn);
    const narrowStage = stageWidth < 720 || !isDesktop;
    const gap = narrowStage ? 8 : fullscreen ? 10 : count >= 5 ? 10 : 12;
    let columns = 1;
    if (narrowStage) {
      // Phone / narrow shell: max 2 per row — bigger cards, usable volume.
      if (count <= 1) columns = 1;
      else columns = 2;
    } else if (fullscreen) {
      const maxCols = stageWidth < 1100 ? 3 : 4;
      if (count <= 1) columns = 1;
      else if (count === 2) columns = 2;
      else columns = Math.min(maxCols, count);
    } else {
      // Modal: classic layout — 4 people = 2×2, tiles a bit under the old 300 cap.
      const maxCols = stageWidth < 900 ? 3 : 4;
      if (count === 2) columns = 2;
      else if (count === 3) columns = Math.min(3, maxCols);
      else if (count === 4) columns = Math.min(2, maxCols);
      else if (count <= 6) columns = Math.min(3, maxCols);
      else columns = Math.min(4, maxCols);
    }
    const rows = Math.ceil(count / columns);
    const naturalTileW = Math.floor(
      (stageWidth - gap * Math.max(0, columns - 1)) / columns,
    );
    const colBudget = Math.max(140, naturalTileW);

    if (!videoMode) {
      let tileWidth: number;
      let avatarSize: number;
      let tileMinHeight: number | null = null;
      let gridAlignStart = false;
      if (fullscreen || narrowStage) {
        // Voice-only: fill the column budget — wide cards on phone/narrow stage.
        const voiceMaxW = count === 1 ? 440 : 380;
        tileWidth = Math.min(colBudget, voiceMaxW);
        avatarSize = Math.min(
          Math.round(tileWidth * 0.38),
          count === 1 ? 128 : 120,
        );
        tileMinHeight = null;
        gridAlignStart = false;
      } else {
        tileWidth =
          count === 1
            ? Math.min(naturalTileW, Math.round(stageWidth * 0.52), 380)
            : count === 2
              ? Math.round(naturalTileW * 0.93)
              : count === 4
                ? Math.min(naturalTileW, 240)
                : Math.min(naturalTileW, count <= 6 ? 240 : 200);
        avatarSize = Math.min(
          Math.round(tileWidth * (count <= 2 ? 0.42 : 0.36)),
          count <= 2 ? (isDesktop ? 140 : 120) : count === 4 ? 88 : count <= 6 ? 88 : 72,
        );
      }
      // Narrow stage: fixed card height so we can clip after 2 rows + peek.
      if (narrowStage) {
        const fitBudget =
          rows > MOBILE_GRID_FIT_ROWS
            ? Math.floor(
                (stageBudget - gap * (MOBILE_GRID_FIT_ROWS - 1)) /
                  (MOBILE_GRID_FIT_ROWS + MOBILE_GRID_PEEK_RATIO),
              )
            : Math.floor(
                (stageBudget - gap * Math.max(0, rows - 1)) / Math.max(1, rows),
              );
        tileMinHeight = Math.max(
          140,
          Math.min(
            Math.round(tileWidth * 1.15),
            fitBudget,
            estimateVoiceTileHeight(tileWidth, avatarSize) + 36,
          ),
        );
      }
      const voiceTileH =
        tileMinHeight ?? estimateVoiceTileHeight(tileWidth, avatarSize);
      const scrollMetrics = narrowStage
        ? mobileGridScrollMetrics({
            stageBudget,
            tileH: voiceTileH,
            gap,
            rows,
          })
        : null;
      const gridContentWidth =
        tileWidth * Math.min(count, columns) +
        gap * Math.max(0, Math.min(count, columns) - 1);
      return {
        mode: 'grid' as const,
        columns,
        gap,
        tileWidth,
        avatarSize,
        stageWidth,
        gridContentWidth,
        gridShort: !(scrollMetrics?.needsScroll),
        gridAlignStart,
        stageBudget,
        gridScrollHeight: scrollMetrics?.scrollH ?? stageBudget,
        gridNeedsScroll: Boolean(scrollMetrics?.needsScroll),
        videoHeight: null,
        tileMinHeight,
        spotlightWidth: tileWidth,
        spotlightAvatar: avatarSize,
        spotlightVideoHeight: null,
        filmGap: gap,
        filmTileWidth: tileWidth,
        filmTileHeight: null as number | null,
        filmAvatar: avatarSize,
        filmVideoHeight: null,
        filmBandHeight: FILM_H_FALLBACK,
        filmBandVideoHeight: Math.max(48, FILM_H_FALLBACK - 14),
        filmRowBudget: 0,
        sideFilm: false,
        filmRailHeight: 0,
        filmCols: 1,
        filmRailWidth: FILM_W,
        frameColGap: 12,
        discordBodyWidth: stageWidth,
        discordFill: false,
        discordAlignStart: false,
      };
    }

    const tileChrome = fullscreen || narrowStage ? 36 : 40;
    let tileWidth: number;
    if (fullscreen || narrowStage) {
      // Expanded / narrow: tiles fill the chosen column budget.
      tileWidth = count === 1 ? Math.min(colBudget, 440) : colBudget;
    } else {
      tileWidth =
        count === 1
          ? Math.min(naturalTileW, Math.round(stageWidth * 0.52), 380)
          : count === 2
            ? Math.round(naturalTileW * 0.93)
            : count === 4
              ? Math.min(naturalTileW, 240)
              : Math.min(naturalTileW, count <= 6 ? 240 : 200);
    }
    // Narrow stage with many rows: size for 2 rows + peek, scroll the rest.
    const layoutRows =
      narrowStage && rows > MOBILE_GRID_FIT_ROWS ? MOBILE_GRID_FIT_ROWS : rows;
    const peekReserve =
      narrowStage && rows > MOBILE_GRID_FIT_ROWS
        ? Math.max(32, Math.round(stageBudget * 0.1))
        : 0;
    const cellH = Math.floor(
      (stageBudget - peekReserve - gap * Math.max(0, layoutRows - 1)) /
        Math.max(1, layoutRows),
    );
    let maxVideoH = Math.max(100, cellH - tileChrome);
    if (!fullscreen && !narrowStage && rows === 1) {
      maxVideoH = Math.min(maxVideoH, Math.round(stageBudget * 0.62));
    }
    let videoHeight = Math.round(tileWidth * (9 / 16));
    if (videoHeight > maxVideoH) {
      videoHeight = maxVideoH;
      tileWidth = Math.min(tileWidth, Math.round(videoHeight * (16 / 9)));
    }
    videoHeight = Math.max(100, videoHeight);
    const gridContentWidth =
      tileWidth * Math.min(count, columns) +
      gap * Math.max(0, Math.min(count, columns) - 1);
    const avatarSize = Math.min(
      fullscreen || narrowStage ? 96 : count <= 2 ? 96 : 80,
      Math.max(52, Math.round(videoHeight * (fullscreen || narrowStage ? 0.55 : 0.7))),
    );
    const tileH = videoHeight + tileChrome;
    const scrollMetrics = narrowStage
      ? mobileGridScrollMetrics({
          stageBudget,
          tileH,
          gap,
          rows,
        })
      : null;
    const gridShort = !(scrollMetrics?.needsScroll) &&
      rows * tileH + gap * Math.max(0, rows - 1) < stageBudget - 24;

    return {
      mode: 'grid' as const,
      columns,
      gap,
      tileWidth,
      avatarSize,
      stageWidth,
      gridContentWidth,
      gridShort,
      // Center equal grids — left-pack looked fine only with left-aligned controls.
      gridAlignStart: false,
      stageBudget,
      gridScrollHeight: scrollMetrics?.scrollH ?? stageBudget,
      gridNeedsScroll: Boolean(scrollMetrics?.needsScroll),
      videoHeight,
      tileMinHeight: null as number | null,
      spotlightWidth: tileWidth,
      spotlightAvatar: avatarSize,
      spotlightVideoHeight: videoHeight,
      filmGap: gap,
      filmTileWidth: tileWidth,
      filmTileHeight: null as number | null,
      filmAvatar: avatarSize,
      filmVideoHeight: videoHeight,
      filmBandHeight: FILM_H_FALLBACK,
      filmBandVideoHeight: Math.max(48, FILM_H_FALLBACK - 14),
      filmRowBudget: 0,
      sideFilm: false,
      filmRailHeight: 0,
      filmCols: 1,
      filmRailWidth: FILM_W,
      frameColGap: 12,
      discordBodyWidth: stageWidth,
      discordFill: false,
      discordAlignStart: false,
    };
  }, [
    bardTile,
    filmstripTiles,
    fullscreen,
    height,
    insets.bottom,
    insets.top,
    isDesktop,
    mockPeers.length,
    peopleTiles,
    screenStreams.length,
    showConnectionBanner,
    showMockControls,
    spotlightTile,
    useSpotlight,
    priorityPaneWidth,
    volumeOpenId,
    watchedScreen,
    width,
  ]);

  const clampPriorityPaneWidth = useCallback(
    (next: number) => {
      const minW =
        typeof layout.priorityMinW === 'number'
          ? layout.priorityMinW
          : PRIORITY_PANE_MIN_W;
      const maxW =
        typeof layout.priorityMaxW === 'number'
          ? layout.priorityMaxW
          : Math.floor(layout.stageWidth * 0.72);
      return Math.max(minW, Math.min(maxW, Math.round(next)));
    },
    [layout.priorityMaxW, layout.priorityMinW, layout.stageWidth],
  );

  const movePriorityResize = useCallback(
    (clientX: number) => {
      const drag = priorityDragRef.current;
      if (!drag) {
        return;
      }
      setPriorityPaneWidth(
        clampPriorityPaneWidth(drag.startW + (clientX - drag.startX)),
      );
    },
    [clampPriorityPaneWidth],
  );

  const endPriorityResize = useCallback(() => {
    priorityDragRef.current = null;
    setPriorityResizing(false);
  }, []);

  const beginPriorityResize = useCallback(
    (clientX: number) => {
      if (!layout.sideFilm) {
        return;
      }
      priorityDragRef.current = {
        startX: clientX,
        startW: layout.spotlightWidth,
      };
      setPriorityResizing(true);

      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return;
      }

      const onMove = (event: PointerEvent) => movePriorityResize(event.clientX);
      const onUp = () => {
        endPriorityResize();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [endPriorityResize, layout.sideFilm, layout.spotlightWidth, movePriorityResize],
  );

  const tileHasScreenShare = useCallback(
    (tile: OverlayTile) =>
      screenStreams.some((s) => s.identity === tileIdentity(tile)),
    [screenStreams],
  );

  const canPinTile = useCallback(
    (tile: OverlayTile) =>
      !tile.waiting &&
      !tile.isBard &&
      (tileHasPriorityVideo(tile) || tileHasScreenShare(tile)),
    [tileHasScreenShare],
  );

  const isTilePinned = useCallback(
    (tile: OverlayTile) =>
      pinnedSpotlightKey === tile.key ||
      pinnedScreenIdentity === tileIdentity(tile),
    [pinnedScreenIdentity, pinnedSpotlightKey],
  );

  const togglePinTile = useCallback(
    (tile: OverlayTile) => {
      if (!canPinTile(tile)) {
        return;
      }
      const id = tileIdentity(tile);
      const alreadyPinned =
        pinnedSpotlightKey === tile.key || pinnedScreenIdentity === id;
      if (alreadyPinned) {
        setPinnedSpotlightKey(null);
        setPinnedScreenIdentity(null);
        return;
      }

      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
      setFullscreen(true);

      if (tileHasPriorityVideo(tile)) {
        setPinnedScreenIdentity(null);
        setPinnedSpotlightKey(tile.key);
        setSpotlightKey(tile.key);
        if (selectedScreenIdentity) {
          onSelectScreenShare?.(null);
        }
        return;
      }

      // Screen share only.
      setPinnedSpotlightKey(null);
      setPinnedScreenIdentity(id);
      onSelectScreenShare?.(id);
    },
    [
      canPinTile,
      onSelectScreenShare,
      pinnedScreenIdentity,
      pinnedSpotlightKey,
      selectedScreenIdentity,
    ],
  );

  /** Ordinary click: temporary priority until the next remote speaker/click — not a pin lock. */
  const promoteTemporarily = useCallback(
    (tile: OverlayTile) => {
      if (tile.isBard) {
        openBardSheet();
        return;
      }
      // No live/mock video → stay on equal grid (never a big avatar stage).
      if (!tileHasPriorityVideo(tile)) {
        return;
      }
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
      manualSpotlightRef.current = true;
      setPinnedSpotlightKey(null);
      setPinnedScreenIdentity(null);
      setFullscreen(true);
      if (selectedScreenIdentity) {
        onSelectScreenShare?.(null);
      }
      setSpotlightKey(tile.key);
      // From cinema PIPs (incl. self): keep / enter priority cinema for that camera.
      if (streamCinemaRef.current || priorityCinemaRef.current) {
        setStreamCinema(false);
        setPriorityCinema(true);
      }
    },
    [onSelectScreenShare, openBardSheet, selectedScreenIdentity],
  );

  // Cinema: main stage + Discord-style translucent PIPs (stage person stays in the list).
  const cinemaDockTiles = useMemo(() => {
    if (!cinemaActive) {
      return [] as OverlayTile[];
    }
    return tiles.filter((t) => !t.isBard);
  }, [cinemaActive, tiles]);

  useEffect(() => {
    if (!cinemaActive || cinemaDockTiles.length === 0) {
      return;
    }
    const stageW = Math.max(320, cinemaStageSize.width || width);
    const stageH = Math.max(240, cinemaStageSize.height || height);
    setCinemaPipLayouts((prev) => {
      let changed = false;
      const next: Record<string, CinemaPipLayout> = {};
      cinemaDockTiles.forEach((tile, index) => {
        const existing = prev[tile.key];
        if (existing && existing.docked === false) {
          // Free-dragged — keep position, only clamp to stage.
          const clamped = clampCinemaPipLayout(existing, stageW, stageH);
          next[tile.key] = clamped;
          if (
            clamped.x !== existing.x ||
            clamped.y !== existing.y ||
            clamped.w !== existing.w ||
            clamped.h !== existing.h
          ) {
            changed = true;
          }
          return;
        }
        // Auto-dock: fixed size, col1 top→bottom then col2. Keep custom size if resized.
        const docked = defaultCinemaPipLayout(index, stageH, stageW, !isDesktop);
        if (existing?.docked && existing.w) {
          docked.w = existing.w;
          docked.h = existing.h || cinemaPipAspectHeight(existing.w);
        }
        const clamped = clampCinemaPipLayout(docked, stageW, stageH);
        next[tile.key] = clamped;
        if (
          !existing ||
          clamped.right !== existing.right ||
          clamped.bottom !== existing.bottom ||
          clamped.w !== existing.w ||
          clamped.h !== existing.h ||
          existing.docked !== true
        ) {
          changed = true;
        }
      });
      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    cinemaActive,
    cinemaDockTiles,
    cinemaStageSize.height,
    cinemaStageSize.width,
    height,
    isDesktop,
    width,
  ]);

  const updateCinemaPipLayout = useCallback(
    (key: string, next: CinemaPipLayout) => {
      setCinemaPipLayouts((prev) => ({
        ...prev,
        [key]: clampCinemaPipLayout(
          next,
          Math.max(320, cinemaStageSize.width || width),
          Math.max(240, cinemaStageSize.height || height),
        ),
      }));
    },
    [cinemaStageSize.height, cinemaStageSize.width, height, width],
  );

  const onCinemaStageLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextW = Math.round(event.nativeEvent.layout.width);
      const nextH = Math.round(event.nativeEvent.layout.height);
      if (nextW <= 0 || nextH <= 0) {
        return;
      }
      setCinemaStageSize((prev) =>
        prev.width === nextW && prev.height === nextH
          ? prev
          : { width: nextW, height: nextH },
      );
    },
    [],
  );

  if (!visible) {
    return null;
  }

  const statusColor = connection.color;
  const timerLabel = formatCallDuration(elapsedSec);

  const showPriorityResizeGrip =
    Platform.OS !== 'web' || priorityResizeHot || priorityResizing;
  const renderPriorityResizeHandle =
    layout.sideFilm && fullscreen ? (
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Ширина приоритетного окна"
        accessibilityHint="Потяните влево, чтобы уменьшить"
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          beginPriorityResize(event.nativeEvent.pageX);
        }}
        onResponderMove={(event) => {
          if (Platform.OS !== 'web') {
            movePriorityResize(event.nativeEvent.pageX);
          }
        }}
        onResponderRelease={endPriorityResize}
        onResponderTerminate={endPriorityResize}
        // @ts-expect-error RN Web pointer
        onPointerDown={(event: { clientX: number; preventDefault?: () => void }) => {
          event.preventDefault?.();
          beginPriorityResize(event.clientX);
        }}
        style={styles.priorityResizeHandle}
        {...(Platform.OS === 'web'
          ? ({
              onMouseEnter: () => setPriorityResizeHot(true),
              onMouseLeave: () => setPriorityResizeHot(false),
            } as object)
          : null)}>
        {showPriorityResizeGrip ? (
          <View style={styles.priorityResizeGrip}>
            <Ionicons name="caret-back" size={12} color="#DCDDDE" />
            <View style={styles.priorityResizeBar} />
            <Ionicons name="caret-forward" size={12} color="#DCDDDE" />
          </View>
        ) : null}
      </View>
    ) : null;

  const renderFilmTile = (
    tile: OverlayTile,
    opts: {
      width: number;
      height: number;
      videoH: number | null;
      allowPromote?: boolean;
    },
  ) => (
    <ParticipantTile
      key={tile.key}
      tile={tile}
      avatarSize={Math.min(
        layout.filmAvatar,
        Math.round(opts.height * 0.36),
        Math.round(opts.width * 0.36),
      )}
      tileWidth={opts.width}
      videoHeight={opts.videoH}
      tileHeight={opts.height}
      compact
      volumeOpen={volumeOpenId === tile.key}
      onToggleVolume={
        tile.isBard
          ? onSetBardLocalVolume
            ? () =>
                setVolumeOpenId((current) => (current === tile.key ? null : tile.key))
            : undefined
          : onSetParticipantVolume && !tile.isLocal && !tile.waiting
            ? () =>
                setVolumeOpenId((current) => (current === tile.key ? null : tile.key))
            : undefined
      }
      onVolumeChange={
        tile.isBard
          ? onSetBardLocalVolume
          : onSetParticipantVolume && !tile.isLocal && !tile.waiting
            ? (volume) => onSetParticipantVolume(tileIdentity(tile), volume)
            : undefined
      }
      pinned={isTilePinned(tile)}
      onTogglePin={canPinTile(tile) ? () => togglePinTile(tile) : undefined}
      dragEnabled={canReorderPeople}
      isDragging={gridDragKey === tile.key}
      isDropTarget={gridDropKey === tile.key && gridDragKey !== tile.key}
      onGridPointerDown={(x, y) => beginGridPointerDrag(tile.key, x, y)}
      onPress={
        tile.isBard || opts.allowPromote
          ? () => {
              if (gridDragMovedRef.current) {
                return;
              }
              promoteTemporarily(tile);
            }
          : undefined
      }
    />
  );

  const filmCols = Math.max(1, layout.filmCols || 1);
  const filmRailW = layout.filmRailWidth || layout.filmTileWidth;
  const stageGap = layout.frameColGap || 12;
  const discordBodyWidth = Math.min(
    layout.stageWidth,
    layout.discordBodyWidth ||
      (layout.spotlightWidth || 0) +
        (layout.sideFilm && filmstripTiles.length > 0
          ? filmRailW + stageGap
          : 0),
  );

  const renderDiscordRail = (allowPromote: boolean) => {
    if (!filmstripTiles.length) {
      return null;
    }
    const railH = layout.filmRailHeight || layout.spotlightVideoHeight || 200;
    const tileH =
      layout.filmTileHeight || discordRailTileHeight(layout.filmTileWidth);
    const tileW = layout.filmTileWidth;
    const videoH = Math.max(52, tileH - 14);
    const rows = Math.ceil(filmstripTiles.length / filmCols);
    const contentH = tileH * rows + layout.filmGap * Math.max(0, rows - 1);
    const tiles = filmstripTiles.map((tile) =>
      renderFilmTile(tile, {
        width: tileW,
        height: tileH,
        videoH,
        allowPromote,
      }),
    );
    if (layout.sideFilm) {
      return (
        <ScrollView
          showsVerticalScrollIndicator={contentH > railH + 2}
          style={[
            styles.discordRailScroll,
            {
              width: filmRailW,
              height: railH,
              maxHeight: railH,
            },
          ]}
          contentContainerStyle={[
            filmCols > 1 ? styles.discordRailGrid : styles.discordRail,
            {
              gap: layout.filmGap,
              width: filmRailW,
              // Don't stretch content to railH — keeps even tile gaps.
              minHeight: Math.min(contentH, railH),
              justifyContent: 'flex-start',
            },
          ]}>
          {tiles}
        </ScrollView>
      );
    }
    // Mobile stack: adaptive wrap grid — tiles sized to fill the row exactly.
    if (filmCols > 1 && !layout.sideFilm) {
      const stackH = layout.filmRailHeight || contentH;
      const needsScroll = contentH > stackH + 2;
      const rowW =
        tileW * filmCols + layout.filmGap * Math.max(0, filmCols - 1);
      return (
        <ScrollView
          {...(Platform.OS === 'web' && needsScroll
            ? ({ className: 'call-grid-scroll' } as object)
            : null)}
          showsVerticalScrollIndicator={needsScroll}
          persistentScrollbar={needsScroll}
          indicatorStyle="white"
          style={[
            styles.discordRailScroll,
            needsScroll ? styles.gridScrollOverflow : null,
            mobileScrollBarStyle,
            {
              width: '100%',
              height: stackH,
              maxHeight: stackH,
              alignSelf: 'stretch',
            },
          ]}
          contentContainerStyle={[
            styles.discordRailGridStack,
            {
              gap: layout.filmGap,
              width: '100%',
              maxWidth: '100%',
              minHeight: Math.min(contentH, stackH),
              // Pin row to full width so 2/3 tiles don't drift left.
              paddingHorizontal: Math.max(
                0,
                Math.floor((layout.stageWidth - rowW) / 2),
              ),
              paddingBottom: needsScroll ? 8 : 0,
            },
          ]}>
          {tiles}
        </ScrollView>
      );
    }
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.discordRailScroll, { width: '100%' }]}
        contentContainerStyle={[
          styles.discordRailHorizontal,
          { gap: layout.filmGap },
        ]}>
        {tiles}
      </ScrollView>
    );
  };

  const cinemaStripModePreview = cinemaPeopleUseBottomStrip(
    Math.max(320, cinemaStageSize.width || width),
    !isDesktop,
  );
  const cinemaBardStrip =
    cinemaActive && bardTile ? (
      <View
        style={[
          styles.cinemaBardSlot,
          {
            left: Math.max(Spacing.md, insets.left > 0 ? insets.left : 12),
            top:
              Math.max(Spacing.md, insets.top > 0 ? insets.top : 12) +
              48 +
              // Phone: name chip sits under «Свернуть».
              (cinemaStripModePreview && priorityCinema ? 40 : 0),
          },
        ]}
        pointerEvents="box-none">
        <BardNowPlayingStrip
          tile={bardTile}
          volumeOpen={volumeOpenId === bardTile.key}
          onToggleVolume={
            onSetBardLocalVolume
              ? () =>
                  setVolumeOpenId((current) =>
                    current === bardTile.key ? null : bardTile.key,
                  )
              : undefined
          }
          onVolumeChange={onSetBardLocalVolume}
          onOpen={openBardSheet}
        />
      </View>
    ) : null;

  const cinemaStageFrame = {
    width: Math.max(320, cinemaStageSize.width || width),
    height: Math.max(240, cinemaStageSize.height || height),
  };
  const cinemaRailEdgePad = {
    top: Math.max(CINEMA_PIP_PAD, insets.top > 0 ? insets.top : 10),
    right: Math.max(10, insets.right > 0 ? insets.right : 10),
    bottom: Math.max(12, insets.bottom),
  };
  const cinemaRail = cinemaRailMetrics(
    cinemaDockTiles.length,
    cinemaStageFrame.height,
    cinemaStageFrame.width,
    cinemaRailEdgePad,
    !isDesktop,
  );
  const cinemaStripMode = cinemaRail.mode === 'strip';
  const cinemaRailHoverProps =
    Platform.OS === 'web' && !cinemaStripMode
      ? ({
          onMouseEnter: () => setCinemaRailTabHot(true),
          onMouseLeave: () => setCinemaRailTabHot(false),
        } as object)
      : null;

  const renderCinemaRailTile = (tile: OverlayTile) => (
    <CinemaRailPersonTile
      key={tile.key}
      tile={tile}
      profileAvatarUrl={profileAvatarUrl}
      pinned={isTilePinned(tile)}
      canPin={canPinTile(tile)}
      onTogglePin={canPinTile(tile) ? () => togglePinTile(tile) : undefined}
      onPress={
        tileHasPriorityVideo(tile) ? () => promoteTemporarily(tile) : undefined
      }
      width={cinemaRail.tileW}
      height={cinemaRail.tileH}
      isOnStage={Boolean(
        priorityCinema && spotlightTile && spotlightTile.key === tile.key,
      )}
    />
  );

  const cinemaMobileBtnStyle =
    cinemaActive && !isDesktop ? styles.controlBtnCinemaMobile : null;

  const cinemaUrgentCount = cinemaDockTiles.filter((t) => t.urgent).length;
  const cinemaPeopleCollapsedChip = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        cinemaUrgentCount > 0
          ? `Срочная заявка, показать участников, ${cinemaDockTiles.length}`
          : `Показать участников, ${cinemaDockTiles.length}`
      }
      onPress={() => {
        setCinemaRailCollapsed(false);
        setCinemaRailTabHot(false);
      }}
      style={({ pressed }) => [
        styles.cinemaRailReopenChip,
        cinemaUrgentCount > 0 && styles.cinemaRailReopenChipUrgent,
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={cinemaUrgentCount > 0 ? 'flash' : 'people'}
        size={15}
        color="#F2F3F5"
      />
      <Text style={styles.cinemaRailReopenChipText}>
        {cinemaUrgentCount > 0 ? 'срочная' : cinemaDockTiles.length}
      </Text>
      <Ionicons
        name={cinemaStripMode ? 'chevron-up' : 'chevron-back'}
        size={14}
        color="#DCDDDE"
      />
    </Pressable>
  );

  const cinemaPeopleHideChip = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Скрыть участников"
      onPress={() => {
        setCinemaRailCollapsed(true);
        setCinemaRailTabHot(false);
      }}
      hitSlop={8}
      style={({ pressed }) => [
        cinemaStripMode ? styles.cinemaStripHideBtn : styles.cinemaRailHideChip,
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={cinemaStripMode ? 'chevron-down' : 'chevron-forward'}
        size={cinemaStripMode ? 16 : 14}
        color="#DCDDDE"
      />
      {cinemaStripMode ? null : (
        <Text style={styles.cinemaRailHideChipText}>Скрыть</Text>
      )}
    </Pressable>
  );

  const cinemaRailTilesColumn =
    cinemaRail.scroll && !cinemaStripMode ? (
      <ScrollView
        style={{
          width: cinemaRail.railW,
          maxHeight: cinemaRail.availH,
        }}
        contentContainerStyle={{
          gap: CINEMA_PIP_GAP,
          paddingBottom: 4,
        }}
        showsVerticalScrollIndicator
        {...(Platform.OS === 'web'
          ? ({ className: 'call-grid-scroll' } as object)
          : null)}>
        {cinemaDockTiles.map(renderCinemaRailTile)}
      </ScrollView>
    ) : !cinemaStripMode ? (
      <View style={{ width: cinemaRail.railW, gap: CINEMA_PIP_GAP }}>
        {(() => {
          const rows: OverlayTile[][] = [];
          const { cols, rowsPerCol } = cinemaRail;
          for (let r = 0; r < rowsPerCol; r++) {
            const row: OverlayTile[] = [];
            for (let c = 0; c < cols; c++) {
              const tile = cinemaDockTiles[c * rowsPerCol + r];
              if (tile) {
                row.push(tile);
              }
            }
            if (row.length > 0) {
              rows.push(row);
            }
          }
          return rows.map((row, rowIndex) => (
            <View
              key={`cinema-rail-row-${rowIndex}`}
              style={{
                flexDirection: 'row',
                flexWrap: 'nowrap',
                width: cinemaRail.railW,
                height: cinemaRail.tileH,
                gap: CINEMA_PIP_GAP,
              }}>
              {row.map(renderCinemaRailTile)}
            </View>
          ));
        })()}
      </View>
    ) : null;

  const cinemaPeopleDock =
    cinemaActive && cinemaDockTiles.length > 0 ? (
      cinemaRailCollapsed ? (
        <View
          style={[
            styles.cinemaRailCollapsedHit,
            cinemaStripMode
              ? {
                  top: undefined,
                  bottom:
                    Math.max(insets.bottom, 12) +
                    (cinemaControlsRevealed
                      ? cinemaRail.controlsReserve
                      : 16) +
                    8,
                  right: cinemaRail.padRight,
                  left: undefined,
                  height: CINEMA_RAIL_CHIP_H + 8,
                }
              : {
                  top: cinemaRail.padTop,
                  right: cinemaRail.padRight,
                  height: CINEMA_RAIL_CHIP_H + 8,
                },
          ]}
          pointerEvents="auto"
          {...cinemaRailHoverProps}>
          {cinemaPeopleCollapsedChip}
        </View>
      ) : cinemaStripMode ? (
        <View
          style={[
            styles.cinemaPeopleStrip,
            {
              left: Math.max(16, insets.left),
              right: Math.max(16, insets.right),
              bottom:
                Math.max(insets.bottom, 20) +
                (cinemaControlsRevealed ? cinemaRail.controlsReserve : 14),
            },
          ]}
          pointerEvents="box-none">
          <View style={styles.cinemaPeopleStripInner} pointerEvents="auto">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.cinemaPeopleStripScroll}
              contentContainerStyle={styles.cinemaPeopleStripRow}
              {...(Platform.OS === 'web'
                ? ({ className: 'call-grid-scroll' } as object)
                : null)}>
              {cinemaDockTiles.map((tile) => (
                <CinemaRailPersonTile
                  key={tile.key}
                  tile={tile}
                  profileAvatarUrl={profileAvatarUrl}
                  pinned={isTilePinned(tile)}
                  canPin={canPinTile(tile)}
                  onTogglePin={
                    canPinTile(tile) ? () => togglePinTile(tile) : undefined
                  }
                  onPress={
                    tileHasPriorityVideo(tile)
                      ? () => promoteTemporarily(tile)
                      : undefined
                  }
                  width={cinemaRail.tileW}
                  height={cinemaRail.tileH}
                  isOnStage={Boolean(
                    priorityCinema &&
                      spotlightTile &&
                      spotlightTile.key === tile.key,
                  )}
                />
              ))}
            </ScrollView>
            {cinemaPeopleHideChip}
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.cinemaPeopleRail,
            {
              top: 0,
              right: 0,
              bottom: 0,
              width: cinemaRail.railW + cinemaRail.padRight + 8,
              paddingTop: cinemaRail.padTop,
              paddingRight: cinemaRail.padRight,
              paddingBottom: cinemaRail.padBottom,
            },
          ]}
          pointerEvents="box-none"
          {...cinemaRailHoverProps}>
          <View style={styles.cinemaPeopleRailInner} pointerEvents="auto">
            {cinemaPeopleHideChip}
            {cinemaRailTilesColumn}
          </View>
        </View>
      )
    ) : null;

  const diceLayer =
    conversationId?.trim() ? (
      <VoiceCallDiceLayer
        conversationId={conversationId.trim()}
        senderNickname={diceSenderNickname}
        open={diceOpen}
        onOpenChange={setDiceOpen}
        onNeedsSurface={leaveOsFullscreenForOverlay}
      />
    ) : null;

  if (minimized) {
    const pinToTop = !isDesktop;
    const miniAnchor = {
      right: Math.max(insets.right, 16),
      bottom: Math.max(insets.bottom, 16) + 12,
    };
    const miniBar = (
      <View style={pinToTop ? styles.miniPinnedBar : styles.miniBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            pinToTop ? 'Развернуть звонок' : 'Развернуть звонок. Потяните, чтобы перенести'
          }
          onPress={() => {
            if (suppressExpandRef.current) {
              suppressExpandRef.current = false;
              return;
            }
            onExpand?.();
          }}
          // @ts-expect-error RN-web pointer drag
          onPointerDown={(event: { button?: number; clientX: number; clientY: number }) => {
            if (pinToTop) {
              return;
            }
            if (event.button != null && event.button !== 0) {
              return;
            }
            beginMiniDrag(event.clientX, event.clientY);
          }}
          style={({ pressed }) => [
            styles.miniMain,
            Platform.OS === 'web' && !pinToTop
              ? ({ cursor: 'grab', touchAction: 'none' } as const)
              : null,
            pressed && styles.pressed,
          ]}>
          <Animated.View
            style={[
              styles.miniDot,
              { backgroundColor: statusColor, opacity: linking ? connectPulse : 1 },
            ]}
          />
          <View style={styles.miniCopy}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text
              style={[styles.miniMeta, failed && styles.statusError]}
              numberOfLines={1}>
              {miniStatusLine}
            </Text>
          </View>
          {pinToTop ? null : <Ionicons name="expand" size={18} color="#F2F3F5" />}
        </Pressable>
        <View style={styles.miniActions}>
          {canRollDice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Бросить кости"
              onPress={openDice}
              style={({ pressed }) => [
                pinToTop ? styles.miniCtrlCompact : styles.miniCtrl,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="dice-outline" size={pinToTop ? 17 : 18} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              muted ? 'Включить микрофон (Ctrl+Shift+M)' : 'Выключить микрофон (Ctrl+Shift+M)'
            }
            onPressIn={muted ? onMicGesture : undefined}
            onPress={onToggleMute}
            style={({ pressed }) => [
              pinToTop ? styles.miniCtrlCompact : styles.miniCtrl,
              muted && styles.miniCtrlDanger,
              pressed && styles.pressed,
            ]}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={pinToTop ? 17 : 18} color="#FFFFFF" />
          </Pressable>
          {onToggleCamera && !pinToTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                cameraOn ? 'Выключить камеру (Ctrl+Shift+V)' : 'Включить камеру (Ctrl+Shift+V)'
              }
              onPress={onToggleCamera}
              style={({ pressed }) => [
                styles.miniCtrl,
                !cameraOn && styles.miniCtrlOff,
                pressed && styles.pressed,
              ]}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {onSwitchCameraFacing && cameraOn && !pinToTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Переключить камеру"
              onPress={onSwitchCameraFacing}
              style={({ pressed }) => [styles.miniCtrl, pressed && styles.pressed]}>
              <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {onToggleScreenShare && !pinToTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                screenShareOn
                  ? 'Остановить демонстрацию (Ctrl+Shift+S)'
                  : 'Демонстрация экрана (Ctrl+Shift+S)'
              }
              onPress={() => {
                if (screenShareOn) {
                  onToggleScreenShare();
                  return;
                }
                onToggleScreenShare(lastScreenQuality);
              }}
              style={({ pressed }) => [
                styles.miniCtrl,
                !screenShareOn && styles.miniCtrlOff,
                screenShareOn && styles.miniCtrlScreenOn,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={screenShareOn ? 'desktop' : 'desktop-outline'}
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Завершить звонок"
            onPress={onHangup}
            style={({ pressed }) => [
              pinToTop ? styles.miniCtrlCompact : styles.miniCtrl,
              styles.miniCtrlHangup,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name="call"
              size={pinToTop ? 15 : 16}
              color="#FFFFFF"
              style={styles.hangupIcon}
            />
          </Pressable>
        </View>
      </View>
    );

    if (pinToTop) {
      return (
        <>
          <View
            style={[
              styles.miniPinned,
              {
                paddingTop: insets.top,
                backgroundColor: mediaReady ? '#123524' : linking || failed ? '#2B1D1D' : '#1E1F22',
              },
            ]}>
            {miniBar}
          </View>
          {diceLayer}
        </>
      );
    }

    return (
      <>
        <View
          pointerEvents="box-none"
          onLayout={(event) => {
            const { width: barWidth, height: barHeight } = event.nativeEvent.layout;
            if (barWidth > 0 && barHeight > 0) {
              miniSizeRef.current = { width: barWidth, height: barHeight };
            }
          }}
          style={[
            styles.miniRoot,
            {
              bottom: miniAnchor.bottom,
              right: miniAnchor.right,
              transform: [{ translateX: miniOffset.x }, { translateY: miniOffset.y }],
            },
          ]}>
          {miniBar}
        </View>
        {diceLayer}
      </>
    );
  }

  return (
    <>
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View ref={cinemaHostRef} style={styles.modalRoot}>
        <View
          style={[
            styles.root,
            fullscreen && styles.rootFullscreen,
            cinemaActive && styles.rootStreamCinema,
            {
              paddingTop:
                fullscreen || cinemaActive || !isDesktop
                  ? 0
                  : Math.max(insets.top, Spacing.md),
              paddingBottom:
                fullscreen || cinemaActive || !isDesktop
                  ? 0
                  : Math.max(insets.bottom, Spacing.md),
              paddingHorizontal: !isDesktop ? 0 : undefined,
              ...(cinemaActive || !isDesktop
                ? { alignItems: 'stretch' as const, justifyContent: 'flex-start' as const }
                : null),
            },
          ]}>
          {onMinimize && !fullscreen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Свернуть звонок"
              onPress={onMinimize}
              style={styles.backdropHit}
            />
          ) : null}
        <View
          style={[
            styles.shell,
            isDesktop && styles.shellDesktop,
            !isDesktop && styles.shellMobile,
            (fullscreen || cinemaActive || !isDesktop) && styles.shellFullscreen,
            cinemaActive && styles.shellStreamCinema,
          ]}>
          {!cinemaActive ? (
            <View
              style={[
                styles.header,
                fullscreen || !isDesktop
                  ? {
                      paddingHorizontal: Spacing.md,
                      paddingTop: !isDesktop
                        ? Math.max(insets.top, Spacing.sm)
                        : Spacing.sm,
                      paddingBottom: Spacing.xs,
                    }
                  : null,
              ]}>
              <View style={styles.headerCopy}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <View style={styles.statusRow}>
                  <Animated.View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: statusColor,
                        opacity: linking ? connectPulse : 1,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      failed && styles.statusError,
                      mediaReady && !error && styles.statusOk,
                      (linking || Boolean(mediaReady && error)) && styles.statusConnecting,
                    ]}
                    numberOfLines={1}>
                    {statusLine}
                  </Text>
                  {mediaReady ? (
                    <Text style={styles.timerText} accessibilityLabel={`Длительность ${timerLabel}`}>
                      {timerLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
              {watchedScreen ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Развернуть стрим на весь монитор"
                  onPress={enterStreamCinema}
                  style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                  <Ionicons name="scan-outline" size={20} color="#F2F3F5" />
                </Pressable>
              ) : spotlightTile?.cameraOn ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Развернуть приоритет на весь монитор"
                  onPress={enterPriorityCinema}
                  style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                  <Ionicons name="scan-outline" size={20} color="#F2F3F5" />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  fullscreen ? 'Свернуть звонок в окно' : 'Развернуть звонок на окно сайта'
                }
                onPress={toggleFullscreen}
                style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                <Ionicons
                  name={fullscreen ? 'contract' : 'expand'}
                  size={20}
                  color="#F2F3F5"
                />
              </Pressable>
              {onMinimize ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Свернуть звонок"
                  onPress={onMinimize}
                  style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                  <Ionicons name="remove" size={20} color="#F2F3F5" />
                </Pressable>
              ) : null}
              {isGroup ? (
                <View style={styles.headerBadge}>
                  <Ionicons name="people" size={14} color="#B5BAC1" />
                  <Text style={styles.headerBadgeText}>{tiles.length}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {!cinemaActive && showConnectionBanner ? (
            <View
              style={[
                styles.connectionBanner,
                failed
                  ? styles.connectionBannerError
                  : styles.connectionBannerConnecting,
              ]}>
              <Ionicons
                name={
                  failed
                    ? 'cloud-offline-outline'
                    : connection.tone === 'warn'
                      ? 'mic-off-outline'
                      : 'sync-outline'
                }
                size={18}
                color={failed ? '#FFB4B4' : '#FFE6A8'}
              />
              <View style={styles.connectionBannerCopy}>
                <Text
                  style={[
                    styles.connectionBannerTitle,
                    failed && styles.connectionBannerTitleError,
                  ]}
                  numberOfLines={1}>
                  {connection.label}
                </Text>
                {connection.detail ? (
                  <Text style={styles.connectionBannerDetail} numberOfLines={2}>
                    {connection.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {!cinemaActive && bardTile ? (
            <View style={styles.bardNowPlayingSlot}>
              <BardNowPlayingStrip
                tile={bardTile}
                volumeOpen={volumeOpenId === bardTile.key}
                onToggleVolume={
                  onSetBardLocalVolume
                    ? () =>
                        setVolumeOpenId((current) =>
                          current === bardTile.key ? null : bardTile.key,
                        )
                    : undefined
                }
                onVolumeChange={onSetBardLocalVolume}
                onOpen={openBardSheet}
              />
            </View>
          ) : null}

          <View
            style={[
              styles.stage,
              fullscreen || cinemaActive || !isDesktop
                ? { alignItems: 'stretch', justifyContent: 'flex-start' }
                : null,
              // Leave room for the absolute mobile dock.
              !isDesktop && !cinemaActive
                ? {
                    paddingBottom:
                      CONTROL_BTN_SIZE + Math.max(insets.bottom, 12) + 28,
                  }
                : null,
              cinemaActive ? styles.stageCinema : null,
            ]}>
            {streamCinema && streamCinemaTrack ? (
              <View
                style={styles.streamCinemaStage}
                onLayout={onCinemaStageLayout}>
                <CallVideoView
                  track={streamCinemaTrack}
                  mirror={false}
                  objectFit="cover"
                  style={styles.cinemaVideoFill}
                />
                {!isDesktop && !cinemaControlsRevealed ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Показать кнопки звонка"
                    onPress={() => revealCinemaControls()}
                    style={styles.cinemaTapToReveal}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Свернуть стрим"
                  onPress={exitStreamCinema}
                  style={({ pressed }) => [
                    styles.streamCinemaExit,
                    {
                      top: Math.max(Spacing.md, insets.top > 0 ? insets.top : 12),
                      left: Math.max(Spacing.md, insets.left > 0 ? insets.left : 12),
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="contract" size={18} color="#FFFFFF" />
                  <Text style={styles.streamCinemaExitLabel}>Свернуть</Text>
                </Pressable>
                {cinemaBardStrip}
                {cinemaPeopleDock}
              </View>
            ) : priorityCinema && spotlightTile && (priorityCinemaTrack || priorityCinemaMock) ? (
              <View
                style={styles.streamCinemaStage}
                onLayout={onCinemaStageLayout}>
                {priorityCinemaMock ? (
                  <View
                    style={[
                      styles.mockVideoFill,
                      {
                        backgroundColor: `hsl(${spotlightTile.mockHue ?? 210} 42% 28%)`,
                      },
                    ]}>
                    <Ionicons name="videocam" size={48} color="rgba(255,255,255,0.55)" />
                    <Text style={styles.mockVideoLabel}>мок-камера</Text>
                  </View>
                ) : (
                  <CallVideoView
                    track={priorityCinemaTrack!}
                    mirror={spotlightTile.isLocal}
                    objectFit="cover"
                    style={styles.cinemaVideoFill}
                  />
                )}
                {!isDesktop && !cinemaControlsRevealed ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Показать кнопки звонка"
                    onPress={() => revealCinemaControls()}
                    style={styles.cinemaTapToReveal}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Свернуть приоритет"
                  onPress={exitPriorityCinema}
                  style={({ pressed }) => [
                    styles.streamCinemaExit,
                    {
                      top: Math.max(Spacing.md, insets.top > 0 ? insets.top : 12),
                      left: Math.max(Spacing.md, insets.left > 0 ? insets.left : 12),
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="contract" size={18} color="#FFFFFF" />
                  <Text style={styles.streamCinemaExitLabel}>Свернуть</Text>
                </Pressable>
                <View
                  style={[
                    styles.cinemaStageNameChip,
                    cinemaStripMode
                      ? {
                          // Phone: under «Свернуть», don't fight the bottom dock.
                          left: Math.max(
                            Spacing.md,
                            insets.left > 0 ? insets.left : 12,
                          ),
                          top:
                            Math.max(
                              Spacing.md,
                              insets.top > 0 ? insets.top : 12,
                            ) + 48,
                          bottom: undefined,
                          maxWidth: '55%',
                        }
                      : {
                          left: Math.max(
                            Spacing.md,
                            insets.left > 0 ? insets.left : 12,
                          ),
                          bottom: Math.max(
                            Spacing.md + 8,
                            insets.bottom + CINEMA_RAIL_CONTROLS_RESERVE * 0.35,
                          ),
                        },
                  ]}
                  pointerEvents="none">
                  <Ionicons
                    name={spotlightTile.isLocal ? 'person' : 'videocam'}
                    size={12}
                    color="#E8F2FF"
                  />
                  <Text style={styles.cinemaStageNameText} numberOfLines={1}>
                    {spotlightTile.isLocal
                      ? `${spotlightTile.name} (вы)`
                      : spotlightTile.name}
                  </Text>
                </View>
                {cinemaBardStrip}
                {cinemaPeopleDock}
              </View>
            ) : (
            <View
              style={[
                styles.stageInner,
                {
                  width: layout.stageWidth,
                  ...(fullscreen
                    ? {
                        // Inset keeps speaking stroke inside the shell; center the pack.
                        paddingHorizontal: 14,
                        paddingTop: 12,
                        paddingBottom: 10,
                        overflow: 'visible' as const,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    : null),
                },
              ]}>
              {screenStreams.length >= 2 && onSelectScreenShare ? (
                <View style={[styles.screenPicker, { width: layout.stageWidth }]}>
                  <Text style={styles.screenPickerLabel}>
                    {needsScreenPick ? 'Выбери трансляцию' : 'Трансляции'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.screenPickerRow}>
                    {screenStreams.map((stream) => {
                      const active = selectedScreenIdentity === stream.identity;
                      const screenPinned = pinnedScreenIdentity === stream.identity;
                      return (
                        <Pressable
                          key={stream.identity}
                          accessibilityRole="button"
                          accessibilityLabel={
                            active
                              ? `Стоп просмотра: ${stream.name}`
                              : `Смотреть экран: ${stream.name}`
                          }
                          onPress={() => {
                            const next = active ? null : stream.identity;
                            if (pinnedScreenIdentity && pinnedScreenIdentity !== next) {
                              setPinnedScreenIdentity(null);
                            }
                            if (next) {
                              setPinnedSpotlightKey(null);
                            }
                            onSelectScreenShare(next);
                          }}
                          style={({ pressed }) => [
                            styles.screenPickerChip,
                            active && styles.screenPickerChipActive,
                            screenPinned && styles.screenPickerChipPinned,
                            pressed && styles.pressed,
                          ]}>
                          <Ionicons
                            name={screenPinned ? 'pin' : 'desktop-outline'}
                            size={14}
                            color={active || screenPinned ? '#FFFFFF' : '#B5BAC1'}
                          />
                          <Text
                            style={[
                              styles.screenPickerChipText,
                              active && styles.screenPickerChipTextActive,
                            ]}
                            numberOfLines={1}>
                            {stream.isLocal ? 'Мой экран' : stream.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {needsScreenPick ? (
                <View
                  style={[
                    styles.screenPickPrompt,
                    { width: layout.stageWidth, maxHeight: layout.stageBudget },
                  ]}>
                  <Ionicons name="tv-outline" size={36} color="#B5BAC1" />
                  <Text style={styles.screenPickPromptTitle}>Несколько трансляций</Text>
                  <Text style={styles.screenPickPromptDetail}>
                    Выбери, чей экран смотреть — поток пойдёт только после выбора
                  </Text>
                </View>
              ) : watchedScreen ? (
                <View
                  style={[
                    styles.spotlightStage,
                    layout.sideFilm ? styles.discordStage : null,
                    layout.discordFill ? styles.discordStageFill : null,
                    {
                      width: layout.sideFilm ? discordBodyWidth : layout.stageWidth,
                      maxWidth: layout.stageWidth,
                      height: layout.sideFilm
                        ? layout.spotlightVideoHeight ?? undefined
                        : undefined,
                      maxHeight: layout.stageBudget,
                      alignSelf: layout.discordFill
                        ? 'stretch'
                        : layout.discordAlignStart
                          ? 'flex-start'
                          : 'center',
                      gap: layout.sideFilm && fullscreen ? 0 : layout.sideFilm ? stageGap : 12,
                    },
                  ]}>
                  <View
                    style={[
                      styles.spotlightMain,
                      styles.discordMain,
                      layout.discordFill ? styles.discordMainFill : null,
                    ]}>
                    <View
                      style={[
                        styles.streamWatchMain,
                        layout.discordFill ? styles.streamWatchMainFill : null,
                        {
                          width: layout.spotlightWidth,
                          height: layout.spotlightVideoHeight ?? 220,
                        },
                      ]}
                      {...(Platform.OS === 'web'
                        ? ({
                            onMouseEnter: () => setStreamWatchHovered(true),
                            onMouseLeave: () => setStreamWatchHovered(false),
                          } as object)
                        : null)}>
                      <CallVideoView
                        track={watchedScreen.track}
                        mirror={false}
                        objectFit="contain"
                      />
                      <View style={styles.streamWatchChrome} pointerEvents="box-none">
                        <View style={styles.streamWatchLabel} pointerEvents="none">
                          <Ionicons name="desktop-outline" size={12} color="#FFFFFF" />
                          <Text style={styles.streamWatchLabelText} numberOfLines={1}>
                            {watchedScreen.isLocal
                              ? 'Твой экран'
                              : `${watchedScreen.name} · экран`}
                          </Text>
                        </View>
                        {streamWatchHovered || Platform.OS !== 'web' ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              pinnedScreenIdentity === watchedScreen.identity
                                ? 'Снять закрепление экрана'
                                : 'Закрепить экран в приоритете'
                            }
                            hitSlop={8}
                            onPress={() => {
                              const id = watchedScreen.identity;
                              if (pinnedScreenIdentity === id) {
                                setPinnedScreenIdentity(null);
                                return;
                              }
                              setPinnedSpotlightKey(null);
                              setPinnedScreenIdentity(id);
                            }}
                            style={({ pressed }) => [
                              styles.streamWatchPinBtn,
                              pinnedScreenIdentity === watchedScreen.identity &&
                                styles.videoPinBtnActive,
                              pressed && styles.pressed,
                            ]}>
                            <Ionicons
                              name={
                                pinnedScreenIdentity === watchedScreen.identity
                                  ? 'pin'
                                  : 'pin-outline'
                              }
                              size={15}
                              color="#FFFFFF"
                            />
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Развернуть стрим на весь монитор"
                          hitSlop={8}
                          onPress={enterStreamCinema}
                          style={({ pressed }) => [
                            styles.streamWatchExpandBtn,
                            pressed && styles.pressed,
                          ]}>
                          <Ionicons name="expand" size={16} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  {renderPriorityResizeHandle}
                  {renderDiscordRail(true)}
                </View>
              ) : layout.mode === 'spotlight' && spotlightTile ? (
                <View
                  style={[
                    styles.spotlightStage,
                    layout.sideFilm ? styles.discordStage : null,
                    layout.discordFill ? styles.discordStageFill : null,
                    !isDesktop && !layout.sideFilm
                      ? styles.spotlightStageMobile
                      : null,
                    {
                      width: layout.sideFilm ? discordBodyWidth : layout.stageWidth,
                      maxWidth: layout.stageWidth,
                      // Video + name row — otherwise caption is clipped by stage height.
                      height: layout.sideFilm
                        ? (layout.spotlightVideoHeight ?? 0) + PRIORITY_CAPTION_EXTRA
                        : undefined,
                      maxHeight: layout.stageBudget,
                      alignSelf: layout.discordFill
                        ? 'stretch'
                        : layout.discordAlignStart
                          ? 'flex-start'
                          : 'center',
                      gap: layout.sideFilm && fullscreen ? 0 : layout.sideFilm ? stageGap : 10,
                    },
                  ]}>
                  <View
                    style={[
                      styles.spotlightMain,
                      styles.discordMain,
                      layout.discordFill ? styles.discordMainFill : null,
                      // Slight inset on priority only — film grid stays full-bleed.
                      !isDesktop && !layout.sideFilm
                        ? { paddingHorizontal: Spacing.sm }
                        : null,
                    ]}>
                    <ParticipantTile
                      tile={spotlightTile}
                      avatarSize={layout.spotlightAvatar}
                      tileWidth={
                        !isDesktop && !layout.sideFilm
                          ? Math.max(
                              160,
                              layout.spotlightWidth - Spacing.sm * 2,
                            )
                          : layout.spotlightWidth
                      }
                      videoHeight={layout.spotlightVideoHeight}
                      spotlight
                      volumeOpen={volumeOpenId === spotlightTile.key}
                      onToggleVolume={
                        spotlightTile.isBard
                          ? onSetBardLocalVolume
                            ? () =>
                                setVolumeOpenId((current) =>
                                  current === spotlightTile.key
                                    ? null
                                    : spotlightTile.key,
                                )
                            : undefined
                          : onSetParticipantVolume &&
                              !spotlightTile.isLocal &&
                              !spotlightTile.waiting
                            ? () =>
                                setVolumeOpenId((current) =>
                                  current === spotlightTile.key
                                    ? null
                                    : spotlightTile.key,
                                )
                            : undefined
                      }
                      onVolumeChange={
                        spotlightTile.isBard
                          ? onSetBardLocalVolume
                          : onSetParticipantVolume &&
                              !spotlightTile.isLocal &&
                              !spotlightTile.waiting
                            ? (volume) =>
                                onSetParticipantVolume(
                                  tileIdentity(spotlightTile),
                                  volume,
                                )
                            : undefined
                      }
                      pinned={isTilePinned(spotlightTile)}
                      onTogglePin={
                        canPinTile(spotlightTile)
                          ? () => togglePinTile(spotlightTile)
                          : undefined
                      }
                      onExpandPriority={
                        spotlightTile.cameraOn ? enterPriorityCinema : undefined
                      }
                      onPress={
                        spotlightTile.isBard ? openBardSheet : undefined
                      }
                    />
                  </View>
                  {renderPriorityResizeHandle}
                  {renderDiscordRail(true)}
                </View>
              ) : (
                <ScrollView
                  {...(Platform.OS === 'web' && layout.gridNeedsScroll
                    ? ({ className: 'call-grid-scroll' } as object)
                    : null)}
                  style={[
                    styles.gridScroll,
                    layout.gridNeedsScroll ? styles.gridScrollOverflow : null,
                    mobileScrollBarStyle,
                    {
                      width: layout.stageWidth,
                      height:
                        layout.gridScrollHeight ?? layout.stageBudget,
                      maxHeight:
                        layout.gridScrollHeight ?? layout.stageBudget,
                      ...(layout.gridAlignStart
                        ? { alignSelf: 'flex-start' }
                        : {
                            alignSelf: 'center',
                            // Don't stretch the viewport when we intentionally
                            // clip after 2 rows + peek — empty dock gap is fine.
                            minHeight: layout.gridNeedsScroll
                              ? undefined
                              : layout.stageBudget,
                          }),
                    },
                  ]}
                  contentContainerStyle={[
                    styles.gridScrollContent,
                    {
                      width: layout.gridAlignStart
                        ? layout.stageWidth
                        : '100%',
                      maxWidth: layout.stageWidth,
                      minHeight: layout.gridAlignStart
                        ? undefined
                        : layout.gridNeedsScroll
                          ? undefined
                          : layout.stageBudget,
                      justifyContent: layout.gridAlignStart
                        ? 'flex-start'
                        : layout.gridShort
                          ? 'center'
                          : 'flex-start',
                      paddingHorizontal: layout.gridAlignStart
                        ? 0
                        : Math.max(
                            0,
                            Math.floor(
                              (layout.stageWidth -
                                (layout.gridContentWidth ?? layout.stageWidth)) /
                                2,
                            ),
                          ),
                      // Extra bottom pad so the last clipped row still peeks.
                      paddingBottom: layout.gridNeedsScroll ? 12 : 8,
                    },
                  ]}
                  showsVerticalScrollIndicator
                  persistentScrollbar={Boolean(layout.gridNeedsScroll)}
                  indicatorStyle="white"
                  nestedScrollEnabled>
                  <View
                    style={[
                      styles.grid,
                      {
                        gap: layout.gap,
                        width: layout.gridContentWidth ?? layout.stageWidth,
                        alignSelf: 'center',
                      },
                    ]}>
                    {peopleTiles.map((tile) => (
                      <ParticipantTile
                        key={tile.key}
                        tile={tile}
                        avatarSize={layout.avatarSize}
                        tileWidth={layout.tileWidth}
                        videoHeight={layout.videoHeight}
                        tileMinHeight={layout.tileMinHeight}
                        volumeOpen={volumeOpenId === tile.key}
                        onToggleVolume={
                          onSetParticipantVolume &&
                          !tile.isLocal &&
                          !tile.waiting
                            ? () =>
                                setVolumeOpenId((current) =>
                                  current === tile.key ? null : tile.key,
                                )
                            : undefined
                        }
                        onVolumeChange={
                          onSetParticipantVolume &&
                          !tile.isLocal &&
                          !tile.waiting
                            ? (volume) =>
                                onSetParticipantVolume(
                                  tileIdentity(tile),
                                  volume,
                                )
                            : undefined
                        }
                        pinned={isTilePinned(tile)}
                        onTogglePin={
                          canPinTile(tile)
                            ? () => togglePinTile(tile)
                            : undefined
                        }
                        dragEnabled={canReorderPeople}
                        isDragging={gridDragKey === tile.key}
                        isDropTarget={
                          gridDropKey === tile.key && gridDragKey !== tile.key
                        }
                        onGridPointerDown={(x, y) =>
                          beginGridPointerDrag(tile.key, x, y)
                        }
                        onPress={() => {
                          if (gridDragMovedRef.current) {
                            return;
                          }
                          promoteTemporarily(tile);
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
            )}
          </View>

            <Animated.View
              pointerEvents={
                cinemaActive
                  ? cinemaControlsRevealed || controlsOverflowOpen
                    ? 'box-none'
                    : 'none'
                  : 'box-none'
              }
              style={[
                styles.controls,
                !isDesktop && !cinemaActive ? styles.controlsMobile : null,
                // Mobile: pin dock to the bottom of the shell — flex was
                // pushing it below the overflow:hidden clip.
                !isDesktop && !cinemaActive
                  ? {
                      position: 'absolute' as const,
                      // Override styles.controls width:'100%' so side insets work.
                      width: 'auto' as const,
                      left: Math.max(12, insets.left),
                      right: Math.max(12, insets.right),
                      bottom: Math.max(insets.bottom, 12),
                      zIndex: 30,
                      paddingTop: 10,
                      paddingBottom: Math.max(10, Math.min(insets.bottom, 16)),
                      paddingHorizontal: 10,
                      minHeight: CONTROL_BTN_SIZE + 28,
                      borderRadius: 20,
                    }
                  : null,
                fullscreen && !cinemaActive && isDesktop
                  ? {
                      paddingTop: 2,
                      paddingBottom: Spacing.sm,
                    }
                  : null,
                cinemaActive ? styles.controlsCinemaDock : null,
                cinemaActive && isDesktop
                  ? {
                      position: 'absolute' as const,
                      left: 0,
                      right: 0,
                      bottom: Math.max(insets.bottom, 12) + 56,
                      height: 0,
                      overflow: 'visible' as const,
                      paddingBottom: 0,
                      paddingTop: 28,
                      paddingHorizontal: Spacing.md,
                      opacity: cinemaDockAnim,
                      transform: [
                        {
                          translateY: cinemaDockAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [88, 0],
                          }),
                        },
                        {
                          scale: cinemaDockAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.86, 1],
                          }),
                        },
                      ],
                    }
                  : null,
                cinemaActive && !isDesktop
                  ? {
                      position: 'absolute' as const,
                      // Override styles.controls width:'100%' so side insets work.
                      width: 'auto' as const,
                      left: Math.max(16, insets.left),
                      right: Math.max(16, insets.right),
                      bottom: Math.max(insets.bottom, 20),
                      overflow: 'visible' as const,
                      paddingTop: 10,
                      paddingBottom: 10,
                      paddingHorizontal: 12,
                      borderRadius: 28,
                      backgroundColor: 'rgba(15, 16, 18, 0.9)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.14)',
                      opacity: cinemaDockAnim,
                      transform: [
                        {
                          translateY: cinemaDockAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [72, 0],
                          }),
                        },
                        {
                          scale: cinemaDockAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.92, 1],
                          }),
                        },
                      ],
                      ...(Platform.OS === 'web'
                        ? ({
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                          } as object)
                        : null),
                    }
                  : null,
              ]}
              onLayout={(event) => {
                const pad = isDesktop ? Spacing.md * 2 : 20;
                const next = Math.round(event.nativeEvent.layout.width - pad);
                if (next > 0 && next !== controlsSlotWidth) {
                  setControlsSlotWidth(next);
                }
              }}
              {...(cinemaActive && isDesktop && Platform.OS === 'web'
                ? ({
                    onMouseEnter: () => {
                      cinemaControlsHoverRef.current = true;
                      clearCinemaHideTimer();
                      setCinemaControlsRevealed(true);
                    },
                    onMouseLeave: () => {
                      cinemaControlsHoverRef.current = false;
                      if (controlsOverflowOpen) {
                        return;
                      }
                      clearCinemaHideTimer();
                      cinemaHideControlsTimerRef.current = setTimeout(() => {
                        cinemaHideControlsTimerRef.current = null;
                        if (!cinemaControlsHoverRef.current) {
                          setCinemaControlsRevealed(false);
                        }
                      }, 520);
                    },
                  } as object)
                : null)}
              {...(cinemaActive && !isDesktop
                ? ({
                    onTouchStart: () => revealCinemaControls(),
                    ...(Platform.OS === 'web'
                      ? {
                          onPointerDown: () => revealCinemaControls(),
                        }
                      : null),
                  } as object)
                : null)}>
            <View
              style={[
                styles.controlsInner,
                cinemaActive && !isDesktop
                  ? styles.controlsInnerCinemaMobile
                  : null,
              ]}>
            {showRetryControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Повторить"
                onPressIn={onMicGesture}
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  styles.controlBtnSecondary,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                muted ? 'Включить микрофон (Ctrl+Shift+M)' : 'Выключить микрофон (Ctrl+Shift+M)'
              }
              disabled={!mediaReady}
              onPressIn={muted ? onMicGesture : undefined}
              onPress={onToggleMute}
              style={({ pressed }) => [
                styles.controlBtn,
                cinemaMobileBtnStyle,
                muted ? styles.controlBtnMuted : styles.controlBtnSecondary,
                pressed && styles.pressed,
                !mediaReady && styles.controlDisabled,
              ]}>
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={18} color="#FFFFFF" />
            </Pressable>

            {showCameraControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  cameraOn ? 'Выключить камеру (Ctrl+Shift+V)' : 'Включить камеру (Ctrl+Shift+V)'
                }
                disabled={!mediaReady}
                onPress={onToggleCamera}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  cameraOn ? styles.controlBtnSecondary : styles.controlBtnMuted,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {showSwitchCameraControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Переключить камеру"
                disabled={!mediaReady}
                onPress={onSwitchCameraFacing}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  styles.controlBtnSecondary,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {showScreenShareControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  screenShareOn
                    ? 'Остановить демонстрацию (Ctrl+Shift+S)'
                    : 'Демонстрация экрана — выбрать качество'
                }
                accessibilityState={{ selected: screenShareOn, expanded: screenQualityOpen }}
                disabled={!mediaReady}
                onPress={() => {
                  if (screenShareOn) {
                    setScreenQualityOpen(false);
                    onToggleScreenShare?.();
                    return;
                  }
                  setScreenQualityOpen((open) => !open);
                }}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  screenShareOn ? styles.controlBtnScreenOn : styles.controlBtnSecondary,
                  screenQualityOpen && styles.controlBtnScreenOn,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons
                  name={screenShareOn ? 'desktop' : 'desktop-outline'}
                  size={18}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                deafened ? 'Включить звук (Ctrl+Shift+D)' : 'Отключить звук (Ctrl+Shift+D)'
              }
              disabled={!mediaReady}
              onPress={onToggleDeafen}
              style={({ pressed }) => [
                styles.controlBtn,
                  cinemaMobileBtnStyle,
                deafened ? styles.controlBtnMuted : styles.controlBtnSecondary,
                pressed && styles.pressed,
                !mediaReady && styles.controlDisabled,
              ]}>
              <MaterialCommunityIcons
                name={deafened ? 'headphones-off' : 'headphones'}
                size={19}
                color="#FFFFFF"
              />
            </Pressable>

            {!controlsCompact && canRollDice ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Бросить кости"
                onPress={openDice}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  styles.controlBtnSecondary,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="dice-outline" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {!controlsCompact && showBardControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  bardPresent
                    ? 'Треки и библиотека Барда'
                    : 'Призвать Барда'
                }
                accessibilityState={{ selected: bardPresent }}
                onPress={openBardSheet}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  bardPresent ? styles.controlBtnMusicOn : styles.controlBtnSecondary,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="musical-notes" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {!controlsCompact && showUrgentControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={localUrgent ? 'Снять срочную заявку' : 'Срочная заявка'}
                accessibilityState={{ selected: localUrgent }}
                disabled={!mediaReady}
                onPress={onUrgentRequest}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  localUrgent ? styles.controlBtnUrgent : styles.controlBtnSecondary,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons name="flash" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {!controlsCompact && showMockControls ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Добавить мок-участника"
                onPress={addMockPeer}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cinemaMobileBtnStyle,
                  styles.controlBtnMock,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {controlsCompact && secondaryControlsCount > 0 ? (
              <View style={styles.controlsOverflowWrap}>
                {controlsOverflowOpen ? (
                  <View style={styles.controlsOverflowMenu} accessibilityRole="menu">
                    {canRollDice ? (
                      <Pressable
                        accessibilityRole="menuitem"
                        accessibilityLabel="Бросить кости"
                        onPress={() => {
                          setControlsOverflowOpen(false);
                          openDice();
                        }}
                        style={({ pressed }) => [
                          styles.controlsOverflowItem,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="dice-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.controlsOverflowLabel}>Бросить кости</Text>
                      </Pressable>
                    ) : null}
                    {showBardControl ? (
                      <Pressable
                        accessibilityRole="menuitem"
                        accessibilityLabel={
                          bardPresent ? 'Треки и библиотека Барда' : 'Призвать Барда'
                        }
                        accessibilityState={{ selected: bardPresent }}
                        onPress={() => {
                          setControlsOverflowOpen(false);
                          openBardSheet();
                        }}
                        style={({ pressed }) => [
                          styles.controlsOverflowItem,
                          bardPresent && styles.controlsOverflowItemActive,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="musical-notes" size={18} color="#FFFFFF" />
                        <Text style={styles.controlsOverflowLabel}>
                          {bardPresent ? 'Треки Барда' : 'Призвать Барда'}
                        </Text>
                      </Pressable>
                    ) : null}
                    {showUrgentControl ? (
                      <Pressable
                        accessibilityRole="menuitem"
                        accessibilityLabel={
                          localUrgent ? 'Снять срочную заявку' : 'Срочная заявка'
                        }
                        accessibilityState={{ selected: localUrgent }}
                        disabled={!mediaReady}
                        onPress={() => {
                          setControlsOverflowOpen(false);
                          onUrgentRequest?.();
                        }}
                        style={({ pressed }) => [
                          styles.controlsOverflowItem,
                          localUrgent && styles.controlsOverflowItemUrgent,
                          pressed && styles.pressed,
                          !mediaReady && styles.controlDisabled,
                        ]}>
                        <Ionicons name="flash" size={18} color="#FFFFFF" />
                        <Text style={styles.controlsOverflowLabel}>
                          {localUrgent ? 'Снять срочное' : 'Срочная заявка'}
                        </Text>
                      </Pressable>
                    ) : null}
                    {showMockControls ? (
                      <Pressable
                        accessibilityRole="menuitem"
                        accessibilityLabel="Добавить мок-участника"
                        onPress={() => {
                          setControlsOverflowOpen(false);
                          addMockPeer();
                        }}
                        style={({ pressed }) => [
                          styles.controlsOverflowItem,
                          styles.controlsOverflowItemMock,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.controlsOverflowLabel}>Добавить мок</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ещё"
                  accessibilityState={{ expanded: controlsOverflowOpen }}
                  onPress={() => setControlsOverflowOpen((open) => !open)}
                  style={({ pressed }) => [
                    styles.controlBtn,
                  cinemaMobileBtnStyle,
                    controlsOverflowOpen
                      ? styles.controlBtnScreenOn
                      : styles.controlBtnSecondary,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Завершить звонок"
              onPress={onHangup}
              style={({ pressed }) => [
                styles.controlBtn,
                  cinemaMobileBtnStyle,
                styles.controlBtnHangup,
                cinemaMobileBtnStyle && styles.controlBtnHangupCinemaMobile,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="call" size={18} color="#FFFFFF" style={styles.hangupIcon} />
            </Pressable>
            </View>

            {showMockControls && mockPeers.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mockDockScroll}
                contentContainerStyle={styles.mockDock}>
                {mockPeers.map((mock) => (
                  <View key={mock.id} style={styles.mockDockCard}>
                    <Text style={styles.mockDockName} numberOfLines={1}>
                      {mock.name}
                    </Text>
                    <View style={styles.mockDockActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          mock.cameraOn ? 'Выключить мок-камеру' : 'Включить мок-камеру'
                        }
                        onPress={() => toggleMockCamera(mock.id)}
                        style={({ pressed }) => [
                          styles.mockDockBtn,
                          mock.cameraOn && styles.mockDockBtnOn,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons
                          name={mock.cameraOn ? 'videocam' : 'videocam-off'}
                          size={13}
                          color="#FFFFFF"
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Воспроизвести звук мока"
                        onPress={() => pulseMockSpeak(mock.id)}
                        style={({ pressed }) => [
                          styles.mockDockBtn,
                          mock.speaking && styles.mockDockBtnSpeak,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="volume-high" size={13} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Убрать мок-участника"
                        onPress={() => removeMockPeer(mock.id)}
                        style={({ pressed }) => [
                          styles.mockDockBtn,
                          styles.mockDockBtnRemove,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="close" size={16} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Animated.View>

          {controlsOverflowOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть меню"
              onPress={() => setControlsOverflowOpen(false)}
              style={styles.controlsOverflowBackdrop}
            />
          ) : null}
        </View>
      </View>
      </View>
    </Modal>

    <Modal
      visible={Boolean(visible && !minimized && screenQualityOpen && !screenShareOn)}
      transparent
      animationType="fade"
      onRequestClose={() => setScreenQualityOpen(false)}>
      <View style={styles.screenQualityBackdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          style={StyleSheet.absoluteFillObject}
          onPress={() => setScreenQualityOpen(false)}
        />
        <View style={styles.screenQualityCard}>
          <Text style={styles.screenQualityTitle}>Качество трансляции</Text>
          <Text style={styles.screenQualityHint}>
            Выбери качество — дальше выберешь экран или окно. 30 FPS.
          </Text>
          <View style={styles.screenQualityRow}>
            {SCREEN_SHARE_QUALITY_OPTIONS.map((option) => {
              const active = lastScreenQuality === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}, ${option.hint}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setLastScreenQuality(option.id)}
                  style={({ pressed }) => [
                    styles.screenQualityChip,
                    active && styles.screenQualityChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.screenQualityChipLabel,
                      active && styles.screenQualityChipLabelActive,
                    ]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.screenQualityChipHint,
                      active && styles.screenQualityChipHintActive,
                    ]}>
                    {option.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.screenQualityActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Отмена"
              onPress={() => setScreenQualityOpen(false)}
              style={({ pressed }) => [styles.screenQualityCancel, pressed && styles.pressed]}>
              <Text style={styles.screenQualityCancelText}>Отмена</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Выбрать окно для трансляции"
              onPress={() => {
                const quality = lastScreenQuality;
                setScreenQualityOpen(false);
                onToggleScreenShare?.(quality);
              }}
              style={({ pressed }) => [styles.screenQualityContinue, pressed && styles.pressed]}>
              <Text style={styles.screenQualityContinueText}>Выбрать окно</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    {diceLayer}
    <CallBardSheet
      visible={bardSheetOpen && bardPresent}
      canControl={canControlMusic}
      localDisplayName={bardLocalDisplayName}
      trackTitle={bardTrackTitle}
      globalVolume={bardGlobalVolume}
      queue={bardQueue}
      layerLive={bardLayerLive}
      onClose={() => setBardSheetOpen(false)}
      onEnqueueTrack={(trackId, title, durationSec, playUrl) =>
        onEnqueueBardTrack?.(trackId, title, durationSec, playUrl)
      }
      onRemoveQueueEntry={(entryId) => onRemoveBardQueueEntry?.(entryId)}
      onToggleLayerPlay={(entryId) => onToggleBardLayerPlay?.(entryId)}
      onSeekLayer={(entryId, positionSec) => onSeekBardLayer?.(entryId, positionSec)}
      onLayerVolumeChange={(entryId, volume) => onSetBardLayerVolume?.(entryId, volume)}
      onToggleLayerLoop={(entryId) => onToggleBardLayerLoop?.(entryId)}
      onPauseAll={() => onToggleBardPlay?.()}
      anyPlaying={bardPlaying}
      onGlobalVolumeChange={(volume) => onSetBardGlobalVolume?.(volume)}
      onDismissBard={() => onDismissBard?.()}
      onRequestSync={() => onRequestBardSync?.()}
      onAudioGesture={() => onResumeBardAudio?.()}
    />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    // @ts-expect-error RN Web — Modal must own the viewport or cinema letterboxes.
    position: Platform.OS === 'web' ? ('fixed' as const) : 'relative',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    position: 'relative',
  },
  rootFullscreen: {
    paddingHorizontal: 0,
    backgroundColor: '#111214',
  },
  rootStreamCinema: {
    paddingHorizontal: 0,
    backgroundColor: '#000000',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
    minHeight: '100%',
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  miniRoot: {
    position: 'absolute',
    zIndex: 10050,
    maxWidth: 420,
  },
  miniPinned: {
    width: '100%',
    zIndex: 10050,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  miniPinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 6,
  },
  miniBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1E1F22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  miniActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  miniMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flexShrink: 1,
    paddingVertical: 4,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  miniTitle: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
  },
  miniMeta: {
    color: '#B5BAC1',
    fontSize: 11,
    fontWeight: '600',
  },
  miniCtrl: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E5058',
    flexShrink: 0,
  },
  miniCtrlCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E5058',
    flexShrink: 0,
  },
  miniCtrlDanger: {
    backgroundColor: '#ED4245',
  },
  miniCtrlOff: {
    backgroundColor: '#3A3C41',
  },
  miniCtrlScreenOn: {
    backgroundColor: '#5865F2',
  },
  miniCtrlHangup: {
    backgroundColor: '#ED4245',
  },
  shell: {
    flex: 1,
    flexDirection: 'column',
    width: '100%',
    maxWidth: 720,
    maxHeight: '86%',
    borderRadius: 20,
    backgroundColor: '#1E1F22',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
  shellDesktop: {
    maxWidth: 900,
  },
  /** Phone / narrow web: edge-to-edge shell so controls aren't clipped. */
  shellMobile: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  shellFullscreen: {
    flex: 1,
    flexGrow: 1,
    width: '100%',
    maxWidth: '100%',
    minHeight: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  shellStreamCinema: {
    backgroundColor: '#000000',
    position: 'relative',
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    minHeight: '100%',
  },
  streamCinemaStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
    // @ts-expect-error RN Web
    userSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserSelect: 'none',
  },
  streamWatchMain: {
    maxWidth: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#0B0C0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'center',
  },
  streamWatchChrome: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  streamWatchLabel: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '70%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  streamWatchLabelText: {
    color: '#F2F3F5',
    fontSize: 12,
    fontWeight: '700',
  },
  /** Cinema priority: floating name chip over full-bleed video (no bottom chrome bar). */
  cinemaStageNameChip: {
    position: 'absolute',
    zIndex: 6,
    maxWidth: '42%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(21, 122, 254, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(168, 205, 255, 0.45)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      } as object,
      default: {},
    }),
  },
  cinemaStageNameText: {
    flexShrink: 1,
    minWidth: 0,
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  streamWatchExpandBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  streamWatchPinBtn: {
    position: 'absolute',
    left: 10,
    top: 10,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  /** Mobile: full-stage tap target while the dock is hidden. */
  cinemaTapToReveal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  streamCinemaExit: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    zIndex: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  streamCinemaExitLabel: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
  },
  cinemaPeopleRail: {
    position: 'absolute',
    zIndex: 6,
    overflow: 'visible',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  cinemaPeopleRailInner: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'stretch',
    gap: 8,
  },
  /** Phone: landscape thumbs above the control capsule. */
  cinemaPeopleStrip: {
    position: 'absolute',
    zIndex: 8,
    overflow: 'visible',
    alignItems: 'stretch',
  },
  cinemaPeopleStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(12, 13, 15, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      } as object,
      default: {},
    }),
  },
  cinemaPeopleStripScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  cinemaPeopleStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CINEMA_STRIP_TILE_GAP,
    paddingVertical: 1,
    paddingRight: 2,
  },
  cinemaStripHideBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  /** Collapsed reopen chip anchor (top-right or above dock). */
  cinemaRailCollapsedHit: {
    position: 'absolute',
    zIndex: 8,
    alignItems: 'flex-end',
  },
  cinemaRailReopenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: CINEMA_RAIL_CHIP_H,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 16, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
      } as object,
      default: {},
    }),
  },
  cinemaRailReopenChipUrgent: {
    backgroundColor: 'rgba(237, 66, 69, 0.92)',
    borderColor: 'rgba(255, 180, 180, 0.55)',
  },
  cinemaRailReopenChipText: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 12,
    textAlign: 'center',
  },
  cinemaRailHideChip: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 16, 18, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        cursor: 'pointer',
      } as object,
      default: {},
    }),
  },
  cinemaRailHideChipText: {
    color: '#DCDDDE',
    fontSize: 12,
    fontWeight: '600',
  },
  cinemaRailEdgeTab: {
    position: 'absolute',
    zIndex: 8,
    width: CINEMA_RAIL_TAB_W,
    height: CINEMA_RAIL_TAB_H,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.88)',
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.18)',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
      } as object,
      default: {},
    }),
  },
  cinemaRailEdgeTabCollapsed: {
    width: CINEMA_RAIL_TAB_W,
    borderRightWidth: 1,
    borderLeftWidth: 0,
  },
  cinemaBardSlot: {
    position: 'absolute',
    left: Spacing.md,
    // Below «Свернуть» (+ name chip on phone strip mode).
    top: Spacing.md + 48,
    zIndex: 12,
    maxWidth: 300,
    // @ts-expect-error RN Web
    pointerEvents: 'auto',
  },
  /** Hard clip box — fixed pixel size, no absolute escape into the stage. */
  cinemaRailCell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    flexShrink: 0,
    flexGrow: 0,
  },
  cinemaRailTile: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 16, 18, 0.42)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    opacity: 0.92,
    // @ts-expect-error RN Web
    userSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserDrag: 'none',
    // @ts-expect-error RN Web cursor
    cursor: 'pointer',
  },
  cinemaPersonTile: {
    position: 'absolute',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 16, 18, 0.42)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    opacity: 0.88,
    zIndex: 2,
    // @ts-expect-error RN Web
    userSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserDrag: 'none',
    // @ts-expect-error RN Web cursor
    cursor: 'grab',
  },
  cinemaPersonTileHot: {
    opacity: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    zIndex: 4,
  },
  cinemaPersonTileOnStage: {
    opacity: 1,
    borderColor: 'rgba(132, 185, 255, 0.85)',
    backgroundColor: 'rgba(21, 122, 254, 0.18)',
  },
  cinemaPersonTileSpeaking: {
    borderColor: '#23A559',
    opacity: 1,
    backgroundColor: 'rgba(15, 16, 18, 0.55)',
  },
  cinemaPersonTileUrgent: {
    borderColor: '#ED4245',
    opacity: 1,
    borderWidth: 3,
  },
  cinemaPersonUrgentChip: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    zIndex: 5,
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(237, 66, 69, 0.92)',
  },
  cinemaPersonUrgentChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cinemaPersonResizeHandle: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    zIndex: 4,
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    // @ts-expect-error RN Web cursor
    cursor: 'nwse-resize',
  },
  cinemaPersonOnStageBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 122, 254, 0.55)',
  },
  cinemaPersonMock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cinemaPersonAvatar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.55)',
  },
  cinemaPersonChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(8, 9, 10, 0.55)',
  },
  cinemaPersonChromeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 3,
  },
  cinemaPersonName: {
    flex: 1,
    minWidth: 0,
    color: '#F2F3F5',
    fontSize: 11,
    fontWeight: '700',
    // @ts-expect-error RN Web
    userSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserSelect: 'none',
  },
  cinemaPersonNameCompact: {
    fontSize: 10,
    fontWeight: '600',
  },
  cinemaPersonMute: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ED4245',
  },
  cinemaPersonPinBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 0,
  },
  title: {
    color: '#F2F3F5',
    fontSize: 18,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#B5BAC1',
    fontSize: FontSize.caption,
    fontWeight: '600',
    flexShrink: 1,
  },
  timerText: {
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
    marginLeft: 2,
  },
  statusError: {
    color: '#ED4245',
  },
  statusOk: {
    color: '#3BA55D',
  },
  statusConnecting: {
    color: '#F0B232',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
    gap: 10,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectionBannerConnecting: {
    backgroundColor: 'rgba(240, 178, 50, 0.12)',
    borderColor: 'rgba(240, 178, 50, 0.35)',
  },
  connectionBannerError: {
    backgroundColor: 'rgba(237, 66, 69, 0.14)',
    borderColor: 'rgba(237, 66, 69, 0.4)',
  },
  connectionBannerCopy: {
    flex: 1,
    gap: 4,
  },
  connectionBannerTitle: {
    color: '#FFE6A8',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  connectionBannerTitleError: {
    color: '#FFB4B4',
  },
  connectionBannerDetail: {
    color: '#DCDDDE',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },
  headerBadgeText: {
    color: '#B5BAC1',
    fontSize: 12,
    fontWeight: '700',
  },
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageCinema: {
    ...StyleSheet.absoluteFillObject,
    alignSelf: 'stretch',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    backgroundColor: '#000000',
    zIndex: 1,
  },
  cinemaVideoFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  stageInner: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: '100%',
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
    overflow: 'visible',
  },
  screenPicker: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 4,
  },
  screenPickerLabel: {
    color: '#B5BAC1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  screenPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  screenPickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  screenPickerChipActive: {
    backgroundColor: 'rgba(88, 101, 242, 0.45)',
    borderColor: 'rgba(88, 101, 242, 0.8)',
  },
  screenPickerChipPinned: {
    borderColor: 'rgba(88, 101, 242, 0.95)',
  },
  screenPickerChipText: {
    color: '#B5BAC1',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  screenPickerChipTextActive: {
    color: '#FFFFFF',
  },
  screenPickPrompt: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
  },
  screenPickPromptTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.button,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenPickPromptDetail: {
    color: '#B5BAC1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 320,
  },
  spotlightStage: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 4,
    overflow: 'visible',
  },
  /** Mobile stack: priority on top, film under — full width, no side gutters. */
  spotlightStageMobile: {
    flexGrow: 1,
    flexShrink: 1,
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    width: '100%',
    maxWidth: '100%',
  },
  discordStage: {
    // Packed row: stream + resize handle + rail. Centered as one unit.
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexGrow: 0,
  },
  priorityResizeHandle: {
    width: PRIORITY_RESIZE_HANDLE_W,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    ...Platform.select({
      web: { cursor: 'col-resize', userSelect: 'none' } as object,
      default: {},
    }),
  },
  priorityResizeGrip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  priorityResizeBar: {
    width: 2,
    height: 28,
    borderRadius: 1,
    backgroundColor: 'rgba(220,221,222,0.55)',
  },
  discordStageFill: {
    // Fullscreen: hug the left edge, rail on the right, no side gutters.
    justifyContent: 'flex-start',
    width: '100%',
  },
  discordMain: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  discordMainFill: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'stretch',
  },
  streamWatchMainFill: {
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  discordRailScroll: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
  },
  discordRail: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  discordRailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    // Incomplete last row (e.g. 5th tile) sits centered, not left-hanging.
    justifyContent: 'center',
  },
  /** Mobile stacked film: left-to-right fill, no centering drift. */
  discordRailGridStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  discordRailHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  spotlightMain: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  filmstripScroll: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
  },
  filmstrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    width: '100%',
    minWidth: '100%',
    paddingHorizontal: 4,
    paddingBottom: 2,
    overflow: 'visible',
  },
  gridScroll: {
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: 'center',
  },
  /** Overflow cue: always-on thin scrollbar (web) + clip for peek. */
  gridScrollOverflow: {
    overflow: 'scroll',
    ...Platform.select({
      web: {
        // @ts-expect-error RN Web scrollbar
        scrollbarWidth: 'thin',
        // @ts-expect-error RN Web scrollbar
        scrollbarColor: 'rgba(255,255,255,0.55) rgba(255,255,255,0.1)',
      } as object,
      default: {},
    }),
  },
  gridScrollContent: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'flex-start',
    overflow: 'visible',
  },
  tileOuter: {
    alignItems: 'center',
    gap: 6,
  },
  tileOuterNoSelect: {
    // @ts-expect-error RN Web
    userSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserSelect: 'none',
    // @ts-expect-error RN Web
    WebkitUserDrag: 'none',
  },
  tileOuterDragging: {
    opacity: 0.55,
    // @ts-expect-error RN Web cursor
    cursor: 'grabbing',
  },
  tileOuterDropTarget: {
    transform: [{ scale: 1.03 }],
  },
  tileDragHandle: {
    position: 'absolute',
    top: 6,
    left: '50%',
    zIndex: 6,
    width: 28,
    height: 22,
    marginLeft: -14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    opacity: 0.55,
    // @ts-expect-error RN Web
    cursor: 'grab',
    // @ts-expect-error RN Web
    touchAction: 'none',
  },
  tileDragHandleHot: {
    opacity: 1,
    backgroundColor: 'rgba(15, 16, 18, 0.82)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tileDragHandleActive: {
    // @ts-expect-error RN Web
    cursor: 'grabbing',
    backgroundColor: 'rgba(88, 101, 242, 0.85)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bardNowPlayingSlot: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: Spacing.md,
    zIndex: 8,
  },
  bardChipWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  bardChipVolumeDock: {
    position: 'absolute',
    left: 0,
    top: '100%',
    marginTop: 6,
    zIndex: 9,
  },
  bardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: 300,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(21, 122, 254, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.35)',
    opacity: 0.72,
  },
  bardChipLive: {
    borderColor: 'rgba(132, 185, 255, 0.55)',
    backgroundColor: 'rgba(21, 122, 254, 0.22)',
  },
  bardChipHovered: {
    opacity: 1,
    backgroundColor: 'rgba(21, 122, 254, 0.42)',
    borderColor: 'rgba(168, 205, 255, 0.7)',
  },
  bardChipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
    paddingVertical: 3,
    paddingRight: 4,
  },
  bardChipIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.45)',
  },
  bardChipIconLive: {
    backgroundColor: 'rgba(88, 101, 242, 0.7)',
  },
  bardChipCopy: {
    flexShrink: 1,
    minWidth: 0,
    gap: 1,
  },
  bardChipLabel: {
    color: '#9EC5FF',
    fontSize: 10,
    fontWeight: '700',
  },
  bardChipTrack: {
    color: '#F2F3F5',
    fontSize: 12,
    fontWeight: '700',
  },
  bardChipLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#23A559',
  },
  bardChipVolumeIn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bardChipVolumeInMuted: {
    backgroundColor: 'rgba(242, 63, 67, 0.2)',
  },
  bardChipVolumeInOpen: {
    backgroundColor: 'rgba(88, 101, 242, 0.55)',
  },
  tileBadgesAbove: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  tile: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#2B2D31',
    overflow: 'visible',
    position: 'relative',
    // Always 3px so speaking/waiting stroke never shifts layout.
    borderWidth: 3,
    borderColor: 'transparent',
  },
  tileLandscape: {
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    // Keep name/volume inside the card on phone grids.
    overflow: 'hidden',
  },
  tileCompact: {
    gap: 0,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
    overflow: 'visible',
  },
  tileCompactRatio: {
    aspectRatio: 16 / 9,
  },
  tileCompactLocal: {
    backgroundColor: 'rgba(107, 78, 255, 0.16)',
  },
  tileSpotlight: {
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#1E1F22',
  },
  tileVideo: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 4,
    alignItems: 'stretch',
  },
  tileCaption: {
    width: '100%',
    alignItems: 'center',
    gap: 1,
  },
  tileCaptionVideo: {
    minHeight: 22,
    justifyContent: 'center',
  },
  tileCompactCaption: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    zIndex: 3,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
  },
  tileCompactCaptionLocal: {
    backgroundColor: 'rgba(107, 78, 255, 0.88)',
  },
  tileCompactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  tileCompactName: {
    color: '#F2F3F5',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  youBadge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'lowercase',
  },
  tileCompactHint: {
    color: '#B5BAC1',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  videoFrame: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111214',
    borderWidth: 2,
    position: 'relative',
    minHeight: 100,
  },
  videoFrameScreen: {
    backgroundColor: '#0B0C0E',
  },
  videoMuteBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ED4245',
    borderWidth: 2,
    borderColor: '#2B2D31',
  },
  videoScreenBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.95)',
    borderWidth: 2,
    borderColor: '#2B2D31',
  },
  // Corners: pin TL, volume TR (tile), expand BR — never stack two controls in one corner.
  videoExpandBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  videoPinBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  videoPinBtnActive: {
    backgroundColor: 'rgba(88, 101, 242, 0.95)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  videoUrgentChip: {
    position: 'absolute',
    top: 8,
    left: 44,
    maxWidth: '55%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ED4245',
  },
  tileWaiting: {
    backgroundColor: '#25272B',
  },
  tileUrgent: {
    backgroundColor: 'rgba(237, 66, 69, 0.18)',
  },
  tileBard: {
    backgroundColor: 'rgba(21, 122, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.28)',
  },
  tilePressable: {
    alignItems: 'center',
    width: '100%',
  },
  tilePressableCompact: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  tileMediaMenuHost: {
    width: '100%',
    position: 'relative',
  },
  tileMediaMenuHit: {
    alignItems: 'center',
    width: '100%',
  },
  bardRing: {
    borderWidth: 2.5,
    backgroundColor: 'rgba(12, 24, 42, 0.55)',
  },
  bardRingPlaying: {
    borderWidth: 2.5,
    shadowColor: '#157AFE',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bardRingLoading: {
    borderColor: 'rgba(132, 185, 255, 0.55)',
    opacity: 0.92,
  },
  bardLoadingRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(132, 185, 255, 0.45)',
    backgroundColor: 'rgba(8, 16, 28, 0.35)',
    zIndex: 4,
  },
  bardAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 122, 254, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.35)',
  },
  bardAvatarPlaying: {
    backgroundColor: 'rgba(21, 122, 254, 0.42)',
    borderColor: 'rgba(180, 214, 255, 0.65)',
  },
  bardAvatarInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bardPlaque: {
    position: 'absolute',
    bottom: 0,
    left: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 74, 160, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(132, 185, 255, 0.45)',
  },
  bardPlaquePlaying: {
    backgroundColor: 'rgba(21, 122, 254, 0.98)',
    borderColor: 'rgba(205, 226, 255, 0.7)',
    shadowColor: '#157AFE',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  bardPlaqueIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  bardPlaqueIconPlaying: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  bardPlaqueText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  bardPulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(132, 185, 255, 0.7)',
    backgroundColor: 'transparent',
  },
  bardShimmerRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(180, 214, 255, 0.95)',
    backgroundColor: 'transparent',
  },
  bardCoreGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(21, 122, 254, 0.55)',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarVideoSlot: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    // Same as card surface — not the black video hole (that's only for real camera).
    backgroundColor: '#2B2D31',
    borderWidth: 2,
    position: 'relative',
  },
  avatarSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#157AFE',
    backgroundColor: 'rgba(21, 122, 254, 0.12)',
  },
  waitingFrameLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    overflow: 'visible',
  },
  waitingFramePulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(21, 122, 254, 0.85)',
    backgroundColor: 'transparent',
  },
  waitingFramePulseOuter: {
    position: 'absolute',
    // Keep pulse inside the tile — negative inset drew past the screen edge.
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(21, 122, 254, 0.4)',
    backgroundColor: 'transparent',
  },
  urgentPulseRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#ED4245',
    backgroundColor: 'rgba(237, 66, 69, 0.18)',
  },
  urgentBubble: {
    position: 'absolute',
    top: -2,
    right: -6,
    maxWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ED4245',
    borderWidth: 2,
    borderColor: '#1E1F22',
  },
  urgentBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  avatarRing: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  muteBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ED4245',
    borderWidth: 2,
    borderColor: '#2B2D31',
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  tileName: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: 2,
  },
  tileNameUnderVideo: {
    paddingHorizontal: 4,
  },
  tileHint: {
    color: '#B5BAC1',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    height: 14,
    marginTop: 0,
    textAlign: 'center',
  },
  tileHintCompact: {
    fontSize: 10,
    lineHeight: 12,
    height: 12,
  },
  tileHintSpacer: {
    color: 'transparent',
  },
  tileMedia: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  volumeChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      web: { backdropFilter: 'blur(8px)', cursor: 'pointer' } as object,
      default: {},
    }),
  },
  volumeChipMuted: {
    backgroundColor: 'rgba(237, 66, 69, 0.92)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  volumeChipOpen: {
    borderColor: 'rgba(132, 185, 255, 0.65)',
    backgroundColor: 'rgba(21, 122, 254, 0.28)',
  },
  tileVolumeOpen: {
    overflow: 'hidden',
    zIndex: 6,
  },
  volumeDockOverlay: {
    position: 'absolute',
    zIndex: 20,
    minWidth: 0,
    ...Platform.select({
      web: { touchAction: 'none' } as object,
      default: {},
    }),
  },
  /** Wide / compact tiles: bar along the bottom of the media. */
  volumeDockOverlayBar: {
    left: 6,
    right: 6,
    bottom: 6,
  },
  /** Narrow / filmstrip: dimmed panel, horizontal dock centered. */
  volumeDockOverlayPanel: {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(12, 13, 15, 0.78)',
    ...Platform.select({
      web: { backdropFilter: 'blur(10px)' } as object,
      default: {},
    }),
  },
  volumeDockBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
  volumeDockFront: {
    zIndex: 2,
    maxWidth: '100%',
    elevation: 4,
  },
  volumeDockFrontPanel: {
    width: '100%',
    paddingHorizontal: 8,
  },
  volumeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 16, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'visible',
    maxWidth: '100%',
    ...Platform.select({
      web: { backdropFilter: 'blur(12px)' } as object,
      default: {},
    }),
  },
  volumeDockDense: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 44,
  },
  volumeDockWithCaption: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  volumeCaption: {
    color: '#B5BAC1',
    fontSize: 11,
    fontWeight: '600',
  },
  volumeCaptionDense: {
    fontSize: 10,
  },
  volumeDockControls: {
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  volumeDockControlsHorizontal: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
  },
  volumeDockHorizontal: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  volumeMuteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  volumeMuteBtnDense: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  volumeMuteBtnActive: {
    backgroundColor: '#ED4245',
  },
  volumeCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  volumeCloseText: {
    color: '#DCDDDE',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: -1,
  },
  volumeTrackHit: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    justifyContent: 'center',
    position: 'relative',
    minWidth: 48,
    overflow: 'visible',
  },
  volumeTrackHitHorizontal: {
    height: 32,
    minWidth: 56,
    alignItems: 'stretch',
  },
  volumeTrackHitDenseHorizontal: {
    minWidth: 48,
    height: 36,
    flexGrow: 1,
  },
  volumeTrackRail: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  volumeTrackRailHorizontal: {
    alignSelf: 'stretch',
    width: '100%',
    height: 6,
  },
  volumeTrackRailActiveHorizontal: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  volumeFill: {
    borderRadius: 999,
    backgroundColor: '#4B99FF',
  },
  volumeFillMuted: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  volumeThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4B99FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  volumeThumbDense: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  volumeThumbActive: {
    borderColor: '#84B9FF',
    transform: [{ scale: 1.12 }],
  },
  volumePercent: {
    minWidth: 36,
    flexShrink: 0,
    textAlign: 'right',
    color: '#DCDDDE',
    fontSize: 11,
    fontWeight: '700',
  },
  volumePercentDense: {
    minWidth: 32,
    fontSize: 11,
    textAlign: 'center',
  },
  volumePercentMuted: {
    color: '#F23F43',
    textAlign: 'center',
    minWidth: 34,
  },
  controls: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: 4,
    zIndex: 6,
  },
  /** Mobile: solid dock bar pinned over the stage. */
  controlsMobile: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(15, 16, 18, 0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      } as object,
      default: {},
    }),
  },
  /** Cinema: buttons float over video (PC macOS dock / mobile capsule via inline). */
  controlsCinemaDock: {
    position: 'absolute',
    flexShrink: 0,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  controlsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: CONTROL_BTN_GAP,
  },
  controlsInnerCinemaMobile: {
    gap: 6,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  controlBtnCinemaMobile: {
    width: CONTROL_BTN_SIZE_MOBILE,
    height: CONTROL_BTN_SIZE_MOBILE,
    borderRadius: CONTROL_BTN_SIZE_MOBILE / 2,
  },
  controlsOverflowWrap: {
    position: 'relative',
    zIndex: 7,
  },
  controlsOverflowMenu: {
    position: 'absolute',
    bottom: CONTROL_BTN_SIZE + 10,
    left: '50%',
    transform: [{ translateX: -110 }],
    width: 220,
    borderRadius: 14,
    paddingVertical: 6,
    backgroundColor: '#2B2D31',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 2,
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
      },
    }),
  },
  controlsOverflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  controlsOverflowItemActive: {
    backgroundColor: 'rgba(21, 122, 254, 0.28)',
  },
  controlsOverflowItemUrgent: {
    backgroundColor: 'rgba(237, 66, 69, 0.28)',
  },
  controlsOverflowItemMock: {
    backgroundColor: 'rgba(107, 78, 255, 0.28)',
  },
  controlsOverflowLabel: {
    flexShrink: 1,
    color: '#F2F3F5',
    fontSize: 14,
    fontWeight: '600',
  },
  controlsOverflowBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  controlBtn: {
    width: CONTROL_BTN_SIZE,
    height: CONTROL_BTN_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnSecondary: {
    backgroundColor: '#4E5058',
  },
  controlBtnMuted: {
    backgroundColor: '#ED4245',
  },
  controlBtnUrgent: {
    backgroundColor: '#ED4245',
  },
  controlBtnMusicOn: {
    backgroundColor: '#157AFE',
  },
  controlBtnScreenOn: {
    backgroundColor: '#5865F2',
  },
  controlBtnMock: {
    backgroundColor: '#6B4EFF',
  },
  mockDockScroll: {
    maxWidth: '100%',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 2,
    flexGrow: 0,
    opacity: 0.72,
  },
  mockDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    gap: 6,
    paddingHorizontal: 4,
  },
  mockDockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 78, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 255, 0.3)',
    maxWidth: 200,
  },
  mockDockName: {
    color: '#EDE9FE',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 72,
  },
  mockDockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mockDockBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  mockDockBtnOn: {
    backgroundColor: '#23A559',
  },
  mockDockBtnSpeak: {
    backgroundColor: '#157AFE',
  },
  mockDockBtnRemove: {
    backgroundColor: 'rgba(237, 66, 69, 0.85)',
  },
  mockVideoFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mockVideoLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  controlBtnHangup: {
    backgroundColor: '#ED4245',
    width: 68,
  },
  controlBtnHangupCinemaMobile: {
    width: CONTROL_BTN_SIZE_MOBILE + 10,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
  screenQualityBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  screenQualityCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: Spacing.md,
    gap: 10,
    backgroundColor: '#2B2D31',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  screenQualityTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenQualityHint: {
    color: '#B5BAC1',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  screenQualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  screenQualityChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  screenQualityChipActive: {
    backgroundColor: 'rgba(88, 101, 242, 0.35)',
    borderColor: 'rgba(132, 185, 255, 0.65)',
  },
  screenQualityChipLabel: {
    color: '#F2F3F5',
    fontSize: 15,
    fontWeight: '800',
  },
  screenQualityChipLabelActive: {
    color: '#FFFFFF',
  },
  screenQualityChipHint: {
    color: '#949BA4',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  screenQualityChipHintActive: {
    color: '#DCDDDE',
  },
  screenQualityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  screenQualityCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  screenQualityCancelText: {
    color: '#B5BAC1',
    fontSize: 13,
    fontWeight: '600',
  },
  screenQualityContinue: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    backgroundColor: '#157AFE',
  },
  screenQualityContinueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
