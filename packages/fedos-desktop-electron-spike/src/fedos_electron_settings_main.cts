/**
 * Secure Runtime Alpha 4901-4980 — Electron Main Adapter for the desktop
 * settings bridge (Phase G). A NEW, ADDITIVE sibling main-process entry
 * point, never a modification of any prior `*_main.cts`.
 *
 * Architecture (mirrors `fedos_electron_host_adapter_main.cts` exactly, now
 * for settings):
 *
 *   Electron Renderer -> Preload -> ipcRenderer.invoke("fedos-settings:invoke")
 *   -> ipcMain.handle() -> FedosDesktopSettingsHostBridge
 *   -> FedosDesktopSettingsController -> FedosSettingsAuthority -> one JSON file
 *
 * This file owns EXACTLY: process/window lifecycle, one `ipcMain.handle()`
 * registration, and loading the compiled settings controller + bridge
 * modules. It contains NO business logic — the dispatch translation
 * (`fedos_electron_settings_dispatch_translation.ts`, no Electron import)
 * owns the ONE request->bridge-call translation, and the bridge/controller/
 * authority own everything below.
 *
 * SECURITY (mirrors every prior package's proven-safe defaults exactly):
 * `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
 * `webSecurity: true`, preload only, `loadFile()` only, every new-window/
 * navigation/permission-request denied. The settings file path is a FIXED,
 * main-process-determined path under `app.getPath("userData")` — never a
 * renderer-supplied path.
 *
 * `.cts` (not `.ts`): forces CommonJS emit for the Electron main context.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import * as path from "node:path";
import { fedosElectronLoadSettingsModule } from "./fedos_electron_settings_host_bridge_loader.js";
import { fedosElectronSettingsHandleInvoke, type FedosElectronSettingsBridgeLike } from "./fedos_electron_settings_dispatch_translation.js";

const DEV_TOOLS_ENABLED: boolean = process.env.FEDOS_ELECTRON_SETTINGS_DEVTOOLS === "1";
/** Non-empty to drive the REAL renderer self-test (acceptance-support only); unset for an ordinary launch. */
const AUTOTEST_MODE: string = process.env.FEDOS_ELECTRON_SETTINGS_AUTOTEST ?? "";
const SELFTEST_MARKER = "FEDOS_ELECTRON_SETTINGS_TEST:";

let settingsBridge: FedosElectronSettingsBridgeLike | undefined;

/** The FIXED, main-process-owned settings file — never renderer-supplied. */
function settingsFilePath(): string {
  const override = process.env.FEDOS_ELECTRON_SETTINGS_DATA_DIR;
  const root = override !== undefined && override.length > 0 ? override : app.getPath("userData");
  return path.join(root, "settings.json");
}

function createSecureWindow(): BrowserWindow {
  const offscreen = AUTOTEST_MODE.length > 0;
  const window = new BrowserWindow({
    width: 860,
    height: 640,
    show: !offscreen,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      offscreen,
      preload: path.join(__dirname, "fedos_electron_settings_preload.cjs"),
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  window.webContents.on("console-message", (event) => {
    const message = event.message;
    if (typeof message === "string" && message.startsWith(SELFTEST_MARKER)) {
      process.stdout.write(`${message}\n`);
    }
  });

  if (DEV_TOOLS_ENABLED) {
    window.webContents.openDevTools();
  }

  void window.loadFile(path.join(__dirname, "fedos_electron_settings_page.html"));
  return window;
}

async function handleSettingsInvoke(_event: IpcMainInvokeEvent, request: unknown): Promise<unknown> {
  return fedosElectronSettingsHandleInvoke(settingsBridge, request);
}

app.whenReady().then(async () => {
  try {
    const settings = await fedosElectronLoadSettingsModule(path.join(__dirname, ".."));
    const controller = settings.createFileBackedFedosDesktopSettingsController(settingsFilePath());
    settingsBridge = settings.createFedosDesktopSettingsHostBridge(controller);
    ipcMain.handle("fedos-settings:invoke", handleSettingsInvoke);
    createSecureWindow();
  } catch {
    // A genuine, unexpected exception (e.g. the compiled settings module is missing) —
    // never a raw stack surfaces to any window; deny/close instead.
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSecureWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
