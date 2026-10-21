#!/usr/bin/env bash
# Build a device .ipa for re-signing on iPhone (ESign / Sideloadly / etc.).
# Default: unsigned (no Apple ID / provisioning needed on Mac).
# Optional: SIGN_MODE=xcode — archive + export with your Xcode team.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
BUILD_DIR="$ROOT/build"
DERIVED="$BUILD_DIR/DerivedData"
EXPORT_PATH="$BUILD_DIR/ipa"
ARCHIVE_PATH="$BUILD_DIR/Adventura.xcarchive"
EXPORT_OPTIONS="${EXPORT_OPTIONS_PLIST:-$IOS/ExportOptions.plist}"
SCHEME="${IOS_SCHEME:-adventuraclient}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
TEAM="${DEVELOPMENT_TEAM:-L3GYA8KNK5}"
SIGN_MODE="${SIGN_MODE:-esign}" # esign | xcode
APP_NAME="${IOS_APP_NAME:-adventuraclient}"

cd "$ROOT"

if [[ ! -d "$IOS/$SCHEME.xcworkspace" ]]; then
  echo "Missing $IOS/$SCHEME.xcworkspace — run: cd ios && pod install" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$EXPORT_PATH"

if [[ "${SKIP_POD_INSTALL:-0}" != "1" ]]; then
  echo "==> pod install"
  (
    cd "$IOS"
    export LANG="${LANG:-en_US.UTF-8}"
    export LC_ALL="${LC_ALL:-en_US.UTF-8}"
    pod install
  )
else
  echo "==> skip pod install (SKIP_POD_INSTALL=1)"
fi

pack_ipa_from_app() {
  local app_path="$1"
  local ipa_path="$2"
  local stage
  stage="$(mktemp -d)"
  mkdir -p "$stage/Payload"
  cp -R "$app_path" "$stage/Payload/"
  # Drop leftover signatures so ESign can inject its own cert cleanly.
  rm -rf "$stage/Payload/"*.app/_CodeSignature || true
  rm -f "$stage/Payload/"*.app/embedded.mobileprovision || true
  (
    cd "$stage"
    zip -qr "$ipa_path" Payload
  )
  rm -rf "$stage"
}

if [[ "$SIGN_MODE" == "esign" ]]; then
  echo "==> build unsigned Release for iphoneos (ESign)"
  rm -rf "$DERIVED"
  # SWIFT_STRICT_CONCURRENCY=minimal: Xcode 26 vs ExpoModulesJSI concurrency checks
  set +e
  xcodebuild \
    -workspace "$IOS/$SCHEME.xcworkspace" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -sdk iphoneos \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$DERIVED" \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    SWIFT_STRICT_CONCURRENCY=minimal \
    OTHER_SWIFT_FLAGS='$(inherited) -strict-concurrency=minimal' \
    build
  BUILD_STATUS=$?
  set -e
  if [[ "$BUILD_STATUS" -ne 0 ]]; then
    exit "$BUILD_STATUS"
  fi

  APP_PATH="$(find "$DERIVED/Build/Products/${CONFIGURATION}-iphoneos" -maxdepth 1 -name "*.app" | head -n 1)"
  if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
    echo "Built .app not found under $DERIVED/Build/Products/${CONFIGURATION}-iphoneos" >&2
    exit 1
  fi

  IPA_OUT="$EXPORT_PATH/${APP_NAME}.ipa"
  rm -f "$IPA_OUT"
  echo "==> pack IPA from $(basename "$APP_PATH")"
  pack_ipa_from_app "$APP_PATH" "$IPA_OUT"

  echo "==> done (unsigned — sign in ESign on iPhone)"
  ls -lh "$IPA_OUT"
  echo "$IPA_OUT"
  exit 0
fi

if [[ ! -f "$EXPORT_OPTIONS" ]]; then
  echo "Missing export options: $EXPORT_OPTIONS" >&2
  exit 1
fi

echo "==> archive ($CONFIGURATION, team=$TEAM)"
rm -rf "$ARCHIVE_PATH"
set +e
ARCHIVE_LOG="$(mktemp)"
xcodebuild \
  -workspace "$IOS/$SCHEME.xcworkspace" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  archive 2>&1 | tee "$ARCHIVE_LOG"
ARCHIVE_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$ARCHIVE_STATUS" -ne 0 ]]; then
  if grep -qE 'No Accounts|No profiles for' "$ARCHIVE_LOG"; then
    cat >&2 <<'EOF'

Xcode signing blocked. For ESign use the default instead:

  SKIP_POD_INSTALL=1 SIGN_MODE=esign npm run build:ios-ipa

See docs/ios-ipa-local.md
EOF
  fi
  rm -f "$ARCHIVE_LOG"
  exit "$ARCHIVE_STATUS"
fi
rm -f "$ARCHIVE_LOG"

echo "==> export IPA"
rm -rf "$EXPORT_PATH"
mkdir -p "$EXPORT_PATH"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates

echo "==> done"
ls -lh "$EXPORT_PATH"/*.ipa
