/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase E: Electron Integration.
 *
 * The FIRST real Electron main-process adapter in this repository that
 * wires actual application state through IPC — deliberately a NEW,
 * ADDITIVE sibling of `fedos_electron_spike_main.cts` (Alpha 3881-3940),
 * never a modification of it: that file remains the untouched Package A
 * build spike; this is Package B, exactly as Alpha 4021-4100's own
 * Completion Declaration recommended as "next Arc."
 *
 * ARCHITECTURE (unmodified from this Arc's own brief — "Do not redesign
 * Runtime, Shell, Presentation, Renderer, Host Bridge, Electron Adapter"):
 *
 *   Electron Window -> [this file, the Host] -> Renderer (per-window
 *   `FedosDesktopConversationWindowController.render()`) ->
 *   `FedosDesktopConversationWindowController`/`FedosDesktopConversationWindowRegistry`
 *   (Phase B/C, ../../../src/desktop/navigation/) ->
 *   `FedosDesktopConversationUiPresentationBoundary` (Alpha 3241-3320,
 *   UNMODIFIED) -> `FedosDesktopApplicationShell` (Alpha 2841-2920,
 *   UNMODIFIED) -> `FedosRunningDesktopRuntime` (Alpha 606, UNMODIFIED).
 *
 * This file deliberately constructs a `FedosDesktopConversationUiPresentationBoundary`
 * DIRECTLY (never `FedosDesktopHostBridge`, `../host_boundary/`, Alpha
 * 3561-3640, UNTOUCHED) — `FedosDesktopHostBridge` is a fully valid,
 * complete Host Port implementation for a SINGLE shared window/view, but
 * its own `#boundary`/`#renderer` are private and never exposed, and its
 * `dispatch()`/`render()` model has no concept of "which window" a call
 * is for. Multi-window navigation genuinely needs one independent
 * `FedosDesktopConversationWindowController` per OS window (see
 * `docs/secure_runtime_alpha_4181_4260_phase_a_navigation_api_inventory.md`),
 * which is exactly the layer `FedosDesktopConversationWindowRegistry`
 * exists to own — sitting at the SAME depth as `FedosDesktopHostBridge`
 * (both are direct consumers of the Presentation Boundary), never
 * underneath or instead of it. `FedosDesktopHostBridge` itself is not
 * used, modified, or redesigned anywhere in this file.
 *
 * CRYPTO NOTE (matches every other real-acceptance test/tool in this
 * repository — no compiled WASM artifact exists in this checked-out
 * tree): `FakeEncryptionAuthority`/`FakeDecryptionAuthority` below are
 * the IDENTICAL deterministic test doubles
 * `test/secure_runtime_alpha_3241_3320_presentation_boundary.test.ts`
 * (and every sibling real-acceptance suite) already uses — not a new
 * mock invented for this Arc, and not a claim of real encryption.
 *
 * SECURITY BASELINE: every `BrowserWindow` this file creates uses the
 * IDENTICAL secure `webPreferences`/navigation/permission denial
 * configuration `fedos_electron_spike_main.cts` already established and
 * this package's own test suite already verifies structurally — restated
 * here (not imported, since the spike's own main file exports nothing),
 * never loosened.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";

const DEV_TOOLS_ENABLED: boolean = process.env.FEDOS_ELECTRON_NAV_DEVTOOLS === "1";
const MAX_ID_LENGTH = 512;

// ---------------------------------------------------------------------
// Loading the compiled root application graph (Alpha 4021-4100's own
// isolation architecture, UNCHANGED): this package's own tsconfig never
// includes root `src/`; the root Runtime/Shell/Presentation/Navigation
// graph is ESM (`dist/**/*.js`, root `package.json`'s own
// `"type": "module"`), loaded here via dynamic `import()` of an absolute
// `file://` URL (required on Windows) from this CommonJS (`.cts`) main
// process. `npm run build:runtime` (root) must have produced `dist/`
// before this file runs -- Phase F's own acceptance tooling does this.
// ---------------------------------------------------------------------

const rootDistDir = path.join(__dirname, "..", "..", "..", "dist");

function distUrl(...segments: string[]): string {
  return pathToFileURL(path.join(rootDistDir, ...segments)).href;
}

/**
 * TypeScript downlevels a literal `import(...)` expression to
 * `Promise.resolve().then(() => require(...))` under this package's own
 * `"module": "CommonJS"` tsconfig — CommonJS `require()` cannot load a
 * real ES module and rejects a `file://` URL specifier outright (the
 * "Cannot find module 'file:///...'" failure this produced during this
 * Arc's own real-process verification). Building the import call at
 * RUNTIME via `new Function` hides it from TypeScript's static
 * downlevel transform, so Node's own real dynamic `import()` runs
 * instead — the standard, widely-documented workaround for loading an
 * ESM module from CommonJS TypeScript output; no new dependency, no
 * change to how the root project itself builds/emits ESM.
 */
const dynamicImport: (specifier: string) => Promise<unknown> = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<unknown>;

interface NavigationRootModules {
  readonly createBoundary: () => unknown;
  readonly WindowRegistry: new (boundary: unknown, viewer: unknown, navigationLogPath: string, clock?: () => number) => NavigationRegistry;
  readonly StaticCreatorIdentityAuthority: new (participant: unknown) => unknown;
}

interface NavigationWindowController {
  readonly navigationState: unknown;
  readonly title: string;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  loadConversationList(filter?: unknown): Promise<void>;
  openConversation(conversationId: string): Promise<unknown>;
  switchConversation(conversationId: string): Promise<unknown>;
  closeConversation(): unknown;
  back(): Promise<boolean>;
  forward(): Promise<boolean>;
  restoreLastOpened(conversationId: string | null): Promise<unknown>;
  render(): unknown;
}

interface NavigationRegistry {
  createWindow(windowId: string): NavigationWindowController;
  disposeWindow(windowId: string): boolean;
  getWindow(windowId: string): NavigationWindowController | null;
  recordConversationOpened(conversationId: string): void;
  pinConversation(conversationId: string): void;
  unpinConversation(conversationId: string): void;
  isPinned(conversationId: string): boolean;
  readonly lastOpenedConversationId: string | null;
  sessionState(): unknown;
}

async function loadNavigationRootModules(): Promise<NavigationRootModules> {
  const presentation = (await dynamicImport(distUrl("desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.js"))) as {
    createFedosDesktopConversationUiPresentationBoundary: () => unknown;
  };
  const registry = (await dynamicImport(distUrl("desktop", "navigation", "fedos_desktop_conversation_window_registry.js"))) as {
    FedosDesktopConversationWindowRegistry: NavigationRootModules["WindowRegistry"];
  };
  const identity = (await dynamicImport(distUrl("conversation", "construction", "fedos_conversation_creator_identity_authority.js"))) as {
    StaticFedosConversationCreatorIdentityAuthority: NavigationRootModules["StaticCreatorIdentityAuthority"];
  };
  return {
    createBoundary: presentation.createFedosDesktopConversationUiPresentationBoundary,
    WindowRegistry: registry.FedosDesktopConversationWindowRegistry,
    StaticCreatorIdentityAuthority: identity.StaticFedosConversationCreatorIdentityAuthority,
  };
}

// ---------------------------------------------------------------------
// FakeEncryptionAuthority/FakeDecryptionAuthority -- see this file's own
// header, "CRYPTO NOTE."
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

/** Every durable log this running app instance uses lives under one directory -- `FEDOS_ELECTRON_NAV_DATA_DIR` for Phase F's own real-process acceptance tests (an isolated temp dir per test run), or `app.getPath("userData")` for a genuine developer/user launch. Never a repository-relative or cwd-relative path (mirrors `FedosDesktopRuntimeConfig`'s own "no default path" guardrail). */
function dataDir(): string {
  const override = process.env.FEDOS_ELECTRON_NAV_DATA_DIR;
  if (override !== undefined && override.length > 0) return override;
  return app.getPath("userData");
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

// ---------------------------------------------------------------------
// Secure BrowserWindow baseline -- IDENTICAL to
// `fedos_electron_spike_main.cts`'s own `createSecureBlankWindow()`
// (Alpha 3881-3940), restated here (that file exports nothing to import)
// and never loosened.
// ---------------------------------------------------------------------

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

let registryInstance: NavigationRegistry | null = null;
const windowIdForController = new Map<string, number>();

function controllerIdFor(sender: WebContents): string {
  const window = BrowserWindow.fromWebContents(sender);
  if (window === null) throw new Error("fedos-nav: IPC call from a WebContents with no owning BrowserWindow.");
  return String(window.id);
}

function requireRegistry(): NavigationRegistry {
  if (registryInstance === null) throw new Error("fedos-nav: navigation Registry is not yet started.");
  return registryInstance;
}

function requireController(sender: WebContents): NavigationWindowController {
  const controller = requireRegistry().getWindow(controllerIdFor(sender));
  if (controller === null) throw new Error("fedos-nav: no window controller registered for this window.");
  return controller;
}

async function createNavigationWindow(restoreSession: boolean): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "fedos_electron_navigation_preload.cjs"),
    },
  });
  applySecureWindowPolicy(window);

  const registry = requireRegistry();
  const controller = registry.createWindow(String(window.id));
  windowIdForController.set(String(window.id), window.id);

  window.on("closed", () => {
    requireRegistry().disposeWindow(String(window.id));
    windowIdForController.delete(String(window.id));
  });

  if (restoreSession) {
    await controller.restoreLastOpened(registry.lastOpenedConversationId);
  }

  void window.loadFile(path.join(__dirname, "fedos_electron_navigation_page.html"));
  return window;
}

// ---------------------------------------------------------------------
// IPC -- Phase E "Wire: Window -> Host -> Renderer -> Navigation." Every
// handler validates its own input structurally (mirrors
// `validateFedosDesktopHostCommand`'s own discipline, ../host_boundary/,
// restated rather than imported since that file's validator is typed
// against Host-specific command shapes this Arc's own commands do not
// use), then delegates to exactly one Controller/Registry call -- no
// business logic of any kind lives in a handler body.
// ---------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle("fedos-nav:list-conversations", async (event: IpcMainInvokeEvent) => {
    const controller = requireController(event.sender);
    await controller.loadConversationList();
    return controller.render();
  });

  ipcMain.handle("fedos-nav:open", async (event: IpcMainInvokeEvent, conversationId: unknown) => {
    if (!isSafeId(conversationId)) throw new Error("fedos-nav:open -- malformed conversationId");
    const controller = requireController(event.sender);
    const state = await controller.openConversation(conversationId);
    if ((state as { kind: string }).kind === "open") requireRegistry().recordConversationOpened(conversationId);
    return controller.render();
  });

  ipcMain.handle("fedos-nav:switch", async (event: IpcMainInvokeEvent, conversationId: unknown) => {
    if (!isSafeId(conversationId)) throw new Error("fedos-nav:switch -- malformed conversationId");
    const controller = requireController(event.sender);
    const state = await controller.switchConversation(conversationId);
    if ((state as { kind: string }).kind === "open") requireRegistry().recordConversationOpened(conversationId);
    return controller.render();
  });

  ipcMain.handle("fedos-nav:close", async (event: IpcMainInvokeEvent) => {
    const controller = requireController(event.sender);
    controller.closeConversation();
    return controller.render();
  });

  ipcMain.handle("fedos-nav:back", async (event: IpcMainInvokeEvent) => {
    const controller = requireController(event.sender);
    await controller.back();
    return controller.render();
  });

  ipcMain.handle("fedos-nav:forward", async (event: IpcMainInvokeEvent) => {
    const controller = requireController(event.sender);
    await controller.forward();
    return controller.render();
  });

  ipcMain.handle("fedos-nav:pin", async (event: IpcMainInvokeEvent, conversationId: unknown) => {
    if (!isSafeId(conversationId)) throw new Error("fedos-nav:pin -- malformed conversationId");
    requireRegistry().pinConversation(conversationId);
    return requireController(event.sender).render();
  });

  ipcMain.handle("fedos-nav:unpin", async (event: IpcMainInvokeEvent, conversationId: unknown) => {
    if (!isSafeId(conversationId)) throw new Error("fedos-nav:unpin -- malformed conversationId");
    requireRegistry().unpinConversation(conversationId);
    return requireController(event.sender).render();
  });

  ipcMain.handle("fedos-nav:session-state", async () => requireRegistry().sessionState());

  ipcMain.handle("fedos-nav:new-window", async () => {
    await createNavigationWindow(false);
    return requireRegistry().sessionState();
  });
}

async function startNavigationHost(): Promise<void> {
  fs.mkdirSync(dataDir(), { recursive: true });
  const modules = await loadNavigationRootModules();
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

  const boundary = modules.createBoundary() as {
    runtimeStatus: { start: (c: unknown) => Promise<{ status: string; outcome?: string; reason?: string }> };
  };
  const started = await boundary.runtimeStatus.start(config);
  if (started.status !== "loaded") {
    throw new Error(`fedos-nav: Presentation Boundary failed to start (${started.outcome ?? "unknown"}: ${started.reason ?? ""})`);
  }

  registryInstance = new modules.WindowRegistry(boundary, LOCAL_VIEWER, path.join(dataDir(), "navigation.log"));
  registerIpcHandlers();
}

app.whenReady().then(async () => {
  try {
    await startNavigationHost();
    await createNavigationWindow(true);
    // eslint-disable-next-line no-console -- deliberate, minimal real-process startup signal Phase F's own acceptance tooling greps for; not a debugging leftover.
    console.log("fedos-nav: host started");
  } catch (err) {
    // No orphan partially-started process on a genuine startup failure -- log (never a raw stack beyond this local, non-shipped dev/test process's own stdout) and quit closed.
    console.error("fedos-nav: startup failed", err);
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createNavigationWindow(false);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
