/**
 * Secure Runtime Alpha 3881-3940 -- Electron Dependency and Build Spike
 * (Package A only, per this Arc's own Objective).
 *
 * This file proves ONLY: Electron installs, builds, and launches safely in
 * this repository, with a secure `BrowserWindow` configuration, loading a
 * static local page. It does NOT wire `FedosDesktopHostBridge`, the Desktop
 * Runtime, the Shell, any ViewModel, or the Renderer -- none of those are
 * imported here, and this file's own header is the honest, permanent record
 * of that boundary (Phase L structural guard: this directory is the ONLY
 * place in this repository an Electron import exists).
 *
 * `.cts` (not `.ts`): forces CommonJS emit regardless of this repository's
 * root `"type": "module"` -- see `fedos_electron_spike_preload.cts`'s own
 * header for the full reasoning; the main process does not strictly need
 * this (modern Electron main processes support ESM), but using the SAME
 * module format for main and preload avoids a mixed-format build for one
 * narrow spike directory.
 */

import { app, BrowserWindow } from "electron";
import * as path from "node:path";

/**
 * Development-only DevTools opt-in. Documented, not hidden (Phase D's own
 * explicit instruction: "no devTools exposure decision hidden"): DevTools
 * are NEVER opened unless the developer explicitly sets
 * `FEDOS_ELECTRON_SPIKE_DEVTOOLS=1` before launch. Default: closed.
 */
const DEV_TOOLS_ENABLED: boolean = process.env.FEDOS_ELECTRON_SPIKE_DEVTOOLS === "1";

function createSecureBlankWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Mandatory secure defaults (Phase D) -- every value below is an
      // explicit, non-default-relying literal, never inherited silently.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "fedos_electron_spike_preload.cjs"),
    },
  });

  // Deny EVERY new-window/window.open attempt outright -- this is a single,
  // static, offline page with no legitimate reason to ever open a second
  // window or navigate an external link in-app (Phase D/I: "deny or safely
  // handle new-window attempts", "external link attempt denied").
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Deny ALL in-app navigation, unconditionally -- this page never
  // legitimately navigates anywhere, including to itself again (Phase D:
  // "no navigation away from the local app"; Phase I: "no arbitrary
  // navigation").
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  // Deny every permission request by default -- no evidenced requirement
  // for camera/mic/geolocation/notifications/clipboard/etc. anywhere in
  // this narrow spike (Phase D/I: "deny unexpected permission requests").
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  if (DEV_TOOLS_ENABLED) {
    window.webContents.openDevTools();
  }

  // Loads ONLY the packaged/local static file -- no localhost server, no
  // remote CDN, no external script (Phase D).
  void window.loadFile(path.join(__dirname, "fedos_electron_spike_page.html"));

  return window;
}

app.whenReady().then(() => {
  createSecureBlankWindow();

  // Standard, minimal, platform-conventional macOS "activate" handling
  // (Phase F: "optional platform-specific activate handling") -- recreates
  // the ONE window if the dock icon is clicked with no window open. This
  // does not create a second concurrent window (Phase F: "no multi-window
  // architecture") and is a no-op on Windows/Linux (no dock, event never
  // fires).
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSecureBlankWindow();
    }
  });
});

// Standard minimal lifecycle (Phase F): quit when every window is closed,
// except the documented macOS convention of staying resident with no
// window until the user explicitly quits (Cmd+Q) -- no tray, no daemon, no
// background Runtime, no hidden process on Windows/Linux.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
