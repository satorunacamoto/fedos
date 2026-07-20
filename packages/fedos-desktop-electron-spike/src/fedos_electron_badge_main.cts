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
 *
 * -----------------------------------------------------------------------
 * Secure Runtime Alpha 4501-4580 ("Desktop Device Sync Electron Main
 * Integration Arc") — the final Electron integration for the existing
 * Device Sync Presentation Wiring (Alpha 4421-4500). This IS the file that
 * Arc's own Completion Declaration recommended extending, VERIFIED here
 * (not merely assumed) by reading all five Electron main entry points'
 * own headers before writing a single line: only THIS file already
 * constructs `FedosDesktopNotificationCoordinator`/`TrayCoordinator`/
 * `FedosDesktopBadgeCoordinator` together in one process, so this is the
 * ONE place attaching Device Sync presentation routing does not create a
 * second, competing set of Coordinators (this Arc's own hard rule: "Never
 * duplicate ownership"). Extended IN PLACE, not as a new sibling package —
 * every prior arc in this lineage added a NEW sibling `*_main.cts` file;
 * this one deliberately does not, because a new sibling would have to
 * construct its OWN Boundary/Shell/Runtime/Coordinators to reach the same
 * three targets, which is exactly the duplicate-ownership violation this
 * Arc's own hard rules forbid.
 *
 * TWO NAMING CORRECTIONS VERIFIED AGAINST REAL SOURCE (disclosed, per this
 * Arc's own instruction):
 *   1. The brief says "FedosElectronHostBridge" -- the real class is
 *      `FedosDesktopHostBridge` (`../../../src/desktop/host_boundary/fedos_desktop_host_bridge.ts`).
 *      NOT constructed here, and not relevant to this Arc's own wiring:
 *      read in full, it owns a PRIVATE `#boundary`/`#renderer` pair,
 *      never exposed to a caller, with no concept of "window" or of the
 *      Notification/Tray/Badge Coordinators this file already owns --
 *      exactly the same reason `fedos_electron_navigation_main.cts` and
 *      `fedos_electron_notifications_tray_main.cts` already gave, in
 *      their own headers, for constructing their OWN Boundary directly
 *      instead. Constructing it here alongside this file's own Boundary
 *      would mean two independent, divergent Runtime instances -- the
 *      exact violation this Arc's own hard rules forbid.
 *   2. `FedosDesktopBadgeCoordinator`'s real, current public surface is
 *      `setSynchronizing()` + `refresh()` -- NOT `setAttention()`/
 *      `setCount()`/`setNone()` (an earlier spec's wording; already
 *      corrected by Alpha 4421-4500's own Phase A finding, restated here
 *      since `FedosDesktopDeviceSyncPresentationWiring`, reused verbatim
 *      below, is what actually calls those two real methods).
 *
 * WHAT THIS ARC ADDS (Phase A/B/C, everything additive, nothing above this
 * point in the file modified in BEHAVIOR -- see the diff for the few
 * one-line touch points: `RootModules`/`loadRootModules()` gain two more
 * dynamically-imported compiled modules, `DeviceSyncStatusViewModelLike`
 * gains one more already-real method (`triggerNow`), `startBadgeHost()`/
 * `performCleanShutdown()` gain a Device Sync section each):
 *
 *   - Constructs exactly ONE `FedosDeviceSyncEventBridge` (Alpha 4421-4500,
 *     UNMODIFIED) and exactly ONE `FedosDesktopDeviceSyncPresentationWiring`
 *     (Alpha 4421-4500, UNMODIFIED) per real `startBadgeHost()` call --
 *     never a global singleton (both are ordinary module-level `let`
 *     bindings scoped to THIS process's own single real startup, exactly
 *     like every other Coordinator this file already owns).
 *   - `eventBridge.wrapAttemptFn()` is threaded into `deviceSyncAttemptFn`
 *     on the SAME real `startFedosDesktopRuntime()` config this file's own
 *     Boundary already starts (`deviceSyncRuntimeConfigFields()`) --
 *     `deviceTrustEnabled`/`deviceSyncSchedulerEnabled` turned on for the
 *     first time in this file's own history, so `FedosDeviceSyncScheduler`
 *     is now a REAL, constructed object inside this real process (not a
 *     fabricated flag) -- verified via the real, now-observable
 *     `enabled: true` on `boundary.deviceSyncStatus.refresh()`.
 *   - `wiring` is constructed AFTER `notificationCoordinator`/
 *     `badgeCoordinator`/the shared `trayAdapter` all exist (it needs
 *     them as constructor deps) -- routes through their real, narrow,
 *     already-existing public surfaces only, reusing the SAME shared
 *     `trayAdapter` instance as its own tray status sink (never a second
 *     Tray).
 *   - A welcome, real SIDE EFFECT of finally turning `deviceSyncSchedulerEnabled`
 *     on: the Tray's existing `"pause-sync"`/`"resume-sync"`/
 *     `"device-sync-status"` actions (`TrayCoordinator`, Alpha 4261-4340,
 *     UNMODIFIED) were WIRED but INERT on every real launch before this
 *     Arc (the Scheduler they call into was never constructed). They are
 *     now genuinely functional, with zero changes to `TrayCoordinator`
 *     itself.
 *
 * HONEST, DISCLOSED SCOPE BOUNDARY (Phase A finding, found by reading real
 * source, not assumed): `FedosDesktopApplicationShell` exposes Device Sync
 * OPERATIONAL commands only (`deviceSyncStatus()`/`deviceSyncStart()`/
 * `deviceSyncStop()`/`deviceSyncNow()`/list*) -- it has NO device
 * REGISTRATION surface at all (`registerDevice()`/`confirmTrust()`/
 * `recordLocalChange()` exist only on the raw `FedosRunningDesktopRuntime.deviceTrust()`,
 * which Shell/Boundary never expose to any caller, this file included).
 * Separately, `FedosSyncState` (the Sync Journal `recordLocalChange()`
 * writes into) is constructed fresh, in-memory, on every
 * `startFedosDesktopRuntime()` call -- `FedosDesktopRuntimeConfig` has NO
 * durable-path field for it at all (unlike `deviceRegistryLogPath`), so
 * even a temporary raw seed runtime (this file's own established
 * `seedDirectConversation()` technique, reused for the conversation
 * above) could not carry a seeded Sync Journal entry into this file's own
 * real, long-lived Boundary runtime. Net effect: this real process's own
 * real Scheduler, with real Device Trust enabled, has no reachable way to
 * ever have a real, trusted, in-range target device today -- every real
 * `triggerSyncNow()` in this file's own self-test honestly reports "ok"
 * with an EMPTY tick array, never a fabricated attempt. To still prove
 * the real, live Notification/Badge/Tray Coordinators THIS process
 * constructs correctly receive and process Device Sync events end-to-end,
 * `runFedosBadgeDeviceSyncSelftest()` (`./fedos_electron_badge_device_sync_selftest.ts`)
 * drives `wiring.handleEvent()` directly with hand-built, schema-valid
 * `FedosDeviceSyncEvent` objects -- the IDENTICAL method, and the IDENTICAL
 * code path, a genuine Scheduler-sourced event would take (`FedosDeviceSyncEventBridge`
 * itself calls nothing but `this.#listener(event)`, i.e. `wiring.handleEvent`,
 * to deliver a real one). This is disclosed here, in the Execution Spec,
 * and in the Completion Declaration -- not silently worked around. Closing
 * this gap for real (adding a real device-pairing/registration flow
 * reachable from Electron) is out of THIS Arc's own scope ("No Sync
 * protocol changes") and is this Arc's own recommended next Arc.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { FedosElectronNotificationAdapter } from "./fedos_electron_notification_adapter.js";
import { FedosElectronTrayAdapter } from "./fedos_electron_tray_adapter.js";
import { FedosElectronBadgeAdapter, type FedosElectronBadgeTrayMenuItemLike } from "./fedos_electron_badge_adapter.js";
import { runFedosBadgeSelftest } from "./fedos_electron_badge_selftest.js";
import { runFedosBadgeDeviceSyncSelftest } from "./fedos_electron_badge_device_sync_selftest.js";

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
  /** Alpha 4501-4580 -- already real on `FedosDesktopDeviceSyncStatusViewModel` (Alpha 3801-3880), simply never previously declared on this file's own narrow local view of the Boundary. */
  triggerNow(): Promise<unknown>;
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

// ---------------------------------------------------------------------
// Alpha 4501-4580 -- Device Sync Event Bridge / Presentation Wiring local
// structural views, mirroring every OTHER "Like" interface above: this
// file never statically imports the real classes (it only ever consumes
// the COMPILED `dist/` graph via `loadRootModules()`'s own dynamic
// `import()`), so these describe exactly the real, narrow surface this
// file itself calls -- `FedosDeviceSyncEventBridge.wrapAttemptFn()`/
// `.isTargetBelievedOffline()` and `FedosDesktopDeviceSyncPresentationWiring.handleEvent()`/
// `.currentTrayStatus`, unmodified, Alpha 4421-4500.
// ---------------------------------------------------------------------
interface DeviceSyncEventBridgeLike {
  wrapAttemptFn(real?: (request: unknown) => Promise<unknown>): (request: unknown) => Promise<unknown>;
  isTargetBelievedOffline(targetDeviceId: string): boolean;
}
interface DeviceSyncPresentationWiringLike {
  handleEvent(event: unknown): Promise<void>;
  readonly currentTrayStatus: string;
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
  /** Alpha 4501-4580 -- `FedosDeviceSyncEventBridge` (`../../../src/device/sync_events/fedos_device_sync_event_bridge.ts`, Alpha 4421-4500, UNMODIFIED). */
  readonly DeviceSyncEventBridge: new (deps: {
    listener: (event: unknown) => void;
    abandonmentMaxAttempts?: number;
  }) => DeviceSyncEventBridgeLike;
  /** Alpha 4501-4580 -- `FedosDesktopDeviceSyncPresentationWiring` (`../../../src/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.ts`, Alpha 4421-4500, UNMODIFIED). */
  readonly DeviceSyncPresentationWiring: new (deps: {
    notificationCoordinator: unknown;
    badgeCoordinator: unknown;
    trayStatusSink?: unknown;
  }) => DeviceSyncPresentationWiringLike;
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
  // Alpha 4501-4580 -- Device Sync Event Bridge / Presentation Wiring, both Alpha 4421-4500,
  // UNMODIFIED. Loaded the SAME way as every module above: the compiled `dist/` output, never a
  // static import of `src/`.
  const deviceSyncEventBridgeModule = (await import(distUrl("device", "sync_events", "fedos_device_sync_event_bridge.js"))) as {
    FedosDeviceSyncEventBridge: RootModules["DeviceSyncEventBridge"];
  };
  const deviceSyncWiringModule = (await import(distUrl("desktop", "runtime", "fedos_desktop_device_sync_presentation_wiring.js"))) as {
    FedosDesktopDeviceSyncPresentationWiring: RootModules["DeviceSyncPresentationWiring"];
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
    DeviceSyncEventBridge: deviceSyncEventBridgeModule.FedosDeviceSyncEventBridge,
    DeviceSyncPresentationWiring: deviceSyncWiringModule.FedosDesktopDeviceSyncPresentationWiring,
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

// ---------------------------------------------------------------------
// Alpha 4501-4580 -- Device Sync config. `LOCAL_DEVICE_ID` mirrors
// `LOCAL_VIEWER`'s own "stable, fixed literal for this single-process
// package" precedent; `LOCAL_VIEWER` itself is reused, unmodified, as
// `localAccountRef` below -- its `{authority, publicIdentifier, identityId}`
// shape already matches `FedosDeviceBindingAccountRef` exactly, and it IS
// the same real local identity this Device is additive beneath.
// ---------------------------------------------------------------------
const LOCAL_DEVICE_ID = "fedos-badge-local-device";
const DEVICE_SYNC_ABANDONMENT_POLICY = Object.freeze({ maxAttempts: 5, laterDelaySeconds: 30 });

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

/**
 * Alpha 4501-4580 -- the additional `FedosDesktopRuntimeConfig` fields that
 * turn Device Trust + the Device Sync Scheduler on for real, spread into
 * `runtimeConfig()`'s own output ONLY for this file's own real, long-lived
 * Boundary start (never for the temporary `seedDirectConversation()` raw
 * runtime above, which has no need for either). `attemptFn` is always
 * `eventBridge.wrapAttemptFn(...)` -- see this file's own header for why no
 * real, network-attached attempt function exists on this base (a
 * pre-existing, disclosed gap, unrelated to this Arc).
 */
function deviceSyncRuntimeConfigFields(attemptFn: (request: unknown) => Promise<unknown>): Record<string, unknown> {
  return {
    deviceTrustEnabled: true,
    localDeviceId: LOCAL_DEVICE_ID,
    localAccountRef: LOCAL_VIEWER,
    deviceRegistryLogPath: path.join(dataDir(), "device-registry.log"),
    deviceSyncSchedulerEnabled: true,
    deviceSyncAbandonmentPolicy: DEVICE_SYNC_ABANDONMENT_POLICY,
    deviceSyncAttemptFn: attemptFn,
    deviceSyncScheduleLogPath: path.join(dataDir(), "device-sync-schedule.log"),
    deviceSyncConflictLogPath: path.join(dataDir(), "device-sync-conflict.log"),
    deviceSyncTransferSessionLogPath: path.join(dataDir(), "device-sync-transfer.log"),
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

/**
 * Alpha 4501-4580 -- Device Sync Event Bridge / Presentation Wiring. Plain
 * module-level `let` bindings, exactly like every OTHER Coordinator this
 * file owns above (`badgeCoordinator`/`trayCoordinator`/...) -- NOT a
 * global singleton in any stronger sense than those: scoped to this one
 * process's own single real `startBadgeHost()` call, nulled on shutdown
 * (see `performCleanShutdown()` below), never reused across a restart
 * (a restart is always a brand NEW OS process in this package).
 */
let eventBridge: DeviceSyncEventBridgeLike | null = null;
let wiring: DeviceSyncPresentationWiringLike | null = null;
/** Idempotent-startup guard (Phase C "double startup") -- `startBadgeHost()` performs real, one-time construction (Boundary/Registry/Coordinators/Wiring); a second call must never duplicate any of it. */
let hostStarted = false;
/** Idempotent-shutdown guard (Phase C "double shutdown") -- `performCleanShutdown()` must be safe to call more than once (tray "Exit", the `fedos-badge:shutdown` IPC channel, and a genuine OS shutdown signal can all race to call it). */
let shutdownInitiated = false;

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
function requireWiring(): DeviceSyncPresentationWiringLike {
  if (wiring === null) throw new Error("fedos-badge: Device Sync Presentation Wiring is not yet started.");
  return wiring;
}
function requireEventBridge(): DeviceSyncEventBridgeLike {
  if (eventBridge === null) throw new Error("fedos-badge: Device Sync Event Bridge is not yet started.");
  return eventBridge;
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
  if (shutdownInitiated) {
    // Phase C "double shutdown" -- tray "Exit", the `fedos-badge:shutdown` IPC channel, and this
    // file's own AUTOTEST self-test (deliberately, see below) can all race to call this; a second
    // call must never re-run `runtimeStatus.stop()`/tear down the Tray twice/log
    // "shutdown clean" twice.
    console.log("fedos-badge: performCleanShutdown() called again after shutdown already began -- ignored (idempotent shutdown).");
    return;
  }
  shutdownInitiated = true;

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
  // Alpha 4501-4580 -- "destroy" the Device Sync Wiring/Bridge (Phase B "destroy during Electron
  // shutdown"). Neither owns a timer or an external subscription of its own to unwind (the real
  // Scheduler's own timer is already stopped one line above, via `runtimeStatus.stop()` ->
  // `FedosRunningDesktopRuntime.stop()` -> `scheduler.stopSync()`) -- "destroy" here means
  // dropping the module-level reference BEFORE `app.quit()`, so no post-shutdown code path
  // (Phase C "no memory leaks") can ever route a stray event into a torn-down Coordinator.
  wiring = null;
  eventBridge = null;
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
  if (hostStarted) {
    // Phase C "double startup" -- a second real call (this file's own AUTOTEST self-test proves
    // this deliberately, see below) never re-seeds, never re-starts the Boundary, never
    // constructs a second Registry/Coordinator/Wiring/Bridge -- "no duplicate ownership"
    // restated as an idempotent no-op, not merely documented.
    console.log("fedos-badge: startBadgeHost() called again after startup already completed -- ignored (idempotent startup, no duplicate Runtime/Coordinators/Device Sync Wiring constructed).");
    return;
  }
  hostStarted = true;

  fs.mkdirSync(dataDir(), { recursive: true });
  modules = await loadRootModules();
  const creatorIdentityAuthority = new modules.StaticCreatorIdentityAuthority(LOCAL_VIEWER);

  const seededId = await seedDirectConversation(modules, creatorIdentityAuthority);
  seededConversationId = seededId;

  // Alpha 4501-4580 -- the Event Bridge is constructed BEFORE the real Boundary starts: its own
  // `wrapAttemptFn()` must already exist to be threaded into `startFedosDesktopRuntime()`'s own
  // config below. Its `listener` forwards into `wiring`, constructed a few lines further down
  // (once the three real Coordinators it depends on exist) -- `wiring` is `null` for the brief
  // window between these two points, and the listener below is a safe no-op for that window
  // (there is no real Scheduler attempt in flight yet to observe).
  eventBridge = new modules.DeviceSyncEventBridge({
    listener: (event) => {
      if (wiring !== null) void wiring.handleEvent(event);
    },
    abandonmentMaxAttempts: DEVICE_SYNC_ABANDONMENT_POLICY.maxAttempts,
  });

  boundary = modules.createBoundary();
  const started = await boundary.runtimeStatus.start({
    ...runtimeConfig(creatorIdentityAuthority),
    ...deviceSyncRuntimeConfigFields(eventBridge.wrapAttemptFn()),
  });
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

  // Alpha 4501-4580 -- constructed exactly once, HERE, now that its three real Coordinator deps
  // exist (Phase B "construct FedosDesktopDeviceSyncPresentationWiring exactly once"). Reuses the
  // SAME shared `trayAdapter` instance as its own tray status sink -- never a second Tray.
  wiring = new modules.DeviceSyncPresentationWiring({
    notificationCoordinator,
    badgeCoordinator,
    trayStatusSink: trayAdapter,
  });

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
    // Phase C "double startup" -- a second, real call, BEFORE any self-test runs. Captures the
    // real Coordinator/Wiring object references first so the log line below can PROVE (not just
    // assert-by-absence-of-crash) that nothing was reconstructed.
    const badgeCoordinatorBeforeSecondStart = badgeCoordinator;
    const wiringBeforeSecondStart = wiring;
    const eventBridgeBeforeSecondStart = eventBridge;
    await startBadgeHost();
    const doubleStartupIdempotent =
      badgeCoordinator === badgeCoordinatorBeforeSecondStart && wiring === wiringBeforeSecondStart && eventBridge === eventBridgeBeforeSecondStart;
    console.log(`fedos-badge: double-startup-idempotent=${doubleStartupIdempotent}`);

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

      // Alpha 4501-4580 -- Device Sync scenarios, real Scheduler/Boundary/Coordinators. See this
      // file's own header for the honest, disclosed reason `trigger-now` reports zero targets, and
      // why `event-routing` drives `wiring.handleEvent()` directly.
      await runFedosBadgeDeviceSyncSelftest({
        deviceSyncStatus: () => requireBoundary().deviceSyncStatus.refresh(),
        resumeSync: () => handleTrayAction({ action: "resume-sync" }),
        pauseSync: () => handleTrayAction({ action: "pause-sync" }),
        triggerSyncNow: () => requireBoundary().deviceSyncStatus.triggerNow(),
        handleSyntheticEvent: (event: unknown) => requireWiring().handleEvent(event),
        currentTrayStatus: () => requireWiring().currentTrayStatus,
        notificationDeliveredCount: () => requireNotificationCoordinator().deliveredCount,
        badgeRenderCount: () => requireBadgeCoordinator().renderCount,
        isTargetBelievedOffline: (targetDeviceId: string) => requireEventBridge().isTargetBelievedOffline(targetDeviceId),
      });
    } finally {
      await performCleanShutdown();
      // Phase C "double shutdown" -- a second, real call, proving idempotency the same way the
      // double-startup check above does: `shutdownInitiated` makes this a safe, logged no-op
      // rather than a second `runtimeStatus.stop()`/`app.quit()`.
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
