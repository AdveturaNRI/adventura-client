# Adventura Desktop (Electron)

Оболочка вокруг `https://adventu.ru`: tray, FreeDesktop-уведомления, call PiP, автообновление.

## Установка

```bash
sudo dpkg -i /home/moskowpsix/project_vs/adventura-client/desktop/release/Adventura-0.5.0.deb
```

Или:

```bash
curl -fsSL https://raw.githubusercontent.com/AdveturaNRI/adventura-client/main/desktop/install-linux.sh | bash
```

После установки: меню → **Adventura**, бинарь `adventura`.

## Call PiP (поверх окон)

С **0.5.0** shell сам детектит звонок на `adventu.ru` (DOM: «Завершить звонок» / «Принять») и поднимает always-on-top окно — **деплой веба не обязателен**.

- Перетаскивание за шапку / медиа
- `–` свернуть в компактную полоску, `+` развернуть
- Мик / Открыть / Сброс

**Fullscreen игры:** exclusive fullscreen (Vulkan/OpenGL) часто перекрывает любое always-on-top. Windowed / borderless fullscreen — обычно PiP остаётся. Это ограничение Linux/X11/Wayland, не бага приложения.

## Автообновление

| Пакет | Как |
| --- | --- |
| **AppImage** | `electron-updater` с GitHub Releases |
| **.deb** | новый `.deb` / `install-linux.sh` |

```bash
cd desktop
GH_TOKEN=… npm run dist:publish
```

## Локальный web

```bash
ADVENTURA_URL=http://localhost:8082 adventura
```
