# Changelog

## 1.1.1 — 2026-06-10

### Changed
- Removed sponsor branding. App ID renamed to `io.github.dilates.crosshair` (Flatpak manifest renamed accordingly); the splash and footer now link to the GitHub repo instead.

### Fixed
- **Hyprland: dark box around the crosshair.** Hyprland decorates floating windows with background blur, shadow, rounding, and borders, which drew a frosted dark square behind the overlay. The app now auto-registers a Hyprland window rule for the overlay (supports both the Lua config in 0.55+ via `hyprctl eval` and older conf-based versions via `hyprctl keyword`). The rule also pins the overlay so it stays across workspace switches.
- Transparent overlay hardening: explicit transparent background color and `enable-transparent-visuals` for GNOME/Xorg setups.

## 1.1.0 — 2026-06-10

### Added
- **Multi-monitor support** — all connected displays are detected automatically (including hotplug) and shown as selectable cards; the crosshair centers itself on whichever screen you pick.
- **16 new built-in crosshairs** (22 total): gap cross, cross + dot, T-cross, chevron, diamond, circle-cross, scope, hollow dot, micro dot, three-dot, square, triangle, corner brackets, star, arrow, and duplex.
- **Live preview panel** — see size, hue, rotation, and opacity changes instantly without enabling the overlay.
- **Persistent settings** — your crosshair, style, display, and position are saved and restored between launches.
- **Thumbnails for custom crosshairs** — image previews instead of file-name buttons.
- **Installer** — `install.sh` (source or `--appimage` mode) and `uninstall.sh`.
- App icon.

### Changed
- Completely redesigned UI: modern dark theme, segmented position control, gradient hue slider, status pill, brand mark, and refreshed splash screen.
- Custom pixel positions are now relative to the selected display (more intuitive on multi-monitor setups); `Ctrl+Shift+P` picks the right display automatically.
- Overlay now uses the screen-saver always-on-top level and shows over fullscreen windows on all workspaces.
- Size range extended to 16–256 px.

### Fixed
- Overlay toggle no longer resets visually when config syncs from the main process.
- Crosshair lists are sorted alphabetically.

## 1.0.0 — 2026-02-07

Initial release: crosshair overlay with built-in/custom crosshairs, size/hue/rotation/opacity styling, center/pixel/follow positioning, splash screen, AppImage and Flatpak packaging.
