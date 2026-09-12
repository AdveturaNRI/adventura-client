export const SCREEN_TRANSITION_MS = 380;

/** Мягкий fade-in при первом открытии экрана. */
export const SCREEN_TRANSITION_INITIAL_OPACITY = 0.94;

/** Ещё мягче для переключения вкладок — без «мигания». */
export const TAB_TRANSITION_MS = 420;
export const TAB_TRANSITION_INITIAL_OPACITY = 0.97;
export const TAB_TRANSITION_INITIAL_TRANSLATE_Y = 4;

export const SCREEN_TRANSITION_INITIAL_TRANSLATE_Y = 6;

/** Stack без своей анимации — переходы через ScreenTransition. */
export const stackScreenOptions = {
  animation: 'none' as const,
};
