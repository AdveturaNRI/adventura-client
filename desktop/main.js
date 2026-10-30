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
} = require('electron');
const { autoUpdater } = require('electron-updater');
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

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let callPipWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;
let callPipCollapsed = false;
/** @type {string | null} */
let callPresenceScript = null;

/** @type {'idle' | 'checking' | 'available' | 'downloaded' | 'error'} */
let updateStatus = 'idle';
/** @type {string | null} */
let updateVersion = null;

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
  try {
    return fs.existsSync(AUTOSTART_FILE);
  } catch {
    return false;
  }
}

function writeAutostart(enabled) {
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
  if (!mainWindow) {
    createWindow();
    return;
  }
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
  } else if (updateStatus === 'available' && updateVersion) {
    updateItems.push({
      label: `Качаю обновление v${updateVersion}…`,
      enabled: false,
    });
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
  pinCallPipOnTop(callPipWindow);
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

  pinCallPipOnTop(callPipWindow);
  callPipWindow.setMenu(null);
  callPipWindow.on('closed', () => {
    callPipWindow = null;
    callPipCollapsed = false;
  });

  void callPipWindow.loadFile(path.join(__dirname, 'call-pip.html'));
  return callPipWindow;
}

function showCallPipWindow(win) {
  if (!win || win.isDestroyed()) {
    return;
  }
  if (!win.isVisible()) {
    win.show();
  }
  pinCallPipOnTop(win);
}

function pushCallPipState(state) {
  const win = ensureCallPipWindow();
  const send = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('call-pip:state', state);
    }
  };

  if (win.webContents.isLoadingMainFrame?.() || win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      send();
      if (state?.visible) {
        showCallPipWindow(win);
      }
    });
  } else {
    send();
  }

  if (state?.visible) {
    showCallPipWindow(win);
    applyCallPipBounds();
  } else if (win.isVisible()) {
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
    backgroundColor: '#0B111B',
    autoHideMenuBar: true,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
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
  };
  mainWindow.webContents.on('did-finish-load', inject);
  mainWindow.webContents.on('did-navigate-in-page', inject);
  mainWindow.on('focus', () => {
    // Re-assert PiP stacking after focus changes (some WMs reshuffle).
    if (callPipWindow && !callPipWindow.isDestroyed() && callPipWindow.isVisible()) {
      pinCallPipOnTop(callPipWindow);
    }
  });
  mainWindow.on('blur', () => {
    if (callPipWindow && !callPipWindow.isDestroyed() && callPipWindow.isVisible()) {
      pinCallPipOnTop(callPipWindow);
    }
  });

  void mainWindow.loadURL(START_URL);
}

function showOsNotification(payload, onClick) {
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

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // GitHub Releases; override: ADVENTURA_UPDATE_URL=https://adventu.ru/desktop/
  if (process.env.ADVENTURA_UPDATE_URL) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: process.env.ADVENTURA_UPDATE_URL.replace(/\/$/, ''),
    });
  }

  autoUpdater.on('checking-for-update', () => {
    updateStatus = 'checking';
    refreshTrayMenu();
  });

  autoUpdater.on('update-available', (info) => {
    updateStatus = 'available';
    updateVersion = info?.version || null;
    refreshTrayMenu();
    showOsNotification({
      title: 'Обновление Adventura',
      body: `Качаю v${updateVersion || ''}…`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    updateStatus = 'idle';
    updateVersion = null;
    refreshTrayMenu();
  });

  autoUpdater.on('error', (err) => {
    console.warn('[autoUpdater]', err?.message || err);
    updateStatus = 'error';
    refreshTrayMenu();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateStatus = 'downloaded';
    updateVersion = info?.version || updateVersion;
    refreshTrayMenu();
    showOsNotification(
      {
        title: 'Обновление готово',
        body: `v${updateVersion || ''} — нажми, чтобы перезапустить`,
      },
      () => {
        isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      },
    );
  });
}

async function checkForAppUpdates(options = {}) {
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

  try {
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
    if (userInitiated) {
      const isDeb = !process.env.APPIMAGE;
      showOsNotification({
        title: 'Обновления',
        body: isDeb
          ? 'Для .deb поставь AppImage или переустанови свежий .deb'
          : 'Не удалось проверить обновления',
      });
    }
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allow = [
      'media',
      'mediaKeySystem',
      'display-capture',
      'notifications',
      'clipboard-sanitized-write',
    ].includes(permission);
    callback(allow);
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    [
      'media',
      'mediaKeySystem',
      'display-capture',
      'notifications',
      'clipboard-sanitized-write',
    ].includes(permission),
  );

  ipcMain.handle('desktop:notify', (_event, payload) => showOsNotification(payload || {}));
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
    pushCallPipState(state || { visible: false });
    return true;
  });

  ipcMain.handle('call-pip:set-collapsed', (_event, collapsed) => {
    callPipCollapsed = Boolean(collapsed);
    applyCallPipBounds();
    return callPipCollapsed;
  });

  ipcMain.on('call-pip:action', (_event, action) => {
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

  if (!readAutostartEnabled()) {
    writeAutostart(true);
    refreshTrayMenu();
  }

  setTimeout(() => {
    void checkForAppUpdates();
  }, 8_000);
  setInterval(() => {
    void checkForAppUpdates();
  }, UPDATE_CHECK_MS);

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
