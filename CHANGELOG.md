# Changelog

## 1.2.0 — 2026-09-29

### Added
- **Solid color fill** — recolor *any* crosshair (built-in SVG or custom PNG) to any color. Fixes the old hue slider silently doing nothing on white built-in crosshairs (hue-rotate is a no-op on white); hue-rotate remains available for multi-color custom images when solid fill is off.
- **Outline & glow effects** — add a hard dark/bright outline (1–5 px, any color) and a soft glow behind the crosshair so it stays visible on bright scenes.
- **Profiles** — save your full style + crosshair setup under a name (one per game) and switch instantly from the app.
- **Overlay hotkey** — press the configurable hotkey (default `Ctrl+Shift+X`) anywhere, even in-game, to show/hide the crosshair. Invalid or taken accelerators fall back safely with inline feedback.
- **Position nudging** — `Ctrl+Shift+Arrow keys` move the crosshair 5 px at a time and automatically switch to custom positioning.
- **System tray icon** — show/hide the overlay, open settings, and quit from the tray; closing the window now keeps the app running in the tray (disable in General settings).
- **Remembers overlay state** — if the overlay was on when you closed the app, it comes back on the next launch.
- **Show on all displays** — mirror the crosshair on every connected monitor at once.
- **Single-instance lock** — launching the app twice focuses the existing window instead of spawning a second overlay.
- **Reset style & position** and **Random crosshair** buttons.
- **sway/wlroots window rules** — the overlay now also floats, undecorates and pins itself on sway (previously Hyprland only).
- **6 new built-in crosshairs** (28 total): circle-plus, x-dot, quad-dot, half-cross, dot-ring, cross-thick.

### Changed
- Electron 28 → 44, electron-builder 24 → 26, TypeScript 5.3 → 5.9.
- Overlay and settings preview now share one styling implementation (`public/cross-style.js`), so what you see in the preview is exactly what renders in-game.

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
