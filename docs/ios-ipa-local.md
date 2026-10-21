# Локальный `.ipa` для ESign

Сборка без EAS. Подпись — **на iPhone в ESign** твоим сертификатом.

## Сборка (рекомендуемый путь)

```bash
cd adventura-client

# если cocoapods CDN недоступен:
SKIP_POD_INSTALL=1 npm run build:ios-ipa

# обычный путь:
npm run build:ios-ipa
```

По умолчанию `SIGN_MODE=esign`: Release для `iphoneos` **без** codesign → `build/ipa/adventuraclient.ipa`.

## Установка через ESign

1. Закинь `.ipa` на айфон (AirDrop / Files / ссылка).
2. ESign → импорт IPA → подпиши своим сертификатом → Install.

## Переменные

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `SIGN_MODE` | `esign` | `esign` = unsigned IPA; `xcode` = archive + Apple signing |
| `SKIP_POD_INSTALL` | `0` | `1` = не вызывать `pod install` |
| — | — | `EXPO_USE_PRECOMPILED_MODULES=false` в `ios/Podfile.properties.json`: пребилды Expo под Swift 6.3.1, локальный Xcode 26.3 = Swift 6.2.4 |
| `DEVELOPMENT_TEAM` | `L3GYA8KNK5` | только для `SIGN_MODE=xcode` |
| `EXPORT_OPTIONS_PLIST` | `ios/ExportOptions.plist` | только для `SIGN_MODE=xcode` |

## Опционально: подпись через Xcode

Если нужен development-профиль с Mac:

```bash
SIGN_MODE=xcode SKIP_POD_INSTALL=1 npm run build:ios-ipa
```

Нужен Apple ID в Xcode → Settings → Accounts и Automatic Signing на target.
