/**
 * Secure Runtime Alpha 4821-4900 ("Packaged Electron Real-Unlock Acceptance
 * and GUI Passphrase-Input Boundary Arc") — Phase D/F: the unlock main
 * process. A NEW, ADDITIVE sibling main-process entry point, never a
 * modification of any prior `*_main.cts` (spike/navigation/notifications-tray/
 * badge) — all remain untouched.
 *
 * This is the ONE place the production real-unlock chain crosses into a real
 * Electron process:
 *
 *   packaged Electron main
 *     -> production activation authority (host attestation + pinned manifest)
 *     -> real WASM Master Seed generate/restore (NO dev seed double)
 *     -> the UNCHANGED FedosProfileInitializationCoordinator
 *     -> Desktop Runtime + local Device
 *     -> ready / locked application state
 *
 * OWNERSHIP (Phase F/N): at most ONE ready coordinator (`activeCoordinator`)
 * holds the ONE Desktop Runtime. It is constructed ONLY after a successful
 * create/unlock; a failed unlock constructs NO Runtime. `lock()` stops the
 * Runtime and drops the coordinator. Concurrent create/unlock are serialized
 * by `inFlight`; a window recreation never duplicates the Runtime.
 *
 * SECURITY (Phase D/O): the passphrase arrives ONLY through the dedicated,
 * closed `fedos-profile:create` / `fedos-profile:unlock` commands, is wrapped
 * immediately in the redacting `FedosProfileUnlockSecret` (consumed once by
 * the coordinator, then zeroed), and is NEVER logged, echoed, persisted,
 * placed on a result, or forwarded to any other channel. No raw Error / stack
 * ever leaves the main process. `contextIsolation`/`nodeIntegration`/
 * `sandbox`/`webSecurity` are the same mandatory literals every prior package
 * uses.
 */

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { runFedosUnlockRendererSelftest } from "./fedos_electron_unlock_selftest.js";

// Build-embedded, non-secret identity of this accepted Electron main package.
const APP_ID = "com.fedos.desktop.unlock";
const APP_VERSION = "0.0.1";

const DEV_TOOLS_ENABLED = process.env.FEDOS_ELECTRON_UNLOCK_DEVTOOLS === "1";
/** "create" | "unlock" — drives the REAL renderer self-test (Phase H/I/J); unset for an ordinary launch. */
const AUTOTEST_MODE = process.env.FEDOS_ELECTRON_UNLOCK_AUTOTEST ?? "";
/**
 * TEST-INJECTION ONLY: a stand-in for a human's keystrokes, read here ONLY in
 * autotest mode and typed into the real renderer input by the self-test. The
 * app's normal unlock path NEVER reads a secret from the environment — this
 * is not "environment variables as normal unlock UX" (an Absolute
 * Prohibition), it is the harness simulating typing so the acceptance suite
 * can exercise the real renderer -> preload -> main boundary.
 */
const AUTOTEST_SECRET = process.env.FEDOS_UNLOCK_AUTOTEST_SECRET ?? "";

const MAX_LABEL_CHARS = 128;
const MAX_SECRET_BYTES = 1024;

// ---------------------------------------------------------------------
// Durable location + artifact location.
// ---------------------------------------------------------------------

function dataDir(): string {
  const override = process.env.FEDOS_ELECTRON_UNLOCK_DATA_DIR;
  if (override !== undefined && override.length > 0) return path.join(override, "profile");
  return path.join(app.getPath("userData"), "profile");
}

/** The packaged `pkg/` artifact directory. Resolved from THIS process's layout, never `cwd` (a packaged app's cwd is arbitrary). */
function artifactDir(): string {
  const override = process.env.FEDOS_ELECTRON_UNLOCK_ARTIFACT_DIR;
  if (override !== undefined && override.length > 0) return override;
  // __dirname === packages/fedos-desktop-electron-spike/dist
  return path.join(__dirname, "..", "..", "fedos-core-rust", "pkg");
}

// ---------------------------------------------------------------------
// Loading the compiled production/onboarding graph from the root `dist/`.
// Same dynamic-import technique as every other main here; `npm run
// build:unlock-runtime` (root) must have produced `dist/` first.
// ---------------------------------------------------------------------

const rootDistDir = path.join(__dirname, "..", "..", "..", "dist");
function distUrl(...segments: string[]): string {
  return pathToFileURL(path.join(rootDistDir, ...segments)).href;
}

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
}

async function loadRootModules(): Promise<RootModules> {
  const attestation = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_desktop_host_attestation.js"))) as {
    createElectronMainHostAttestation: RootModules["createElectronMainHostAttestation"];
  };
  const activation = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_profile_activation.js"))) as {
    activateFedosProductionProfileMasterSeed: RootModules["activateFedosProductionProfileMasterSeed"];
  };
  const signer = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_nostr_signing_authority.js"))) as {
    FedosProductionNostrSigningAuthority: RootModules["NostrSigningAuthority"];
  };
  const paths = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_local_profile_paths.js"))) as {
    planFedosLocalProfilePaths: RootModules["planFedosLocalProfilePaths"];
    ensureFedosLocalProfileDirectories: RootModules["ensureFedosLocalProfileDirectories"];
  };
  const profilePersistence = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_local_profile_persistence.js"))) as {
    FileFedosLocalProfilePersistence: RootModules["ProfilePersistence"];
  };
  const sealedPersistence = (await import(distUrl("runtime", "master_seed", "fedos_sealed_master_seed_envelope_persistence.js"))) as {
    FileFedosSealedMasterSeedEnvelopePersistence: RootModules["SealedSeedPersistence"];
  };
  const coordinator = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_profile_initialization_coordinator.js"))) as {
    FedosProfileInitializationCoordinator: RootModules["Coordinator"];
  };
  const secret = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_profile_unlock_secret.js"))) as {
    FedosProfileUnlockSecret: RootModules["UnlockSecret"];
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
  };
}

// ---------------------------------------------------------------------
// Ownership state.
// ---------------------------------------------------------------------

let modules: RootModules | null = null;
let mainWindow: BrowserWindow | null = null;
/** The ONE ready coordinator holding the ONE Runtime, or null when not unlocked. */
let activeCoordinator: CoordinatorLike | null = null;
/** Serializes create/unlock/lock — a concurrent command fails closed with a coarse "busy". */
let inFlight = false;
let shutdownInitiated = false;

function requireModules(): RootModules {
  if (modules === null) throw new Error("fedos-unlock: root modules not loaded");
  return modules;
}

/**
 * Builds a fresh, independent coordinator backed by a fresh production
 * activation (real WASM). Every create/unlock ATTEMPT gets its own, so a
 * failed attempt leaves no half-initialised authority; only a SUCCESSFUL one
 * is promoted to `activeCoordinator`. Returns `null` if production activation
 * is blocked (fail closed — never a dev/fake authority).
 */
async function buildFreshCoordinator(): Promise<{ coordinator: CoordinatorLike; masterSeedAuthority: MasterSeedAuthorityLike } | null> {
  const m = requireModules();
  const attestation = m.createElectronMainHostAttestation({ appId: APP_ID, appVersion: APP_VERSION });
  const activation = await m.activateFedosProductionProfileMasterSeed({
    attestation,
    artifactDir: artifactDir(),
    // `import()` of an absolute path must be a file:// URL under Node/Electron ESM.
    importGlue: (specifier: string) => import(pathToFileURL(specifier).href),
  });
  if (activation.outcome !== "activated") {
    console.error(`fedos-unlock: production activation blocked (${activation.decision})`);
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

// ---------------------------------------------------------------------
// Payload validation (Phase B/D): strict schema, bounded size, no unknown
// fields, no echo. The secret NEVER leaves this function except into the
// one-shot `FedosProfileUnlockSecret`.
// ---------------------------------------------------------------------

function validatedLabel(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const keys = Object.keys(payload);
  if (!keys.every((k) => k === "label" || k === "secret")) return null; // no unknown fields
  const label = (payload as { label?: unknown }).label;
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LABEL_CHARS) return null;
  return trimmed;
}

/** Extracts the secret bytes WITHOUT logging/echoing. Returns null when the payload is malformed or the secret is oversized/empty. */
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
// Command handlers. Each returns ONLY JSON-safe, secret-free, coarse output.
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
  if (activeCoordinator !== null) {
    return sanitizeStatus(activeCoordinator.status());
  }
  const built = await buildFreshCoordinator();
  if (built === null) {
    return { lifecycleState: "absent", presence: "absent", displayLabel: null, accountPublicIdentifier: null, localDeviceId: null, runtimeRunning: false };
  }
  const detect = built.coordinator.detectProfileState();
  await built.masterSeedAuthority.clear(); // throwaway detection authority — release immediately
  if (detect.outcome === "ok" && "value" in detect) return sanitizeStatus(detect.value);
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
    const secret = new (requireModules().UnlockSecret)(secretBytes); // ownership transferred; zeroed on consume
    const result = await built.coordinator.createProfile({ displayLabel: label }, secret);
    if (result.outcome === "ok" && "value" in result) {
      activeCoordinator = built.coordinator;
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
      activeCoordinator = built.coordinator;
      return readyResult(result.value);
    }
    // Failed unlock builds NO Runtime and holds NO live seed.
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
    activeCoordinator = null; // drop the reference FIRST so no concurrent status sees a stopping Runtime
    await coordinator.lock();
    return { outcome: "ok" };
  } finally {
    inFlight = false;
  }
}

async function performCleanShutdown(): Promise<void> {
  if (shutdownInitiated) return;
  shutdownInitiated = true;
  if (activeCoordinator !== null) {
    const coordinator = activeCoordinator;
    activeCoordinator = null;
    try {
      await coordinator.lock();
    } catch {
      /* never throws */
    }
  }
  console.log("fedos-unlock: shutdown clean");
  app.quit();
}

// ---------------------------------------------------------------------
// IPC — the closed, dedicated `fedos-profile:*` contract. Exactly five.
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
}

// ---------------------------------------------------------------------
// Window.
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

function createUnlockWindow(): BrowserWindow {
  const offscreen = AUTOTEST_MODE.length > 0;
  const window = new BrowserWindow({
    width: 720,
    height: 620,
    show: !offscreen,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      offscreen,
      preload: path.join(__dirname, "fedos_electron_unlock_preload.cjs"),
    },
  });
  applySecureWindowPolicy(window);
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window.loadFile(path.join(__dirname, "fedos_electron_unlock_page.html"));
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
    mainWindow = createUnlockWindow();
    console.log("fedos-unlock: host started");
  } catch (err) {
    console.error("fedos-unlock: startup failed", err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }

  if (AUTOTEST_MODE === "create" || AUTOTEST_MODE === "unlock") {
    const window = mainWindow;
    if (window === null) {
      console.error("fedos-unlock: no window for autotest");
      app.quit();
      return;
    }
    const run = async () => {
      try {
        await runFedosUnlockRendererSelftest(window.webContents, {
          mode: AUTOTEST_MODE,
          secret: AUTOTEST_SECRET,
          dataDir: dataDir(),
          log: (line: string) => console.log(line),
        });
      } catch (err) {
        console.error("fedos-unlock: autotest error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    };
    if (window.webContents.isLoading()) {
      window.webContents.once("did-finish-load", () => void run());
    } else {
      void run();
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createUnlockWindow();
    }
  });
});

// No `window-all-closed` -> quit on some platforms would be normal; here we
// quit when no windows remain to keep the acceptance harness deterministic.
app.on("window-all-closed", () => {
  void performCleanShutdown();
});
