/**
 * Secure Runtime Alpha 4101-4180 -- Electron Main Adapter for
 * FedosDesktopHostBridge (Phases B/D/E).
 *
 * Architecture (unchanged from `fedos_desktop_host_port.ts`'s own
 * documented target, now finally connected):
 *
 *   Electron Renderer -> Preload -> ipcRenderer.invoke() -> ipcMain.handle()
 *   -> FedosDesktopHostBridge -> Presentation -> Shell -> Runtime
 *
 * This file owns EXACTLY: process/window lifecycle, one `ipcMain.handle()`
 * registration, and loading the compiled Host Bridge module. It contains
 * NO business logic -- `fedos_electron_host_adapter_dispatch_translation.ts`
 * (plain `.ts`, no Electron import) owns the ONE request->Bridge-call
 * translation, and `FedosDesktopHostBridge` itself (unmodified, Alpha
 * 3561-3640) owns everything below that. This file never redesigns the
 * Shell/Presentation/Renderer/Runtime -- it only starts/stops the ONE
 * Bridge instance and forwards already-validated IPC requests to it.
 *
 * SECURITY (Phase D/E, mirrors `fedos_electron_spike_main.cts`'s own
 * already-proven-safe defaults exactly): `contextIsolation: true`,
 * `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, preload
 * only, `loadFile()` only (never `loadURL`/a remote origin), every
 * new-window/navigation/permission-request attempt denied.
 *
 * `start()`/`stop()` are OWNED BY THIS FILE, not exposed to the renderer
 * (Phase A's own documented decision) -- `start()` uses a FIXED,
 * main-process-determined config under `app.getPath("userData")`, never
 * a renderer-supplied path. A startup failure denies/closes the window
 * (`FedosDesktopHostPort`'s own already-documented Phase F contract) --
 * never a half-started Host with a visible window.
 *
 * `.cts` (not `.ts`): mirrors the spike's own reasoning exactly -- forces
 * CommonJS emit regardless of the root project's own `"type": "module"`,
 * since this package's Electron main/preload run in a context that does
 * not support ESM the version this Arc verified against.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import * as path from "node:path";
import { fedosElectronLoadHostBridgeModule } from "./fedos_electron_host_adapter_host_bridge_loader.js";
import { fedosElectronHandleInvoke, type FedosElectronHostBridgeLike } from "./fedos_electron_host_adapter_dispatch_translation.js";

/** Development-only DevTools opt-in -- same explicit, non-default-relying discipline as the spike (`fedos_electron_spike_main.cts`'s own header). Default: closed. */
const DEV_TOOLS_ENABLED: boolean = process.env.FEDOS_ELECTRON_HOST_ADAPTER_DEVTOOLS === "1";

/** Test-support only (Phase F's own real acceptance tests capture this) -- forwards ONLY this Arc's own self-test marker lines from the renderer's console to this process's own stdout, so a spawned-subprocess test can observe a REAL round trip without a remote-debugging dependency. The self-test page itself emits nothing beyond already-secret-free closed Host response JSON (the Host's own Alpha 3561-3640 guarantee) -- this is not a general logging/telemetry feature. */
const SELFTEST_MARKER = "FEDOS_ELECTRON_ADAPTER_TEST:";

let hostBridge: FedosElectronHostBridgeLike | undefined;

function hostRuntimeConfig(): unknown {
  const userDataDir = app.getPath("userData");
  return {
    boardLogPath: path.join(userDataDir, "fedos-board.ndjson"),
    outboxLogPath: path.join(userDataDir, "fedos-outbox.ndjson"),
    deliveryEnabled: false,
  };
}

function createSecureWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "fedos_electron_host_adapter_preload.cjs"),
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

  void window.loadFile(path.join(__dirname, "fedos_electron_host_adapter_page.html"));

  return window;
}

async function handleFedosInvoke(_event: IpcMainInvokeEvent, request: unknown): Promise<unknown> {
  return fedosElectronHandleInvoke(hostBridge, request);
}

app.whenReady().then(async () => {
  try {
    const { createFedosDesktopHostBridge } = await fedosElectronLoadHostBridgeModule(path.join(__dirname, ".."));
    const bridge = createFedosDesktopHostBridge();
    const started = (await bridge.start(hostRuntimeConfig())) as { readonly outcome: string };
    if (started.outcome !== "ok") {
      // Startup failure denies/closes the window -- FedosDesktopHostPort's own documented contract, never a half-started Host.
      app.quit();
      return;
    }
    hostBridge = bridge;
    ipcMain.handle("fedos:invoke", handleFedosInvoke);
    createSecureWindow();
  } catch {
    // A genuine, unexpected exception (e.g. the compiled Host Bridge module is missing) --
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
  const pendingStop = (async () => {
    if (hostBridge !== undefined) {
      const bridge = hostBridge;
      hostBridge = undefined;
      await bridge.stop();
    }
  })();
  pendingStop.finally(() => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
});
