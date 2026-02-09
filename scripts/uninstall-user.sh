#!/usr/bin/env bash
set -euo pipefail

APP_NAME="wisty"
LOCAL_BIN_DIR="$HOME/.local/bin"
LOCAL_APPS_DIR="$HOME/.local/share/applications"
LOCAL_ICONS_BASE="$HOME/.local/share/icons/hicolor"

PATH_MARKER_START="# >>> wisty user install >>>"
PATH_MARKER_END="# <<< wisty user install <<<"

remove_file_if_exists() {
  local file_path="$1"
  if [ -f "$file_path" ]; then
    rm -f "$file_path"
  fi
}

remove_path_block_if_present() {
  local file_path="$1"
  if [ ! -f "$file_path" ]; then
    return 1
  fi
  if ! grep -Fq "$PATH_MARKER_START" "$file_path"; then
    return 1
  fi

  local temp_file
  temp_file="$(mktemp)"
  awk -v start="$PATH_MARKER_START" -v end="$PATH_MARKER_END" '
    $0 == start { inblock = 1; next }
    $0 == end { inblock = 0; next }
    !inblock { print }
  ' "$file_path" > "$temp_file"
  mv "$temp_file" "$file_path"
  return 0
}

remove_file_if_exists "$LOCAL_BIN_DIR/$APP_NAME"
remove_file_if_exists "$LOCAL_APPS_DIR/$APP_NAME.desktop"

remove_file_if_exists "$LOCAL_ICONS_BASE/32x32/apps/$APP_NAME.png"
remove_file_if_exists "$LOCAL_ICONS_BASE/64x64/apps/$APP_NAME.png"
remove_file_if_exists "$LOCAL_ICONS_BASE/128x128/apps/$APP_NAME.png"
remove_file_if_exists "$LOCAL_ICONS_BASE/256x256/apps/$APP_NAME.png"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$LOCAL_APPS_DIR" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q "$LOCAL_ICONS_BASE" >/dev/null 2>&1 || true
fi

profile_has_block=false
zprofile_has_block=false
if [ -f "$HOME/.profile" ] && grep -Fq "$PATH_MARKER_START" "$HOME/.profile"; then
  profile_has_block=true
fi
if [ -f "$HOME/.zprofile" ] && grep -Fq "$PATH_MARKER_START" "$HOME/.zprofile"; then
  zprofile_has_block=true
fi

if [ "$profile_has_block" = true ] || [ "$zprofile_has_block" = true ]; then
  printf "\n%s\n" "A wisty PATH block was found in shell profile files."
  read -r -p "Remove that PATH block now? [y/N] " response
  case "$response" in
    [yY]|[yY][eE][sS])
      removed_any=false
      if remove_path_block_if_present "$HOME/.profile"; then
        removed_any=true
      fi
      if remove_path_block_if_present "$HOME/.zprofile"; then
        removed_any=true
      fi
      if [ "$removed_any" = true ]; then
        printf "%s\n" "Removed wisty PATH block from profile files."
      fi
      ;;
    *)
      printf "%s\n" "Skipped PATH block removal."
      ;;
  esac
fi

printf "\n%s\n" "wisty user installation removed."
