#!/usr/bin/env bash
# Dilates Crosshair — uninstaller. Removes the launcher, desktop entry, and icon.
set -euo pipefail

BIN_NAME="dilates-crosshair"
GREEN=$'\033[32m'; RESET=$'\033[0m'

rm -f "${HOME}/.local/bin/${BIN_NAME}" \
      "${HOME}/.local/share/applications/${BIN_NAME}.desktop" \
      "${HOME}/.local/share/icons/hicolor/scalable/apps/${BIN_NAME}.svg"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true

echo "${GREEN}✓${RESET} Dilates Crosshair uninstalled. (Settings in \"~/.config/Dilates Crosshair\" were kept; delete that folder to remove them.)"
