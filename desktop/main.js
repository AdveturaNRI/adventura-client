const {
  app,
  BrowserWindow,
  shell,
  session,
  Menu,
  Tray,
  nativeImage,
  Notification,
  ipcMain,
  screen,
  dialog,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const semver = require('semver');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Production web by default; override: ADVENTURA_URL=http://localhost:8082 */
const START_URL = (process.env.ADVENTURA_URL || 'https://adventu.ru').replace(/\/$/, '');
const AUTOSTART_FILE = path.join(os.homedir(), '.config', 'autostart', 'adventura-desktop.desktop');

const CALL_PIP_WIDTH = 280;
const CALL_PIP_HEIGHT = 392;
const CALL_PIP_COLLAPSED_WIDTH = 280;
const CALL_PIP_COLLAPSED_HEIGHT = 118;
const UPDATE_CHECK_MS = 4 * 60 * 60 * 1000;
const UPDATE_URL = (process.env.ADVENTURA_UPDATE_URL || 'https://api.adventu.ru/api/desktop-updates').replace(/\/$/, '');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let callPipWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;
let callPipCollapsed = false;
let lastCallMode = null;
let lastCallVisible = false;
let mainFocusSignaled = false;
let focusMisses = 0;
let focusSyncTimer = null;
const notificationWindows = new Set();
const lastDetailedNotificationAt = { chat: 0, portal: 0 };
let latestCallPipState = { visible: false };
let callPipLoadPending = false;
/** @type {string | null} */
let callPresenceScript = null;

/** @type {'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'} */
let updateStatus = 'idle';
/** @type {string | null} */
let updateVersion = null;
let updatePromptOpen = false;
let requiredUpdate = false;
let initialUpdateCheck = true;
let mandatoryFailureOpen = false;
let expectedUpdateVersion = null;
let updateCheckPromise = null;
const hasSingleInstanceLock = typeof app.requestSingleInstanceLock === 'function'
  ? app.requestSingleInstanceLock()
  : true;
if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', () => showMainWindow());

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(__dirname, 'icon.png'),
  ];
  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

function getLaunchExec() {
  if (process.env.APPIMAGE) {
    return process.env.APPIMAGE;
  }
  return process.execPath;
}

function readAutostartEnabled() {
  if (process.platform === 'win32') return app.getLoginItemSettings().openAtLogin;
  try {
    return fs.existsSync(AUTOSTART_FILE);
  } catch {
    return false;
  }
}

function writeAutostart(enabled) {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return enabled;
  }
  const dir = path.dirname(AUTOSTART_FILE);
  if (!enabled) {
    try {
      fs.unlinkSync(AUTOSTART_FILE);
    } catch {
      // ignore
    }
    return false;
  }
  fs.mkdirSync(dir, { recursive: true });
  const exec = getLaunchExec();
  const desktop = `[Desktop Entry]
Type=Application
Version=1.0
Name=Adventura
Comment=Adventura desktop client
Exec=${JSON.stringify(exec)}
Icon=adventura
Terminal=false
Categories=Network;
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;
  fs.writeFileSync(AUTOSTART_FILE, desktop, 'utf8');
  return true;
}

function showMainWindow() {
  if (requiredUpdate || (app.isPackaged && initialUpdateCheck && !(process.platform === 'linux' && !process.env.APPIMAGE))) return;
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (callPipWindow && !callPipWindow.isDestroyed() && callPipWindow.isVisible()) callPipWindow.hide();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function refreshTrayMenu() {
  tray?.setContextMenu(buildTrayMenu());
}

function buildTrayMenu() {
  const autostartOn = readAutostartEnabled();
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const updateItems = [];

  if (updateStatus === 'downloaded' && updateVersion) {
    updateItems.push({
      label: `Установить v${updateVersion} и перезапустить`,
      click: () => {
        isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      },
    });
  } else if (updateStatus === 'downloading' && updateVersion) {
    updateItems.push({
      label: `Качаю обновление v${updateVersion}…`,
      enabled: false,
    });
  } else if (updateStatus === 'available') {
    updateItems.push({ label: `Доступна v${updateVersion || ''} — проверить обновления`, click: () => void checkForAppUpdates({ userInitiated: true }) });
  } else if (updateStatus === 'checking') {
    updateItems.push({ label: 'Проверка обновлений…', enabled: false });
  } else {
    updateItems.push({
      label: 'Проверить обновления',
      click: () => {
        void checkForAppUpdates({ userInitiated: true });
      },
    });
  }

  return Menu.buildFromTemplate([
    { label: 'Открыть Adventura', click: () => showMainWindow() },
    {
      label: autostartOn ? '✓ Автозапуск' : 'Автозапуск',
      click: () => {
        writeAutostart(!autostartOn);
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Тест уведомления',
      click: () => showOsNotification({ title: 'Adventura', body: 'Уведомления работают' }),
    },
    {
      label: 'Тест PiP (поверх окон)',
      click: () => showTestCallPip(),
    },
    {
      label: 'Скрыть тест PiP',
      click: () => pushCallPipState({ visible: false }),
    },
    { type: 'separator' },
    ...updateItems,
    { type: 'separator' },
    {
      label: 'Выйти',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  const iconPath = resolveIconPath();
  const image = iconPath
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(
    image.isEmpty()
      ? nativeImage.createFromDataURL(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        )
      : image.resize({ width: 32, height: 32 }),
  );
  tray.setToolTip('Adventura');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

function pinCallPipOnTop(win) {
  if (!win || win.isDestroyed()) {
    return;
  }
  // X11: screen-saver level. Exclusive fullscreen games may still cover this.
  // Borderless / windowed fullscreen usually keeps the PiP visible.
  win.setAlwaysOnTop(true, 'screen-saver');
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    // ignore
  }
  try {
    win.moveTop();
  } catch {
    // ignore
  }
}

function getCallPresenceScript() {
  if (callPresenceScript != null) {
    return callPresenceScript;
  }
  try {
    callPresenceScript = fs.readFileSync(
      path.join(__dirname, 'call-presence-inject.js'),
      'utf8',
    );
  } catch (err) {
    console.warn('[call-pip] missing call-presence-inject.js', err?.message || err);
    callPresenceScript = '';
  }
  return callPresenceScript;
}

async function injectCallPresenceWatcher(wc) {
  const script = getCallPresenceScript();
  if (!script || !wc || wc.isDestroyed()) {
    return;
  }
  try {
    await wc.executeJavaScript(script, true);
  } catch (err) {
    console.warn('[call-pip] inject failed', err?.message || err);
  }
}

function applyCallPipBounds() {
  if (!callPipWindow || callPipWindow.isDestroyed()) {
    return;
  }
  const width = callPipCollapsed ? CALL_PIP_COLLAPSED_WIDTH : CALL_PIP_WIDTH;
  const height = callPipCollapsed ? CALL_PIP_COLLAPSED_HEIGHT : CALL_PIP_HEIGHT;
  const [x, y] = callPipWindow.getPosition();
  const display = screen.getDisplayMatching(callPipWindow.getBounds());
  const work = display.workArea;
  const nextX = Math.min(Math.max(work.x, x), work.x + work.width - width);
  const nextY = Math.min(Math.max(work.y, y), work.y + work.height - height);
  callPipWindow.setBounds({ x: nextX, y: nextY, width, height }, false);
  if (callPipWindow.isVisible()) pinCallPipOnTop(callPipWindow);
}

function ensureCallPipWindow() {
  if (callPipWindow && !callPipWindow.isDestroyed()) {
    return callPipWindow;
  }

  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const x = Math.max(work.x + 16, work.x + work.width - CALL_PIP_WIDTH - 24);
  const y = Math.max(work.y + 16, work.y + work.height - CALL_PIP_HEIGHT - 24);

  // Opaque + type=toolbar: transparent frameless windows often never paint on Linux WMs.
  callPipWindow = new BrowserWindow({
    width: CALL_PIP_WIDTH,
    height: CALL_PIP_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    focusable: true,
    backgroundColor: '#111827',
    title: 'Adventura Call',
    ...(process.platform === 'linux' ? { type: 'toolbar' } : null),
    webPreferences: {
      preload: path.join(__dirname, 'call-pip-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  callPipWindow.setMenu(null);
  callPipWindow.on('closed', () => {
    callPipWindow = null;
    callPipCollapsed = false;
    callPipLoadPending = false;
  });

  void callPipWindow.loadFile(path.join(__dirname, 'call-pip.html'));
  return callPipWindow;
}

function showCallPipWindow(win) {
  if (!win || win.isDestroyed()) {
    return;
  }
  if (isMainWindowForeground()) {
    if (win.isVisible()) win.hide();
    return;
  }
  if (!win.isVisible()) {
    win.showInactive();
    pinCallPipOnTop(win);
  }
}

function nativeMainWindowForeground() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized?.()) return false;
  if (mainWindow.isFocused()) return true;
  const focused = BrowserWindow?.getFocusedWindow?.();
  if (!focused || focused.isDestroyed() || focused === callPipWindow || notificationWindows.has(focused)) return false;
  if (focused === mainWindow) return true;
  try { return new URL(focused.webContents.getURL()).origin === new URL(START_URL).origin; }
  catch { return false; }
}

function isMainWindowForeground() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized?.()) return false;
  return mainFocusSignaled || nativeMainWindowForeground();
}

function syncCallPipVisibility() {
  if (!callPipWindow || callPipWindow.isDestroyed()) return;
  if (!latestCallPipState?.visible || requiredUpdate ||
      isMainWindowForeground()) {
    if (callPipWindow.isVisible()) callPipWindow.hide();
    return;
  }
  showCallPipWindow(callPipWindow);
}

function reconcileCallPipFocus() {
  if (!latestCallPipState?.visible || !callPipWindow || callPipWindow.isDestroyed()) return;
  const nativeFocused = nativeMainWindowForeground();
  if (nativeFocused) {
    mainFocusSignaled = true;
    focusMisses = 0;
  } else if (mainFocusSignaled && ++focusMisses >= 3) {
    mainFocusSignaled = false;
    focusMisses = 0;
  }
  syncCallPipVisibility();
}

function handleMainWindowFocus() {
  mainFocusSignaled = true;
  focusMisses = 0;
  if (focusSyncTimer) { clearTimeout(focusSyncTimer); focusSyncTimer = null; }
  syncCallPipVisibility();
  for (const win of [...notificationWindows]) if (!win.isDestroyed()) win.close();
}

function handleMainWindowBlur() {
  mainFocusSignaled = false;
  focusMisses = 0;
  if (focusSyncTimer) clearTimeout(focusSyncTimer);
  focusSyncTimer = setTimeout(() => { focusSyncTimer = null; syncCallPipVisibility(); }, 150);
}

function pushCallPipState(state) {
  const win = ensureCallPipWindow();
  const visibilityChanged = Boolean(state?.visible) !== lastCallVisible || (state?.mode || null) !== lastCallMode;
  latestCallPipState = state;
  if (process.platform === 'win32' && state?.visible && state.mode === 'incoming' &&
      (!lastCallVisible || lastCallMode !== 'incoming')) {
    callPipCollapsed = false;
    const work = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    win.setBounds({ x: Math.round(work.x + (work.width - CALL_PIP_WIDTH) / 2),
      y: Math.round(work.y + (work.height - CALL_PIP_HEIGHT) / 2),
      width: CALL_PIP_WIDTH, height: CALL_PIP_HEIGHT });
  } else if (process.platform === 'win32' && state?.visible && state.mode !== 'incoming' &&
             lastCallVisible && lastCallMode === 'incoming') {
    const work = screen.getDisplayMatching(win.getBounds()).workArea;
    win.setPosition(work.x + work.width - CALL_PIP_WIDTH - 24,
      work.y + work.height - CALL_PIP_HEIGHT - 24);
  }
  lastCallVisible = Boolean(state?.visible);
  lastCallMode = state?.mode || null;
  const send = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('call-pip:state', latestCallPipState);
    }
  };

  if (win.webContents.isLoadingMainFrame?.() || win.webContents.isLoading()) {
    if (!callPipLoadPending) {
      callPipLoadPending = true;
      win.webContents.once('did-finish-load', () => {
        callPipLoadPending = false;
        send();
        syncCallPipVisibility();
      });
    }
  } else {
    send();
  }

  if (state?.visible && visibilityChanged) {
    syncCallPipVisibility();
    applyCallPipBounds();
  } else if (!state?.visible && win.isVisible()) {
    win.hide();
  }
}

async function runCallPipDomAction(action) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  try {
    const ok = await mainWindow.webContents.executeJavaScript(
      `window.__adventuraPipDomAction ? window.__adventuraPipDomAction(${JSON.stringify(
        action,
      )}) : false`,
      true,
    );
    return Boolean(ok);
  } catch {
    return false;
  }
}

function showTestCallPip() {
  pushCallPipState({
    visible: true,
    mode: 'active',
    title: 'Тест PiP',
    subtitle: 'Поверх всех окон',
    peerName: 'Adventura',
    avatarUrl: null,
    frameDataUrl: null,
    hasVideo: false,
    muted: false,
    durationSec: 42,
  });
  showOsNotification({
    title: 'Call PiP',
    body: 'Тестовое окно справа внизу. Скрыть: трей → Скрыть тест PiP',
  });
}

function createWindow() {
  const iconPath = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Adventura',
    show: !app.isPackaged || (process.platform === 'linux' && !process.env.APPIMAGE) || !initialUpdateCheck,
    backgroundColor: '#0B111B',
    autoHideMenuBar: true,
    ...(process.platform === 'win32' ? {
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#111827', symbolColor: '#d6e1f2', height: 40 },
    } : {}),
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      const start = new URL(START_URL);
      if (parsed.origin === start.origin) {
        return { action: 'allow' };
      }
    } catch {
      // fall through
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const start = new URL(START_URL);
      if (parsed.origin !== start.origin && parsed.protocol !== 'mailto:') {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const inject = () => {
    void injectCallPresenceWatcher(mainWindow.webContents);
    if (process.platform === 'win32') {
      const logo = iconPath ? nativeImage.createFromPath(iconPath).resize({ width: 48, height: 48 }).toDataURL() : '';
      const titlebarScript = fs.readFileSync(path.join(__dirname, 'titlebar-inject.js'), 'utf8')
        .replace('"__ADVENTURA_TITLEBAR_LOGO__"', JSON.stringify(logo));
      void mainWindow.webContents.executeJavaScript(titlebarScript).catch((err) => {
        console.warn('[titlebar] inject failed', err?.message || err);
      });
    }
    const script = fs.readFileSync(path.join(__dirname, 'notification-inject.js'), 'utf8');
    void mainWindow.webContents.executeJavaScript(script).catch((err) => {
      console.warn('[notification] inject failed', err?.message || err);
    });
  };
  mainWindow.webContents.on('did-finish-load', inject);
  mainWindow.webContents.on('did-navigate-in-page', inject);
  mainWindow.on('focus', handleMainWindowFocus);
  mainWindow.on('blur', handleMainWindowBlur);
  mainWindow.on('hide', handleMainWindowBlur);
  mainWindow.on('minimize', handleMainWindowBlur);

  void mainWindow.loadURL(START_URL);
}

function arrangeNotificationWindows() {
  const work = screen.getPrimaryDisplay().workArea;
  const width = 340;
  const height = 108;
  const rows = Math.max(1, Math.floor((work.height - 32) / (height + 8)));
  let index = 0;
  for (const win of notificationWindows) {
    if (win.isDestroyed()) continue;
    const column = Math.floor(index / rows);
    const row = index % rows;
    win.setPosition(Math.max(work.x, work.x + work.width - width - 16 - column * (width + 8)),
      work.y + work.height - height - 16 - row * (height + 8));
    index += 1;
  }
}

function showWindowsNotification(payload, onClick) {
  const work = screen.getPrimaryDisplay().workArea;
  const width = 340;
  const height = 108;
  const win = new BrowserWindow({
    width, height, x: work.x + work.width - width - 16,
    y: work.y + work.height - height - 16,
    show: false, frame: false, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, focusable: false, backgroundColor: '#111827',
    webPreferences: { preload: path.join(__dirname, 'notification-preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  notificationWindows.add(win);
  arrangeNotificationWindows();
  win.on('closed', () => {
    notificationWindows.delete(win);
    arrangeNotificationWindows();
  });
  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.webContents.send('notification:content', {
      title: String(payload?.title || 'Adventura').slice(0, 120),
      body: String(payload?.body || '').slice(0, 240),
    });
    win.showInactive();
    pinCallPipOnTop(win);
  });
  win.webContents.on('ipc-message', (_event, channel) => {
    if (channel === 'notification:dismiss') {
      win.close();
      return;
    }
    if (channel !== 'notification:click') return;
    if (typeof onClick === 'function') onClick();
    else {
      showMainWindow();
      if (typeof payload?.url === 'string' && payload.url && mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('desktop:navigate', payload.url);
    }
    if (!win.isDestroyed()) win.close();
  });
  void win.loadFile(path.join(__dirname, 'notification.html'));
  setTimeout(() => { if (!win.isDestroyed()) win.close(); }, 12000);
  return true;
}

function showOsNotification(payload, onClick) {
  if (process.platform === 'win32') {
    return showWindowsNotification(payload, onClick);
  }
  if (!Notification.isSupported()) {
    return false;
  }
  const title = String(payload?.title || 'Adventura').slice(0, 120);
  const body = String(payload?.body || '').slice(0, 240);
  const url = typeof payload?.url === 'string' ? payload.url : '';
  const iconPath = resolveIconPath();

  const notification = new Notification({
    title,
    body,
    icon: iconPath || undefined,
    silent: false,
  });

  notification.on('click', () => {
    if (typeof onClick === 'function') {
      onClick();
      return;
    }
    showMainWindow();
    if (url && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:navigate', url);
    }
  });

  notification.show();
  return true;
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_URL });

  autoUpdater.on('checking-for-update', () => {
    updateStatus = 'checking';
    refreshTrayMenu();
  });

  autoUpdater.on('update-available', async (info) => {
    if (expectedUpdateVersion && info?.version !== expectedUpdateVersion) {
      console.warn('[autoUpdater] manifest does not match the selected release');
      updateStatus = 'error';
      refreshTrayMenu();
      if (requiredUpdate) void showMandatoryUpdateFailure();
      else showOsNotification({ title: 'Обновления', body: 'Версия обновления изменилась. Повторите проверку.' });
      return;
    }
    updateStatus = 'available';
    updateVersion = info?.version || null;
    refreshTrayMenu();
    if (updatePromptOpen) return;
    updatePromptOpen = true;
    try {
      const result = await dialog.showMessageBox({
        type: 'info', title: 'Обновление Adventura',
        message: `Доступна версия ${updateVersion || ''}`,
        detail: requiredUpdate
          ? 'Эта версия больше не поддерживается. Для продолжения необходимо обновить приложение.'
          : 'Скачать и установить обновление? После загрузки приложение перезапустится.',
        buttons: requiredUpdate ? ['Обновить', 'Выйти'] : ['Обновить', 'Позже'], defaultId: 0, cancelId: 1,
      });
      if (result.response === 0) {
        updateStatus = 'downloading';
        refreshTrayMenu();
        await autoUpdater.downloadUpdate();
      } else if (requiredUpdate) {
        app.quit();
      }
    } catch (err) {
      console.warn('[autoUpdater] download failed', err?.message || err);
      if (requiredUpdate) void showMandatoryUpdateFailure();
    } finally {
      updatePromptOpen = false;
    }
  });

  autoUpdater.on('update-not-available', () => {
    updateStatus = 'idle';
    updateVersion = null;
    refreshTrayMenu();
    if (requiredUpdate) void showMandatoryUpdateFailure();
  });

  autoUpdater.on('error', (err) => {
    console.warn('[autoUpdater]', err?.message || err);
    updateStatus = 'error';
    refreshTrayMenu();
    if (requiredUpdate) void showMandatoryUpdateFailure();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateStatus = 'downloaded';
    updateVersion = info?.version || updateVersion;
    refreshTrayMenu();
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
}

async function showMandatoryUpdateFailure() {
  if (mandatoryFailureOpen) return;
  mandatoryFailureOpen = true;
  const result = await dialog.showMessageBox({
    type: 'error', title: 'Требуется обновление',
    message: 'Не удалось установить обязательное обновление.',
    detail: 'Проверьте подключение и повторите попытку.',
    buttons: ['Повторить', 'Выйти'], defaultId: 0, cancelId: 1,
  });
  mandatoryFailureOpen = false;
  if (result.response === 0) void checkForAppUpdates({ userInitiated: true });
  else app.quit();
}

async function getUpdatePolicy() {
  const url = new URL(`${UPDATE_URL}/policy`);
  url.searchParams.set('platform', process.platform);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Policy HTTP ${response.status}`);
  const policy = await response.json();
  if (!policy.configured) return null;
  if (!semver.valid(policy.current) || !semver.valid(policy.minimum) || semver.gt(policy.minimum, policy.current)) {
    throw new Error('Invalid desktop update policy');
  }
  return policy;
}

function applyUpdatePolicy(policy) {
  requiredUpdate = Boolean(policy && semver.lt(app.getVersion(), policy.minimum));
  expectedUpdateVersion = policy?.current || null;
  autoUpdater.allowDowngrade = Boolean(policy && semver.gt(app.getVersion(), policy.current));
  if (requiredUpdate) {
    mainWindow?.hide();
    if (callPipWindow && !callPipWindow.isDestroyed()) pushCallPipState({ visible: false });
  }
}

function readCachedUpdatePolicy() {
  try {
    const policy = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'desktop-update-policy.json'), 'utf8'));
    if (semver.valid(policy.current) && semver.valid(policy.minimum) && semver.lte(policy.minimum, policy.current)) return policy;
  } catch { /* no previously verified policy */ }
  return null;
}

function checkForAppUpdates(options = {}) {
  if (updateCheckPromise) return updateCheckPromise;
  if (updatePromptOpen || updateStatus === 'downloading') return Promise.resolve();
  updateCheckPromise = performUpdateCheck(options).finally(() => { updateCheckPromise = null; });
  return updateCheckPromise;
}

async function performUpdateCheck(options = {}) {
  const { userInitiated = false } = options;
  if (!app.isPackaged) {
    if (userInitiated) {
      showOsNotification({
        title: 'Обновления',
        body: 'В dev-режиме автообновление отключено',
      });
    }
    return;
  }
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    if (userInitiated) showOsNotification({ title: 'Обновления', body: 'Автообновление доступно для версии AppImage.' });
    return;
  }

  try {
    try {
      const policy = await getUpdatePolicy();
      applyUpdatePolicy(policy);
      try {
        const file = path.join(app.getPath('userData'), 'desktop-update-policy.json');
        if (policy) fs.writeFileSync(file, JSON.stringify(policy));
        else if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (err) { console.warn('[autoUpdater] policy cache failed', err?.message || err); }
    } catch (err) {
      console.warn('[autoUpdater] policy unavailable', err?.message || err);
      const cached = readCachedUpdatePolicy();
      if (cached) applyUpdatePolicy(cached);
    }
    if (initialUpdateCheck) {
      initialUpdateCheck = false;
      if (!requiredUpdate) showMainWindow();
    }
    updateStatus = 'checking';
    refreshTrayMenu();
    const result = await autoUpdater.checkForUpdates();
    if (userInitiated && result?.updateInfo?.version === app.getVersion()) {
      showOsNotification({
        title: 'Обновления',
        body: `Уже последняя версия (v${app.getVersion()})`,
      });
    }
  } catch (err) {
    console.warn('[autoUpdater] check failed', err?.message || err);
    updateStatus = 'error';
    refreshTrayMenu();
    if (requiredUpdate) {
      void showMandatoryUpdateFailure();
      return;
    }
    if (userInitiated) {
      const isDeb = process.platform === 'linux' && !process.env.APPIMAGE;
      showOsNotification({
        title: 'Обновления',
        body: isDeb
          ? 'Для .deb поставь AppImage или переустанови свежий .deb'
          : 'Не удалось проверить обновления',
      });
    }
  }
}

function isTrustedLocationRequest(contents, requestingUrl, details) {
  if (!mainWindow || mainWindow.isDestroyed() || contents !== mainWindow.webContents || details?.isMainFrame !== true) return false;
  try {
    const start = new URL(START_URL);
    const current = new URL(contents.getURL());
    // Electron can omit requestingOrigin on main-frame permission checks.
    const requested = new URL(requestingUrl || details.requestingUrl || contents.getURL());
    const secure = start.protocol === 'https:' ||
      (start.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(start.hostname));
    return secure && current.origin === start.origin && requested.origin === start.origin;
  } catch {
    return false;
  }
}

if (hasSingleInstanceLock) app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('ru.adventu.desktop');
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (permission === 'geolocation') {
      callback(isTrustedLocationRequest(wc, details?.requestingUrl, details));
      return;
    }
    const allow = [
      'media',
      'mediaKeySystem',
      'display-capture',
      'notifications',
      'clipboard-sanitized-write',
    ].includes(permission);
    callback(allow);
  });

  session.defaultSession.setPermissionCheckHandler((wc, permission, origin, details) => {
    if (permission === 'geolocation') return isTrustedLocationRequest(wc, origin, details);
    return [
      'media',
      'mediaKeySystem',
      'display-capture',
      'notifications',
      'clipboard-sanitized-write',
    ].includes(permission);
  });

  ipcMain.handle('desktop:notify', (_event, payload) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused()) return false;
    const category = payload?.titleFallback
      ? (payload.title === 'Новое сообщение' ? 'chat' : 'portal')
      : typeof payload?.url === 'string' && payload.url.startsWith('/chats') ? 'chat'
        : payload?.url === '/notifications' ? 'portal' : null;
    if (payload?.titleFallback && category && Date.now() - lastDetailedNotificationAt[category] < 1500) return false;
    if (!payload?.titleFallback && category) lastDetailedNotificationAt[category] = Date.now();
    return showOsNotification(payload || {});
  });
  ipcMain.handle('desktop:show-window', () => {
    showMainWindow();
    return true;
  });
  ipcMain.handle('desktop:get-autostart', () => readAutostartEnabled());
  ipcMain.handle('desktop:set-autostart', (_event, enabled) => {
    const next = writeAutostart(Boolean(enabled));
    refreshTrayMenu();
    return next;
  });
  ipcMain.handle('desktop:check-updates', () => {
    void checkForAppUpdates({ userInitiated: true });
    return true;
  });

  ipcMain.handle('desktop:call-pip-update', (_event, state) => {
    if (requiredUpdate) return false;
    pushCallPipState(state || { visible: false });
    return true;
  });

  ipcMain.handle('call-pip:set-collapsed', (_event, collapsed) => {
    callPipCollapsed = Boolean(collapsed);
    applyCallPipBounds();
    return callPipCollapsed;
  });

  ipcMain.on('call-pip:action', (_event, action) => {
    if (requiredUpdate) return;
    const name = String(action || '');
    if (name === 'expand' || name === 'accept') {
      showMainWindow();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:call-pip-action', name);
      // Production web without React PiP bridge — click in-page controls.
      void runCallPipDomAction(name);
    }
  });

  setupAutoUpdater();
  createTray();
  createWindow();
  ensureCallPipWindow();

  if ((process.platform !== 'win32' || app.isPackaged) && !readAutostartEnabled()) {
    writeAutostart(true);
    refreshTrayMenu();
  }

  void checkForAppUpdates();
  setInterval(() => {
    void checkForAppUpdates();
  }, UPDATE_CHECK_MS);
  setInterval(reconcileCallPipFocus, 400);

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (callPipWindow && !callPipWindow.isDestroyed()) {
    callPipWindow.destroy();
    callPipWindow = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    // macOS activate
  }
});
