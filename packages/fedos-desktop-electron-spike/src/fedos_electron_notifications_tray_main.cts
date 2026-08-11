/**
 * Secure Runtime Alpha 4261-4340 ("Desktop Notifications, System Tray, and
 * Background Operation Arc") — Phase E: Electron Integration.
 *
 * A NEW, ADDITIVE sibling main-process entry point (Package C), never a
 * modification of `fedos_electron_spike_main.cts` (Package A, Alpha
 * 3881-3940) or `fedos_electron_navigation_main.cts` (Package B, Alpha
 * 4181-4260) -- both remain untouched.
 *
 * ARCHITECTURE (unmodified from this Arc's own brief — "Do not redesign
 * Runtime, Shell, Presentation, Renderer, Host Bridge, Electron Adapter"):
 *
 *   Electron Window -> [this file, the Host] ->
 *     Navigation:  FedosDesktopConversationWindowRegistry/-Controller
 *                  (Alpha 4181-4260, UNMODIFIED)
 *     Notification: FedosDesktopNotificationCoordinator (Phase B, this Arc)
 *                    -> FedosElectronNotificationAdapter (Phase E, this file's
 *                       own sibling, `./fedos_electron_notification_adapter.ts`)
 *                       -> real Electron `Notification`.
 *     Tray:        TrayCoordinator (Phase C, this Arc)
 *                    -> FedosElectronTrayAdapter (Phase E, `./fedos_electron_tray_adapter.ts`)
 *                       -> real Electron `Tray`/`Menu`.
 *     Background:  BackgroundLifecycleCoordinator (Phase D, this Arc) --
 *                  a PURE state machine; this file performs every REAL
 *                  side effect (window creation/close, `boundary.runtimeStatus.stop()`,
 *                  `app.quit()`) it decides, never the reverse.
 *   -> `FedosDesktopConversationUiPresentationBoundary` (Alpha 3241-3320,
 *      UNMODIFIED) -> `FedosDesktopApplicationShell` (Alpha 2841-2920,
 *      UNMODIFIED) -> `FedosRunningDesktopRuntime` (Alpha 606, UNMODIFIED).
 *
 * HOST BRIDGE REUSE -- investigated honestly, per this Arc's own brief
 * (Phase E "Reuse Host Bridge"): `FedosDesktopHostBridge`
 * (`../../../src/desktop/host_boundary/fedos_desktop_host_bridge.ts`,
 * Alpha 3561-3640, UNTOUCHED) is NOT constructed here, for the SAME reason
 * the Navigation Arc's own adapter already documented and this Arc's own
 * Phase A inventory restates: it owns its OWN private
 * `FedosDesktopConversationUiPresentationBoundary`/`FedosDesktopRenderer`
 * internally (never exposed) and has no concept of "window" at all —
 * constructing it ALONGSIDE the Window Registry this file also needs would
 * mean two independent, divergent Boundary/Shell/Runtime instances racing
 * inside one process, a direct violation of this Arc's own Phase D "single
 * runtime ownership" requirement. This file instead follows the SAME
 * pattern the Navigation Arc already established (and this Arc's own
 * `BackgroundLifecycleCoordinator` header names explicitly): exactly ONE
 * `FedosDesktopConversationUiPresentationBoundary`, constructed directly,
 * shared by the Window Registry, the Tray Coordinator (for
 * `deviceSyncStatus`), and (indirectly, via the Registry) every window this
 * process ever opens. `FedosDesktopHostBridge`'s own PATTERN — a
 * framework-neutral Port + one concrete adapter, `dispatch()` structurally
 * validated and never a raw command — IS reused, restated in this Arc's own
 * `FedosDesktopNotificationPort`/`FedosDesktopTrayPort` (Phase B/C). No IPC
 * redesign: this file's own `fedos-bg:*` channels are closed, validated,
 * `ipcMain.handle`-based, exactly like `fedos-nav:*`.
 *
 * SECURITY BASELINE: identical `webPreferences`/navigation/permission
 * denial configuration as `fedos_electron_navigation_main.cts`, restated
 * here (that file exports nothing), never loosened.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { FedosElectronNotificationAdapter } from "./fedos_electron_notification_adapter.js";
import { FedosElectronTrayAdapter } from "./fedos_electron_tray_adapter.js";
import { runFedosBackgroundSelftest } from "./fedos_electron_notifications_tray_selftest.js";

const DEV_TOOLS_ENABLED: boolean = process.env.FEDOS_ELECTRON_BG_DEVTOOLS === "1";
const AUTOTEST_ENABLED: boolean = process.env.FEDOS_ELECTRON_BG_AUTOTEST === "1";
const MAX_ID_LENGTH = 512;

// ---------------------------------------------------------------------
// Loading the compiled root application graph -- IDENTICAL technique to
// `fedos_electron_navigation_main.cts`'s own `loadNavigationRootModules()`.
// `npm run build:runtime` (root) must have produced `dist/` before this
// file runs.
// ---------------------------------------------------------------------

const rootDistDir = path.join(__dirname, "..", "..", "..", "dist");

function distUrl(...segments: string[]): string {
  return pathToFileURL(path.join(rootDistDir, ...segments)).href;
}

interface NavigationWindowController {
  readonly navigationState: unknown;
  readonly title: string;
  restoreLastOpened(conversationId: string | null): Promise<unknown>;
  render(): unknown;
}
interface NavigationRegistry {
  createWindow(windowId: string): NavigationWindowController;
  disposeWindow(windowId: string): boolean;
  getWindow(windowId: string): NavigationWindowController | null;
  readonly recentConversationIds: readonly string[];
  readonly lastOpenedConversationId: string | null;
}
interface DeviceSyncStatusViewModelLike {
  refresh(): Promise<unknown>;
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
}
interface BoundaryLike {
  readonly deviceSyncStatus: DeviceSyncStatusViewModelLike;
  readonly runtimeStatus: { start: (c: unknown) => Promise<{ status: string; outcome?: string; reason?: string }>; stop: () => Promise<{ status: string }> };
}
interface NotificationCoordinatorLike {
  notify(candidate: unknown): Promise<unknown>;
  readonly lastOutcome: unknown;
  readonly deliveredCount: number;
  readonly deniedCount: number;
}
interface TrayCoordinatorLike {
  dispatch(candidate: unknown): Promise<{ action: string; outcome: string; [key: string]: unknown }>;
}
interface BackgroundLifecycleLike {
  readonly state: string;
  readonly openWindowCount: number;
  windowOpened(): string;
  windowClosed(): string;
  requestShutdown(): string;
  confirmShutdown(): string;
  canRunBackgroundSync(): boolean;
  canDeliverBackgroundNotifications(): boolean;
}
interface StatusViewModelLike {
  status(): unknown;
}
interface TrayMenuItem {
  readonly action: string;
  readonly label: string;
  readonly enabled: boolean;
}

interface RootModules {
  readonly createBoundary: () => BoundaryLike;
  readonly WindowRegistry: new (boundary: unknown, viewer: unknown, navigationLogPath: string) => NavigationRegistry;
  readonly StaticCreatorIdentityAuthority: new (participant: unknown) => unknown;
  readonly NotificationCoordinator: new (port: unknown) => NotificationCoordinatorLike;
  readonly TrayCoordinator: new (registry: unknown, deviceSyncStatus: unknown) => TrayCoordinatorLike;
  readonly BackgroundLifecycleCoordinator: new (config: { keepAliveInBackground: boolean }) => BackgroundLifecycleLike;
  readonly StatusViewModel: new (notificationCoordinator: unknown, backgroundLifecycle: unknown) => StatusViewModelLike;
  readonly fedosDesktopTrayMenuItems: (disabled?: ReadonlySet<string>) => readonly TrayMenuItem[];
}

async function loadRootModules(): Promise<RootModules> {
  const presentation = (await import(distUrl("os", "messenger", "desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.js"))) as {
    createFedosDesktopConversationUiPresentationBoundary: () => BoundaryLike;
  };
  const registry = (await import(distUrl("os", "messenger", "desktop", "navigation", "fedos_desktop_conversation_window_registry.js"))) as {
    FedosDesktopConversationWindowRegistry: RootModules["WindowRegistry"];
  };
  const identity = (await import(distUrl("conversation", "construction", "fedos_conversation_creator_identity_authority.js"))) as {
    StaticFedosConversationCreatorIdentityAuthority: RootModules["StaticCreatorIdentityAuthority"];
  };
  const notification = (await import(distUrl("os", "messenger", "notifications", "fedos_desktop_notification_coordinator.js"))) as {
    FedosDesktopNotificationCoordinator: RootModules["NotificationCoordinator"];
  };
  const tray = (await import(distUrl("os", "messenger", "desktop", "tray", "fedos_desktop_tray_coordinator.js"))) as { TrayCoordinator: RootModules["TrayCoordinator"] };
  const trayTypes = (await import(distUrl("os", "messenger", "desktop", "tray", "fedos_desktop_tray_types.js"))) as {
    fedosDesktopTrayMenuItems: RootModules["fedosDesktopTrayMenuItems"];
  };
  const background = (await import(distUrl("os", "messenger", "desktop", "background", "fedos_desktop_background_lifecycle_coordinator.js"))) as {
    BackgroundLifecycleCoordinator: RootModules["BackgroundLifecycleCoordinator"];
  };
  const status = (await import(distUrl("os", "messenger", "desktop", "presentation", "fedos_desktop_notifications_tray_status_view_model.js"))) as {
    FedosDesktopNotificationsTrayStatusViewModel: RootModules["StatusViewModel"];
  };
  return {
    createBoundary: presentation.createFedosDesktopConversationUiPresentationBoundary,
    WindowRegistry: registry.FedosDesktopConversationWindowRegistry,
    StaticCreatorIdentityAuthority: identity.StaticFedosConversationCreatorIdentityAuthority,
    NotificationCoordinator: notification.FedosDesktopNotificationCoordinator,
    TrayCoordinator: tray.TrayCoordinator,
    BackgroundLifecycleCoordinator: background.BackgroundLifecycleCoordinator,
    StatusViewModel: status.FedosDesktopNotificationsTrayStatusViewModel,
    fedosDesktopTrayMenuItems: trayTypes.fedosDesktopTrayMenuItems,
  };
}

// ---------------------------------------------------------------------
// FakeEncryptionAuthority/FakeDecryptionAuthority -- IDENTICAL deterministic
// test doubles every real-acceptance suite in this repository already uses
// (no compiled WASM artifact exists in this checked-out tree). See
// `fedos_electron_navigation_main.cts`'s own "CRYPTO NOTE".
// ---------------------------------------------------------------------

interface EncryptionRequest {
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
  readonly plaintext: Uint8Array;
}
interface DecryptionRequest {
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
  readonly ciphertext: Uint8Array;
}
function fakeMarker(request: { localAccountIndex: number; counterpartyPublicKeyHex: string }): Uint8Array {
  return new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
}
class FakeEncryptionAuthority {
  async encrypt(request: EncryptionRequest): Promise<{ outcome: "encrypted"; ciphertext: Uint8Array }> {
    const marker = fakeMarker(request);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority {
  async decrypt(request: DecryptionRequest): Promise<{ outcome: "decrypted"; plaintext: Uint8Array } | { outcome: "failed" }> {
    const marker = fakeMarker(request);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}

const LOCAL_VIEWER = Object.freeze({ authority: "fedos" as const, publicIdentifier: "local-viewer", identityId: null });

/** Mirrors `fedos_electron_navigation_main.cts`'s own `dataDir()` -- `FEDOS_ELECTRON_BG_DATA_DIR` for real-process acceptance tests, `app.getPath("userData")` for a genuine launch. */
function dataDir(): string {
  const override = process.env.FEDOS_ELECTRON_BG_DATA_DIR;
  if (override !== undefined && override.length > 0) return override;
  return app.getPath("userData");
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function applySecureWindowPolicy(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  if (DEV_TOOLS_ENABLED) {
    window.webContents.openDevTools();
  }
}

let modules: RootModules | null = null;
let boundary: BoundaryLike | null = null;
let registryInstance: NavigationRegistry | null = null;
let notificationCoordinator: NotificationCoordinatorLike | null = null;
let trayCoordinator: TrayCoordinatorLike | null = null;
let backgroundLifecycle: BackgroundLifecycleLike | null = null;
let statusViewModel: StatusViewModelLike | null = null;
const trayAdapter = new FedosElectronTrayAdapter();
const notificationAdapter = new FedosElectronNotificationAdapter();

function requireRegistry(): NavigationRegistry {
  if (registryInstance === null) throw new Error("fedos-bg: Registry is not yet started.");
  return registryInstance;
}
function requireTrayCoordinator(): TrayCoordinatorLike {
  if (trayCoordinator === null) throw new Error("fedos-bg: TrayCoordinator is not yet started.");
  return trayCoordinator;
}
function requireNotificationCoordinator(): NotificationCoordinatorLike {
  if (notificationCoordinator === null) throw new Error("fedos-bg: NotificationCoordinator is not yet started.");
  return notificationCoordinator;
}
function requireBackgroundLifecycle(): BackgroundLifecycleLike {
  if (backgroundLifecycle === null) throw new Error("fedos-bg: BackgroundLifecycleCoordinator is not yet started.");
  return backgroundLifecycle;
}
function requireStatusViewModel(): StatusViewModelLike {
  if (statusViewModel === null) throw new Error("fedos-bg: Status ViewModel is not yet started.");
  return statusViewModel;
}
function requireModules(): RootModules {
  if (modules === null) throw new Error("fedos-bg: root modules are not yet loaded.");
  return modules;
}

async function createBackgroundWindow(restoreSession: boolean): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "fedos_electron_notifications_tray_preload.cjs"),
    },
  });
  applySecureWindowPolicy(window);

  const registry = requireRegistry();
  const controller = registry.createWindow(String(window.id));
  requireBackgroundLifecycle().windowOpened();

  window.on("closed", () => {
    requireRegistry().disposeWindow(String(window.id));
    requireBackgroundLifecycle().windowClosed();
    // No `window-all-closed` -> `app.quit()` wiring at all (Phase D "keep runtime alive") -- the
    // process stays alive with zero windows and only the tray icon showing, exactly the behavior
    // this Arc's own "window close keeps runtime alive" scenario proves.
  });

  if (restoreSession) {
    await controller.restoreLastOpened(requireRegistry().lastOpenedConversationId);
  }

  void window.loadFile(path.join(__dirname, "fedos_electron_notifications_tray_page.html"));
  return window;
}

function controllerFor(sender: WebContents): NavigationWindowController {
  const window = BrowserWindow.fromWebContents(sender);
  if (window === null) throw new Error("fedos-bg: IPC call from a WebContents with no owning BrowserWindow.");
  const controller = requireRegistry().getWindow(String(window.id));
  if (controller === null) throw new Error("fedos-bg: no window controller registered for this window.");
  return controller;
}

// ---------------------------------------------------------------------
// Tray wiring -- clicking a menu item forwards its own closed `action`
// string into `TrayCoordinator.dispatch()`; the outcome drives the ONE
// real side effect this file itself performs for that action (open/focus
// a window, or begin a clean shutdown for "exit") -- never business logic
// of its own (Phase E "Electron only hosts UI").
// ---------------------------------------------------------------------

function refreshTrayMenu(): void {
  const items = requireModules().fedosDesktopTrayMenuItems();
  trayAdapter.render(items, (action: string) => {
    void handleTrayAction({ action });
  });
}

async function handleTrayAction(candidate: unknown): Promise<unknown> {
  const outcome = await requireTrayCoordinator().dispatch(candidate);
  if (outcome.action === "open-window") {
    const conversationId = (outcome as unknown as { conversationId: string | null }).conversationId;
    const window = await createBackgroundWindow(false);
    if (conversationId !== null) {
      const controller = requireRegistry().getWindow(String(window.id));
      await controller?.restoreLastOpened(conversationId);
    }
  } else if (outcome.action === "exit") {
    await performCleanShutdown();
  }
  return outcome;
}

async function performCleanShutdown(): Promise<void> {
  const lifecycle = requireBackgroundLifecycle();
  lifecycle.requestShutdown();
  if (boundary !== null) {
    await boundary.runtimeStatus.stop();
  }
  trayAdapter.destroy();
  lifecycle.confirmShutdown();
  // eslint-disable-next-line no-console -- deliberate, minimal real-process shutdown signal Phase G's own acceptance tooling greps for.
  console.log("fedos-bg: shutdown clean");
  app.quit();
}

// ---------------------------------------------------------------------
// IPC -- closed, validated `fedos-bg:*` channels (Phase E "no IPC
// redesign" -- identical `ipcMain.handle` discipline to `fedos-nav:*`).
// ---------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle("fedos-bg:status", async () => requireStatusViewModel().status());

  ipcMain.handle("fedos-bg:notify", async (_event: IpcMainInvokeEvent, candidate: unknown) => requireNotificationCoordinator().notify(candidate));

  ipcMain.handle("fedos-bg:tray-action", async (_event: IpcMainInvokeEvent, candidate: unknown) => handleTrayAction(candidate));

  ipcMain.handle("fedos-bg:new-window", async () => {
    await createBackgroundWindow(false);
    return requireStatusViewModel().status();
  });

  ipcMain.handle("fedos-bg:close-window", async (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window === null) throw new Error("fedos-bg:close-window -- no owning BrowserWindow");
    window.close();
    return { closed: true };
  });

  ipcMain.handle("fedos-bg:session-render", async (event: IpcMainInvokeEvent) => controllerFor(event.sender).render());

  ipcMain.handle("fedos-bg:shutdown", async () => {
    await performCleanShutdown();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------
// Startup.
// ---------------------------------------------------------------------

async function startBackgroundHost(): Promise<void> {
  fs.mkdirSync(dataDir(), { recursive: true });
  modules = await loadRootModules();
  const creatorIdentityAuthority = new modules.StaticCreatorIdentityAuthority(LOCAL_VIEWER);
  const config = {
    boardLogPath: path.join(dataDir(), "board.log"),
    outboxLogPath: path.join(dataDir(), "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: path.join(dataDir(), "draft.log"),
    conversationMembershipLogPath: path.join(dataDir(), "membership.log"),
    conversationCapabilityLogPath: path.join(dataDir(), "capability.log"),
    conversationConstructionCoordinationLogPath: path.join(dataDir(), "construction-coordination.log"),
    conversationEnvelopeLogPath: path.join(dataDir(), "envelope.log"),
    conversationPayloadLogPath: path.join(dataDir(), "payload.log"),
    conversationEncryptionCoordinationLogPath: path.join(dataDir(), "encryption-coordination.log"),
    conversationActivationCoordinationLogPath: path.join(dataDir(), "activation.log"),
    conversationPayloadRetentionLogPath: path.join(dataDir(), "retention.log"),
    conversationCreatorIdentityAuthority: creatorIdentityAuthority,
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: () => Math.floor(Date.now() / 1000),
  };

  boundary = modules.createBoundary();
  const started = await boundary.runtimeStatus.start(config);
  if (started.status !== "loaded") {
    throw new Error(`fedos-bg: Presentation Boundary failed to start (${started.outcome ?? "unknown"}: ${started.reason ?? ""})`);
  }

  registryInstance = new modules.WindowRegistry(boundary, LOCAL_VIEWER, path.join(dataDir(), "navigation.log"));
  backgroundLifecycle = new modules.BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
  notificationCoordinator = new modules.NotificationCoordinator(notificationAdapter);
  trayCoordinator = new modules.TrayCoordinator(registryInstance, boundary.deviceSyncStatus);
  statusViewModel = new modules.StatusViewModel(notificationCoordinator, backgroundLifecycle);

  registerIpcHandlers();
  trayAdapter.create("nostr-window");
  refreshTrayMenu();
}

app.whenReady().then(async () => {
  try {
    await startBackgroundHost();
    // eslint-disable-next-line no-console -- deliberate, minimal real-process startup signal Phase F/G's own acceptance tooling greps for.
    console.log("fedos-bg: host started");
  } catch (err) {
    console.error("fedos-bg: startup failed", err);
    app.quit();
    return;
  }

  if (AUTOTEST_ENABLED) {
    try {
      await runFedosBackgroundSelftest({
        notify: (candidate) => requireNotificationCoordinator().notify(candidate),
        // Deliberately the PURE `TrayCoordinator.dispatch()` here, not `handleTrayAction()` --
        // the self-test's own "tray open"/"tray exit" steps observe the DECISION outcome only;
        // performing `handleTrayAction`'s own real side effects (opening a window / a full clean
        // shutdown) for "exit" here would end the process mid-sequence, before the later "window
        // close keeps runtime alive"/"restart" steps (which open/close REAL windows explicitly,
        // via `createBackgroundWindow` below) ever run. The genuine tray-click -> real side effect
        // path is exercised for real by `refreshTrayMenu()`'s own `onAction` callback in normal
        // operation -- unrelated to this test-only sequencing concern.
        trayDispatch: (candidate) => requireTrayCoordinator().dispatch(candidate),
        backgroundLifecycle: requireBackgroundLifecycle(),
        createBackgroundWindow: () => createBackgroundWindow(false),
        closeWindowAndWait: (window) =>
          new Promise<void>((resolve) => {
            (window as BrowserWindow).once("closed", () => resolve());
            (window as BrowserWindow).close();
          }),
        destroyTray: () => trayAdapter.destroy(),
      });
    } finally {
      await performCleanShutdown();
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createBackgroundWindow(false);
    }
  });
});

// Deliberately NO `window-all-closed` handler -- Phase D "keep runtime alive": closing every
// window never quits this process; only the tray "Exit" action / `fedos-bg:shutdown` IPC /
// `app.quit()` from the OS does.
