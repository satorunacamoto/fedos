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
 * Presentation/Settings-application boundary over the SAME Runtime. This
 * file does, via the additive Phase C/D/E composition module
 * `FedosDesktopBetaApplicationAssembly`
 * (`../../../src/desktop/beta/fedos_desktop_beta_application_assembly.ts`):
 *
 *   packaged Electron main
 *     -> production activation authority (host attestation + pinned manifest)
 *     -> real WASM Master Seed generate/restore (NO dev seed double)
 *     -> the UNCHANGED FedosProfileInitializationCoordinator
 *     -> Desktop Runtime starts EXACTLY ONCE
 *     -> FedosDesktopBetaApplicationAssembly composes ONE Shell/Boundary over
 *        that SAME Runtime (never a second one) + wires the Alpha 4981-5060
 *        Settings Application Coordinator's own startup application
 *     -> ready / locked application state
 *
 * DISCLOSED SCOPE BOUNDARY (Phase C, honest): this file does NOT construct
 * Navigation/Notification-adapter/Tray/Badge/Device-Sync-event-wiring —
 * those remain real, tested, and reachable ONLY through
 * `fedos_electron_badge_main.cts`'s own separate Boundary/Runtime, not this
 * canonical entry point. Composing them into the SAME entry point as this
 * file's own unlock+settings composition is the named, disclosed remaining
 * gap for the next Arc (see the reconciliation report's own Phase R). This
 * file's own real notification port is `FedosElectronNotificationAdapter`
 * (Alpha 4261-4340, UNMODIFIED) directly — no Tray/Badge in this file.
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

const APP_ID = "com.fedos.desktop.beta";
const APP_VERSION = "0.1.0-beta.1";

const DEV_TOOLS_ENABLED = process.env.FEDOS_ELECTRON_BETA_DEVTOOLS === "1";
const AUTOTEST_MODE = process.env.FEDOS_ELECTRON_BETA_AUTOTEST ?? "";
/** TEST-INJECTION ONLY — see `fedos_electron_unlock_main.cts`'s own identical note. Never read on a normal launch. */
const AUTOTEST_SECRET = process.env.FEDOS_BETA_AUTOTEST_SECRET ?? "";

const MAX_LABEL_CHARS = 128;
const MAX_SECRET_BYTES = 1024;

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
interface CoordinatorLike {
  detectProfileState(): CoordResult<StatusView>;
  createProfile(input: { readonly displayLabel: string }, secret: UnlockSecretLike): Promise<CoordResult<ReadyView>>;
  unlockProfile(secret: UnlockSecretLike): Promise<CoordResult<ReadyView>>;
  lock(): Promise<CoordResult<{ readonly lifecycleState: string }>>;
  status(): StatusView;
  runningRuntime(): unknown;
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
interface AssemblyLike {
  readonly settingsCoordinator: {
    previewPlan(candidate: unknown): unknown;
    apply(candidate: unknown): Promise<unknown>;
    effectiveState(): AssemblyEffectiveStateLike | null;
  };
  readonly notificationCoordinator: { notify(candidate: unknown): Promise<unknown> };
  shutdown(): Promise<void>;
}
type AssemblyResult = { readonly outcome: "ok"; readonly value: AssemblyLike } | { readonly outcome: string; readonly reason: string };
interface SettingsControllerLike {
  load(): unknown;
}
interface NotificationPortLike {
  status(): "available" | "unavailable";
  notify(view: unknown): Promise<{ readonly delivered: boolean; readonly reason: string }>;
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
    start(deps: { coordinator: CoordinatorLike; settingsController: SettingsControllerLike; notificationPort: NotificationPortLike }): AssemblyResult;
  };
  readonly betaCapabilityManifestV1: () => unknown;
  readonly betaReleaseConfigurationV1: () => unknown;
  readonly betaLimitationsV1: () => unknown;
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
  };
}

// ---------------------------------------------------------------------
// Ownership state — mirrors fedos_electron_unlock_main.cts exactly.
// ---------------------------------------------------------------------

let modules: RootModules | null = null;
let mainWindow: BrowserWindow | null = null;
let activeCoordinator: CoordinatorLike | null = null;
let activeAssembly: AssemblyLike | null = null;
const notificationAdapter = new FedosElectronNotificationAdapter();
let inFlight = false;
let shutdownInitiated = false;

function requireModules(): RootModules {
  if (modules === null) throw new Error("fedos-beta: root modules not loaded");
  return modules;
}

async function buildFreshCoordinator(): Promise<{ coordinator: CoordinatorLike; masterSeedAuthority: MasterSeedAuthorityLike } | null> {
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
  const coordinator = new m.Coordinator({
    paths,
    profilePersistence: new m.ProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new m.SealedSeedPersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority: signer,
  });
  return { coordinator, masterSeedAuthority };
}

/** Phase C/D — composes the ONE Shell/Boundary + Settings Application Coordinator over the just-unlocked Runtime. Never called before a successful create/unlock. */
function startAssembly(coordinator: CoordinatorLike): AssemblyLike | null {
  const m = requireModules();
  const settingsController = m.createFileBackedSettingsController(settingsFilePath());
  const result = m.BetaApplicationAssembly.start({ coordinator, settingsController, notificationPort: notificationAdapter });
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
      const assembly = startAssembly(built.coordinator);
      if (assembly === null) {
        await built.coordinator.lock();
        return { outcome: "failed", reason: "profile created but application assembly failed to start" };
      }
      activeCoordinator = built.coordinator;
      activeAssembly = assembly;
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
      const assembly = startAssembly(built.coordinator);
      if (assembly === null) {
        await built.coordinator.lock();
        return { outcome: "failed", reason: "unlocked but application assembly failed to start" };
      }
      activeCoordinator = built.coordinator;
      activeAssembly = assembly;
      return readyResult(result.value);
    }
    await built.masterSeedAuthority.clear();
    return { outcome: result.outcome === "recovery-required" || result.outcome === "corrupt" ? result.outcome : "unlock-failed", reason: "unlock did not complete" };
  } finally {
    inFlight = false;
  }
}

async function handleLock() {
  if (inFlight) return { outcome: "busy", reason: "another command is in progress" };
  if (activeCoordinator === null) return { outcome: "ok", reason: "already locked" };
  inFlight = true;
  try {
    const coordinator = activeCoordinator;
    const assembly = activeAssembly;
    activeCoordinator = null;
    activeAssembly = null;
    // Stop background sync + the ONE Runtime via the assembly FIRST, then the coordinator's own
    // lock() (safe to call second -- a non-idempotent Runtime.stop() throw is caught and treated as
    // already-stopped, mirroring fedos_electron_unlock_main.cts's own documented discipline).
    if (assembly !== null) await assembly.shutdown();
    await coordinator.lock();
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
  return {
    profile: profileStatus,
    settingsEffectiveState,
    capabilities: m.betaCapabilityManifestV1(),
    release: m.betaReleaseConfigurationV1(),
    limitations: m.betaLimitationsV1(),
  };
}

async function handleSettingsPlan(candidate: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  return activeAssembly.settingsCoordinator.previewPlan(candidate);
}

async function handleSettingsApply(candidate: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  return activeAssembly.settingsCoordinator.apply(candidate);
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
  console.log("fedos-beta: shutdown clean");
  app.quit();
}

// ---------------------------------------------------------------------
// IPC — `fedos-profile:*` REUSED verbatim (Phase P). New, additive
// `fedos-beta:*` namespace for status + settings-application only.
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
  });
  void window.loadFile(path.join(__dirname, "fedos_electron_beta_page.html"));
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
    // Reuses the unlock package's own renderer self-test technique is out of this Arc's own scope
    // (its selftest module is package-private to that main); this file's own autotest mode simply
    // exercises the same IPC commands directly, headless, and logs a coarse pass/fail marker the
    // acceptance harness can grep for.
    void (async () => {
      try {
        const secretPayload = { label: "Beta Autotest", secret: AUTOTEST_SECRET };
        const result = AUTOTEST_MODE === "create" ? await handleCreate(secretPayload) : await handleUnlock({ secret: AUTOTEST_SECRET });
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:${result.outcome}`);
        const status = await handleBetaStatus();
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_STATUS:${JSON.stringify(status.profile)}`);
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
