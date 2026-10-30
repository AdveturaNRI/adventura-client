#!/usr/bin/env bash
# Установка Adventura Desktop (.deb) с GitHub Releases — одной командой.
# curl -fsSL https://raw.githubusercontent.com/AdveturaNRI/adventura-client/main/desktop/install-linux.sh | bash
set -euo pipefail

REPO="${ADVENTURA_DESKTOP_REPO:-AdveturaNRI/adventura-client}"
API="https://api.github.com/repos/${REPO}/releases/latest"

if ! command -v curl >/dev/null 2>&1; then
  echo "Нужен curl" >&2
  exit 1
fi
if ! command -v dpkg >/dev/null 2>&1; then
  echo "Нужен dpkg (Debian/Ubuntu/Mint и т.п.). Для других дистрибутивов скачай AppImage с релизов." >&2
  exit 1
fi

echo "→ Ищу последний релиз ${REPO}…"
JSON="$(curl -fsSL "$API")"
DEB_URL="$(printf '%s' "$JSON" | sed -n 's/.*"browser_download_url": *"\([^"]*Adventura-[^"]*\.deb\)".*/\1/p' | head -n1)"
VERSION="$(printf '%s' "$JSON" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)"

if [[ -z "$DEB_URL" ]]; then
  echo "В latest-релизе нет .deb (Adventura-*.deb). Сначала опубликуй: cd desktop && npm run dist:publish" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
DEB_FILE="${TMP}/adventura.deb"

echo "→ Качаю ${VERSION}: $DEB_URL"
curl -fL --progress-bar -o "$DEB_FILE" "$DEB_URL"

echo "→ Устанавливаю (нужен sudo)…"
sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y

echo "✓ Готово. Запуск: adventura   (или из меню приложений → Adventura)"
echo "  Автообновление удобнее у AppImage; .deb обновляй этим же скриптом или скачай новый .deb."
