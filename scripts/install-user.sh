#!/usr/bin/env bash
set -euo pipefail

APP_NAME="wisty"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_SRC="$SCRIPT_DIR/$APP_NAME"
DESKTOP_SRC="$SCRIPT_DIR/$APP_NAME.desktop"

LOCAL_BIN_DIR="$HOME/.local/bin"
LOCAL_APPS_DIR="$HOME/.local/share/applications"
LOCAL_ICONS_BASE="$HOME/.local/share/icons/hicolor"

append_path_block_if_missing() {
  local file_path="$1"
  local marker_start="# >>> wisty user install >>>"

  mkdir -p "$(dirname "$file_path")"
  touch "$file_path"

  if grep -Fq "$marker_start" "$file_path"; then
    return
  fi

  cat >> "$file_path" <<'EOF'

# >>> wisty user install >>>
if [ -d "$HOME/.local/bin" ] && [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi
# <<< wisty user install <<<
EOF
}

path_contains_local_bin() {
  [[ ":$PATH:" == *":$HOME/.local/bin:"* ]]
}

profile_for_shell() {
  case "${SHELL:-}" in
    */zsh|zsh)
      printf "%s" "$HOME/.zprofile"
      ;;
    *)
      printf "%s" "$HOME/.profile"
      ;;
  esac
}

install_icon_size() {
  local icon_source="$1"
  local icon_size="$2"
  local icon_target_dir="$LOCAL_ICONS_BASE/${icon_size}x${icon_size}/apps"

  if [ ! -f "$icon_source" ]; then
    return
  fi

  mkdir -p "$icon_target_dir"
  install -m 644 "$icon_source" "$icon_target_dir/$APP_NAME.png"
}

if [ ! -f "$BIN_SRC" ]; then
  printf "Error: '%s' is missing.\n" "$BIN_SRC" >&2
  exit 1
fi

if [ ! -f "$DESKTOP_SRC" ]; then
  printf "Error: '%s' is missing.\n" "$DESKTOP_SRC" >&2
  exit 1
fi

if [ ! -d "$LOCAL_BIN_DIR" ]; then
  printf "\n%s\n" "~/.local/bin does not exist."
  printf "%s\n" "wisty will be installed there for this user."
  read -r -p "Create ~/.local/bin now? [y/N] " create_bin_response
  case "$create_bin_response" in
    [yY]|[yY][eE][sS])
      mkdir -p "$LOCAL_BIN_DIR"
      ;;
    *)
      printf "%s\n" "Installation cancelled: ~/.local/bin is required."
      exit 1
      ;;
  esac
fi

mkdir -p "$LOCAL_APPS_DIR"
install -m 755 "$BIN_SRC" "$LOCAL_BIN_DIR/$APP_NAME"
install -m 644 "$DESKTOP_SRC" "$LOCAL_APPS_DIR/$APP_NAME.desktop"

install_icon_size "$SCRIPT_DIR/icons/32x32.png" 32
install_icon_size "$SCRIPT_DIR/icons/64x64.png" 64
install_icon_size "$SCRIPT_DIR/icons/128x128.png" 128
install_icon_size "$SCRIPT_DIR/icons/256x256.png" 256

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$LOCAL_APPS_DIR" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q "$LOCAL_ICONS_BASE" >/dev/null 2>&1 || true
fi

if ! path_contains_local_bin; then
  printf "\n%s\n" "~/.local/bin is not currently on your PATH."
  printf "%s\n" "If it is not on PATH, you will not be able to run 'wisty' from the command line."
  read -r -p "Add ~/.local/bin to your PATH now? [y/N] " response
  case "$response" in
    [yY]|[yY][eE][sS])
      target_profile="$(profile_for_shell)"
      append_path_block_if_missing "$target_profile"
      printf "%s\n" "PATH configuration added. Open a new terminal session to apply it."
      ;;
    *)
      printf "%s\n" "Skipped PATH update."
      ;;
  esac
fi

printf "\n%s\n" "wisty installed for user '$USER'."
printf "%s\n" "Binary: $LOCAL_BIN_DIR/$APP_NAME"
printf "%s\n" "Desktop entry: $LOCAL_APPS_DIR/$APP_NAME.desktop"
