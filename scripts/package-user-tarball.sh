#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="wisty"
RELEASE_BIN="$ROOT_DIR/src-tauri/target/release/$APP_NAME"
INSTALL_SCRIPT="$ROOT_DIR/scripts/install-user.sh"
UNINSTALL_SCRIPT="$ROOT_DIR/scripts/uninstall-user.sh"
DESKTOP_TEMPLATE="$ROOT_DIR/src-tauri/wisty.desktop.hbs"
TAURI_CONFIG="$ROOT_DIR/src-tauri/tauri.conf.json"
ICONS_DIR="$ROOT_DIR/src-tauri/icons"
OUT_DIR="$ROOT_DIR/dist-user"

VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
ARCH_RAW="$(uname -m)"
ARCH="$ARCH_RAW"

case "$ARCH_RAW" in
  x86_64) ARCH="x86_64" ;;
  aarch64) ARCH="aarch64" ;;
esac

ARCHIVE_BASE="$APP_NAME-user-install-$VERSION-linux-$ARCH"
STAGE_DIR="$OUT_DIR/$ARCHIVE_BASE"
ARCHIVE_PATH="$OUT_DIR/$ARCHIVE_BASE.tar.gz"

if [ ! -f "$RELEASE_BIN" ]; then
  printf "Error: release binary not found at '%s'.\n" "$RELEASE_BIN" >&2
  printf "%s\n" "Build it first, for example: npm run tauri -- build --no-bundle" >&2
  exit 1
fi

if [ ! -f "$INSTALL_SCRIPT" ]; then
  printf "Error: install script missing at '%s'.\n" "$INSTALL_SCRIPT" >&2
  exit 1
fi

if [ ! -f "$UNINSTALL_SCRIPT" ]; then
  printf "Error: uninstall script missing at '%s'.\n" "$UNINSTALL_SCRIPT" >&2
  exit 1
fi

if [ ! -f "$DESKTOP_TEMPLATE" ]; then
  printf "Error: desktop template missing at '%s'.\n" "$DESKTOP_TEMPLATE" >&2
  exit 1
fi

if [ ! -f "$TAURI_CONFIG" ]; then
  printf "Error: Tauri config missing at '%s'.\n" "$TAURI_CONFIG" >&2
  exit 1
fi

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/icons" "$OUT_DIR"

install -m 755 "$RELEASE_BIN" "$STAGE_DIR/$APP_NAME"
install -m 755 "$INSTALL_SCRIPT" "$STAGE_DIR/install.sh"
install -m 755 "$UNINSTALL_SCRIPT" "$STAGE_DIR/uninstall.sh"

node -e '
const fs = require("fs");

const templatePath = process.argv[1];
const configPath = process.argv[2];
const appName = process.argv[3];
const outputPath = process.argv[4];

const template = fs.readFileSync(templatePath, "utf8");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const name = config.productName || appName;
const comment = (config.bundle && config.bundle.shortDescription) || "";
const exec = appName;
const icon = appName;

const rendered = template
  .replaceAll("{{name}}", name)
  .replaceAll("{{comment}}", comment)
  .replaceAll("{{exec}}", exec)
  .replaceAll("{{icon}}", icon);

fs.writeFileSync(outputPath, rendered);
' "$DESKTOP_TEMPLATE" "$TAURI_CONFIG" "$APP_NAME" "$STAGE_DIR/$APP_NAME.desktop"

chmod 644 "$STAGE_DIR/$APP_NAME.desktop"

copy_icon_if_exists() {
  local src="$1"
  local dst="$2"
  if [ -f "$src" ]; then
    install -m 644 "$src" "$dst"
  fi
}

copy_icon_if_exists "$ICONS_DIR/32x32.png" "$STAGE_DIR/icons/32x32.png"
copy_icon_if_exists "$ICONS_DIR/64x64.png" "$STAGE_DIR/icons/64x64.png"
copy_icon_if_exists "$ICONS_DIR/128x128.png" "$STAGE_DIR/icons/128x128.png"
copy_icon_if_exists "$ICONS_DIR/128x128@2x.png" "$STAGE_DIR/icons/256x256.png"

tar -czf "$ARCHIVE_PATH" -C "$OUT_DIR" "$ARCHIVE_BASE"

printf "%s\n" "Created user-install archive:"
printf "%s\n" "  $ARCHIVE_PATH"
printf "\n%s\n" "Contents include:"
printf "%s\n" "  - $APP_NAME (release executable)"
printf "%s\n" "  - install.sh"
printf "%s\n" "  - uninstall.sh"
printf "%s\n" "  - $APP_NAME.desktop"
printf "%s\n" "  - icons/ (available png sizes)"
