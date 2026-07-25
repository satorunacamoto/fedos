/**
 * Secure Runtime Alpha 5061-5160 ("FedOS Desktop Beta 0.1 Integration,
 * Release Candidate, and Acceptance Freeze Arc") — the ONE canonical Beta
 * Electron entry point. A NEW, ADDITIVE sibling main-process entry point,
 * never a modification of any prior `*_main.cts` — all seven remain
 * untouched, preserved as accepted test/harness entry points (Phase C: "do
 * not silently delete accepted test harnesses").
 *
 * WHAT THIS FILE CLOSES (Phase C release-blocking finding, see
 * `docs/secure_runtime_alpha_5061_5160_reconciliation_report.md`): no prior
 * Electron main composed BOTH the real production unlock chain
 * (`fedos_electron_unlock_main.cts`'s own pattern) AND a live
 * Presentation/Settings-application boundary over the SAME Runtime.
 *
 * -----------------------------------------------------------------------
 * Secure Runtime Alpha 5161-5240 ("Canonical Desktop Composition and Beta
 * Release-Blocker Closure Arc") — EXTENDS this file (never replaces it) to
 * also compose the already-accepted Navigation / Notification / Tray /
 * Badge / Background-Lifecycle / Device-Sync-Event layer into this SAME
 * canonical entry point, closing BLK-1 the immediately-prior Arc's own
 * reconciliation report disclosed:
 *
 *   packaged Electron main
 *     -> production activation authority (host attestation + pinned manifest)
 *     -> real WASM Master Seed generate/restore (NO dev seed double)
 *     -> the UNCHANGED FedosProfileInitializationCoordinator (now ALSO given
 *        the additive `deviceSyncSchedulerEnabled`/`deviceSyncAttemptFn`
 *        dependency, mirroring `archiveEnabled`'s own established pattern)
 *     -> Desktop Runtime starts EXACTLY ONCE
 *     -> FedosDesktopBetaApplicationAssembly composes ONE Shell/Boundary,
 *        ONE Navigation Registry, ONE Tray/Badge/Notification/Background-
 *        Lifecycle Coordinator, and ONE Device Sync Presentation Wiring over
 *        that SAME Runtime — plus the Alpha 4981-5060 Settings Application
 *        Coordinator's own startup application
 *     -> ready / locked application state
 *
 * ELECTRON-SIDE ADAPTERS REUSED VERBATIM (Alpha 4261-4340/4341-4420,
 * UNMODIFIED): `FedosElectronNotificationAdapter`, `FedosElectronTrayAdapter`,
 * `FedosElectronBadgeAdapter` — the SAME classes `fedos_electron_badge_main.cts`
 * already proves work; this file constructs exactly one of each and hands
 * them to the assembly as ports, mirroring that file's own established
 * "Electron only hosts UI" discipline. `FedosDeviceSyncEventBridge` is
 * constructed BEFORE `unlockProfile()`/`createProfile()` so its own
 * `wrapAttemptFn()` can be threaded into the Coordinator's Runtime-
 * construction config — its `listener` closure reads the module-level
 * `activeAssembly` (set only AFTER a successful unlock), the IDENTICAL
 * indirection technique `fedos_electron_badge_main.cts` already established
 * for its own `wiring`/`eventBridge` pair.
 *
 * DISCLOSED SCOPE BOUNDARY (Phase C, honest, restated from this Arc's own
 * reconciliation report): this file composes ONE window's own Navigation
 * controller and the Tray/Badge/Notification layer over it; it does not
 * (yet) build a full multi-window conversation UI — that remains
 * `fedos_electron_badge_main.cts`'s own more developed renderer surface.
 * Real, tested, and reachable through IPC here: Navigation Registry session
 * state, Tray dispatch, Badge refresh/mark-viewed, Background Lifecycle,
 * Device Sync operational status/start/stop — the SAME real objects a
 * richer renderer would consume.
 *
 * OWNERSHIP (mirrors `fedos_electron_unlock_main.cts`'s own discipline
 * exactly): at most ONE ready coordinator (`activeCoordinator`) + ONE
 * assembly (`activeAssembly`) exist at a time, constructed ONLY after a
 * successful create/unlock. `lock()` stops background sync + the ONE
 * Runtime (via `activeAssembly.shutdown()`), THEN drops both references.
 * Concurrent create/unlock/lock are serialized by `inFlight`.
 *
 * SECURITY: identical `contextIsolation`/`nodeIntegration`/`sandbox`/
 * `webSecurity` mandatory literals as every prior package's own main.cts.
 * The passphrase arrives ONLY through the closed `fedos-profile:create` /
 * `fedos-profile:unlock` commands (REUSED verbatim from
 * `fedos_electron_unlock_main.cts`, per Phase P "do not rename existing
 * accepted surfaces"), wrapped in the redacting `FedosProfileUnlockSecret`,
 * never logged/echoed/persisted.
 *
 * -----------------------------------------------------------------------
 * Secure Runtime Alpha 7321-7400 ("FedOS Desktop Production Feature
 * Reachability Arc") — closes the Release Readiness Review's own B-1/B-2/
 * B-3/B-7 findings: `secureRuntimeBundleConfig()` now enables the five
 * flags that were silently absent (`conversationCanonicalCryptoEnabled`/
 * `conversationDirectMessageDeliveryRoute`/`conversationTransportInboundEnabled`/
 * `conversationInvitationEnabled`/`archiveEnabled`), so a real, packaged,
 * unlocked profile can genuinely deliver an invitation and messages over
 * the real relay (never merely "sent-locally") and export/import a real
 * Archive; `requireShell()`/the new `requireBoundary()` no longer require
 * `AUTOTEST_MODE` — a real unlocked profile is now the ONLY precondition,
 * in ANY mode, closing the "AUTOTEST-only path" this Review named. Four
 * new commands (`create-conversation-invitation`/`search`/`archive`/
 * `safety-center-overview`) close B-2/B-7 for good — each a thin,
 * validated wrapper over an ALREADY-REAL `FedosDesktopApplicationShell`/
 * `FedosSafetyCenterController` method, never a new business-logic
 * implementation. `AUTOTEST_MODE` itself is UNCHANGED as a test-driving
 * convenience (offscreen window, the scripted "create"/"unlock"/
 * "acceptance" headless startup branches below) — it no longer gates
 * whether the acceptance vocabulary FUNCTIONS, only whether this file
 * drives itself through a scripted sequence at startup for automated
 * testing, exactly like a real user's own click-through would reach the
 * SAME handlers. No visual renderer screen is added for these four new
 * commands in this Arc (disclosed scope decision, see this Arc's own
 * execution specification) — consistent with this codebase's own
 * long-standing, repeatedly-restated choice to defer the full
 * conversation UI to a later Arc; "UI → Runtime routing" here means the
 * IPC main-process handler + preload bridge layer, the SAME layer every
 * existing `fedos-acceptance:*` command already used before this Arc.
 */

import { app, BrowserWindow, ipcMain, dialog, type IpcMainInvokeEvent } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { FedosElectronNotificationAdapter } from "./fedos_electron_notification_adapter.js";
import { FedosElectronTrayAdapter } from "./fedos_electron_tray_adapter.js";
import { FedosElectronBadgeAdapter, type FedosElectronBadgeTrayMenuItemLike } from "./fedos_electron_badge_adapter.js";

const APP_ID = "com.fedos.desktop.beta";
const APP_VERSION = "0.1.0-beta.1";

const DEV_TOOLS_ENABLED = process.env.FEDOS_ELECTRON_BETA_DEVTOOLS === "1";
const AUTOTEST_MODE = process.env.FEDOS_ELECTRON_BETA_AUTOTEST ?? "";
/** TEST-INJECTION ONLY — see `fedos_electron_unlock_main.cts`'s own identical note. Never read on a normal launch. */
const AUTOTEST_SECRET = process.env.FEDOS_BETA_AUTOTEST_SECRET ?? "";

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 1 (external audit
 * delta `6873d24f`): `fedos-acceptance:*` used to be registered
 * unconditionally in every launch mode, relying ONLY on each handler's own
 * `requireBoundary()` (real-unlocked-profile) check as its security
 * boundary — meaning a compromised/scripted renderer or a CDP session
 * attached to an ORDINARY packaged production launch could still reach
 * the entire acceptance vocabulary once a profile was unlocked, with no
 * visible product surface disclosing that this second bridge exists.
 * `ACCEPTANCE_MODE_ENABLED` is a SECOND, independent gate, additive to
 * (never a replacement for) `requireBoundary()`: the channel itself is
 * now only ever registered when this exact, closed value is present.
 * Checked against a closed literal (`=== "acceptance"`), never a truthy/
 * non-empty check, so a malformed or accidental non-empty
 * `FEDOS_ELECTRON_BETA_AUTOTEST` value (e.g. a typo, or a stray value
 * leaked from an unrelated tool) cannot enable it — only the exact,
 * deliberately-set test-harness value can. This env var is a real OS
 * process environment variable, set once at process spawn by whoever
 * launches Electron; no code running inside the sandboxed, isolated
 * Renderer world can read or influence it. A release build never sets
 * it (confirmed: `scripts/build_release.mjs`/`run_electron_builder_package_beta.mjs`
 * launch the packaged app with no such variable). The preload
 * (`fedos_electron_beta_preload.cts`) independently re-derives this SAME
 * check from its own `process.env` read — two independent enforcement
 * points (channel registration here, bridge exposure there), never one
 * hidden only in the page.
 */
const ACCEPTANCE_MODE_ENABLED = AUTOTEST_MODE === "acceptance";

const MAX_LABEL_CHARS = 128;
const MAX_SECRET_BYTES = 1024;
const MAX_ID_LENGTH = 512;
/** Secure Runtime Alpha 7001-7080 — same bound class as `MAX_LABEL_CHARS` above, sized for a real chat message body rather than a short label. */
const MAX_MESSAGE_BODY_CHARS = 8192;
/** Secure Runtime Alpha 7001-7080 — a real Device-pairing encoded request/approval string is larger than an id but still bounded (JSON envelope + one signature + one public key, never unbounded). */
const MAX_PAIRING_ENVELOPE_CHARS = 8192;
/** Secure Runtime Alpha 7321-7400 — a real Search query string, same bound class as a label, never a document body. */
const MAX_SEARCH_QUERY_CHARS = 256;
/** Secure Runtime Alpha 7321-7400 — a real filesystem path for Archive export/import, bounded but generous (Windows long-path aware). */
const MAX_ARCHIVE_PATH_CHARS = 4096;

/** Secure Runtime Alpha 5161-5240 — mirrors `fedos_electron_badge_main.cts`'s own identical policy value (`DEVICE_SYNC_ABANDONMENT_POLICY`). */
const DEVICE_SYNC_ABANDONMENT_POLICY = Object.freeze({ maxAttempts: 5, laterDelaySeconds: 30 });

function dataDir(): string {
  const override = process.env.FEDOS_ELECTRON_BETA_DATA_DIR;
  if (override !== undefined && override.length > 0) return path.join(override, "profile");
  return path.join(app.getPath("userData"), "profile");
}

function settingsFilePath(): string {
  const override = process.env.FEDOS_ELECTRON_BETA_DATA_DIR;
  const root = override !== undefined && override.length > 0 ? override : app.getPath("userData");
  return path.join(root, "settings.json");
}

function artifactDir(): string {
  const override = process.env.FEDOS_ELECTRON_BETA_ARTIFACT_DIR;
  if (override !== undefined && override.length > 0) return override;
  return path.join(__dirname, "..", "..", "fedos-core-rust", "pkg");
}

/** Secure Runtime Alpha 5161-5240 — the ONE Navigation session-state log for this process (mirrors every other `*.log` leaf's own explicit-path discipline). */
function navigationLogPath(): string {
  return path.join(dataDir(), "..", "navigation.log");
}

const rootDistDir = path.join(__dirname, "..", "..", "..", "dist");
function distUrl(...segments: string[]): string {
  return pathToFileURL(path.join(rootDistDir, ...segments)).href;
}

// ---------------------------------------------------------------------
// Local structural types — this package never statically imports root
// `src/`; every module below is loaded from the COMPILED `dist/` graph
// (`npm run build:beta-runtime`, root) via dynamic `import()`, identical
// technique to every prior Electron main in this package.
// ---------------------------------------------------------------------

interface UnlockSecretLike {
  clear(): void;
}
interface ReadyView {
  readonly displayLabel: string;
  readonly accountPublicIdentifier: string;
  readonly localDeviceId: string;
  readonly deviceTrustState: string;
}
interface StatusView {
  readonly lifecycleState: string;
  readonly presence: string;
  readonly displayLabel: string | null;
  readonly accountPublicIdentifier: string | null;
  readonly localDeviceId: string | null;
  readonly runtimeRunning: boolean;
}
type CoordResult<T> = { readonly outcome: "ok"; readonly value: T } | { readonly outcome: string; readonly reason: string };
/**
 * Secure Runtime Alpha 6681-6760 — the narrow, READ-ONLY shape this Arc's
 * own AUTOTEST diagnostic needs from the real running Runtime this SAME
 * Coordinator already constructs. Every accessor here already exists on
 * `FedosConversationRuntime` (`directRatchet()`/`peerCapability()`/
 * `identityTransition()`/`deletionRequest()`, all real, all wired by the
 * immediately-prior Alpha 6521-6600 Arc through this exact Coordinator) —
 * this type adds no new capability, it only lets the diagnostic report
 * whether each is reachable (non-null) on THIS packaged process's own
 * Runtime, proving the unified configuration graph claim end to end.
 */
interface RuntimeConversationLike {
  directRatchet(): unknown;
  peerCapability(): unknown;
  identityTransition(): unknown;
  deletionRequest(): unknown;
}
interface RunningRuntimeLike {
  conversationRuntime(): RuntimeConversationLike;
  deviceTrust(): unknown;
}
interface CoordinatorLike {
  detectProfileState(): CoordResult<StatusView>;
  createProfile(input: { readonly displayLabel: string }, secret: UnlockSecretLike): Promise<CoordResult<ReadyView>>;
  unlockProfile(secret: UnlockSecretLike): Promise<CoordResult<ReadyView>>;
  lock(): Promise<CoordResult<{ readonly lifecycleState: string }>>;
  status(): StatusView;
  runningRuntime(): RunningRuntimeLike | null;
}
interface MasterSeedAuthorityLike {
  clear(): Promise<void>;
}
type Activation =
  | { readonly outcome: "activated"; readonly masterSeedAuthority: MasterSeedAuthorityLike; readonly appId: string }
  | { readonly outcome: "blocked"; readonly decision: string; readonly reason: string };
interface PathsLike {
  readonly profileDescriptorFile: string;
  readonly sealedMasterSeedFile: string;
}
interface AssemblyEffectiveStateLike {
  readonly [key: string]: unknown;
}
interface NavigationRegistryLike {
  readonly recentConversationIds: readonly string[];
  readonly lastOpenedConversationId: string | null;
  createWindow(windowId: string): unknown;
  disposeWindow(windowId: string): boolean;
  recordConversationOpened(conversationId: string): void;
  sessionState(): unknown;
}
interface TrayCoordinatorLike {
  dispatch(candidate: unknown): Promise<{ readonly action: string; readonly outcome: string; readonly [key: string]: unknown }>;
}
interface BadgeCoordinatorLike {
  refresh(): Promise<{ readonly state: string; readonly count: number; readonly reason: string }>;
  readonly lastView: { readonly state: string; readonly count: number; readonly reason: string } | null;
  readonly renderCount: number;
}
interface BackgroundLifecycleLike {
  windowOpened(): string;
  windowClosed(): string;
  requestShutdown(): string;
  confirmShutdown(): string;
  canRunBackgroundSync(): boolean;
  canDeliverBackgroundNotifications(): boolean;
}
interface DeviceSyncWiringLike {
  handleEvent(event: unknown): Promise<void>;
  readonly currentTrayStatus: string;
}
/**
 * Secure Runtime Alpha 6681-6760 — narrow, safe-only Shell surface for the
 * AUTOTEST diagnostic; never exposes a raw Runtime/secret/handle.
 *
 * Secure Runtime Alpha 7001-7080 — extended (never redesigned) with the
 * closed, ACCEPTANCE-MODE-ONLY command vocabulary Phase C names: every
 * method below already exists, verbatim, on the real
 * `FedosDesktopApplicationShell` (`createDirectConversation`/`sendMessage`/
 * `listMessages`/`readMessage`/`directRatchetStatus`/the six Device
 * Pairing methods are all pre-existing and unchanged by this Arc;
 * `activateDirectConversation`/`establishDirectRatchetSession` are the two
 * new, narrow wrapper methods this Arc added directly to the Shell — see
 * that file's own Alpha 7001-7080 doc comments). This interface only
 * narrows the TYPE this file depends on; it grants no new capability
 * beyond what the Shell itself already implements.
 */
interface ShellDiagnosticLike {
  productionCryptoStatus(): { readonly outcome: string; readonly [key: string]: unknown };
  createDirectConversation(command: unknown): { readonly outcome: string; readonly [key: string]: unknown };
  activateDirectConversation(conversationId: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  devicePairingCreate(deviceId: string, expectedAccountRef: unknown): { readonly outcome: string; readonly [key: string]: unknown };
  devicePairingInspect(encodedRequest: string): { readonly outcome: string; readonly [key: string]: unknown };
  devicePairingApprove(encodedRequest: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  devicePairingComplete(pairingId: string, encodedApproval: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  establishDirectRatchetSession(conversationId: string, remoteDeviceRef: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  sendMessage(conversationId: string, sender: unknown, body: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  listMessages(conversationId: string): { readonly outcome: string; readonly [key: string]: unknown };
  readMessage(conversationId: string, messageId: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  directRatchetStatus(conversationId: string, remoteDeviceRef: string): { readonly outcome: string; readonly [key: string]: unknown };
  /** Secure Runtime Alpha 7321-7400 — narrows `FedosDesktopApplicationShell.createConversationInvitation()` (Alpha 7081-7160, unmodified); no new business logic. */
  createConversationInvitation(invitee: unknown, expiresInMs?: number): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  /** Secure Runtime Alpha 7321-7400 — narrows `FedosDesktopApplicationShell.search()` (Alpha 3081-3160, unmodified); synchronous, never a promise. */
  search(query: string): { readonly outcome: string; readonly [key: string]: unknown };
  /** Secure Runtime Alpha 7321-7400 — narrows `FedosDesktopApplicationShell.archive()` (Alpha 3081-3160, unmodified). */
  archive(command: unknown): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  /** Secure Runtime Alpha 8041-8120 — narrows four already-real, unmodified Shell methods (`devicesList`/`deviceDetail`/`deviceRevoke`/`deviceSyncStatus`) this file never called before this Arc. */
  devicesList(): { readonly outcome: string; readonly [key: string]: unknown };
  deviceDetail(deviceId: string): { readonly outcome: string; readonly [key: string]: unknown };
  deviceRevoke(deviceId: string, devicePublicKeyHex: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  deviceSyncStatus(): { readonly outcome: string; readonly [key: string]: unknown };
  /** Secure Runtime Alpha 8041-8120 — narrows `peerCapabilityListObserved()`/`identityTransitionStatus()`, used ONLY to reconcile an Identity Transition inbox item's own `transitionId` back to the `(peerAccountRef, peerDeviceRef)` pair `identityTransitionOpen()`/`Accept()`/`Reject()`/`Defer()` require as input — the Shell/Controller layer has no listing call that returns that pair directly (see this Arc's own Phase A reconciliation report); this main-process-only cross-reference invents no new identity-transition business rule, it only composes two already-public read-only calls, mirroring `FedosSafetyCenterController`'s own established cross-domain reconciliation style. */
  peerCapabilityListObserved(): { readonly outcome: string; readonly [key: string]: unknown };
  identityTransitionStatus(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): { readonly outcome: string; readonly [key: string]: unknown };
}
/** Secure Runtime Alpha 7321-7400 — narrows `FedosSafetyCenterController` (`src/desktop/presentation/safety_center/`, unmodified). Secure Runtime Alpha 8041-8120 — widened (never redesigned) to narrow the REST of `FedosDesktopConversationUiPresentationBoundary`'s own already-real ViewModels/Controllers (`src/desktop/presentation/`, unmodified) this file never read before this Arc: conversation list/detail, message list/compose, membership/invitations, search, archive, device inventory, Identity Transition, Signed Deletion. Every accessor below already exists on the real class; this interface only narrows the TYPE, granting no new capability. */
interface BoundaryLike {
  readonly safetyCenter: {
    refreshOverview(ratchetPairs?: readonly unknown[]): Promise<void>;
    readonly overviewState: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly conversationList: {
    load(filter?: unknown): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly conversationDetail: {
    load(conversationId: string): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly messageList: {
    load(conversationId: string): Promise<unknown>;
    reveal(messageId: string): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly composeMessage: {
    setBody(body: string): void;
    send(conversationId: string, sender: unknown): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly membership: {
    load(conversationId: string): Promise<unknown>;
    loadInvitations(conversationId: string, issuer: unknown): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
    readonly invitations: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly search: {
    setQuery(query: string): void;
    search(): Promise<unknown>;
  };
  readonly archive: {
    inspect(sourcePath: string): Promise<unknown>;
    export(request: unknown): Promise<unknown>;
    preflightRestore(request: unknown): Promise<unknown>;
    restore(request: unknown): Promise<unknown>;
    workflowWarnings(operation: "inspect" | "preflightRestore" | "export" | "restore"): readonly { readonly [key: string]: unknown }[];
  };
  readonly deviceInventory: {
    refresh(): Promise<unknown>;
    selectDevice(deviceId: string): Promise<unknown>;
  };
  readonly identityTransitions: {
    refreshInbox(limit: number, offset: number): Promise<void>;
    readonly inboxState: { readonly status: string; readonly [key: string]: unknown };
    openTransition(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    readonly detailState: { readonly status: string; readonly [key: string]: unknown };
    acceptSelected(): Promise<void>;
    rejectSelected(): Promise<void>;
    deferSelected(): Promise<void>;
    // Secure Runtime Alpha 8121-8200 -- Security Finding 3: the real, exact-id authorization boundary.
    accept(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    reject(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    defer(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    recordManualVerification(method: unknown, verifiedAt: number, noteCode: unknown): Promise<void>;
    readonly manualVerificationState: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly deletionRequests: {
    openReceivedInbox(): Promise<void>;
    readonly inboxState: { readonly status: string; readonly [key: string]: unknown };
    openReceivedRequest(requestId: string, policy: string): Promise<void>;
    readonly consentDetailState: { readonly status: string; readonly [key: string]: unknown };
    approveSelected(): Promise<void>;
    rejectSelected(): Promise<void>;
    // Secure Runtime Alpha 8121-8200 -- Security Finding 3: the real, exact-id authorization boundary.
    approve(requestId: string): Promise<void>;
    reject(requestId: string): Promise<void>;
  };
}
interface AssemblyLike {
  readonly shell: ShellDiagnosticLike;
  /** Secure Runtime Alpha 7321-7400 — `FedosDesktopBetaApplicationAssembly` (`src/desktop/beta/fedos_desktop_beta_application_assembly.ts`, unmodified) already exposes this getter; this file simply never read it before now. */
  readonly boundary: BoundaryLike;
  readonly settingsCoordinator: {
    previewPlan(candidate: unknown): unknown;
    apply(candidate: unknown): Promise<unknown>;
    effectiveState(): AssemblyEffectiveStateLike | null;
  };
  readonly notificationCoordinator: { notify(candidate: unknown): Promise<unknown> };
  readonly navigationRegistry: NavigationRegistryLike;
  readonly trayCoordinator: TrayCoordinatorLike;
  readonly badgeCoordinator: BadgeCoordinatorLike;
  readonly backgroundLifecycle: BackgroundLifecycleLike;
  readonly deviceSyncPresentationWiring: DeviceSyncWiringLike;
  shutdown(): Promise<void>;
}
type AssemblyResult = { readonly outcome: "ok"; readonly value: AssemblyLike } | { readonly outcome: string; readonly reason: string };
interface SettingsControllerLike {
  load(): { readonly outcome: string; readonly value?: { readonly relays: readonly string[] } };
}
/** Secure Runtime Alpha 6761-6840 -- the real, production `FedosRelay` implementation (`WebSocketRelay`, Node 22+'s own global `WebSocket`, no new dependency) and its one real socket factory. Never `NullRelay` (test-only, no real network I/O) in this canonical packaged entry point. */
interface RelayLike {
  readonly url: string;
  /** Secure Runtime Alpha 8121-8200 -- `WebSocketRelay.isConnected()` (Alpha 215, unmodified) was already real and public; this file simply never read it before this Arc. A PURE, SYNCHRONOUS accessor -- no new capability. */
  isConnected(): boolean;
}
interface NotificationPortLike {
  status(): "available" | "unavailable";
  notify(view: unknown): Promise<{ readonly delivered: boolean; readonly reason: string }>;
}
interface BadgePortLike {
  status(): "available" | "unavailable";
  render(view: unknown): void;
}
interface TrayStatusSinkLike {
  setTooltip(text: string): void;
}
interface ParticipantRefLike {
  readonly authority: "nostr";
  readonly publicIdentifier: string;
  readonly identityId: null;
}
interface DeviceSyncEventBridgeLike {
  wrapAttemptFn(real?: (request: unknown) => Promise<unknown>): (request: unknown) => Promise<unknown>;
}

interface RootModules {
  readonly createElectronMainHostAttestation: (identity: { appId: string; appVersion: string }) => unknown;
  readonly activateFedosProductionProfileMasterSeed: (request: {
    attestation: unknown;
    artifactDir?: string;
    importGlue?: (specifier: string) => Promise<unknown>;
  }) => Promise<Activation>;
  readonly NostrSigningAuthority: new (handleSource: unknown) => unknown;
  readonly planFedosLocalProfilePaths: (root: string) => PathsLike | null;
  readonly ensureFedosLocalProfileDirectories: (paths: PathsLike) => boolean;
  readonly ProfilePersistence: new (file: string) => unknown;
  readonly SealedSeedPersistence: new (file: string) => unknown;
  readonly Coordinator: new (deps: Record<string, unknown>) => CoordinatorLike;
  readonly UnlockSecret: new (bytes: Uint8Array) => UnlockSecretLike;
  readonly createFileBackedSettingsController: (filePath: string) => SettingsControllerLike;
  readonly BetaApplicationAssembly: {
    start(deps: {
      coordinator: CoordinatorLike;
      settingsController: SettingsControllerLike;
      notificationPort: NotificationPortLike;
      badgePort: BadgePortLike;
      trayStatusSink?: TrayStatusSinkLike;
      viewerParticipant: ParticipantRefLike;
      navigationLogPath: string;
    }): AssemblyResult;
  };
  readonly betaCapabilityManifestV1: () => unknown;
  readonly betaReleaseConfigurationV1: () => unknown;
  readonly betaLimitationsV1: () => unknown;
  readonly DeviceSyncEventBridge: new (deps: { listener: (event: unknown) => void; abandonmentMaxAttempts?: number }) => DeviceSyncEventBridgeLike;
  readonly fedosDesktopTrayMenuItems: (disabled?: ReadonlySet<string>) => readonly FedosElectronBadgeTrayMenuItemLike[];
  readonly WebSocketRelay: new (url: string, factory: (url: string) => Promise<unknown>) => RelayLike;
  readonly createNodeWebSocketRelaySocketFactory: () => (url: string) => Promise<unknown>;
}

async function loadRootModules(): Promise<RootModules> {
  const attestation = (await import(distUrl("desktop", "production_activation", "fedos_production_desktop_host_attestation.js"))) as {
    createElectronMainHostAttestation: RootModules["createElectronMainHostAttestation"];
  };
  const activation = (await import(distUrl("desktop", "production_activation", "fedos_production_profile_activation.js"))) as {
    activateFedosProductionProfileMasterSeed: RootModules["activateFedosProductionProfileMasterSeed"];
  };
  const signer = (await import(distUrl("desktop", "production_activation", "fedos_production_nostr_signing_authority.js"))) as {
    FedosProductionNostrSigningAuthority: RootModules["NostrSigningAuthority"];
  };
  const paths = (await import(distUrl("desktop", "onboarding", "fedos_local_profile_paths.js"))) as {
    planFedosLocalProfilePaths: RootModules["planFedosLocalProfilePaths"];
    ensureFedosLocalProfileDirectories: RootModules["ensureFedosLocalProfileDirectories"];
  };
  const profilePersistence = (await import(distUrl("desktop", "onboarding", "fedos_local_profile_persistence.js"))) as {
    FileFedosLocalProfilePersistence: RootModules["ProfilePersistence"];
  };
  const sealedPersistence = (await import(distUrl("runtime", "master_seed", "fedos_sealed_master_seed_envelope_persistence.js"))) as {
    FileFedosSealedMasterSeedEnvelopePersistence: RootModules["SealedSeedPersistence"];
  };
  const coordinator = (await import(distUrl("desktop", "onboarding", "fedos_profile_initialization_coordinator.js"))) as {
    FedosProfileInitializationCoordinator: RootModules["Coordinator"];
  };
  const secret = (await import(distUrl("desktop", "onboarding", "fedos_profile_unlock_secret.js"))) as {
    FedosProfileUnlockSecret: RootModules["UnlockSecret"];
  };
  const settingsController = (await import(distUrl("desktop", "settings", "fedos_desktop_settings_controller.js"))) as {
    createFileBackedFedosDesktopSettingsController: RootModules["createFileBackedSettingsController"];
  };
  const assembly = (await import(distUrl("desktop", "beta", "fedos_desktop_beta_application_assembly.js"))) as {
    FedosDesktopBetaApplicationAssembly: RootModules["BetaApplicationAssembly"];
  };
  const capabilityManifest = (await import(distUrl("desktop", "beta", "fedos_desktop_beta_capability_manifest.js"))) as {
    fedosDesktopBetaCapabilityManifestV1: RootModules["betaCapabilityManifestV1"];
  };
  const releaseConfiguration = (await import(distUrl("desktop", "beta", "fedos_desktop_beta_release_configuration.js"))) as {
    fedosDesktopBetaReleaseConfigurationV1: RootModules["betaReleaseConfigurationV1"];
  };
  const limitations = (await import(distUrl("desktop", "beta", "fedos_desktop_beta_limitations.js"))) as {
    fedosDesktopBetaLimitationsV1: RootModules["betaLimitationsV1"];
  };
  const deviceSyncEventBridgeModule = (await import(distUrl("device", "sync_events", "fedos_device_sync_event_bridge.js"))) as {
    FedosDeviceSyncEventBridge: RootModules["DeviceSyncEventBridge"];
  };
  const websocketRelay = (await import(distUrl("desktop", "websocket_relay.js"))) as {
    WebSocketRelay: RootModules["WebSocketRelay"];
  };
  const websocketRelaySocketFactory = (await import(distUrl("desktop", "node_websocket_relay_socket_factory.js"))) as {
    createNodeWebSocketRelaySocketFactory: RootModules["createNodeWebSocketRelaySocketFactory"];
  };
  const trayTypes = (await import(distUrl("desktop", "tray", "fedos_desktop_tray_types.js"))) as {
    fedosDesktopTrayMenuItems: RootModules["fedosDesktopTrayMenuItems"];
  };
  return {
    createElectronMainHostAttestation: attestation.createElectronMainHostAttestation,
    activateFedosProductionProfileMasterSeed: activation.activateFedosProductionProfileMasterSeed,
    NostrSigningAuthority: signer.FedosProductionNostrSigningAuthority,
    planFedosLocalProfilePaths: paths.planFedosLocalProfilePaths,
    ensureFedosLocalProfileDirectories: paths.ensureFedosLocalProfileDirectories,
    ProfilePersistence: profilePersistence.FileFedosLocalProfilePersistence,
    SealedSeedPersistence: sealedPersistence.FileFedosSealedMasterSeedEnvelopePersistence,
    Coordinator: coordinator.FedosProfileInitializationCoordinator,
    UnlockSecret: secret.FedosProfileUnlockSecret,
    createFileBackedSettingsController: settingsController.createFileBackedFedosDesktopSettingsController,
    BetaApplicationAssembly: assembly.FedosDesktopBetaApplicationAssembly,
    betaCapabilityManifestV1: capabilityManifest.fedosDesktopBetaCapabilityManifestV1,
    betaReleaseConfigurationV1: releaseConfiguration.fedosDesktopBetaReleaseConfigurationV1,
    betaLimitationsV1: limitations.fedosDesktopBetaLimitationsV1,
    DeviceSyncEventBridge: deviceSyncEventBridgeModule.FedosDeviceSyncEventBridge,
    fedosDesktopTrayMenuItems: trayTypes.fedosDesktopTrayMenuItems,
    WebSocketRelay: websocketRelay.WebSocketRelay,
    createNodeWebSocketRelaySocketFactory: websocketRelaySocketFactory.createNodeWebSocketRelaySocketFactory,
  };
}

// ---------------------------------------------------------------------
// Ownership state — mirrors fedos_electron_unlock_main.cts /
// fedos_electron_badge_main.cts exactly. Exactly ONE of each real
// Electron-side adapter for the lifetime of this process.
// ---------------------------------------------------------------------

let modules: RootModules | null = null;
let mainWindow: BrowserWindow | null = null;
let activeCoordinator: CoordinatorLike | null = null;
let activeAssembly: AssemblyLike | null = null;
/** Secure Runtime Alpha 8041-8120 — the local viewer's own participant reference, set once alongside `activeAssembly` on a successful create/unlock (SAME value `startAssembly()` already derives for `viewerParticipant` below), never re-derived elsewhere. Required by `sendMessage()`/`issuedInvitations()`, which take the LOCAL sender/issuer explicitly rather than reading it from a session. */
let activeViewerParticipant: ParticipantRefLike | null = null;
/** Secure Runtime Alpha 8121-8200 — the real, currently-configured Relay instances this Runtime's own Coordinator constructed (`secureRuntimeBundleConfig()`, unmodified), kept here ONLY so the ordinary UI can honestly report per-Relay connectivity (Phase K "show offline/retry state") — never a second Relay set, never a new connection, just a read-only reference to what already exists. Empty until a real relay is configured and a profile is unlocked. */
let activeRelays: readonly RelayLike[] = [];
const notificationAdapter = new FedosElectronNotificationAdapter();
const trayAdapter = new FedosElectronTrayAdapter();
let badgeAdapter: FedosElectronBadgeAdapter | null = null;
let inFlight = false;
let shutdownInitiated = false;
let trayCreated = false;

function requireModules(): RootModules {
  if (modules === null) throw new Error("fedos-beta: root modules not loaded");
  return modules;
}

function baseTrayMenuItems(): readonly FedosElectronBadgeTrayMenuItemLike[] {
  return requireModules().fedosDesktopTrayMenuItems();
}

/** Forwards a clicked Tray action's own string to `TrayCoordinator.dispatch()`, then refreshes the badge (mirrors `fedos_electron_badge_main.cts`'s own `handleTrayAction`). */
async function handleTrayAction(candidate: unknown): Promise<unknown> {
  if (activeAssembly === null) return { action: "rejected", outcome: "unavailable", reason: "no profile is unlocked" };
  const outcome = await activeAssembly.trayCoordinator.dispatch(candidate);
  if (outcome.action === "exit") {
    await performCleanShutdown();
  } else {
    void activeAssembly.badgeCoordinator.refresh();
  }
  return outcome;
}

function onTrayMenuAction(action: string): void {
  void handleTrayAction({ action });
}

function refreshTrayMenu(): void {
  if (!trayCreated) return;
  trayAdapter.render(baseTrayMenuItems(), onTrayMenuAction);
}

/**
 * Secure Runtime Alpha 5161-5240 — builds a fresh, independent Coordinator
 * (mirrors `fedos_electron_unlock_main.cts`'s own `buildFreshCoordinator()`
 * exactly), NOW ALSO constructing the ONE `FedosDeviceSyncEventBridge` for
 * this attempt and threading its `wrapAttemptFn()` into the Coordinator's
 * own additive `deviceSyncSchedulerEnabled`/`deviceSyncAttemptFn`
 * dependencies (Phase E) — so the Runtime this Coordinator starts during
 * `createProfile()`/`unlockProfile()` has the Scheduler enabled from the
 * very first construction, never a second, later Runtime just to turn it on.
 *
 * Secure Runtime Alpha 6761-6840 — ALSO reads the SAME persisted Settings
 * descriptor `startAssembly()` already loads later (a second, independent,
 * stateless `.load()` of the same file-backed store — never a second
 * owner: neither call holds any state, both just re-read the one durable
 * file), BEFORE constructing the Coordinator, so a genuinely user-
 * configured `relays` list can be threaded into Runtime construction
 * itself (the ONLY point `conversationTransportRelays` can ever be set —
 * `relays`/`defaultRelay` are classified `runtime-restart` by this
 * repository's own `fedos_settings_application_class.ts`, exactly because
 * `FedosConversationRelaySet` is immutable after construction). When
 * `relays.length > 0`, real `WebSocketRelay` instances (Node's own global
 * `WebSocket`, no mock, no `NullRelay`) are constructed for each
 * configured URL and `privateTransportEnabled`/`directRatchetEnabled`/
 * `peerCapabilityEnabled`/`identityTransitionEnabled`/`deletionRequestEnabled`
 * are enabled — the SAME conservative, never-auto-accept policy values
 * `test/secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
 * already establishes, reused verbatim, never a new policy. When NO relay
 * is configured (the honest default on every fresh profile), every one of
 * these stays disabled — never a fabricated placeholder relay, matching
 * this Arc's own "no fake Relay configuration" rule; the user must
 * genuinely configure a relay via Settings, then relaunch (the existing,
 * accepted `runtime-restart` UX this repository already reports), before
 * these subsystems activate.
 */
async function buildFreshCoordinator(): Promise<{ coordinator: CoordinatorLike; masterSeedAuthority: MasterSeedAuthorityLike; eventBridge: DeviceSyncEventBridgeLike } | null> {
  const m = requireModules();
  const attestation = m.createElectronMainHostAttestation({ appId: APP_ID, appVersion: APP_VERSION });
  const activation = await m.activateFedosProductionProfileMasterSeed({
    attestation,
    artifactDir: artifactDir(),
    importGlue: (specifier: string) => import(pathToFileURL(specifier).href),
  });
  if (activation.outcome !== "activated") {
    console.error(`fedos-beta: production activation blocked (${activation.decision})`);
    return null;
  }
  const masterSeedAuthority = activation.masterSeedAuthority;
  const signer = new m.NostrSigningAuthority(masterSeedAuthority);
  const paths = m.planFedosLocalProfilePaths(dataDir());
  if (paths === null) return null;
  m.ensureFedosLocalProfileDirectories(paths);
  // The event bridge's own listener reads `activeAssembly` (set only AFTER a successful
  // create/unlock + startAssembly()) -- identical indirection to `fedos_electron_badge_main.cts`'s
  // own `wiring`/`eventBridge` pair, since the Wiring itself cannot exist before the assembly does.
  const eventBridge = new m.DeviceSyncEventBridge({
    listener: (event) => {
      if (activeAssembly !== null) void activeAssembly.deviceSyncPresentationWiring.handleEvent(event);
    },
    abandonmentMaxAttempts: DEVICE_SYNC_ABANDONMENT_POLICY.maxAttempts,
  });
  const secureRuntimeBundle = secureRuntimeBundleConfig(m, signer);
  const coordinator = new m.Coordinator({
    paths,
    profilePersistence: new m.ProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new m.SealedSeedPersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority: signer,
    deviceSyncSchedulerEnabled: true,
    deviceSyncAbandonmentPolicy: DEVICE_SYNC_ABANDONMENT_POLICY,
    deviceSyncAttemptFn: eventBridge.wrapAttemptFn(),
    ...secureRuntimeBundle,
  });
  return { coordinator, masterSeedAuthority, eventBridge };
}

/**
 * Secure Runtime Alpha 6761-6840 — reads the persisted Settings descriptor's
 * own `relays` (real, user-configured relay URLs only) and returns the
 * additive Coordinator dependency fields that activate Direct Ratchet /
 * Peer Capability / Identity Transition / Deletion Request, or an empty
 * object when no relay is configured (fail closed, never fabricated).
 * Pure with respect to Runtime/Electron state; its only side effect is one
 * stateless settings-file read.
 */
function secureRuntimeBundleConfig(m: RootModules, signer: unknown): Record<string, unknown> {
  const settingsController = m.createFileBackedSettingsController(settingsFilePath());
  const loaded = settingsController.load();
  const relayUrls = loaded.outcome === "ok" && loaded.value !== undefined ? loaded.value.relays : [];
  if (relayUrls.length === 0) {
    console.log("fedos-beta: no relay configured in Settings -- Direct Ratchet/Peer Capability/Identity Transition/Deletion Request stay honestly disabled until the user configures one and relaunches.");
    return {};
  }
  const socketFactory = m.createNodeWebSocketRelaySocketFactory();
  const relays = relayUrls.map((url) => new m.WebSocketRelay(url, socketFactory));
  // Secure Runtime Alpha 8121-8200 -- captured here (the ONE real
  // construction site) so the ordinary UI can honestly report per-Relay
  // connectivity later. Safe even though this function is also called by
  // the throwaway status-check path (`handleStatus()`'s own
  // `buildFreshCoordinator()` call, which never starts a real Runtime and
  // is always discarded): by the time any `fedos-app:*` command reads
  // `activeRelays` (gated on a real unlocked profile), a real
  // `handleCreate()`/`handleUnlock()` success is guaranteed to have run
  // this same line last, since each attempt calls this function exactly
  // once and only a successful attempt ever sets `activeAssembly`.
  activeRelays = relays;
  // Secure Runtime Alpha 7001-7080 -- see `FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`'s
  // own doc comment. TEST-INJECTION ONLY, mirrors `AUTOTEST_SECRET`'s own
  // discipline exactly -- unset on every ordinary launch, so `sendMessage()`
  // keeps using the legacy static route for every real user by default.
  const messageDeliveryRemoteDeviceRef = process.env.FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF;
  return {
    privateTransportEnabled: true,
    conversationTransportRelays: relays,
    conversationTransportSigningAuthority: signer,
    directRatchetEnabled: true,
    directRatchetMessageDeliveryRemoteDeviceRef: messageDeliveryRemoteDeviceRef !== undefined && messageDeliveryRemoteDeviceRef.length > 0 ? messageDeliveryRemoteDeviceRef : undefined,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
    deletionRequestEnabled: true,
    deletionRequestResolveLocalPolicy: () => "always-review",
    // Secure Runtime Alpha 7321-7400 -- these five flags already existed
    // on `FedosDesktopRuntimeConfig`/`FedosProfileInitializationDependencies`
    // (Alpha 7161-7240/7081-7160/1691-1760) and are already proven real,
    // no-substitution production-reachable by that Arc's own vertical
    // slice tests -- this canonical packaged entry point simply never
    // enabled them (Release Readiness Review, B-1/B-2/B-7). Enabling them
    // here is the direct fix: a real, packaged, unlocked profile can now
    // genuinely send an invitation, have it delivered over the real relay,
    // exchange real encrypted messages via the standard NIP-17 route, and
    // export/import a real Archive -- never merely "sent-locally".
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationInvitationEnabled: true,
    archiveEnabled: true,
    // Secure Runtime Alpha 7321-7400 -- TEST-INJECTION ONLY, mirrors
    // `messageDeliveryRemoteDeviceRef`'s own identical discipline exactly:
    // unset on every ordinary launch, so a real user gets the Coordinator's
    // own real default production cadence. Lets this Arc's own real
    // packaged vertical slice test exchange several real messages within a
    // sane test time budget without waiting on that production cadence.
    conversationTransportIntervalMs: (() => {
      const raw = process.env.FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS;
      const parsed = raw !== undefined ? Number(raw) : NaN;
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    })(),
  };
}

/** Phase C/D/E — composes the ONE Shell/Boundary/Navigation/Tray/Badge/Background/DeviceSyncWiring + Settings Application Coordinator over the just-unlocked Runtime. Never called before a successful create/unlock. */
function startAssembly(coordinator: CoordinatorLike, readyView: ReadyView): AssemblyLike | null {
  const m = requireModules();
  const settingsController = m.createFileBackedSettingsController(settingsFilePath());
  badgeAdapter = new FedosElectronBadgeAdapter(trayAdapter, () => BrowserWindow.getAllWindows(), baseTrayMenuItems, onTrayMenuAction);
  const viewerParticipant: ParticipantRefLike = { authority: "nostr", publicIdentifier: readyView.accountPublicIdentifier, identityId: null };
  const result = m.BetaApplicationAssembly.start({
    coordinator,
    settingsController,
    notificationPort: notificationAdapter,
    badgePort: badgeAdapter,
    trayStatusSink: trayAdapter,
    viewerParticipant,
    navigationLogPath: navigationLogPath(),
  });
  if (result.outcome !== "ok" || !("value" in result)) {
    console.error(`fedos-beta: application assembly failed to start (${result.outcome})`);
    return null;
  }
  return result.value;
}

// ---------------------------------------------------------------------
// Payload validation — reused verbatim from fedos_electron_unlock_main.cts.
// ---------------------------------------------------------------------

function validatedLabel(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const keys = Object.keys(payload);
  if (!keys.every((k) => k === "label" || k === "secret")) return null;
  const label = (payload as { label?: unknown }).label;
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LABEL_CHARS) return null;
  return trimmed;
}

function validatedSecretBytes(payload: unknown, allowedKeys: readonly string[]): Uint8Array | null {
  if (typeof payload !== "object" || payload === null) return null;
  const keys = Object.keys(payload);
  if (!keys.every((k) => allowedKeys.includes(k))) return null;
  const secret = (payload as { secret?: unknown }).secret;
  if (typeof secret !== "string" || secret.length === 0) return null;
  const bytes = new TextEncoder().encode(secret);
  if (bytes.length > MAX_SECRET_BYTES) {
    bytes.fill(0);
    return null;
  }
  return bytes;
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

// ---------------------------------------------------------------------
// Command handlers.
// ---------------------------------------------------------------------

function readyResult(view: ReadyView) {
  return {
    outcome: "ok" as const,
    ready: {
      displayLabel: view.displayLabel,
      accountPublicIdentifier: view.accountPublicIdentifier,
      localDeviceId: view.localDeviceId,
      deviceTrustState: view.deviceTrustState,
    },
  };
}

async function handleStatus(): Promise<StatusView> {
  if (activeCoordinator !== null) return sanitizeStatus(activeCoordinator.status());
  const built = await buildFreshCoordinator();
  if (built === null) return absentStatus();
  const detect = built.coordinator.detectProfileState();
  await built.masterSeedAuthority.clear();
  if (detect.outcome === "ok" && "value" in detect) return sanitizeStatus(detect.value);
  return absentStatus();
}

function absentStatus(): StatusView {
  return { lifecycleState: "absent", presence: "absent", displayLabel: null, accountPublicIdentifier: null, localDeviceId: null, runtimeRunning: false };
}

function sanitizeStatus(view: StatusView): StatusView {
  return {
    lifecycleState: view.lifecycleState,
    presence: view.presence,
    displayLabel: view.displayLabel,
    accountPublicIdentifier: view.accountPublicIdentifier,
    localDeviceId: view.localDeviceId,
    runtimeRunning: view.runtimeRunning,
  };
}

/** Secure Runtime Alpha 5161-5240 — registers the ONE existing Beta window with the fresh Navigation Registry, creates the ONE shared Tray icon (idempotent), and renders its initial menu + badge. Called exactly once per successful create/unlock. */
async function attachPresentationLayer(assembly: AssemblyLike): Promise<void> {
  if (mainWindow !== null) {
    assembly.navigationRegistry.createWindow(String(mainWindow.id));
  }
  if (!trayCreated) {
    trayAdapter.create("FedOS Desktop Beta");
    trayCreated = true;
  }
  refreshTrayMenu();
  await assembly.badgeCoordinator.refresh();
}

async function handleCreate(payload: unknown) {
  if (inFlight) return { outcome: "busy", reason: "another command is in progress" };
  if (activeCoordinator !== null) return { outcome: "already-exists", reason: "a profile is already active" };
  const label = validatedLabel(payload);
  const secretBytes = validatedSecretBytes(payload, ["label", "secret"]);
  if (label === null || secretBytes === null) {
    if (secretBytes !== null) secretBytes.fill(0);
    return { outcome: "invalid-input", reason: "malformed create request" };
  }
  inFlight = true;
  try {
    const built = await buildFreshCoordinator();
    if (built === null) {
      secretBytes.fill(0);
      return { outcome: "seed-unavailable", reason: "production crypto unavailable" };
    }
    const secret = new (requireModules().UnlockSecret)(secretBytes);
    const result = await built.coordinator.createProfile({ displayLabel: label }, secret);
    if (result.outcome === "ok" && "value" in result) {
      const assembly = startAssembly(built.coordinator, result.value);
      if (assembly === null) {
        await built.coordinator.lock();
        return { outcome: "failed", reason: "profile created but application assembly failed to start" };
      }
      activeCoordinator = built.coordinator;
      activeAssembly = assembly;
      activeViewerParticipant = { authority: "nostr", publicIdentifier: result.value.accountPublicIdentifier, identityId: null };
      await attachPresentationLayer(assembly);
      return readyResult(result.value);
    }
    await built.masterSeedAuthority.clear();
    return { outcome: result.outcome, reason: "create did not complete" };
  } finally {
    inFlight = false;
  }
}

async function handleUnlock(payload: unknown) {
  if (inFlight) return { outcome: "busy", reason: "another command is in progress" };
  if (activeCoordinator !== null) return { outcome: "ok", reason: "already unlocked" };
  const secretBytes = validatedSecretBytes(payload, ["secret"]);
  if (secretBytes === null) return { outcome: "invalid-input", reason: "malformed unlock request" };
  inFlight = true;
  try {
    const built = await buildFreshCoordinator();
    if (built === null) {
      secretBytes.fill(0);
      return { outcome: "seed-unavailable", reason: "production crypto unavailable" };
    }
    built.coordinator.detectProfileState();
    const secret = new (requireModules().UnlockSecret)(secretBytes);
    const result = await built.coordinator.unlockProfile(secret);
    if (result.outcome === "ok" && "value" in result) {
      const assembly = startAssembly(built.coordinator, result.value);
      if (assembly === null) {
        await built.coordinator.lock();
        return { outcome: "failed", reason: "unlocked but application assembly failed to start" };
      }
      activeCoordinator = built.coordinator;
      activeAssembly = assembly;
      activeViewerParticipant = { authority: "nostr", publicIdentifier: result.value.accountPublicIdentifier, identityId: null };
      await attachPresentationLayer(assembly);
      return readyResult(result.value);
    }
    await built.masterSeedAuthority.clear();
    return { outcome: result.outcome === "recovery-required" || result.outcome === "corrupt" ? result.outcome : "unlock-failed", reason: "unlock did not complete" };
  } finally {
    inFlight = false;
  }
}

/** Phase G — Lock: stops background sync + the ONE Runtime (via the assembly), clears badge/tray to their inert "no active sensitive work" state, THEN the Coordinator's own lock() (safe second call). */
async function handleLock() {
  if (inFlight) return { outcome: "busy", reason: "another command is in progress" };
  if (activeCoordinator === null) return { outcome: "ok", reason: "already locked" };
  inFlight = true;
  try {
    const coordinator = activeCoordinator;
    const assembly = activeAssembly;
    activeCoordinator = null;
    activeAssembly = null;
    activeViewerParticipant = null;
    activeRelays = [];
    if (assembly !== null) await assembly.shutdown();
    await coordinator.lock();
    if (badgeAdapter !== null) {
      badgeAdapter.render({ state: "none", count: 0, reason: "profile locked" });
    }
    refreshTrayMenu();
    return { outcome: "ok" };
  } finally {
    inFlight = false;
  }
}

/** Phase H — the Beta Home/status surface: real, non-secret facts only. Never exposes a raw Settings descriptor, a raw error, or a WASM handle. */
async function handleBetaStatus() {
  const m = requireModules();
  const profileStatus = await handleStatus();
  const settingsEffectiveState = activeAssembly?.settingsCoordinator.effectiveState() ?? null;
  let navigation: unknown = null;
  let badge: unknown = null;
  let background: { canRunBackgroundSync: boolean; canDeliverBackgroundNotifications: boolean } | null = null;
  let deviceSyncStatus: string | null = null;
  if (activeAssembly !== null) {
    navigation = activeAssembly.navigationRegistry.sessionState();
    badge = activeAssembly.badgeCoordinator.lastView;
    background = {
      canRunBackgroundSync: activeAssembly.backgroundLifecycle.canRunBackgroundSync(),
      canDeliverBackgroundNotifications: activeAssembly.backgroundLifecycle.canDeliverBackgroundNotifications(),
    };
    deviceSyncStatus = activeAssembly.deviceSyncPresentationWiring.currentTrayStatus;
  }
  return {
    profile: profileStatus,
    settingsEffectiveState,
    navigation,
    badge,
    background,
    trayActive: trayCreated,
    deviceSyncStatus,
    capabilities: m.betaCapabilityManifestV1(),
    release: m.betaReleaseConfigurationV1(),
    limitations: m.betaLimitationsV1(),
  };
}

/**
 * Secure Runtime Alpha 6681-6760 — AUTOTEST-only, READ-ONLY reachability
 * diagnostic proving this packaged process's own real Runtime is the SAME
 * unified configuration graph the reconciled 70bbd6e8/8a33045e lineages
 * produce: Direct Ratchet, Peer Capability, Identity Transition, and
 * Deletion Request all resolve through the SAME `conversationRuntime()`
 * this Coordinator already constructs (never a second Runtime/Coordinator
 * built just for this check), and `productionCryptoStatus()` proves the
 * Store-backed crypto authority from 8a33045e is live -- through the SAME
 * Shell every other command in this file uses. Reads existing accessors
 * only; mutates nothing; never returns a raw Runtime/handle/secret, only
 * booleans and the Shell's own already-safe status outcome string.
 */
function unifiedGraphDiagnostics(): {
  readonly runtimeReachable: boolean;
  readonly deviceTrustReachable: boolean;
  readonly directRatchetConfigured: boolean;
  readonly peerCapabilityConfigured: boolean;
  readonly identityTransitionConfigured: boolean;
  readonly deletionRequestConfigured: boolean;
  readonly productionCryptoStatusOutcome: string | null;
} {
  const runtime = activeCoordinator?.runningRuntime() ?? null;
  if (runtime === null) {
    return {
      runtimeReachable: false,
      deviceTrustReachable: false,
      directRatchetConfigured: false,
      peerCapabilityConfigured: false,
      identityTransitionConfigured: false,
      deletionRequestConfigured: false,
      productionCryptoStatusOutcome: null,
    };
  }
  const cr = runtime.conversationRuntime();
  let deviceTrustReachable = false;
  try {
    runtime.deviceTrust();
    deviceTrustReachable = true;
  } catch {
    deviceTrustReachable = false;
  }
  return {
    runtimeReachable: true,
    deviceTrustReachable,
    directRatchetConfigured: cr.directRatchet() !== null,
    peerCapabilityConfigured: cr.peerCapability() !== null,
    identityTransitionConfigured: cr.identityTransition() !== null,
    deletionRequestConfigured: cr.deletionRequest() !== null,
    productionCryptoStatusOutcome: activeAssembly?.shell.productionCryptoStatus().outcome ?? null,
  };
}

async function handleSettingsPlan(candidate: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  return activeAssembly.settingsCoordinator.previewPlan(candidate);
}

async function handleSettingsApply(candidate: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  const result = await activeAssembly.settingsCoordinator.apply(candidate);
  refreshTrayMenu();
  return result;
}

async function handleBadgeMarkViewed(payload: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isSafeId(conversationId)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  activeAssembly.navigationRegistry.recordConversationOpened(conversationId);
  const view = await activeAssembly.badgeCoordinator.refresh();
  return { outcome: "ok", view };
}

async function performCleanShutdown(): Promise<void> {
  if (shutdownInitiated) return;
  shutdownInitiated = true;
  if (activeCoordinator !== null) {
    const coordinator = activeCoordinator;
    const assembly = activeAssembly;
    activeCoordinator = null;
    activeAssembly = null;
    activeViewerParticipant = null;
    activeRelays = [];
    try {
      if (assembly !== null) await assembly.shutdown();
      await coordinator.lock();
    } catch {
      /* never throws */
    }
  }
  if (badgeAdapter !== null) {
    badgeAdapter.render({ state: "none", count: 0, reason: "process shutting down" });
  }
  trayAdapter.destroy();
  console.log("fedos-beta: shutdown clean");
  app.quit();
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 7001-7080 — Phase C: the closed `fedos-acceptance:*`
// command vocabulary; EXTENDED by Secure Runtime Alpha 7321-7400 with
// createConversationInvitation/search/archive/safety-center-overview
// (Release Readiness Review B-2/B-7). Every command below is REJECTED
// (`{outcome: "unavailable", reason: "acceptance-only"}`, structurally
// identical to every other "unavailable" outcome this file already
// produces — no new failure shape) whenever no real profile is currently
// unlocked (`requireShell()`/`requireBoundary()`) — the SAME real
// precondition every other command in this file already requires. Prior
// to Alpha 7321-7400 this vocabulary was ADDITIONALLY gated behind
// `AUTOTEST_MODE`, making it unreachable in ordinary packaged production
// mode even with a real profile unlocked — that gap is what this Arc
// closes (Release Readiness Review B-3); the name `"acceptance-only"`
// is kept as the existing, stable outcome-reason string (Phase P "do not
// rename existing accepted surfaces"), even though the gate it now
// describes is real-profile-required, not AUTOTEST-required. Every
// command delegates ENTIRELY to an ALREADY-REAL `FedosDesktopApplicationShell`/
// `FedosSafetyCenterController` method (never a raw Runtime/Store/handle,
// never a second business-logic implementation) and validates its own
// JSON payload shape before calling it — malformed input never reaches
// the Shell.
// ---------------------------------------------------------------------

function acceptanceGateRejection(): { readonly outcome: "unavailable"; readonly reason: string } {
  return { outcome: "unavailable", reason: "acceptance-only" };
}

/**
 * Secure Runtime Alpha 7321-7400 — real production reachability fix
 * (Release Readiness Review B-3): the ONLY gate is now "is a real profile
 * genuinely unlocked" — the SAME real precondition every other command in
 * this file already requires (`fedos-beta:*`/`fedos-profile:*`). The prior
 * `AUTOTEST_MODE.length === 0` check made this entire vocabulary
 * unreachable in ordinary packaged production mode by design; that was
 * itself the reachability gap this Arc's own mission exists to close. No
 * other change: still `null` before any create/unlock, still delegates
 * entirely to the SAME already-real `FedosDesktopApplicationShell`.
 */
function requireShell(): ShellDiagnosticLike | null {
  if (activeAssembly === null) return null;
  return activeAssembly.shell;
}

/** Secure Runtime Alpha 7321-7400 — mirrors `requireShell()`'s own identical discipline exactly, for Safety Center's own real presentation boundary. */
function requireBoundary(): BoundaryLike | null {
  if (activeAssembly === null) return null;
  return activeAssembly.boundary;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

async function handleAcceptanceCreateDirectConversation(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  if (typeof payload !== "object" || payload === null) return { outcome: "invalid-input", reason: "malformed create-direct-conversation request" };
  const recipient = (payload as { recipient?: unknown }).recipient;
  if (typeof recipient !== "object" || recipient === null) return { outcome: "invalid-input", reason: "missing recipient" };
  const authority = (recipient as { authority?: unknown }).authority;
  const publicIdentifier = (recipient as { publicIdentifier?: unknown }).publicIdentifier;
  if (typeof authority !== "string" || !isBoundedString(publicIdentifier, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed recipient" };
  }
  return shell.createDirectConversation({ recipient: { authority: authority as never, publicIdentifier } });
}

async function handleAcceptanceActivateDirectConversation(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  return shell.activateDirectConversation(conversationId);
}

async function handleAcceptanceDevicePairingCreate(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const deviceId = (payload as { deviceId?: unknown } | null)?.deviceId;
  const expectedAccountRef = (payload as { expectedAccountRef?: unknown } | null)?.expectedAccountRef;
  if (!isBoundedString(deviceId, MAX_ID_LENGTH) || typeof expectedAccountRef !== "object" || expectedAccountRef === null) {
    return { outcome: "invalid-input", reason: "malformed device-pairing-create request" };
  }
  return shell.devicePairingCreate(deviceId, expectedAccountRef);
}

async function handleAcceptanceDevicePairingInspect(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const encodedRequest = (payload as { encodedRequest?: unknown } | null)?.encodedRequest;
  if (!isBoundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS)) return { outcome: "invalid-input", reason: "malformed encodedRequest" };
  return shell.devicePairingInspect(encodedRequest);
}

async function handleAcceptanceDevicePairingApprove(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const encodedRequest = (payload as { encodedRequest?: unknown } | null)?.encodedRequest;
  if (!isBoundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS)) return { outcome: "invalid-input", reason: "malformed encodedRequest" };
  return shell.devicePairingApprove(encodedRequest);
}

async function handleAcceptanceDevicePairingComplete(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const pairingId = (payload as { pairingId?: unknown } | null)?.pairingId;
  const encodedApproval = (payload as { encodedApproval?: unknown } | null)?.encodedApproval;
  if (!isBoundedString(pairingId, MAX_ID_LENGTH) || !isBoundedString(encodedApproval, MAX_PAIRING_ENVELOPE_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed device-pairing-complete request" };
  }
  return shell.devicePairingComplete(pairingId, encodedApproval);
}

async function handleAcceptanceEstablishDirectRatchetSession(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const remoteDeviceRef = (payload as { remoteDeviceRef?: unknown } | null)?.remoteDeviceRef;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(remoteDeviceRef, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed establish-session request" };
  }
  return shell.establishDirectRatchetSession(conversationId, remoteDeviceRef);
}

async function handleAcceptanceSendMessage(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const sender = (payload as { sender?: unknown } | null)?.sender;
  const body = (payload as { body?: unknown } | null)?.body;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || typeof sender !== "object" || sender === null || !isBoundedString(body, MAX_MESSAGE_BODY_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed send-message request" };
  }
  return shell.sendMessage(conversationId, sender, body);
}

async function handleAcceptanceListMessages(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  return shell.listMessages(conversationId);
}

async function handleAcceptanceReadMessage(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const messageId = (payload as { messageId?: unknown } | null)?.messageId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(messageId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed read-message request" };
  }
  return shell.readMessage(conversationId, messageId);
}

async function handleAcceptanceDirectRatchetStatus(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const remoteDeviceRef = (payload as { remoteDeviceRef?: unknown } | null)?.remoteDeviceRef;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(remoteDeviceRef, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed status request" };
  }
  return { outcome: "ok", value: shell.directRatchetStatus(conversationId, remoteDeviceRef) };
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-2:
 * `createConversationInvitation()` had zero IPC/preload exposure anywhere.
 * Delegates ENTIRELY to the already-real `FedosDesktopApplicationShell.createConversationInvitation()`
 * (Alpha 7081-7160, unmodified) — creates a brand-new Direct conversation
 * and sends a real, signed invitation over the real relay.
 */
async function handleAcceptanceCreateConversationInvitation(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  if (typeof payload !== "object" || payload === null) return { outcome: "invalid-input", reason: "malformed create-conversation-invitation request" };
  const invitee = (payload as { invitee?: unknown }).invitee;
  if (typeof invitee !== "object" || invitee === null) return { outcome: "invalid-input", reason: "missing invitee" };
  const authority = (invitee as { authority?: unknown }).authority;
  const publicIdentifier = (invitee as { publicIdentifier?: unknown }).publicIdentifier;
  if (typeof authority !== "string" || !isBoundedString(publicIdentifier, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed invitee" };
  }
  const expiresInMs = (payload as { expiresInMs?: unknown }).expiresInMs;
  return shell.createConversationInvitation({ authority: authority as never, publicIdentifier, identityId: null }, typeof expiresInMs === "number" ? expiresInMs : undefined);
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7
 * (Search): delegates ENTIRELY to the already-real, unconditionally-
 * constructed `FedosDesktopApplicationShell.search()` (Alpha 3081-3160,
 * unmodified) — real, retention-gated keyword search over locally-held
 * plaintext.
 */
async function handleAcceptanceSearch(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const query = (payload as { query?: unknown } | null)?.query;
  if (!isBoundedString(query, MAX_SEARCH_QUERY_CHARS)) return { outcome: "invalid-input", reason: "malformed search query" };
  return Promise.resolve(shell.search(query));
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7
 * (Archive): delegates ENTIRELY to the already-real `FedosDesktopApplicationShell.archive()`
 * (Alpha 3081-3160, unmodified) — real WASM-backed export/inspect/
 * preflightRestore/restore, exactly the same command shape
 * `FedosContentAccessorArchiveCommand` already defines. Only the closed
 * `operation` discriminant and any bounded path string are validated
 * here — the nested `request` object (export/restore parameters) is
 * passed through to the Shell's own existing validation, mirroring how
 * `sendMessage`'s own `sender` and `devicePairingCreate`'s own
 * `expectedAccountRef` are already handled in this file.
 */
async function handleAcceptanceArchive(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  if (typeof payload !== "object" || payload === null) return { outcome: "invalid-input", reason: "malformed archive request" };
  const operation = (payload as { operation?: unknown }).operation;
  if (operation === "inspect") {
    const sourcePath = (payload as { sourcePath?: unknown }).sourcePath;
    if (!isBoundedString(sourcePath, MAX_ARCHIVE_PATH_CHARS)) return { outcome: "invalid-input", reason: "malformed sourcePath" };
    return shell.archive({ operation: "inspect", sourcePath });
  }
  if (operation === "preflightRestore" || operation === "export" || operation === "restore") {
    const request = (payload as { request?: unknown }).request;
    if (typeof request !== "object" || request === null) return { outcome: "invalid-input", reason: "missing request" };
    return shell.archive({ operation, request } as never);
  }
  return { outcome: "invalid-input", reason: "unknown archive operation" };
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7
 * (Safety Center): delegates ENTIRELY to the already-real
 * `FedosSafetyCenterController` (`src/desktop/presentation/safety_center/`,
 * unmodified), reached via `FedosDesktopBetaApplicationAssembly`'s own
 * pre-existing `boundary` getter — no new presentation logic.
 */
async function handleAcceptanceSafetyCenterOverview(): Promise<{ readonly outcome: string; readonly [key: string]: unknown }> {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.safetyCenter.refreshOverview([]);
  return { outcome: "ok", value: boundary.safetyCenter.overviewState };
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 8041-8120 — Phase B-K: the ORDINARY, user-facing
// `fedos-app:*` command vocabulary. This is the FedOS Desktop Beta
// User-Facing Product UI Completion Arc's own closure of the Phase A
// reconciliation report's central finding: `FedosDesktopConversationUiPresentationBoundary`
// (`src/desktop/presentation/`, unmodified) already composes a real
// conversation list/detail, message list/compose, membership/invitation,
// search, archive, device inventory, Identity Transition, and Signed
// Deletion Controller/ViewModel over the SAME Shell/Runtime every
// `fedos-acceptance:*` command already uses -- it was simply never read by
// this file before this Arc. Every handler below is a THIN delegation to
// one of those already-real, already-tested ViewModels/Controllers (never
// a second business-logic implementation, never a raw Runtime/Store/handle)
// and gates on the SAME real-profile-unlocked precondition
// (`requireShell()`/`requireBoundary()`) every other command in this file
// already requires. This vocabulary is the ONLY one the ordinary page may
// ever call -- `fedosAcceptance`/`fedos-acceptance:*` remains untouched,
// reachable only by the pre-existing acceptance-mode test harness (Phase P
// "do not rename existing accepted surfaces"; Phase Q "acceptance API
// remains test-gated/clearly internal").
// ---------------------------------------------------------------------

/** Maps ANY `FedosDesktopViewModelState<T>` (`{status:"idle"|"loading"}` | `{status:"loaded",data}` | `{status:"error",outcome,reason}`) onto the SAME `{outcome:"ok",value}` / `{outcome,reason}` shape every `fedos-acceptance:*`/`fedos-profile:*` result in this file already uses -- one uniform result vocabulary across both command sets, never a second. */
function resultFromViewModelState(state: { readonly status: string; readonly data?: unknown; readonly outcome?: string; readonly reason?: string }): { readonly outcome: string; readonly [key: string]: unknown } {
  if (state.status === "loaded") return { outcome: "ok", value: state.data };
  if (state.status === "error") return { outcome: state.outcome ?? "failed", reason: state.reason ?? "" };
  return { outcome: "unavailable", reason: state.status };
}

function requireViewerParticipant(): ParticipantRefLike | null {
  return activeViewerParticipant;
}

async function handleAppConversationsList() {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.conversationList.load();
  return resultFromViewModelState(boundary.conversationList.state);
}

async function handleAppConversationOpen(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.conversationDetail.load(conversationId);
  return resultFromViewModelState(boundary.conversationDetail.state);
}

async function handleAppMessagesList(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.messageList.load(conversationId);
  return resultFromViewModelState(boundary.messageList.state);
}

async function handleAppMessageReveal(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const messageId = (payload as { messageId?: unknown } | null)?.messageId;
  if (!isBoundedString(messageId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed messageId" };
  await boundary.messageList.reveal(messageId);
  return resultFromViewModelState(boundary.messageList.state);
}

async function handleAppMessageSend(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const viewer = requireViewerParticipant();
  if (viewer === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const body = (payload as { body?: unknown } | null)?.body;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(body, MAX_MESSAGE_BODY_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed message-send request" };
  }
  boundary.composeMessage.setBody(body);
  await boundary.composeMessage.send(conversationId, viewer);
  return resultFromViewModelState(boundary.composeMessage.state);
}

async function handleAppMembershipList(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.membership.load(conversationId);
  return resultFromViewModelState(boundary.membership.state);
}

async function handleAppInvitationsList(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const viewer = requireViewerParticipant();
  if (viewer === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.membership.loadInvitations(conversationId, viewer);
  return resultFromViewModelState(boundary.membership.invitations);
}

async function handleAppArchiveWorkflowWarnings(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const operation = (payload as { operation?: unknown } | null)?.operation;
  if (operation !== "inspect" && operation !== "preflightRestore" && operation !== "export" && operation !== "restore") {
    return { outcome: "invalid-input", reason: "unknown archive operation" };
  }
  return { outcome: "ok", value: boundary.archive.workflowWarnings(operation) };
}

async function handleAppDevicesList() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.devicesList();
}

async function handleAppDeviceDetail(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const deviceId = (payload as { deviceId?: unknown } | null)?.deviceId;
  if (!isBoundedString(deviceId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed deviceId" };
  return shell.deviceDetail(deviceId);
}

async function handleAppDeviceRevoke(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const deviceId = (payload as { deviceId?: unknown } | null)?.deviceId;
  const devicePublicKeyHex = (payload as { devicePublicKeyHex?: unknown } | null)?.devicePublicKeyHex;
  if (!isBoundedString(deviceId, MAX_ID_LENGTH) || !isBoundedString(devicePublicKeyHex, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed device-revoke request" };
  }
  return shell.deviceRevoke(deviceId, devicePublicKeyHex);
}

async function handleAppDeviceSyncStatus() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.deviceSyncStatus();
}

/**
 * Secure Runtime Alpha 8041-8120 — see `BoundaryLike`'s own updated header
 * comment: `identityTransitionList()`/its Controller-built inbox item never
 * carries the `(peerAccountRef, peerDeviceRef)` pair `openTransition()`/
 * `Accept()`/`Reject()`/`Defer()` require as input -- no Shell/Controller
 * listing call returns that pair directly on this base. This handler
 * reconciles two ALREADY-REAL, already-public read-only calls
 * (`identityTransitionList()`'s own inbox items plus `peerCapabilityListObserved()`'s
 * known peer Device pairs, cross-referenced via the ALREADY-PUBLIC
 * `identityTransitionStatus()` probe) to attach the pair each item needs --
 * inventing no new identity-transition business rule, mirroring
 * `FedosSafetyCenterController`'s own established cross-domain
 * reconciliation style. An item with no resolvable pair is marked
 * `openable: false` (fail closed) rather than fabricated.
 */
async function handleAppIdentityTransitionList(payload: unknown) {
  const boundary = requireBoundary();
  const shell = requireShell();
  if (boundary === null || shell === null) return acceptanceGateRejection();
  const limit = (payload as { limit?: unknown } | null)?.limit;
  const offset = (payload as { offset?: unknown } | null)?.offset;
  await boundary.identityTransitions.refreshInbox(typeof limit === "number" ? limit : 50, typeof offset === "number" ? offset : 0);
  const inbox = boundary.identityTransitions.inboxState;
  if (inbox.status !== "loaded") return resultFromViewModelState(inbox);
  const peersResult = shell.peerCapabilityListObserved();
  const peers = (peersResult.outcome === "ok" ? (peersResult as unknown as { readonly value: readonly { readonly peerAccountRef: unknown; readonly peerDeviceRef: string }[] }).value : []) ?? [];
  const items = (inbox.data as readonly { readonly transitionId: string; readonly [key: string]: unknown }[]) ?? [];
  const enriched = items.map((item) => {
    for (const peer of peers) {
      const statusResult = shell.identityTransitionStatus(peer.peerAccountRef, peer.peerDeviceRef, item.transitionId);
      if (statusResult.outcome === "ok" && (statusResult as unknown as { readonly value: unknown }).value !== null) {
        return { ...item, openable: true, peerAccountRef: peer.peerAccountRef, peerDeviceRef: peer.peerDeviceRef };
      }
    }
    return { ...item, openable: false, peerAccountRef: null, peerDeviceRef: null };
  });
  return { outcome: "ok", value: enriched };
}

async function handleAppIdentityTransitionOpen(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const peerAccountRef = (payload as { peerAccountRef?: unknown } | null)?.peerAccountRef;
  const peerDeviceRef = (payload as { peerDeviceRef?: unknown } | null)?.peerDeviceRef;
  const transitionId = (payload as { transitionId?: unknown } | null)?.transitionId;
  if (typeof peerAccountRef !== "object" || peerAccountRef === null || !isBoundedString(peerDeviceRef, MAX_ID_LENGTH) || !isBoundedString(transitionId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed identity-transition-open request" };
  }
  await boundary.identityTransitions.openTransition(peerAccountRef, peerDeviceRef, transitionId);
  return resultFromViewModelState(boundary.identityTransitions.detailState);
}

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 3 (`6873d24f`): now
 * requires the exact identifying tuple in `payload`, validated the SAME
 * way `handleAppIdentityTransitionOpen()` already validates it, and
 * dispatches to the Controller's own exact-id `accept()`/`reject()`/
 * `defer()` methods -- never `acceptSelected()`/`rejectSelected()`/
 * `deferSelected()` (which trust a mutable "currently selected" field).
 * A stale/mismatched id still fails closed: the Shell's own real
 * transition lookup (unchanged) rejects an id that no longer exists or
 * no longer matches, exactly as it always has for `identityTransitionOpen()`.
 */
async function handleAppIdentityTransitionDecide(decision: "accept" | "reject" | "defer", payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const peerAccountRef = (payload as { peerAccountRef?: unknown } | null)?.peerAccountRef;
  const peerDeviceRef = (payload as { peerDeviceRef?: unknown } | null)?.peerDeviceRef;
  const transitionId = (payload as { transitionId?: unknown } | null)?.transitionId;
  if (typeof peerAccountRef !== "object" || peerAccountRef === null || !isBoundedString(peerDeviceRef, MAX_ID_LENGTH) || !isBoundedString(transitionId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed identity-transition-decide request" };
  }
  if (decision === "accept") await boundary.identityTransitions.accept(peerAccountRef as never, peerDeviceRef, transitionId);
  else if (decision === "reject") await boundary.identityTransitions.reject(peerAccountRef as never, peerDeviceRef, transitionId);
  else await boundary.identityTransitions.defer(peerAccountRef as never, peerDeviceRef, transitionId);
  return resultFromViewModelState(boundary.identityTransitions.detailState);
}

async function handleAppIdentityTransitionRecordManualVerification(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const method = (payload as { method?: unknown } | null)?.method;
  const noteCode = (payload as { noteCode?: unknown } | null)?.noteCode;
  if (typeof method !== "string" || typeof noteCode !== "string") return { outcome: "invalid-input", reason: "malformed manual-verification request" };
  await boundary.identityTransitions.recordManualVerification(method, Date.now(), noteCode);
  return resultFromViewModelState(boundary.identityTransitions.manualVerificationState);
}

/** Secure Runtime Alpha 8041-8120 — a dedicated `fedos-app:*` wrapper, distinct from `handleAcceptanceSafetyCenterOverview()` above: that handler returns `boundary.safetyCenter.overviewState` RAW (a `{status,data}` ViewModelState nested one level inside `value`, matching the `fedos-acceptance:*` vocabulary's own established shape for this one call) — flattened here via `resultFromViewModelState()` so `fedos-app:*` keeps ONE consistent `{outcome:"ok",value:<content>}` shape across every command, never two different unwrapping conventions for the ordinary page to guess between. */
async function handleAppSafetyCenterOverview() {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.safetyCenter.refreshOverview([]);
  return resultFromViewModelState(boundary.safetyCenter.overviewState);
}

async function handleAppDeletionRequestListReceived() {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.deletionRequests.openReceivedInbox();
  return resultFromViewModelState(boundary.deletionRequests.inboxState);
}

/** The recipient-side local review policy is fixed to `"always-review"` -- the SAME conservative, never-auto-accept value `secureRuntimeBundleConfig()` already configures Runtime-wide (`deletionRequestResolveLocalPolicy`); a per-click UI override of this trust policy is deliberately never offered. */
async function handleAppDeletionRequestOpen(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const requestId = (payload as { requestId?: unknown } | null)?.requestId;
  if (!isBoundedString(requestId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed requestId" };
  await boundary.deletionRequests.openReceivedRequest(requestId, "always-review");
  return resultFromViewModelState(boundary.deletionRequests.consentDetailState);
}

/** Secure Runtime Alpha 8121-8200 — Security Finding 3 (`6873d24f`): requires the exact `requestId` in `payload`, dispatches to the Controller's own exact-id `approve()`/`reject()`, never `approveSelected()`/`rejectSelected()`. */
async function handleAppDeletionRequestDecide(decision: "approve" | "reject", payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const requestId = (payload as { requestId?: unknown } | null)?.requestId;
  if (!isBoundedString(requestId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed deletion-request-decide request" };
  if (decision === "approve") await boundary.deletionRequests.approve(requestId);
  else await boundary.deletionRequests.reject(requestId);
  return resultFromViewModelState(boundary.deletionRequests.inboxState);
}

/**
 * Secure Runtime Alpha 8041-8120 — Phase G's own "choose destination through
 * an existing safe path boundary" requirement: no file/save picker existed
 * anywhere in this package before this Arc (confirmed by the Phase A
 * reconciliation report's own file inventory). A native OS picker, gated
 * behind ONE specific named channel that returns ONE user-chosen path back
 * to the caller, is the safe primitive Phase G names -- never a generic
 * "read/write arbitrary path" IPC command (the prohibited kind): the
 * renderer receives only the chosen path string, and that string is only
 * ever accepted afterward by the ALREADY-VALIDATED `fedos-app:archive`
 * export/restore commands, never used for any other file operation.
 */
async function handleAppArchiveChooseExportDestination(payload: unknown): Promise<{ readonly outcome: string; readonly path?: string }> {
  if (activeAssembly === null || mainWindow === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const safeName = isBoundedString(conversationId, MAX_ID_LENGTH) ? conversationId.replace(/[^a-zA-Z0-9_-]/g, "_") : "conversation";
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Conversation Archive",
    defaultPath: `${safeName}.fedosarchive`,
    filters: [{ name: "FedOS Archive", extensions: ["fedosarchive"] }],
  });
  if (result.canceled || result.filePath === undefined) return { outcome: "cancelled" };
  return { outcome: "ok", path: result.filePath };
}

async function handleAppArchiveChooseSource(): Promise<{ readonly outcome: string; readonly path?: string }> {
  if (activeAssembly === null || mainWindow === null) return acceptanceGateRejection();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a FedOS Archive",
    properties: ["openFile"],
    filters: [{ name: "FedOS Archive", extensions: ["fedosarchive"] }, { name: "All Files", extensions: ["*"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { outcome: "cancelled" };
  return { outcome: "ok", path: result.filePaths[0] };
}

/** Reads current persisted Settings fresh -- mirrors `secureRuntimeBundleConfig()`'s own established "construct one stateless, file-backed controller, `.load()`, discard" pattern exactly; never a second, divergent Settings owner. */
async function handleAppSettingsLoad() {
  if (activeAssembly === null) return acceptanceGateRejection();
  const m = requireModules();
  const controller = m.createFileBackedSettingsController(settingsFilePath());
  return controller.load();
}

/**
 * Secure Runtime Alpha 8121-8200 -- real, disclosed Phase K gap this Arc's
 * own extended vertical slice found live: the nav bar's own `#app-status-area`
 * was wired in the renderer but never actually populated with real Relay
 * connectivity, so "one unreachable Relay does not invalidate the whole
 * profile" had no VISIBLE confirmation anywhere in the shipped UI. Fixed
 * with a thin, read-only wrapper over the ALREADY-REAL, ALREADY-PUBLIC
 * `WebSocketRelay.isConnected()` accessor (Alpha 215, unmodified) -- never
 * a new connection, never a new protocol, never a second Relay set.
 */
async function handleAppRelayStatus() {
  if (activeAssembly === null) return acceptanceGateRejection();
  return { outcome: "ok", value: activeRelays.map((r) => ({ url: r.url, connected: r.isConnected() })) };
}

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 1 (`6873d24f`):
 * the ACCEPTANCE-mode counterpart to the `ui-script` mode's own
 * `readGlobal` action (see that block's own comment) — same closed
 * allowlist, same `typeof window[<name>]` check, reached here via
 * `mainWindow.webContents.executeJavaScript()` since acceptance mode's
 * own command loop otherwise never touches the DOM. Exists ONLY to let
 * this Arc's own test suite prove `window.fedosAcceptance` genuinely IS
 * present when acceptance mode is the very thing that's active — never
 * reachable from the ordinary page itself.
 */
async function handleAcceptanceReadGlobal(payload: unknown) {
  const name = (payload as { name?: unknown } | null)?.name;
  const allowedGlobals = new Set(["fedosProfile", "fedosBeta", "fedosAcceptance", "fedosApp"]);
  if (typeof name !== "string" || !allowedGlobals.has(name)) return { outcome: "invalid-input", reason: "unrecognized readGlobal selector" };
  if (mainWindow === null) return { outcome: "unavailable", reason: "no window" };
  const value = await mainWindow.webContents.executeJavaScript(`typeof window[${JSON.stringify(name)}]`);
  return { outcome: "ok", value };
}

// ---------------------------------------------------------------------
// IPC — `fedos-profile:*` REUSED verbatim (Phase P). Additive `fedos-beta:*`
// namespace for status/settings-application/tray/badge/background.
// ---------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle("fedos-profile:status", async () => handleStatus());
  ipcMain.handle("fedos-profile:create", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCreate(payload));
  ipcMain.handle("fedos-profile:unlock", async (_e: IpcMainInvokeEvent, payload: unknown) => handleUnlock(payload));
  ipcMain.handle("fedos-profile:lock", async () => handleLock());
  ipcMain.handle("fedos-profile:quit", async () => {
    void performCleanShutdown();
    return { ok: true };
  });

  ipcMain.handle("fedos-beta:status", async () => handleBetaStatus());
  ipcMain.handle("fedos-beta:settings-plan", async (_e: IpcMainInvokeEvent, candidate: unknown) => handleSettingsPlan(candidate));
  ipcMain.handle("fedos-beta:settings-apply", async (_e: IpcMainInvokeEvent, candidate: unknown) => handleSettingsApply(candidate));
  ipcMain.handle("fedos-beta:tray-action", async (_e: IpcMainInvokeEvent, candidate: unknown) => handleTrayAction(candidate));
  ipcMain.handle("fedos-beta:badge-mark-viewed", async (_e: IpcMainInvokeEvent, payload: unknown) => handleBadgeMarkViewed(payload));

  // Secure Runtime Alpha 7001-7080 — Phase C closed acceptance vocabulary.
  //
  // Secure Runtime Alpha 8121-8200 — Security Finding 1 (`6873d24f`):
  // these channels are now registered ONLY when `ACCEPTANCE_MODE_ENABLED`
  // (see its own header comment above). In an ordinary packaged
  // production launch, or in any OTHER AUTOTEST_MODE value (`create`,
  // `unlock`, `ui-script`), `ipcMain.handle` is never called for any
  // `fedos-acceptance:*` channel at all — `ipcRenderer.invoke()` against
  // one of these channel names then rejects with Electron's own real "no
  // handler registered" error, a genuine absence, not a UI-layer hint.
  // The acceptance-mode SCRIPT RUNNER below (`AUTOTEST_MODE === "acceptance"`)
  // is entirely unaffected either way: it calls each handler FUNCTION
  // directly from its own command map, never through `ipcMain`/
  // `ipcRenderer` — confirmed by direct read of that block, so this gate
  // narrows only the renderer-reachable IPC surface, never the test
  // harness's own internal capability.
  if (ACCEPTANCE_MODE_ENABLED) {
    ipcMain.handle("fedos-acceptance:create-direct-conversation", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceCreateDirectConversation(payload));
    ipcMain.handle("fedos-acceptance:activate-direct-conversation", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceActivateDirectConversation(payload));
    ipcMain.handle("fedos-acceptance:device-pairing-create", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingCreate(payload));
    ipcMain.handle("fedos-acceptance:device-pairing-inspect", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingInspect(payload));
    ipcMain.handle("fedos-acceptance:device-pairing-approve", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingApprove(payload));
    ipcMain.handle("fedos-acceptance:device-pairing-complete", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingComplete(payload));
    ipcMain.handle("fedos-acceptance:establish-direct-ratchet-session", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceEstablishDirectRatchetSession(payload));
    ipcMain.handle("fedos-acceptance:send-message", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceSendMessage(payload));
    ipcMain.handle("fedos-acceptance:list-messages", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceListMessages(payload));
    ipcMain.handle("fedos-acceptance:read-message", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceReadMessage(payload));
    ipcMain.handle("fedos-acceptance:direct-ratchet-status", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDirectRatchetStatus(payload));
    // Secure Runtime Alpha 7321-7400 -- these four channels close Release
    // Readiness Review B-2/B-7; Secure Runtime Alpha 8121-8200 narrows
    // "reachable whenever a real profile is unlocked, in ANY mode" (the
    // ORIGINAL 7321-7400 wording) to the same `ACCEPTANCE_MODE_ENABLED`
    // gate as every other `fedos-acceptance:*` channel above -- the
    // ordinary UI has had its own equivalent `fedos-app:*` channel for
    // each of these four since Alpha 8041-8120 (`create-invitation`,
    // `search`, `archive`, `safety-center-overview`), so no real
    // capability is lost, only the SECOND, acceptance-only path to it.
    ipcMain.handle("fedos-acceptance:create-conversation-invitation", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceCreateConversationInvitation(payload));
    ipcMain.handle("fedos-acceptance:search", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceSearch(payload));
    ipcMain.handle("fedos-acceptance:archive", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceArchive(payload));
    ipcMain.handle("fedos-acceptance:safety-center-overview", async () => handleAcceptanceSafetyCenterOverview());
  }

  // Secure Runtime Alpha 8041-8120 -- Phase B-K: the ordinary, user-facing
  // `fedos-app:*` vocabulary. Every handler is registered unconditionally
  // (mirrors every channel above); the security boundary is each handler's
  // own `requireShell()`/`requireBoundary()` runtime check, not whether the
  // channel itself was registered.
  ipcMain.handle("fedos-app:conversations-list", async () => handleAppConversationsList());
  ipcMain.handle("fedos-app:conversation-open", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppConversationOpen(payload));
  // Phase E -- a genuinely restarted Runtime must re-activate a Direct
  // conversation before it can send/receive (a real, per-Runtime-lifetime
  // precondition -- Alpha 2041-2120, unmodified, unrelated to this Arc);
  // reuses the SAME handler `fedos-acceptance:activate-direct-conversation`
  // already dispatches to, never a second implementation.
  ipcMain.handle("fedos-app:conversation-activate", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceActivateDirectConversation(payload));
  ipcMain.handle("fedos-app:messages-list", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppMessagesList(payload));
  ipcMain.handle("fedos-app:message-reveal", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppMessageReveal(payload));
  ipcMain.handle("fedos-app:message-send", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppMessageSend(payload));
  ipcMain.handle("fedos-app:membership-list", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppMembershipList(payload));
  ipcMain.handle("fedos-app:invitations-list", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppInvitationsList(payload));
  // Phase D -- creating an invitation IS creating the Direct conversation and
  // sending it over the real relay; reuses the SAME handler
  // `fedos-acceptance:create-conversation-invitation` already dispatches to,
  // never a second implementation.
  ipcMain.handle("fedos-app:create-invitation", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceCreateConversationInvitation(payload));
  // Phase F/G -- reuse the SAME handlers `fedos-acceptance:search`/`:archive` already dispatch to.
  ipcMain.handle("fedos-app:search", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceSearch(payload));
  ipcMain.handle("fedos-app:archive", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceArchive(payload));
  ipcMain.handle("fedos-app:archive-workflow-warnings", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppArchiveWorkflowWarnings(payload));
  ipcMain.handle("fedos-app:archive-choose-export-destination", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppArchiveChooseExportDestination(payload));
  ipcMain.handle("fedos-app:archive-choose-source", async () => handleAppArchiveChooseSource());
  // Phase H -- Device management.
  ipcMain.handle("fedos-app:devices-list", async () => handleAppDevicesList());
  ipcMain.handle("fedos-app:device-detail", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppDeviceDetail(payload));
  ipcMain.handle("fedos-app:device-revoke", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppDeviceRevoke(payload));
  ipcMain.handle("fedos-app:device-sync-status", async () => handleAppDeviceSyncStatus());
  // Phase H (pairing) -- reuse the SAME handlers the acceptance vocabulary already dispatches to.
  ipcMain.handle("fedos-app:device-pairing-create", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingCreate(payload));
  ipcMain.handle("fedos-app:device-pairing-inspect", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingInspect(payload));
  ipcMain.handle("fedos-app:device-pairing-approve", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingApprove(payload));
  ipcMain.handle("fedos-app:device-pairing-complete", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAcceptanceDevicePairingComplete(payload));
  // Phase I -- Identity Replacement.
  ipcMain.handle("fedos-app:identity-transition-list", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppIdentityTransitionList(payload));
  ipcMain.handle("fedos-app:identity-transition-open", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppIdentityTransitionOpen(payload));
  ipcMain.handle("fedos-app:identity-transition-accept", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppIdentityTransitionDecide("accept", payload));
  ipcMain.handle("fedos-app:identity-transition-reject", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppIdentityTransitionDecide("reject", payload));
  ipcMain.handle("fedos-app:identity-transition-defer", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppIdentityTransitionDecide("defer", payload));
  ipcMain.handle("fedos-app:identity-transition-record-manual-verification", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppIdentityTransitionRecordManualVerification(payload));
  // Phase J -- Signed Deletion.
  ipcMain.handle("fedos-app:deletion-request-list-received", async () => handleAppDeletionRequestListReceived());
  ipcMain.handle("fedos-app:deletion-request-open", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppDeletionRequestOpen(payload));
  ipcMain.handle("fedos-app:deletion-request-approve", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppDeletionRequestDecide("approve", payload));
  ipcMain.handle("fedos-app:deletion-request-reject", async (_e: IpcMainInvokeEvent, payload: unknown) => handleAppDeletionRequestDecide("reject", payload));
  // Phase K -- reuse the SAME handler `fedos-acceptance:safety-center-overview` already dispatches to.
  ipcMain.handle("fedos-app:safety-center-overview", async () => handleAppSafetyCenterOverview());
  // Phase C -- Settings read (write already exists as `fedos-beta:settings-plan`/`:settings-apply`).
  ipcMain.handle("fedos-app:settings-load", async () => handleAppSettingsLoad());
  ipcMain.handle("fedos-app:relay-status", async () => handleAppRelayStatus());
}

// ---------------------------------------------------------------------
// Window — identical secure policy to every prior package main.
// ---------------------------------------------------------------------

function applySecureWindowPolicy(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  if (DEV_TOOLS_ENABLED) window.webContents.openDevTools();
}

function createBetaWindow(): BrowserWindow {
  const offscreen = AUTOTEST_MODE.length > 0;
  const window = new BrowserWindow({
    width: 760,
    height: 680,
    show: !offscreen,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      offscreen,
      preload: path.join(__dirname, "fedos_electron_beta_preload.cjs"),
    },
  });
  applySecureWindowPolicy(window);
  if (AUTOTEST_MODE.length > 0) {
    // Test-only: forwards the real page's own `console.*` calls into this
    // process's stdout so a spawned-subprocess test (`ui-script`/`acceptance`)
    // can see a renderer-side error without a devtools window. Never active
    // on an ordinary launch (`AUTOTEST_MODE` is always empty then).
    window.webContents.on("console-message", (_e, _level, message) => {
      console.log(`FEDOS_ELECTRON_BETA_RENDERER_CONSOLE:${message}`);
    });
  }
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
    if (activeAssembly !== null) {
      activeAssembly.navigationRegistry.disposeWindow(String(window.id));
      activeAssembly.backgroundLifecycle.windowClosed();
      void activeAssembly.badgeCoordinator.refresh();
    }
  });
  void window.loadFile(path.join(__dirname, "fedos_electron_beta_page.html"));
  if (activeAssembly !== null) {
    activeAssembly.backgroundLifecycle.windowOpened();
  }
  return window;
}

// ---------------------------------------------------------------------
// Startup.
// ---------------------------------------------------------------------

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    modules = await loadRootModules();
    registerIpcHandlers();
    mainWindow = createBetaWindow();
    console.log("fedos-beta: host started");
  } catch (err) {
    console.error("fedos-beta: startup failed", err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }

  if (AUTOTEST_MODE === "create" || AUTOTEST_MODE === "unlock") {
    // This file's own autotest mode exercises the real IPC commands directly, headless, and logs a
    // coarse pass/fail marker the acceptance harness can grep for.
    void (async () => {
      try {
        const secretPayload = { label: "Beta Autotest", secret: AUTOTEST_SECRET };
        const result = AUTOTEST_MODE === "create" ? await handleCreate(secretPayload) : await handleUnlock({ secret: AUTOTEST_SECRET });
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:${result.outcome}`);
        const status = await handleBetaStatus();
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_STATUS:${JSON.stringify(status.profile)}`);
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_COMPOSITION:${JSON.stringify({ navigation: status.navigation !== null, badge: status.badge !== null, tray: status.trayActive, deviceSyncStatus: status.deviceSyncStatus })}`);
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_UNIFIED_GRAPH:${JSON.stringify(unifiedGraphDiagnostics())}`);
      } catch (err) {
        console.error("fedos-beta: autotest error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    })();
  }

  if (AUTOTEST_MODE === "acceptance") {
    // Secure Runtime Alpha 7001-7080 -- Phase C/G/H/J/K. No precedent
    // exists anywhere in this repository for a live, multi-command IPC
    // session with a running Electron subprocess from an external Node
    // test driver (confirmed by the Phase A reconciliation report). This
    // mode reads an ORDERED SCRIPT of steps (`FEDOS_BETA_ACCEPTANCE_SCRIPT`,
    // a JSON array of `{command, payload}`), and calls the SAME internal
    // handler function each named command already dispatches to via
    // `registerIpcHandlers()` above -- never a second implementation. Each
    // step's result is logged as one JSON line the test driver parses;
    // an unknown command name fails that ONE step closed
    // (`{outcome:"unavailable", reason:"unknown-acceptance-script-command"}`)
    // without aborting the remaining steps, so a script can assert on a
    // failure mid-sequence exactly like a real multi-step user flow would.
    void (async () => {
      const commands: Record<string, (payload: unknown) => Promise<unknown>> = {
        "profile-create": (payload) => handleCreate(payload),
        "profile-unlock": (payload) => handleUnlock(payload),
        "profile-lock": () => handleLock(),
        "beta-status": () => handleBetaStatus(),
        "unified-graph": () => Promise.resolve(unifiedGraphDiagnostics()),
        "acceptance-create-direct-conversation": (payload) => handleAcceptanceCreateDirectConversation(payload),
        "acceptance-activate-direct-conversation": (payload) => handleAcceptanceActivateDirectConversation(payload),
        "acceptance-device-pairing-create": (payload) => handleAcceptanceDevicePairingCreate(payload),
        "acceptance-device-pairing-inspect": (payload) => handleAcceptanceDevicePairingInspect(payload),
        "acceptance-device-pairing-approve": (payload) => handleAcceptanceDevicePairingApprove(payload),
        "acceptance-device-pairing-complete": (payload) => handleAcceptanceDevicePairingComplete(payload),
        "acceptance-establish-direct-ratchet-session": (payload) => handleAcceptanceEstablishDirectRatchetSession(payload),
        "acceptance-send-message": (payload) => handleAcceptanceSendMessage(payload),
        "acceptance-list-messages": (payload) => handleAcceptanceListMessages(payload),
        "acceptance-read-message": (payload) => handleAcceptanceReadMessage(payload),
        "acceptance-direct-ratchet-status": (payload) => handleAcceptanceDirectRatchetStatus(payload),
        "acceptance-create-conversation-invitation": (payload) => handleAcceptanceCreateConversationInvitation(payload),
        "acceptance-search": (payload) => handleAcceptanceSearch(payload),
        "acceptance-archive": (payload) => handleAcceptanceArchive(payload),
        // Secure Runtime Alpha 8041-8120 -- non-DOM regression coverage for
        // the SAME `fedos-app:*` handler functions the real page's own
        // `window.fedosApp` bridge calls; useful both as a lower-level
        // regression suite (Phase O's own "a lower-level acceptance suite
        // may remain as regression coverage") and to isolate a main-process
        // handler bug from a renderer/DOM bug during development.
        "app-conversations-list": () => handleAppConversationsList(),
        "app-conversation-open": (payload) => handleAppConversationOpen(payload),
        "app-messages-list": (payload) => handleAppMessagesList(payload),
        "app-message-send": (payload) => handleAppMessageSend(payload),
        "app-devices-list": () => handleAppDevicesList(),
        "app-device-revoke": (payload) => handleAppDeviceRevoke(payload),
        "app-identity-transition-list": (payload) => handleAppIdentityTransitionList(payload),
        "app-deletion-request-list-received": () => handleAppDeletionRequestListReceived(),
        "app-safety-center-overview": () => handleAppSafetyCenterOverview(),
        "app-settings-load": () => handleAppSettingsLoad(),
        "app-relay-status": () => handleAppRelayStatus(),
        "acceptance-safety-center-overview": () => handleAcceptanceSafetyCenterOverview(),
        "read-global": (payload) => handleAcceptanceReadGlobal(payload),
      };
      try {
        const scriptRaw = process.env.FEDOS_BETA_ACCEPTANCE_SCRIPT ?? "[]";
        const script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }> = JSON.parse(scriptRaw);
        for (let i = 0; i < script.length; i++) {
          const step = script[i]!;
          // Secure Runtime Alpha 7321-7400 -- "wait" is the ONE pseudo-command
          // this script interpreter recognizes that never reaches a Shell/
          // IPC handler: a real, live, two-party relay-delivered flow needs
          // a genuine settle window for the durable Outbox Scheduler's own
          // NEXT real tick (Alpha 1471-1540, unmodified) before this process
          // exits -- exactly the same "standard NIP-01 client discipline"
          // settle wait every real vertical-slice test elsewhere in this
          // repository already uses, just expressed as a scripted step here
          // since this process has no test harness of its own to await from
          // the outside.
          if (step.command === "wait") {
            const ms = (step.payload as { ms?: unknown } | null)?.ms;
            await new Promise((resolve) => setTimeout(resolve, typeof ms === "number" && ms > 0 && ms <= 30000 ? ms : 0));
            console.log(`FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:${i}:${step.command}:${JSON.stringify({ outcome: "ok" })}`);
            continue;
          }
          const fn = commands[step.command];
          const result = fn === undefined ? { outcome: "unavailable", reason: "unknown-acceptance-script-command" } : await fn(step.payload);
          console.log(`FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:${i}:${step.command}:${JSON.stringify(result)}`);
        }
      } catch (err) {
        console.error("fedos-beta: acceptance script error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    })();
  }

  if (AUTOTEST_MODE === "ui-script") {
    // Secure Runtime Alpha 8041-8120 -- Phase O's own explicit requirement:
    // "the headline test must interact with visible user-facing controls...
    // do not substitute webContents calls directly into internal acceptance
    // methods for user-facing proof." Unlike `AUTOTEST_MODE=acceptance`
    // above (which calls this file's own internal handler functions
    // directly, bypassing the DOM entirely), this mode drives the REAL
    // rendered page through `webContents.executeJavaScript()` -- filling
    // real `<input>`/`<textarea>` elements, dispatching real `click()` calls
    // on real `<button>` elements, and reading back real rendered
    // `textContent`/`value` -- the exact same DOM `fedos_electron_beta_renderer.ts`
    // itself listens on, so every action still traverses the real
    // preload bridge -> real IPC channel -> real handler path, never a
    // shortcut around it. Test-only (`AUTOTEST_MODE` is never set on an
    // ordinary launch); does not weaken `contextIsolation`/`sandbox` for the
    // page itself -- `executeJavaScript` is a main-process-initiated
    // DevTools-protocol-level injection into the page's own world, the same
    // technique every Electron UI test harness (Spectron/Playwright) uses,
    // not a new capability exposed TO the page.
    void (async () => {
      const window = mainWindow;
      if (window === null) {
        await performCleanShutdown();
        return;
      }
      if (window.webContents.isLoadingMainFrame()) {
        await new Promise<void>((resolve) => window.webContents.once("did-finish-load", () => resolve()));
      }
      try {
        const scriptRaw = process.env.FEDOS_BETA_UI_SCRIPT ?? "[]";
        const script: ReadonlyArray<{ readonly action: "fill" | "click" | "doubleClick" | "read" | "readGlobal" | "wait"; readonly selector?: string; readonly value?: string; readonly as?: "text" | "value"; readonly ms?: number }> = JSON.parse(scriptRaw);
        for (let i = 0; i < script.length; i++) {
          const step = script[i]!;
          if (step.action === "wait") {
            const ms = step.ms;
            await new Promise((resolve) => setTimeout(resolve, typeof ms === "number" && ms > 0 && ms <= 30000 ? ms : 0));
            console.log(`FEDOS_ELECTRON_BETA_UI_STEP_JSON:${JSON.stringify({ index: i, action: "wait", selector: "", result: { outcome: "ok" } })}`);
            continue;
          }
          const selector = step.selector ?? "";
          let result: unknown;
          if (step.action === "fill") {
            const value = step.value ?? "";
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", { bubbles: true })); return { outcome: "ok" }; })()`,
            );
          } else if (step.action === "click") {
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; el.click(); return { outcome: "ok" }; })()`,
            );
          } else if (step.action === "doubleClick") {
            // Secure Runtime Alpha 8121-8200 -- Security Finding 2
            // (`6873d24f`): fires TWO real `.click()` calls back-to-back,
            // synchronously, with NO await between them -- the real
            // browser DOM dispatches the first click's own listener
            // synchronously up to its first `await`, so this genuinely
            // exercises "does the SECOND click reach the handler before
            // the first one's own disable-while-in-flight guard takes
            // effect," never a scripted delay that would hide a real race.
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; el.click(); el.click(); return { outcome: "ok" }; })()`,
            );
          } else if (step.action === "readGlobal") {
            // Secure Runtime Alpha 8121-8200 -- Security Finding 1
            // (`6873d24f`): reads `typeof window[<selector>]` for a small,
            // closed set of top-level bridge names ONLY (never an
            // arbitrary property path, never a value read) -- exists
            // solely to prove a bridge is genuinely ABSENT (`"undefined"`)
            // or genuinely PRESENT (`"object"`) from a real running page,
            // the same DevTools-injection technique every other action in
            // this block already uses, just checking presence rather than
            // DOM text.
            const allowedGlobals = new Set(["fedosProfile", "fedosBeta", "fedosAcceptance", "fedosApp"]);
            result = allowedGlobals.has(selector)
              ? { outcome: "ok", value: await window.webContents.executeJavaScript(`typeof window[${JSON.stringify(selector)}]`) }
              : { outcome: "invalid-input", reason: "unrecognized readGlobal selector" };
          } else {
            const as = step.as ?? "text";
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; return { outcome: "ok", value: ${as === "value" ? "el.value" : "el.textContent"} }; })()`,
            );
          }
          console.log(`FEDOS_ELECTRON_BETA_UI_STEP_JSON:${JSON.stringify({ index: i, action: step.action, selector, result })}`);
        }
      } catch (err) {
        console.error("fedos-beta: ui-script error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    })();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createBetaWindow();
    }
  });
});

app.on("window-all-closed", () => {
  void performCleanShutdown();
});
