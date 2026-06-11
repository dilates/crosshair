#!/usr/bin/env bash
#
# Dilates Crosshair — installer
#
#   ./install.sh             Install from source (desktop launcher + command)
#   ./install.sh --appimage  Build a portable AppImage and install it
#   ./install.sh --help      Show help
#
set -euo pipefail

APP_NAME="Dilates Crosshair"
BIN_NAME="dilates-crosshair"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; BLUE=$'\033[34m'; RESET=$'\033[0m'

info()  { echo "${BLUE}::${RESET} $*"; }
ok()    { echo "${GREEN}✓${RESET} $*"; }
warn()  { echo "${YELLOW}!${RESET} $*"; }
fail()  { echo "${RED}✗${RESET} $*" >&2; exit 1; }

usage() {
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

MODE="source"
for arg in "$@"; do
  case "$arg" in
    --appimage) MODE="appimage" ;;
    -h|--help)  usage ;;
    *) fail "Unknown option: $arg (try --help)" ;;
  esac
done

echo
echo "${BOLD}  ┼  ${APP_NAME} installer${RESET}"
echo

# --- Check dependencies -----------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js is required (v18+). Install it from your package manager, e.g. 'sudo pacman -S nodejs npm' or 'sudo apt install nodejs npm'."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18+ required (found v$(node -v | tr -d v))."
ok "Node.js $(node -v)"

# --- Install npm dependencies -----------------------------------------------
cd "$SCRIPT_DIR"
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/tsc ]; then
  command -v npm >/dev/null 2>&1 || fail "npm is required to install dependencies."
  info "Installing dependencies (this can take a minute)…"
  npm install
fi
ok "Dependencies present"

# --- Build ------------------------------------------------------------------
info "Compiling…"
./node_modules/.bin/tsc
ok "Build complete"

mkdir -p "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"

# --- Icon -------------------------------------------------------------------
cp -f "$SCRIPT_DIR/public/icon.svg" "$ICON_DIR/${BIN_NAME}.svg"
ok "Icon installed"

if [ "$MODE" = "appimage" ]; then
  # --- AppImage install -------------------------------------------------------
  info "Building AppImage (first run downloads Electron binaries)…"
  ./node_modules/.bin/electron-builder --linux AppImage
  APPIMAGE_PATH="$(find "$SCRIPT_DIR/dist" -maxdepth 1 -name '*.AppImage' -print -quit)"
  [ -n "$APPIMAGE_PATH" ] || fail "AppImage build failed — nothing found in dist/."
  install -m 755 "$APPIMAGE_PATH" "$BIN_DIR/${BIN_NAME}"
  EXEC_CMD="$BIN_DIR/${BIN_NAME}"
  ok "AppImage installed to $BIN_DIR/${BIN_NAME}"
else
  # --- Source install: wrapper script ----------------------------------------
  cat > "$BIN_DIR/${BIN_NAME}" <<EOF
#!/usr/bin/env bash
exec "$SCRIPT_DIR/node_modules/.bin/electron" "$SCRIPT_DIR" "\$@"
EOF
  chmod +x "$BIN_DIR/${BIN_NAME}"
  EXEC_CMD="$BIN_DIR/${BIN_NAME}"
  ok "Launcher installed to $BIN_DIR/${BIN_NAME}"
fi

# --- Desktop entry ----------------------------------------------------------
cat > "$DESKTOP_DIR/${BIN_NAME}.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=${APP_NAME}
GenericName=Crosshair Overlay
Comment=Free crosshair overlay for Linux gaming
Exec=${EXEC_CMD}
Icon=${BIN_NAME}
Terminal=false
Categories=Game;
Keywords=crosshair;overlay;gaming;aim;fps;
EOF
ok "Desktop entry installed"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

# --- PATH hint ---------------------------------------------------------------
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) warn "$BIN_DIR is not in your PATH — add it to run '${BIN_NAME}' from a terminal. The app menu entry works either way." ;;
esac

echo
echo "${GREEN}${BOLD}Done!${RESET} Launch ${BOLD}${APP_NAME}${RESET} from your app menu, or run: ${BOLD}${BIN_NAME}${RESET}"
echo "To uninstall: ./uninstall.sh"
echo
