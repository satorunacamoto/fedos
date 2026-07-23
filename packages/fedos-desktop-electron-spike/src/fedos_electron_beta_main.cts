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
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
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

const MAX_LABEL_CHARS = 128;
const MAX_SECRET_BYTES = 1024;
const MAX_ID_LENGTH = 512;

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
/** Secure Runtime Alpha 6681-6760 — narrow, safe-only Shell surface for the AUTOTEST diagnostic; never exposes a raw Runtime/secret/handle. */
interface ShellDiagnosticLike {
  productionCryptoStatus(): { readonly outcome: string; readonly [key: string]: unknown };
}
interface AssemblyLike {
  readonly shell: ShellDiagnosticLike;
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
  return {
    privateTransportEnabled: true,
    conversationTransportRelays: relays,
    conversationTransportSigningAuthority: signer,
    directRatchetEnabled: true,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
    deletionRequestEnabled: true,
    deletionRequestResolveLocalPolicy: () => "always-review",
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createBetaWindow();
    }
  });
});

app.on("window-all-closed", () => {
  void performCleanShutdown();
});
