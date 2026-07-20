/**
 * Secure Runtime Alpha 4341-4420 ("Desktop Unread Badge and Menu Bar Count
 * Integration Arc") — Phase E: Electron Integration.
 *
 * A NEW, ADDITIVE sibling main-process entry point (Package F), never a
 * modification of `fedos_electron_spike_main.cts` (Package A),
 * `fedos_electron_navigation_main.cts` (Package B), or
 * `fedos_electron_notifications_tray_main.cts` (Package D, Alpha
 * 4261-4340) — all three remain untouched.
 *
 * ARCHITECTURE (unmodified from this Arc's own brief — "Reuse the existing
 * FedosDesktopUnreadCounterViewModel without redesign... No Runtime
 * redesign... Reuse existing Notification/Tray layer"):
 *
 *   Electron Window -> [this file, the Host] ->
 *     Navigation:   FedosDesktopConversationWindowRegistry (Alpha 4181-4260, UNMODIFIED)
 *     Notification: FedosDesktopNotificationCoordinator (Alpha 4261-4340, UNMODIFIED)
 *                     -> FedosElectronNotificationAdapter (Alpha 4261-4340, UNMODIFIED)
 *     Tray:         TrayCoordinator (Alpha 4261-4340, UNMODIFIED)
 *                     -> FedosElectronTrayAdapter (Alpha 4261-4340, UNMODIFIED)
 *                        -- this file's ONE, SHARED Tray instance, reused
 *                           (never duplicated) by the Badge adapter below.
 *     Background:   BackgroundLifecycleCoordinator (Alpha 4261-4340, UNMODIFIED)
 *     Badge:        FedosDesktopBadgeCoordinator (Phase B, THIS Arc)
 *                     -> FedosElectronBadgeAdapter (Phase E, `./fedos_electron_badge_adapter.ts`)
 *                        -> real Electron `app.dock`/`app.setBadgeCount`/
 *                           `BrowserWindow.setOverlayIcon`, PLUS the SAME
 *                           shared `FedosElectronTrayAdapter` instance above
 *                           (`setTooltip`/`render`, never a second Tray --
 *                           "No duplicate state").
 *   -> `FedosDesktopConversationUiPresentationBoundary` (UNMODIFIED)
 *      -> `FedosDesktopApplicationShell` (UNMODIFIED)
 *      -> `FedosRunningDesktopRuntime` (UNMODIFIED).
 *
 * The Badge Coordinator itself reuses exactly TWO existing ViewModels off
 * the SAME Boundary this file already constructs --
 * `boundary.unreadCounter` (Alpha 3241-3320) and `boundary.conversationList`
 * (Alpha 3241-3320) -- never a third, divergent Shell/Boundary instance
 * (this Arc's own "single runtime ownership" restatement, identical to
 * every prior Electron package in this lineage).
 *
 * SEEDING (test-support only, real objects): to give the acceptance suite
 * (and this file's own `FEDOS_ELECTRON_BADGE_AUTOTEST=1` self-test) a REAL
 * activated direct conversation to observe real unread counts on, this file
 * seeds exactly ONE direct conversation between the local viewer and a
 * synthetic counterparty ("bob") through a TEMPORARY raw
 * `FedosRunningDesktopRuntime` instance (the SAME technique
 * `secure_runtime_alpha_4261_4340_tray_coordinator.test.ts`'s own
 * `activateDirectConversation()` helper already uses) BEFORE the real
 * Boundary starts -- writing into the SAME log files the real Boundary then
 * re-reads on startup. This is necessary because `FedosDesktopApplicationShell.redeemInvitation()`
 * is honestly `"unavailable"` on this base (documented, pre-existing, Alpha
 * 2841-2920) -- there is no OTHER way to reach a real, activated
 * conversation through the Boundary's own exposed surface. No new
 * capability is invented: this is the exact same construction/activation
 * sequence `fedos_conversation_runtime.ts` already supports and every real
 * acceptance test in this repository already exercises directly.
 *
 * SECURITY BASELINE: identical `webPreferences`/navigation/permission
 * denial configuration as every prior package's own main.cts, restated
 * here, never loosened.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { FedosElectronNotificationAdapter } from "./fedos_electron_notification_adapter.js";
import { FedosElectronTrayAdapter } from "./fedos_electron_tray_adapter.js";
import { FedosElectronBadgeAdapter, type FedosElectronBadgeTrayMenuItemLike } from "./fedos_electron_badge_adapter.js";
import { runFedosBadgeSelftest } from "./fedos_electron_badge_selftest.js";

const DEV_TOOLS_ENABLED: boolean = process.env.FEDOS_ELECTRON_BADGE_DEVTOOLS === "1";
const AUTOTEST_ENABLED: boolean = process.env.FEDOS_ELECTRON_BADGE_AUTOTEST === "1";
const MAX_ID_LENGTH = 512;

// ---------------------------------------------------------------------
// Loading the compiled root application graph -- IDENTICAL technique to
// `fedos_electron_notifications_tray_main.cts`'s own `loadRootModules()`.
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
  recordConversationOpened(conversationId: string): void;
  readonly recentConversationIds: readonly string[];
  readonly lastOpenedConversationId: string | null;
}
interface DeviceSyncStatusViewModelLike {
  refresh(): Promise<unknown>;
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
}
interface ViewModelStateLike {
  readonly status: string;
  readonly data?: unknown;
}
interface UnreadCounterLike {
  refresh(conversationId: string): Promise<ViewModelStateLike>;
  markViewed(conversationId: string): Promise<void>;
}
interface ComposeMessageLike {
  setBody(body: string): void;
  send(conversationId: string, sender: unknown): Promise<ViewModelStateLike>;
}
interface BoundaryLike {
  readonly deviceSyncStatus: DeviceSyncStatusViewModelLike;
  readonly unreadCounter: UnreadCounterLike;
  readonly composeMessage: ComposeMessageLike;
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
interface BadgeViewLike {
  readonly state: string;
  readonly count: number;
  readonly reason: string;
}
interface BadgeCoordinatorLike {
  refresh(): Promise<BadgeViewLike>;
  readonly lastView: BadgeViewLike | null;
  readonly renderCount: number;
  setSynchronizing(active: boolean): void;
}
interface TrayMenuItem {
  readonly action: string;
  readonly label: string;
  readonly enabled: boolean;
}
interface ConversationDraftResultLike {
  readonly outcome: string;
  readonly draft?: { readonly id: string };
  readonly capability?: { readonly descriptor: { readonly capabilityId: string }; readonly bearerSecret: string };
}
interface ConversationRuntimeLike {
  createDirectDraft(command: unknown): ConversationDraftResultLike;
  redeemInvitation(token: unknown, counterparty: unknown): { readonly outcome: string };
  activateDirectConversation(id: string): Promise<{ readonly outcome: string }>;
}
interface RawRuntimeLike {
  conversationRuntime(): ConversationRuntimeLike;
  stop(): Promise<void>;
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
  readonly BadgeCoordinator: new (registry: unknown, unreadCounter: unknown, port: unknown) => BadgeCoordinatorLike;
  readonly startRawRuntime: (config: unknown) => Promise<RawRuntimeLike>;
  readonly toInvitationToken: (capabilityId: string, bearerSecret: string) => unknown;
}

async function loadRootModules(): Promise<RootModules> {
  const presentation = (await import(distUrl("desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.js"))) as {
    createFedosDesktopConversationUiPresentationBoundary: () => BoundaryLike;
  };
  const registry = (await import(distUrl("desktop", "navigation", "fedos_desktop_conversation_window_registry.js"))) as {
    FedosDesktopConversationWindowRegistry: RootModules["WindowRegistry"];
  };
  const identity = (await import(distUrl("conversation", "construction", "fedos_conversation_creator_identity_authority.js"))) as {
    StaticFedosConversationCreatorIdentityAuthority: RootModules["StaticCreatorIdentityAuthority"];
  };
  const notification = (await import(distUrl("desktop", "notification", "fedos_desktop_notification_coordinator.js"))) as {
    FedosDesktopNotificationCoordinator: RootModules["NotificationCoordinator"];
  };
  const tray = (await import(distUrl("desktop", "tray", "fedos_desktop_tray_coordinator.js"))) as { TrayCoordinator: RootModules["TrayCoordinator"] };
  const trayTypes = (await import(distUrl("desktop", "tray", "fedos_desktop_tray_types.js"))) as {
    fedosDesktopTrayMenuItems: RootModules["fedosDesktopTrayMenuItems"];
  };
  const background = (await import(distUrl("desktop", "background", "fedos_desktop_background_lifecycle_coordinator.js"))) as {
    BackgroundLifecycleCoordinator: RootModules["BackgroundLifecycleCoordinator"];
  };
  const status = (await import(distUrl("desktop", "presentation", "fedos_desktop_notifications_tray_status_view_model.js"))) as {
    FedosDesktopNotificationsTrayStatusViewModel: RootModules["StatusViewModel"];
  };
  const badge = (await import(distUrl("desktop", "badge", "fedos_desktop_badge_coordinator.js"))) as {
    FedosDesktopBadgeCoordinator: RootModules["BadgeCoordinator"];
  };
  const runtimeModule = (await import(distUrl("desktop", "runtime", "fedos_desktop_runtime.js"))) as {
    startFedosDesktopRuntime: RootModules["startRawRuntime"];
  };
  const invitation = (await import(distUrl("conversation", "invitation", "fedos_conversation_invitation_token.js"))) as {
    toFedosConversationInvitationToken: RootModules["toInvitationToken"];
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
    BadgeCoordinator: badge.FedosDesktopBadgeCoordinator,
    startRawRuntime: runtimeModule.startFedosDesktopRuntime,
    toInvitationToken: invitation.toFedosConversationInvitationToken,
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
const SEED_COUNTERPARTY = Object.freeze({ authority: "nostr" as const, publicIdentifier: "b".repeat(64), identityId: null });

/** Mirrors `fedos_electron_notifications_tray_main.cts`'s own `dataDir()` -- `FEDOS_ELECTRON_BADGE_DATA_DIR` for real-process acceptance tests, `app.getPath("userData")` for a genuine launch. */
function dataDir(): string {
  const override = process.env.FEDOS_ELECTRON_BADGE_DATA_DIR;
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

function runtimeConfig(creatorIdentityAuthority: unknown): Record<string, unknown> {
  return {
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
}

let modules: RootModules | null = null;
let boundary: BoundaryLike | null = null;
let registryInstance: NavigationRegistry | null = null;
let notificationCoordinator: NotificationCoordinatorLike | null = null;
let trayCoordinator: TrayCoordinatorLike | null = null;
let backgroundLifecycle: BackgroundLifecycleLike | null = null;
let statusViewModel: StatusViewModelLike | null = null;
let badgeCoordinator: BadgeCoordinatorLike | null = null;
let seededConversationId: string | null = null;
const trayAdapter = new FedosElectronTrayAdapter();
const notificationAdapter = new FedosElectronNotificationAdapter();

function requireRegistry(): NavigationRegistry {
  if (registryInstance === null) throw new Error("fedos-badge: Registry is not yet started.");
  return registryInstance;
}
function requireTrayCoordinator(): TrayCoordinatorLike {
  if (trayCoordinator === null) throw new Error("fedos-badge: TrayCoordinator is not yet started.");
  return trayCoordinator;
}
function requireNotificationCoordinator(): NotificationCoordinatorLike {
  if (notificationCoordinator === null) throw new Error("fedos-badge: NotificationCoordinator is not yet started.");
  return notificationCoordinator;
}
function requireBackgroundLifecycle(): BackgroundLifecycleLike {
  if (backgroundLifecycle === null) throw new Error("fedos-badge: BackgroundLifecycleCoordinator is not yet started.");
  return backgroundLifecycle;
}
function requireStatusViewModel(): StatusViewModelLike {
  if (statusViewModel === null) throw new Error("fedos-badge: Status ViewModel is not yet started.");
  return statusViewModel;
}
function requireBadgeCoordinator(): BadgeCoordinatorLike {
  if (badgeCoordinator === null) throw new Error("fedos-badge: BadgeCoordinator is not yet started.");
  return badgeCoordinator;
}
function requireModules(): RootModules {
  if (modules === null) throw new Error("fedos-badge: root modules are not yet loaded.");
  return modules;
}
function requireBoundary(): BoundaryLike {
  if (boundary === null) throw new Error("fedos-badge: Boundary is not yet started.");
  return boundary;
}

/** Marks `conversationId` viewed (reusing the SAME `FedosDesktopUnreadCounterViewModel` the Badge Coordinator itself wraps) and recomputes the badge. A no-op-safe wrapper -- never throws past this boundary. */
async function markViewedAndRefreshBadge(conversationId: string | null): Promise<void> {
  if (conversationId === null) return;
  await requireBoundary().unreadCounter.markViewed(conversationId);
  await requireBadgeCoordinator().refresh();
}

async function createBadgeWindow(restoreSession: boolean): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "fedos_electron_badge_preload.cjs"),
    },
  });
  applySecureWindowPolicy(window);

  const registry = requireRegistry();
  const controller = registry.createWindow(String(window.id));
  requireBackgroundLifecycle().windowOpened();

  window.on("closed", () => {
    requireRegistry().disposeWindow(String(window.id));
    requireBackgroundLifecycle().windowClosed();
    void requireBadgeCoordinator().refresh();
    // No `window-all-closed` -> `app.quit()` wiring at all (keep runtime alive, Alpha 4261-4340's
    // own established behavior, restated here) -- the process stays alive with zero windows and
    // only the tray icon (with its own live badge suffix) showing.
  });

  if (restoreSession) {
    await controller.restoreLastOpened(requireRegistry().lastOpenedConversationId);
  }

  void window.loadFile(path.join(__dirname, "fedos_electron_badge_page.html"));
  return window;
}

/** Opens/focuses `conversationId` in a real window, THEN marks it viewed and refreshes the badge -- the real "a user actually looked at this conversation" path this Arc's own "unread clears"/"tray interaction" scenarios exercise. */
async function openConversationWindow(conversationId: string | null): Promise<BrowserWindow> {
  const window = await createBadgeWindow(false);
  if (conversationId !== null) {
    const controller = requireRegistry().getWindow(String(window.id));
    await controller?.restoreLastOpened(conversationId);
    requireRegistry().recordConversationOpened(conversationId);
  }
  await markViewedAndRefreshBadge(conversationId);
  return window;
}

function controllerFor(sender: WebContents): NavigationWindowController {
  const window = BrowserWindow.fromWebContents(sender);
  if (window === null) throw new Error("fedos-badge: IPC call from a WebContents with no owning BrowserWindow.");
  const controller = requireRegistry().getWindow(String(window.id));
  if (controller === null) throw new Error("fedos-badge: no window controller registered for this window.");
  return controller;
}

// ---------------------------------------------------------------------
// Tray wiring -- clicking a menu item forwards its own closed `action`
// string into `TrayCoordinator.dispatch()`; the outcome drives the ONE real
// side effect this file itself performs for that action, then refreshes the
// badge (Phase G "tray interaction"). The MENU ITSELF is rendered through
// `FedosElectronBadgeAdapter` (reusing this file's own single
// `trayAdapter`, never a second Tray) so its own labels always carry the
// current badge count suffix -- never a second, separate tray render call.
// ---------------------------------------------------------------------

function baseTrayMenuItems(): readonly FedosElectronBadgeTrayMenuItemLike[] {
  return requireModules().fedosDesktopTrayMenuItems();
}

function onTrayMenuAction(action: string): void {
  void handleTrayAction({ action });
}

async function handleTrayAction(candidate: unknown): Promise<unknown> {
  const outcome = await requireTrayCoordinator().dispatch(candidate);
  if (outcome.action === "open-window") {
    const conversationId = (outcome as unknown as { conversationId: string | null }).conversationId;
    await openConversationWindow(conversationId);
  } else if (outcome.action === "exit") {
    await performCleanShutdown();
  } else {
    // Every other real action (recent-conversations/device-sync-status/pause-sync/resume-sync) --
    // no badge-affecting side effect of its own, but the badge is still recomputed so its own
    // count/state never goes stale behind whatever the action itself just changed.
    void requireBadgeCoordinator().refresh();
  }
  return outcome;
}

async function performCleanShutdown(): Promise<void> {
  const lifecycle = requireBackgroundLifecycle();
  lifecycle.requestShutdown();
  if (boundary !== null) {
    await boundary.runtimeStatus.stop();
  }
  // Phase G "shutdown cleanup" -- clear every real badge surface BEFORE tearing down the Tray
  // icon itself, never leaving a stale badge/overlay/dock number visible after the process exits.
  // Idempotent, mirrors `trayAdapter.destroy()`'s own safe-to-call-more-than-once discipline.
  if (badgeAdapter !== null) {
    badgeAdapter.render({ state: "none", count: 0, reason: "process shutting down" });
  }
  trayAdapter.destroy();
  lifecycle.confirmShutdown();
  // eslint-disable-next-line no-console -- deliberate, minimal real-process shutdown signal Phase G's own acceptance tooling greps for.
  console.log("fedos-badge: shutdown clean");
  app.quit();
}

// ---------------------------------------------------------------------
// Seeding -- see this file's own header, "SEEDING". Runs BEFORE the real
// Boundary starts, using a TEMPORARY raw runtime over the SAME log files.
// ---------------------------------------------------------------------

async function seedDirectConversation(mods: RootModules, creatorIdentityAuthority: unknown): Promise<string> {
  const raw = await mods.startRawRuntime(runtimeConfig(creatorIdentityAuthority));
  const cr = raw.conversationRuntime();
  const created = cr.createDirectDraft({ recipient: SEED_COUNTERPARTY });
  if (created.outcome !== "draft-created" || created.draft === undefined || created.capability === undefined) {
    await raw.stop();
    throw new Error(`fedos-badge: seed conversation draft failed (${created.outcome})`);
  }
  const id = created.draft.id;
  const token = mods.toInvitationToken(created.capability.descriptor.capabilityId, created.capability.bearerSecret);
  const redeemed = cr.redeemInvitation(token, SEED_COUNTERPARTY);
  if (redeemed.outcome !== "redeemed") {
    await raw.stop();
    throw new Error(`fedos-badge: seed conversation redemption failed (${redeemed.outcome})`);
  }
  const activated = await cr.activateDirectConversation(id);
  if (activated.outcome !== "activated") {
    await raw.stop();
    throw new Error(`fedos-badge: seed conversation activation failed (${activated.outcome})`);
  }
  await raw.stop();
  return id;
}

// ---------------------------------------------------------------------
// IPC -- closed, validated `fedos-badge:*` channels. Nine total: seven
// reused-layer channels (renamed from Alpha 4261-4340's own `fedos-bg:*`
// set into this file's OWN namespace, since this is a wholly separate
// process/preload pair -- no IPC redesign of the REUSED coordinators
// themselves, only this file's own channel naming) plus two new ones for
// the Badge boundary itself.
// ---------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle("fedos-badge:bg-status", async () => requireStatusViewModel().status());

  ipcMain.handle("fedos-badge:notify", async (_event: IpcMainInvokeEvent, candidate: unknown) => {
    const outcome = await requireNotificationCoordinator().notify(candidate);
    // Phase G "notification interaction" -- a delivered/denied notification always recomputes the
    // badge, so it never lags behind whatever real event the notification itself was ABOUT.
    void requireBadgeCoordinator().refresh();
    return outcome;
  });

  ipcMain.handle("fedos-badge:tray-action", async (_event: IpcMainInvokeEvent, candidate: unknown) => handleTrayAction(candidate));

  ipcMain.handle("fedos-badge:new-window", async () => {
    await createBadgeWindow(false);
    return requireStatusViewModel().status();
  });

  ipcMain.handle("fedos-badge:close-window", async (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window === null) throw new Error("fedos-badge:close-window -- no owning BrowserWindow");
    window.close();
    return { closed: true };
  });

  ipcMain.handle("fedos-badge:session-render", async (event: IpcMainInvokeEvent) => controllerFor(event.sender).render());

  ipcMain.handle("fedos-badge:shutdown", async () => {
    await performCleanShutdown();
    return { ok: true };
  });

  ipcMain.handle("fedos-badge:badge-status", async () => {
    const view = await requireBadgeCoordinator().refresh();
    return { view, renderCount: requireBadgeCoordinator().renderCount };
  });

  ipcMain.handle("fedos-badge:mark-viewed", async (_event: IpcMainInvokeEvent, candidate: unknown) => {
    const conversationId = (candidate as { conversationId?: unknown } | null)?.conversationId;
    if (!isSafeId(conversationId)) throw new Error("fedos-badge:mark-viewed -- malformed conversationId");
    await markViewedAndRefreshBadge(conversationId);
    return { view: requireBadgeCoordinator().lastView, renderCount: requireBadgeCoordinator().renderCount };
  });
}

// ---------------------------------------------------------------------
// Startup.
// ---------------------------------------------------------------------

let badgeAdapter: FedosElectronBadgeAdapter | null = null;

async function startBadgeHost(): Promise<void> {
  fs.mkdirSync(dataDir(), { recursive: true });
  modules = await loadRootModules();
  const creatorIdentityAuthority = new modules.StaticCreatorIdentityAuthority(LOCAL_VIEWER);

  const seededId = await seedDirectConversation(modules, creatorIdentityAuthority);
  seededConversationId = seededId;

  boundary = modules.createBoundary();
  const started = await boundary.runtimeStatus.start(runtimeConfig(creatorIdentityAuthority));
  if (started.status !== "loaded") {
    throw new Error(`fedos-badge: Presentation Boundary failed to start (${started.outcome ?? "unknown"}: ${started.reason ?? ""})`);
  }

  registryInstance = new modules.WindowRegistry(boundary, LOCAL_VIEWER, path.join(dataDir(), "navigation.log"));
  // Registers the seeded conversation into the Registry's own real, persisted `recentConversationIds`
  // (see this file's own header, "SEEDING") -- pure Registry bookkeeping, no `markViewed()` call, so
  // it never affects the Badge's own unread computation, only which conversation ids it sums over.
  registryInstance.recordConversationOpened(seededId);
  backgroundLifecycle = new modules.BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
  notificationCoordinator = new modules.NotificationCoordinator(notificationAdapter);
  trayCoordinator = new modules.TrayCoordinator(registryInstance, boundary.deviceSyncStatus);
  statusViewModel = new modules.StatusViewModel(notificationCoordinator, backgroundLifecycle);

  badgeAdapter = new FedosElectronBadgeAdapter(trayAdapter, () => BrowserWindow.getAllWindows(), baseTrayMenuItems, onTrayMenuAction);
  badgeCoordinator = new modules.BadgeCoordinator(registryInstance, boundary.unreadCounter, badgeAdapter);

  registerIpcHandlers();
  trayAdapter.create("nostr-window");
  await badgeCoordinator.refresh();
}

app.whenReady().then(async () => {
  try {
    await startBadgeHost();
    // eslint-disable-next-line no-console -- deliberate, minimal real-process startup signal Phase F/G's own acceptance tooling greps for.
    console.log("fedos-badge: host started");
  } catch (err) {
    console.error("fedos-badge: startup failed", err);
    app.quit();
    return;
  }

  if (AUTOTEST_ENABLED) {
    try {
      await runFedosBadgeSelftest({
        seededConversationId: seededConversationId,
        sendSeedMessage: async (body: string) => {
          const boundaryRef = requireBoundary();
          boundaryRef.composeMessage.setBody(body);
          return boundaryRef.composeMessage.send(seededConversationId as string, LOCAL_VIEWER);
        },
        markViewed: (conversationId: string) => markViewedAndRefreshBadge(conversationId),
        refreshBadge: () => requireBadgeCoordinator().refresh(),
        badgeRenderCount: () => requireBadgeCoordinator().renderCount,
        notify: (candidate: unknown) => requireNotificationCoordinator().notify(candidate),
        trayOpenWindow: (conversationId: string | null) => handleTrayAction({ action: "open-window", conversationId: conversationId ?? undefined }),
        createExtraWindow: () => createBadgeWindow(false),
        closeWindowAndWait: (window) =>
          new Promise<void>((resolve) => {
            (window as BrowserWindow).once("closed", () => resolve());
            (window as BrowserWindow).close();
          }),
        openWindowCount: () => BrowserWindow.getAllWindows().length,
      });
    } finally {
      await performCleanShutdown();
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createBadgeWindow(false);
    }
  });
});

// Deliberately NO `window-all-closed` handler -- keep-alive-in-background, restated from Alpha
// 4261-4340: closing every window never quits this process; only the tray "Exit" action /
// `fedos-badge:shutdown` IPC / `app.quit()` from the OS does.
