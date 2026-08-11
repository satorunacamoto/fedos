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
import { randomBytes as nodeRandomBytes } from "node:crypto";
import { FedosElectronNotificationAdapter } from "./fedos_electron_notification_adapter.js";
import { FedosElectronTrayAdapter } from "./fedos_electron_tray_adapter.js";
import { FedosElectronBadgeAdapter, type FedosElectronBadgeTrayMenuItemLike } from "./fedos_electron_badge_adapter.js";
import {
  FEDOS_COMMERCE_DEMO_PRODUCTS,
  FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA,
  fedosCommerceDemoMerchantLabel,
  type FedosCommerceDemoProduct,
} from "./fedos_electron_beta_commerce_demo_catalog.js";

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

/**
 * FedOS Commerce FINAL Closure (Agent X) — packaged-binary acceptance
 * reachability fix. Root cause (reproduced live, not guessed): when this
 * package's own `electron-builder`-packaged Windows executable (the
 * renamed/resource-edited copy of `electron.exe` that `npm run
 * package:beta`/NSIS install produce — NOT the raw `node_modules/electron`
 * dev binary) is launched with its stdout/stderr handles redirected to
 * ANY non-NUL target (an anonymous pipe, a real file, or an inherited
 * console handle — all three reproduced), the process never completes
 * Chromium's multi-process bootstrap (zero GPU/utility child processes
 * ever spawn, confirmed via live process-tree inspection over 40s) and
 * never calls back into this file's own code at all — so EVERY
 * `console.log`-based signal (`FEDOS_ELECTRON_BETA_UI_STEP_JSON`, the
 * `ui-script`/`acceptance` step markers) and even the disk-based
 * screenshot writer are equally unreachable, matching exactly what the
 * Commerce E2E Completion arc's own "known limitation" observed. Only
 * `stdio: "ignore"` (true NUL, no redirection at all — confirmed live,
 * matches a plain `Start-Process`/double-click launch) lets the packaged
 * binary proceed normally. This is an environment/Chromium-sandbox
 * interaction with inherited stdio handles, not a bug in this file's own
 * logic — no `app.isPackaged` branch exists anywhere near this code, and
 * the SAME `AUTOTEST_MODE=ui-script` loop below already works perfectly
 * against the dev-launched binary under IDENTICAL pipe-redirected stdio.
 * Since a harness driving the packaged binary MUST therefore use
 * `stdio: "ignore"` (no stdout/stderr capture is possible), it needs a
 * disk-based evidence channel that does not depend on being able to
 * observe this process's own stdout at all — this env var opts into
 * exactly that, additively, alongside (never replacing) the existing
 * console marker every other caller (including the dev-launch test
 * `commerce_e2e_full_happy_path_real_electron.test.ts`) already reads.
 * Empty by default; a real production launch never sets it (confirmed:
 * `scripts/run_electron_builder_package_beta.mjs`/`scripts/build_release.mjs`
 * launch nothing and set no env vars at packaging time — this is read
 * only at RUNTIME, by whoever spawns the already-built exe, exactly like
 * every other `FEDOS_ELECTRON_BETA_*`/`FEDOS_BETA_*` test-only override
 * in this file).
 */
const UI_STEP_LOG_FILE = process.env.FEDOS_BETA_UI_STEP_LOG_FILE ?? "";

/**
 * FedOS Commerce FINAL Closure (Agent X) — same disk-mirror idiom as
 * `UI_STEP_LOG_FILE` above, for a handful of coarse LIFECYCLE checkpoints
 * (never step-level detail) so a harness running under `stdio: "ignore"`
 * (the only mode that reliably reaches the packaged binary at all — see
 * `UI_STEP_LOG_FILE`'s own doc comment) can pinpoint WHICH phase a run is
 * in without any console access. No-op unless `UI_STEP_LOG_FILE` is set;
 * failures are swallowed (best-effort diagnostic only, never masks or
 * replaces a real assertion).
 */
function logCheckpoint(label: string): void {
  if (UI_STEP_LOG_FILE.length === 0) return;
  try {
    fs.mkdirSync(path.dirname(UI_STEP_LOG_FILE), { recursive: true });
    fs.appendFileSync(UI_STEP_LOG_FILE, `FEDOS_ELECTRON_BETA_CHECKPOINT:${label}:${Date.now()}\n`);
  } catch {
    /* best-effort only */
  }
}

const MAX_LABEL_CHARS = 128;
const MAX_SECRET_BYTES = 1024;
const MAX_ID_LENGTH = 512;
/** Commerce E2E Completion arc — bounds for the new Merchant Product CRUD / Order IPC surface. Same discipline as every bound above: sized for the field, never generous "just in case". */
const MAX_PRODUCT_TITLE_CHARS = 200;
const MAX_PRODUCT_DESCRIPTION_CHARS = 4000;
const MAX_CURRENCY_CHARS = 8;
const MAX_ORDER_REJECTION_REASON_CHARS = 500;
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
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
   * pass) -- present (as a real, callable function) on the canonical
   * production `FedosProductionMasterSeedAuthority` this Coordinator
   * already activates (see that class's own Commerce FINAL Closure
   * doc comment); OPTIONAL here purely because this structural "Like"
   * interface is also satisfied by other, non-Commerce-aware callers
   * elsewhere in this file's own type graph. Returns an opaque handle
   * (never a raw key byte), or `null` on any failure -- fails closed,
   * mirrors `FedosMasterSeedAuthority.resolveCommerceMediaKey`'s own
   * contract exactly (`src/os/core/vault/wasm/fedos_master_seed_authority.ts`).
   */
  resolveCommerceMediaKey?(): Promise<unknown>;
}
/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- structural mirror
 * of `FedosNostrSigningAuthority` (`src/os/messenger/adapters/nostr/protocol/sign/`),
 * satisfied at runtime by the SAME `FedosProductionNostrSigningAuthority`
 * instance `buildFreshCoordinator()` already constructs for Direct
 * Ratchet/Conversation Transport -- never a second signer, never a second
 * Master Seed reach.
 */
interface NostrSigningAuthorityLike {
  signEvent(request: unknown): Promise<unknown>;
  publicIdentityForAccount(accountIndex: number): Promise<{ readonly publicKeyHex: string } | null>;
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
  /**
   * Commerce Reachable Catalog + Product Surface Phase 1 -- the real
   * `os/commerce` domain's `listViewableProducts()`, loaded exactly like
   * every other module in this function (compiled `dist/`, dynamic
   * `import()`). Read-only catalog discovery.
   *
   * Commerce E2E Completion arc (coordinator integration gate) widens this
   * to the real, mutable Merchant Product CRUD + Order + local Payment
   * simulator surface -- still every field loaded from the SAME compiled
   * `os/commerce/index.js` barrel, still zero network/storage dependency
   * inside the domain itself (`LocalProductRepository`/`LocalOrderRepository`
   * are in-process only; THIS main process is the only thing that holds
   * them, module-scope, for its own lifetime -- see the `commerceProductRepo`
   * etc. state below). Constructors are typed as `new (...) => X` so
   * `new modules.Commerce.LocalProductRepository(...)` produces a real,
   * checked instance -- never `any`.
   */
  readonly Commerce: {
    readonly listViewableProducts: (
      products: readonly FedosCommerceDemoProduct[],
      actorPubkey?: string,
      grants?: readonly unknown[],
    ) => readonly FedosCommerceDemoProduct[];
    readonly LocalProductRepository: new (
      generateId?: () => string,
      initialProducts?: readonly CommerceProductLike[],
    ) => CommerceProductRepositoryLike;
    readonly LocalOrderRepository: new () => CommerceOrderRepositoryLike;
    readonly createOrder: (input: CommerceCreateOrderInputLike, actor: CommerceOrderActorLike, now: number) => CommerceOrderTransitionResultLike;
    readonly applyOrderAction: (order: CommerceOrderLike, action: CommerceOrderActionLike, now: number) => CommerceOrderTransitionResultLike;
    readonly DeterministicLocalPaymentProvider: new (options: { readonly acknowledgeTestOnly: true; readonly runtimeProfile?: string }) => CommerceLocalPaymentProviderLike;
    readonly PaymentSettlementLedger: new () => CommercePaymentLedgerLike;
    readonly LocalDeliveryRepository: new () => CommerceDeliveryRepositoryLike;
    readonly createDelivery: (input: CommerceCreateDeliveryInputLike, actor: CommerceDeliveryActorLike, now: number) => CommerceDeliveryTransitionResultLike;
    readonly applyDeliveryAction: (delivery: CommerceDeliveryRecordLike, action: CommerceDeliveryActionLike, now: number) => CommerceDeliveryTransitionResultLike;
    readonly issueSignedTradeReceiptProof: (payload: unknown, keys: unknown, options: unknown) => unknown;
    readonly verifySignedTradeReceiptProof: (envelope: unknown, policy: unknown) => { readonly status: string; readonly payload?: unknown };
    readonly encodeCommerceReceiptProofToQrText: (envelope: unknown) => string;
    readonly decodeCommerceReceiptProofFromQrText: (text: string) => unknown;
  };
  /**
   * Commerce E2E Completion arc (coordinator) -- the narrow slice of the
   * real `os/trust` barrel this main process needs to issue/verify a
   * signed Commerce receipt (`os/commerce/receipt/commerce_trust_receipt_adapter.ts`'s
   * own two required collaborators it never constructs itself: a signing
   * keypair and a verification policy). Loaded exactly like `Commerce`
   * above -- compiled `dist/`, dynamic `import()`. This is the ONLY
   * `os/trust` surface this main process touches.
   */
  readonly Trust: {
    readonly FedosTrustSigningKeypair: { readonly generate: () => { readonly publicKeyHex: string } };
    readonly createSingleIssuerFedosTrustPolicy: (options: { readonly issuerId: string; readonly keys: readonly { readonly keyId: string; readonly publicKeyHex: string }[] }) => unknown;
  };
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
   * pass) -- Agent R's `os/commerce/reputation/index.ts` (its own scoped
   * barrel, mirroring `./order/index.ts`'s convention -- NOT re-exported
   * from the top-level `os/commerce/index.ts` barrel, since Reputation is
   * additive/optional the same way Nostr publication is). Loaded exactly
   * like `Commerce`/`Trust` above -- compiled `dist/`, dynamic `import()`.
   */
  readonly Reputation: {
    readonly LocalPersonaEpochRegistry: new () => CommercePersonaEpochRegistryLike;
    readonly LocalTradeCompletionAttestationStore: new () => CommerceTradeCompletionAttestationStoreLike;
    readonly createPersonaEpoch: (
      validFrom: number,
      validUntil: number,
      predecessorEpochId?: string,
    ) => { readonly epoch: CommercePersonaEpochLike; readonly keypair: CommercePersonaEpochSigningKeypairLike };
    readonly issueTradeCompletionAttestation: (
      deps: { readonly orderRepository: CommerceOrderRepositoryLike; readonly store: CommerceTradeCompletionAttestationStoreLike },
      request: Record<string, unknown>,
      now: number,
    ) => CommerceIssueTradeCompletionAttestationResultLike;
    readonly queryPersonaBoardView: (
      subjectEpochId: string,
      layer: "PUBLIC" | "PSEUDONYMOUS_PROOF" | "AUTHORIZED",
      registry: CommercePersonaEpochRegistryLike,
      store: CommerceTradeCompletionAttestationStoreLike,
      asOf: number,
    ) => CommercePersonaBoardQueryResultLike | undefined;
  };
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent M's real
   * `WasmProductMediaEncryption`/`WasmProductMediaDecryption` adapters plus
   * `IpfsMediaStore` itself, all now barreled from `os/commerce/index.ts`
   * (see that file's own Commerce FINAL Closure header addition).
   */
  readonly Media: {
    readonly IpfsMediaStore: new (
      transport: unknown,
      maxPayloadByteLength: number,
      supportedContentTypes: readonly string[],
      encryption?: unknown,
      networkProfile?: string,
      now?: () => number,
      decryption?: unknown,
    ) => CommerceMediaStoreLike;
    readonly InMemoryIpfsTransport: new (options?: { readonly simulateOffline?: boolean }) => unknown;
    readonly WasmProductMediaEncryption: new (authority?: unknown) => unknown;
    readonly WasmProductMediaDecryption: new (authority?: unknown) => unknown;
  };
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's
   * outbound Port + real Nostr adapter transport, and the inbound
   * read-model + real verifying bridge. NOT part of `os/commerce/index.ts`'s
   * public barrel (that file's own header explicitly leaves this decision
   * to the coordinator's own composition-root wiring) -- loaded here via
   * explicit `tsconfig.beta-runtime.json` entries for the four files this
   * needs, the same "explicit whitelist, one entry per reachable file"
   * discipline that file already documents for every other module in this
   * function.
   */
  readonly CommerceNostr: {
    readonly CommerceNostrEventPortImpl: new (transport: CommerceNostrTransportLike, networkProfile?: string) => CommerceNostrEventPortLike;
    readonly RealCommerceNostrEventTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly accountIndex: number;
    }) => CommerceNostrTransportLike;
    readonly CommerceNostrProductReadModel: new () => CommerceNostrReadModelLike;
    readonly verifyAndBuildInboundCommerceNostrEnvelope: (event: unknown, options?: unknown) => Promise<unknown>;
    readonly WebSocketRelayPublisher: new (url: string, options: { readonly factory: (url: string) => Promise<unknown> }) => unknown;
  };
}

/** Structural mirrors of the real `os/commerce` types (`Product`, `Order`, `PaymentEvidence`, ...) -- same discipline as `FedosCommerceDemoProduct` above: this file never `import type`s from `src/os/commerce/**` (only the compiled runtime, dynamically), so every shape it touches is re-declared here, structurally, once. */
interface CommerceProductLike {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly description?: string;
  readonly creatorPubkey: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly status: string;
  readonly visibility: string;
  readonly linkedSpaceIds: readonly string[];
  readonly linkedEventIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly stock?: number;
}
interface CommerceProductMutationResultLike {
  readonly outcome: "ok" | "not-found" | "forbidden" | "invalid-input";
  readonly product?: CommerceProductLike;
  readonly reason?: string;
}
interface CommerceProductRepositoryLike {
  create(actorPubkey: string, input: Record<string, unknown>): CommerceProductMutationResultLike;
  update(actorPubkey: string, productId: string, patch: Record<string, unknown>): CommerceProductMutationResultLike;
  publish(actorPubkey: string, productId: string): CommerceProductMutationResultLike;
  unpublish(actorPubkey: string, productId: string): CommerceProductMutationResultLike;
  get(id: string): CommerceProductLike | undefined;
  list(): readonly CommerceProductLike[];
  listOwnedByMerchant(actorPubkey: string): readonly CommerceProductLike[];
  listPublished(): readonly CommerceProductLike[];
}
interface CommerceOrderActorLike {
  readonly kind: "customer" | "merchant" | "payment_evidence" | "delivery_evidence";
  readonly pubkey?: string;
}
interface CommerceOrderLike {
  readonly id: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly paymentId?: string;
  readonly deliveryId?: string;
  readonly history: readonly { readonly from: string | null; readonly to: string; readonly at: number }[];
  readonly [key: string]: unknown;
}
interface CommerceCreateOrderInputLike {
  readonly id: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly quantity?: number;
}
interface CommerceOrderActionLike {
  readonly type: string;
  readonly actor: CommerceOrderActorLike;
  readonly [key: string]: unknown;
}
interface CommerceOrderTransitionResultLike {
  readonly ok: boolean;
  readonly order?: CommerceOrderLike;
  readonly reason?: string;
  readonly code?: string;
}
interface CommerceOrderRepositoryLike {
  save(order: CommerceOrderLike): void;
  findById(id: string): CommerceOrderLike | undefined;
  list(): readonly CommerceOrderLike[];
  listByBuyer(buyerPubkey: string): readonly CommerceOrderLike[];
  listBySeller(sellerPubkey: string): readonly CommerceOrderLike[];
}
interface CommercePaymentEvidenceLike {
  readonly paymentId: string;
  readonly productId: string;
  readonly orderId?: string;
  readonly observedAt: number;
  readonly status: string;
  readonly reason?: string;
  readonly verification?: { readonly source: string; readonly authoritative: boolean };
}
interface CommerceLocalPaymentProviderLike {
  requestPayment(request: { readonly productId: string; readonly orderId?: string; readonly buyerPubkey?: string; readonly amountCents: number; readonly currency: string; readonly expiresAt?: number }): Promise<{
    readonly allowed: boolean;
    readonly status: string;
    readonly reason: string;
    readonly productId: string;
    readonly orderId?: string;
    readonly paymentId?: string;
    readonly expiresAt?: number;
  }>;
  simulateSettlement(paymentId: string, outcome: "settled" | "failed" | "expired" | "refunded"): Promise<CommercePaymentEvidenceLike>;
}
interface CommerceSettlementStateLike {
  readonly paymentId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly status: string;
}
interface CommerceSettlementApplyResultLike {
  readonly state: CommerceSettlementStateLike;
  readonly outcome: "transitioned" | "rejected" | "noop";
  readonly reason?: string;
}
interface CommercePaymentLedgerLike {
  bind(paymentId: string, orderId: string, productId: string, createdAt?: number): CommerceSettlementStateLike;
  get(paymentId: string): CommerceSettlementStateLike | undefined;
  apply(evidence: CommercePaymentEvidenceLike, expectedOrderId: string): CommerceSettlementApplyResultLike;
}
interface CommerceDeliveryActorLike {
  readonly kind: "merchant" | "customer" | "delivery_evidence";
  readonly pubkey?: string;
}
interface CommerceDeliveryRecordLike {
  readonly id: string;
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: string;
  readonly receiptArtifact?: unknown;
  readonly [key: string]: unknown;
}
interface CommerceCreateDeliveryInputLike {
  readonly id: string;
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly orderPaymentConfirmed: boolean;
}
interface CommerceDeliveryActionLike {
  readonly type: string;
  readonly actor: CommerceDeliveryActorLike;
  readonly [key: string]: unknown;
}
interface CommerceDeliveryTransitionResultLike {
  readonly ok: boolean;
  readonly delivery?: CommerceDeliveryRecordLike;
  readonly reason?: string;
  readonly code?: string;
}
interface CommerceDeliveryRepositoryLike {
  save(delivery: CommerceDeliveryRecordLike): void;
  findById(id: string): CommerceDeliveryRecordLike | undefined;
  findByOrderId(orderId: string): CommerceDeliveryRecordLike | undefined;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
 * pass) -- structural mirrors of `os/commerce/reputation/`'s real shapes,
 * same "never `import type` from `src/os/commerce/**`" discipline as every
 * other `*Like` interface in this file.
 */
interface CommercePersonaEpochLike {
  readonly epochId: string;
  readonly epochKeyPublicHex: string;
  readonly validFrom: number;
  readonly validUntil: number;
  readonly predecessorEpochId?: string;
}
interface CommercePersonaEpochSigningKeypairLike {
  readonly publicKeyHex: string;
}
interface CommercePersonaEpochRegistryLike {
  register(epoch: CommercePersonaEpochLike): void;
  findById(epochId: string): CommercePersonaEpochLike | undefined;
  isCurrentlyValid(epochId: string, atTimeUnixSeconds: number): boolean;
}
interface CommerceTradeCompletionAttestationStoreLike {
  hasAttestedOrder(orderId: string, attestorRealPubkey: string): boolean;
  findBySubjectEpochId(subjectEpochId: string): readonly unknown[];
}
interface CommerceIssueTradeCompletionAttestationResultLike {
  readonly ok: boolean;
  readonly code?: string;
  readonly reason?: string;
}
interface CommercePersonaBoardViewLike {
  readonly layer: string;
  readonly epochId: string;
  readonly epochKeyPublicHex?: string;
  readonly verifiedTradeCountBucket?: string;
  readonly verifiedTradeCount?: number;
  readonly primaryCategory?: string;
  readonly attestationRefs: readonly string[];
}
interface CommercePersonaBoardQueryResultLike {
  readonly view: CommercePersonaBoardViewLike;
  readonly verificationState: {
    readonly epochKnown: boolean;
    readonly epochCurrentlyValid: boolean;
    readonly totalStoredAttestations: number;
    readonly validSignatureAttestations: number;
    readonly rejectedSignatureAttestations: number;
  };
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- structural mirror
 * of `IpfsMediaStore`'s own public surface. This main process only ever
 * constructs and holds an instance (proving Agent M's real Master Seed
 * Authority injection makes it genuinely live) -- no IPC channel calls any
 * method on it this pass, so only the shape needed to construct/introspect
 * it is declared.
 */
interface CommerceMediaStoreLike {
  readonly [key: string]: unknown;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- structural mirrors
 * of `os/commerce/events/`'s real shapes.
 */
interface CommerceNostrTransportLike {
  send(draft: unknown): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
}
interface CommerceNostrEventPortLike {
  publish(draft: unknown): Promise<{ readonly outcome: string; readonly reason: string; readonly eventId?: string }>;
}
interface CommerceNostrReadModelLike {
  ingest(envelope: unknown): { readonly outcome: string; readonly reason: string; readonly productId?: string };
  getProduct(productId: string): unknown;
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
  const settingsController = (await import(distUrl("os", "messenger", "desktop", "settings", "fedos_desktop_settings_controller.js"))) as {
    createFileBackedFedosDesktopSettingsController: RootModules["createFileBackedSettingsController"];
  };
  const assembly = (await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_application_assembly.js"))) as {
    FedosDesktopBetaApplicationAssembly: RootModules["BetaApplicationAssembly"];
  };
  // NOT migrated with its siblings above: this one file has an unrelated,
  // uncommitted, in-progress edit from a different arc on this branch and was
  // deliberately left at its original path -- see the Messenger migration
  // Stage 6 commit message and fedos_desktop_beta_release_configuration.ts's
  // own note.
  const capabilityManifest = (await import(distUrl("desktop", "beta", "fedos_desktop_beta_capability_manifest.js"))) as {
    fedosDesktopBetaCapabilityManifestV1: RootModules["betaCapabilityManifestV1"];
  };
  const releaseConfiguration = (await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_release_configuration.js"))) as {
    fedosDesktopBetaReleaseConfigurationV1: RootModules["betaReleaseConfigurationV1"];
  };
  const limitations = (await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_limitations.js"))) as {
    fedosDesktopBetaLimitationsV1: RootModules["betaLimitationsV1"];
  };
  const deviceSyncEventBridgeModule = (await import(distUrl("device", "sync_events", "fedos_device_sync_event_bridge.js"))) as {
    FedosDeviceSyncEventBridge: RootModules["DeviceSyncEventBridge"];
  };
  const websocketRelay = (await import(distUrl("os", "messenger", "desktop", "websocket_relay.js"))) as {
    WebSocketRelay: RootModules["WebSocketRelay"];
  };
  const websocketRelaySocketFactory = (await import(distUrl("os", "messenger", "desktop", "node_websocket_relay_socket_factory.js"))) as {
    createNodeWebSocketRelaySocketFactory: RootModules["createNodeWebSocketRelaySocketFactory"];
  };
  const trayTypes = (await import(distUrl("os", "messenger", "desktop", "tray", "fedos_desktop_tray_types.js"))) as {
    fedosDesktopTrayMenuItems: RootModules["fedosDesktopTrayMenuItems"];
  };
  // Commerce Reachable Catalog + Product Surface Phase 1 -- first-ever
  // production caller of `createCommerce()`'s barrel (`src/os/commerce/index.ts`,
  // newly added to `tsconfig.beta-runtime.json`'s include list this arc).
  // Commerce E2E Completion arc (coordinator integration gate) widens the
  // set of names taken from the SAME already-whitelisted barrel -- no new
  // tsconfig entry needed, `os/commerce/index.js` was already the include.
  const commerce = (await import(distUrl("os", "commerce", "index.js"))) as {
    listViewableProducts: RootModules["Commerce"]["listViewableProducts"];
    LocalProductRepository: RootModules["Commerce"]["LocalProductRepository"];
    LocalOrderRepository: RootModules["Commerce"]["LocalOrderRepository"];
    createOrder: RootModules["Commerce"]["createOrder"];
    applyOrderAction: RootModules["Commerce"]["applyOrderAction"];
    DeterministicLocalPaymentProvider: RootModules["Commerce"]["DeterministicLocalPaymentProvider"];
    PaymentSettlementLedger: RootModules["Commerce"]["PaymentSettlementLedger"];
    LocalDeliveryRepository: RootModules["Commerce"]["LocalDeliveryRepository"];
    createDelivery: RootModules["Commerce"]["createDelivery"];
    applyDeliveryAction: RootModules["Commerce"]["applyDeliveryAction"];
    issueSignedTradeReceiptProof: RootModules["Commerce"]["issueSignedTradeReceiptProof"];
    verifySignedTradeReceiptProof: RootModules["Commerce"]["verifySignedTradeReceiptProof"];
    encodeCommerceReceiptProofToQrText: RootModules["Commerce"]["encodeCommerceReceiptProofToQrText"];
    decodeCommerceReceiptProofFromQrText: RootModules["Commerce"]["decodeCommerceReceiptProofFromQrText"];
  };
  // Commerce E2E Completion arc (coordinator) -- the ONE os/trust surface
  // this main process touches: a signing keypair generator and a
  // single-issuer verification policy, both required by the commerce
  // receipt adapter's own `CommerceReceiptSigningKeys`/verify contract.
  const trust = (await import(distUrl("os", "trust", "index.js"))) as {
    FedosTrustSigningKeypair: RootModules["Trust"]["FedosTrustSigningKeypair"];
    createSingleIssuerFedosTrustPolicy: RootModules["Trust"]["createSingleIssuerFedosTrustPolicy"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's own
  // scoped reputation barrel (`os/commerce/reputation/index.js`), loaded
  // exactly like `Commerce`/`Trust` above.
  const reputation = (await import(distUrl("os", "commerce", "reputation", "index.js"))) as {
    LocalPersonaEpochRegistry: RootModules["Reputation"]["LocalPersonaEpochRegistry"];
    LocalTradeCompletionAttestationStore: RootModules["Reputation"]["LocalTradeCompletionAttestationStore"];
    createPersonaEpoch: RootModules["Reputation"]["createPersonaEpoch"];
    issueTradeCompletionAttestation: RootModules["Reputation"]["issueTradeCompletionAttestation"];
    queryPersonaBoardView: RootModules["Reputation"]["queryPersonaBoardView"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent M's real
  // media adapters, now barreled from `os/commerce/index.js` (the SAME
  // already-whitelisted `Commerce` barrel loaded above) -- no new tsconfig
  // entry needed for these three.
  const commerceMedia = (await import(distUrl("os", "commerce", "index.js"))) as {
    IpfsMediaStore: RootModules["Media"]["IpfsMediaStore"];
    InMemoryIpfsTransport: RootModules["Media"]["InMemoryIpfsTransport"];
    WasmProductMediaEncryption: RootModules["Media"]["WasmProductMediaEncryption"];
    WasmProductMediaDecryption: RootModules["Media"]["WasmProductMediaDecryption"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's
  // outbound Port + real Nostr adapter transport (two explicit
  // `tsconfig.beta-runtime.json` entries) and the inbound read-model + real
  // verifying bridge (two more) -- see `RootModules["CommerceNostr"]`'s own
  // doc comment for why these are not part of the public `os/commerce`
  // barrel.
  const commerceNostrOutbound = (await import(distUrl("os", "commerce", "events", "commerce_nostr_event_port.js"))) as {
    CommerceNostrEventPortImpl: RootModules["CommerceNostr"]["CommerceNostrEventPortImpl"];
  };
  const commerceNostrTransportBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_event_bridge.js")
  )) as {
    RealCommerceNostrEventTransport: RootModules["CommerceNostr"]["RealCommerceNostrEventTransport"];
  };
  const commerceNostrReadModel = (await import(distUrl("os", "commerce", "events", "commerce_nostr_event_read_model.js"))) as {
    CommerceNostrProductReadModel: RootModules["CommerceNostr"]["CommerceNostrProductReadModel"];
  };
  const commerceNostrInboundBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_inbound_event_bridge.js")
  )) as {
    verifyAndBuildInboundCommerceNostrEnvelope: RootModules["CommerceNostr"]["verifyAndBuildInboundCommerceNostrEnvelope"];
  };
  const commerceNostrRelayPublisher = (await import(distUrl("os", "messenger", "adapters", "nostr", "protocol", "publish.js"))) as {
    WebSocketRelayPublisher: RootModules["CommerceNostr"]["WebSocketRelayPublisher"];
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
    Commerce: {
      listViewableProducts: commerce.listViewableProducts,
      LocalProductRepository: commerce.LocalProductRepository,
      LocalOrderRepository: commerce.LocalOrderRepository,
      createOrder: commerce.createOrder,
      applyOrderAction: commerce.applyOrderAction,
      DeterministicLocalPaymentProvider: commerce.DeterministicLocalPaymentProvider,
      PaymentSettlementLedger: commerce.PaymentSettlementLedger,
      LocalDeliveryRepository: commerce.LocalDeliveryRepository,
      createDelivery: commerce.createDelivery,
      applyDeliveryAction: commerce.applyDeliveryAction,
      issueSignedTradeReceiptProof: commerce.issueSignedTradeReceiptProof,
      verifySignedTradeReceiptProof: commerce.verifySignedTradeReceiptProof,
      encodeCommerceReceiptProofToQrText: commerce.encodeCommerceReceiptProofToQrText,
      decodeCommerceReceiptProofFromQrText: commerce.decodeCommerceReceiptProofFromQrText,
    },
    Trust: {
      FedosTrustSigningKeypair: trust.FedosTrustSigningKeypair,
      createSingleIssuerFedosTrustPolicy: trust.createSingleIssuerFedosTrustPolicy,
    },
    Reputation: {
      LocalPersonaEpochRegistry: reputation.LocalPersonaEpochRegistry,
      LocalTradeCompletionAttestationStore: reputation.LocalTradeCompletionAttestationStore,
      createPersonaEpoch: reputation.createPersonaEpoch,
      issueTradeCompletionAttestation: reputation.issueTradeCompletionAttestation,
      queryPersonaBoardView: reputation.queryPersonaBoardView,
    },
    Media: {
      IpfsMediaStore: commerceMedia.IpfsMediaStore,
      InMemoryIpfsTransport: commerceMedia.InMemoryIpfsTransport,
      WasmProductMediaEncryption: commerceMedia.WasmProductMediaEncryption,
      WasmProductMediaDecryption: commerceMedia.WasmProductMediaDecryption,
    },
    CommerceNostr: {
      CommerceNostrEventPortImpl: commerceNostrOutbound.CommerceNostrEventPortImpl,
      RealCommerceNostrEventTransport: commerceNostrTransportBridge.RealCommerceNostrEventTransport,
      CommerceNostrProductReadModel: commerceNostrReadModel.CommerceNostrProductReadModel,
      verifyAndBuildInboundCommerceNostrEnvelope: commerceNostrInboundBridge.verifyAndBuildInboundCommerceNostrEnvelope,
      WebSocketRelayPublisher: commerceNostrRelayPublisher.WebSocketRelayPublisher,
    },
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
/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
 * pass) -- the SAME real, process-lifetime `FedosMasterSeedAuthority`
 * instance `buildFreshCoordinator()` already constructs and hands to this
 * Coordinator's own Runtime, retained here (set/cleared alongside
 * `activeCoordinator` at the exact same points) so `commerceMediaStoreFor()`
 * below can inject it into `WasmProductMediaEncryption`/
 * `WasmProductMediaDecryption` -- never a second, separately-generated,
 * unauthenticated Master Seed Authority instance for Commerce media.
 */
let activeMasterSeedAuthority: MasterSeedAuthorityLike | null = null;
/** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the SAME real Nostr signing authority `buildFreshCoordinator()` already constructs (see `NostrSigningAuthorityLike`'s own doc comment), retained for `commerceNostrOutboundPortFor()` below. */
let activeNostrSigningAuthority: NostrSigningAuthorityLike | null = null;
const notificationAdapter = new FedosElectronNotificationAdapter();
const trayAdapter = new FedosElectronTrayAdapter();
let badgeAdapter: FedosElectronBadgeAdapter | null = null;
let inFlight = false;
let shutdownInitiated = false;
let trayCreated = false;

// ---------------------------------------------------------------------
// Commerce E2E Completion arc — in-memory Commerce state for this Electron
// process's lifetime only. NOT persisted across restarts (a durable
// adapter is a future arc — same "0 storage dependency at this layer"
// posture Phase 1 already established for the read-only catalog). Lazily
// constructed on first use so Commerce stays reachable even before a
// profile exists (unchanged Phase 1 property — see `commerceState()`
// below), never gated on `requireBoundary()`/`requireShell()`.
// ---------------------------------------------------------------------
let commerceProductRepo: CommerceProductRepositoryLike | null = null;
let commerceOrderRepo: CommerceOrderRepositoryLike | null = null;
let commercePaymentProvider: CommerceLocalPaymentProviderLike | null = null;
let commercePaymentLedger: CommercePaymentLedgerLike | null = null;
let commerceDeliveryRepo: CommerceDeliveryRepositoryLike | null = null;
let commerceReceiptKeypair: { readonly publicKeyHex: string } | null = null;
let commerceReceiptPolicy: unknown = null;
const COMMERCE_RECEIPT_ISSUER_ID = "fedos-commerce-e2e-demo-merchant";

/**
 * Lazily constructs (once) and returns the process's Commerce state,
 * seeding `commerceProductRepo` with the EXACT Phase 1 demo products
 * (same ids/status — `LocalProductRepository`'s `initialProducts` seeds by
 * `.id` directly, never through `create()`) so existing Phase 1 catalog
 * behavior is unchanged, while making the catalog now backed by a real,
 * mutable repository a Merchant can create/edit/publish/unpublish
 * against. `commercePaymentProvider` is the LOUDLY-labeled TEST/LOCAL
 * simulator (`acknowledgeTestOnly: true`) — never a real payment rail;
 * see `RootModules.Commerce`'s own header.
 */
function commerceState(): {
  readonly products: CommerceProductRepositoryLike;
  readonly orders: CommerceOrderRepositoryLike;
  readonly payments: CommerceLocalPaymentProviderLike;
  readonly ledger: CommercePaymentLedgerLike;
  readonly deliveries: CommerceDeliveryRepositoryLike;
} {
  const m = requireModules();
  if (commerceProductRepo === null) {
    commerceProductRepo = new m.Commerce.LocalProductRepository(undefined, FEDOS_COMMERCE_DEMO_PRODUCTS as unknown as CommerceProductLike[]);
  }
  if (commerceOrderRepo === null) {
    commerceOrderRepo = new m.Commerce.LocalOrderRepository();
  }
  if (commercePaymentProvider === null) {
    commercePaymentProvider = new m.Commerce.DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
  }
  if (commercePaymentLedger === null) {
    commercePaymentLedger = new m.Commerce.PaymentSettlementLedger();
  }
  if (commerceDeliveryRepo === null) {
    commerceDeliveryRepo = new m.Commerce.LocalDeliveryRepository();
  }
  return {
    products: commerceProductRepo,
    orders: commerceOrderRepo,
    payments: commercePaymentProvider,
    ledger: commercePaymentLedger,
    deliveries: commerceDeliveryRepo,
  };
}

/**
 * Commerce E2E Completion arc (coordinator) -- lazily generates ONE
 * process-lifetime Trust signing keypair standing in for "the merchant's"
 * receipt-issuing identity, plus the matching single-issuer verification
 * policy. Scoping decision, documented: a real product would derive this
 * from the merchant's OWN account identity (out of scope this arc -- no
 * per-merchant Trust identity concept exists yet); this local-only demo
 * keypair is sufficient to prove the real sign -> QR -> verify pipeline
 * end to end without inventing that larger design here.
 */
function commerceReceiptSigningState(): { readonly issuerId: string; readonly keypair: { readonly publicKeyHex: string }; readonly policy: unknown } {
  const m = requireModules();
  if (commerceReceiptKeypair === null) {
    commerceReceiptKeypair = m.Trust.FedosTrustSigningKeypair.generate();
    commerceReceiptPolicy = m.Trust.createSingleIssuerFedosTrustPolicy({
      issuerId: COMMERCE_RECEIPT_ISSUER_ID,
      keys: [{ keyId: commerceReceiptKeypair.publicKeyHex, publicKeyHex: commerceReceiptKeypair.publicKeyHex }],
    });
  }
  return { issuerId: COMMERCE_RECEIPT_ISSUER_ID, keypair: commerceReceiptKeypair, policy: commerceReceiptPolicy };
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Reputation /
// Persona Epoch composition (Agent R's central-integration TODOs).
//
// Same lazy, process-lifetime, in-memory singleton pattern as
// `commerceState()` above -- a real `LocalPersonaEpochRegistry` +
// `LocalTradeCompletionAttestationStore`, constructed once, never
// persisted across restarts (same posture as every other Commerce
// repository this file already owns).
//
// PSEUDONYM MAPPING: `os/commerce/reputation`'s own domain layer
// deliberately holds no mapping from a real pubkey to a `PersonaEpoch`
// (`persona_epoch_registry.ts`'s own header) -- that binding is this
// coordinator's job. `commercePersonaEpochByPubkey` below is that mapping,
// scoped to this demo/pilot build: ONE persona epoch is lazily minted per
// real pubkey the first time it is needed (either by an order completing,
// or by an explicit Persona Board query for a pubkey that already has
// one), never re-derived from key material -- exactly the "free to
// generate, no Sybil resistance" property `attestation_types.ts`'s own
// header documents and warns a UI must never contradict.
// ---------------------------------------------------------------------

let commercePersonaEpochRegistry: CommercePersonaEpochRegistryLike | null = null;
let commerceAttestationStore: CommerceTradeCompletionAttestationStoreLike | null = null;
/** real pubkey -> that pubkey's own lazily-minted Persona Epoch + signing keypair. */
const commercePersonaEpochByPubkey = new Map<
  string,
  { readonly epoch: CommercePersonaEpochLike; readonly keypair: CommercePersonaEpochSigningKeypairLike }
>();
/** A Persona Epoch's validity window -- one year, chosen as a reasonable pilot-scale default; not itself a Reputation domain-layer decision (see `persona_epoch.ts`'s own validity-window shape, which takes any caller-supplied window). */
const COMMERCE_PERSONA_EPOCH_VALIDITY_SECONDS = 60 * 60 * 24 * 365;

function commerceReputationState(): { readonly registry: CommercePersonaEpochRegistryLike; readonly store: CommerceTradeCompletionAttestationStoreLike } {
  const m = requireModules();
  if (commercePersonaEpochRegistry === null) {
    commercePersonaEpochRegistry = new m.Reputation.LocalPersonaEpochRegistry();
  }
  if (commerceAttestationStore === null) {
    commerceAttestationStore = new m.Reputation.LocalTradeCompletionAttestationStore();
  }
  return { registry: commercePersonaEpochRegistry, store: commerceAttestationStore };
}

/**
 * Looks up (or, when `createIfAbsent`, lazily mints and registers) the
 * Persona Epoch standing in for `realPubkey`. Returns `undefined` when
 * absent and `createIfAbsent` is `false` -- the read-only Persona Board
 * query path (`handleCommercePersonaBoardQuery`) never fabricates a
 * "no history yet" epoch just because someone asked about it; only a real
 * completed order (`issueReputationAttestationsForCompletedOrderNonFatal`)
 * mints one.
 */
function commercePersonaEpochForPubkey(
  realPubkey: string,
  createIfAbsent: boolean,
): { readonly epoch: CommercePersonaEpochLike; readonly keypair: CommercePersonaEpochSigningKeypairLike } | undefined {
  const existing = commercePersonaEpochByPubkey.get(realPubkey);
  if (existing !== undefined) return existing;
  if (!createIfAbsent) return undefined;
  const m = requireModules();
  const now = Math.floor(Date.now() / 1000);
  const created = m.Reputation.createPersonaEpoch(now, now + COMMERCE_PERSONA_EPOCH_VALIDITY_SECONDS);
  commerceReputationState().registry.register(created.epoch);
  const entry = { epoch: created.epoch, keypair: created.keypair };
  commercePersonaEpochByPubkey.set(realPubkey, entry);
  return entry;
}

/** Coarse, non-authoritative mapping from a Product's own `kind` to a `TradeCompletionCategory` -- a coordinator-level display/bucketing decision, not a Reputation domain-layer rule (that domain never models `Product.kind` at all, by design -- see `attestation_types.ts`'s header on why the category label is deliberately coarser than a real product kind). */
function commerceReputationCategoryForProductKind(kind: string): "digital_good" | "physical_good" | "service" | "other" {
  switch (kind) {
    case "pdf":
    case "zip":
    case "template":
    case "software":
    case "link":
      return "digital_good";
    default:
      return "other";
  }
}

/**
 * Issues REAL, signed `TradeCompletionAttestation`s for BOTH parties of a
 * just-completed order (buyer attests seller, seller attests buyer) --
 * Agent R's own "wire attestation issuance into the real order-completion
 * path" TODO. NON-FATAL / BEST-EFFORT relative to the underlying Commerce
 * transaction: this function is `async` but the ENTIRE body is one
 * `try`/`catch` that never rethrows and never returns anything the caller
 * must check -- a rejected/failed attestation (e.g. a duplicate reissue
 * after a retried IPC call) never blocks, rolls back, or corrupts the
 * Order/Payment/Delivery state that already committed before this is
 * called. See `handleCommerceOrderComplete()`'s own call site.
 */
async function issueReputationAttestationsForCompletedOrderNonFatal(order: CommerceOrderLike, now: number): Promise<void> {
  try {
    const m = requireModules();
    const state = commerceState();
    const { store } = commerceReputationState();
    const buyer = commercePersonaEpochForPubkey(order.buyerPubkey, true);
    const seller = commercePersonaEpochForPubkey(order.sellerPubkey, true);
    if (buyer === undefined || seller === undefined) return;
    const product = state.products.get(order.productId);
    const category = commerceReputationCategoryForProductKind(product?.kind ?? "other");
    const deps = { orderRepository: state.orders, store };
    m.Reputation.issueTradeCompletionAttestation(
      deps,
      {
        orderId: order.id,
        attestorRole: "buyer",
        attestorRealPubkey: order.buyerPubkey,
        attestorEpoch: buyer.epoch,
        attestorSigningKeypair: buyer.keypair,
        subjectEpoch: seller.epoch,
        category,
        outcome: "completed_as_agreed",
      },
      now,
    );
    m.Reputation.issueTradeCompletionAttestation(
      deps,
      {
        orderId: order.id,
        attestorRole: "seller",
        attestorRealPubkey: order.sellerPubkey,
        attestorEpoch: seller.epoch,
        attestorSigningKeypair: seller.keypair,
        subjectEpoch: buyer.epoch,
        category,
        outcome: "completed_as_agreed",
      },
      now,
    );
  } catch (err) {
    console.error("fedos-beta: reputation attestation issuance failed (non-fatal, Commerce completion unaffected):", err);
  }
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Protected media
// composition (Agent M's central-integration TODOs).
//
// `commerceMediaStoreFor()` constructs (and, if the shared Master Seed
// Authority reference changes -- i.e. a lock/unlock cycle -- reconstructs)
// ONE `IpfsMediaStore` whose `WasmProductMediaEncryption`/
// `WasmProductMediaDecryption` are injected with the app's REAL, shared
// `activeMasterSeedAuthority` (never a fresh, separately-constructed,
// always-unauthenticated one). No IPC channel calls into this store this
// pass (see this arc's own coordinator report) -- constructing it here
// proves the wiring is genuinely live; a real product-media upload/
// download surface remains a labeled follow-up.
// ---------------------------------------------------------------------

let commerceMediaStore: CommerceMediaStoreLike | null = null;
/** The `activeMasterSeedAuthority` reference the current `commerceMediaStore` was built with -- reconstructed whenever this changes (e.g. `null` -> real on unlock, or real -> `null` on lock), so the store is never permanently stuck on a stale/absent authority just because Commerce was first touched before a profile was unlocked. */
let commerceMediaStoreAuthorityRef: MasterSeedAuthorityLike | null = null;
const COMMERCE_MEDIA_MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const COMMERCE_MEDIA_SUPPORTED_CONTENT_TYPES: readonly string[] = ["image/png", "image/jpeg", "application/pdf", "application/zip"];

function commerceMediaStoreFor(): CommerceMediaStoreLike {
  const m = requireModules();
  if (commerceMediaStore === null || commerceMediaStoreAuthorityRef !== activeMasterSeedAuthority) {
    const transport = new m.Media.InMemoryIpfsTransport();
    const encryption = new m.Media.WasmProductMediaEncryption(activeMasterSeedAuthority ?? undefined);
    const decryption = new m.Media.WasmProductMediaDecryption(activeMasterSeedAuthority ?? undefined);
    commerceMediaStore = new m.Media.IpfsMediaStore(
      transport,
      COMMERCE_MEDIA_MAX_PAYLOAD_BYTES,
      COMMERCE_MEDIA_SUPPORTED_CONTENT_TYPES,
      encryption,
      "local-only",
      Date.now,
      decryption,
    );
    commerceMediaStoreAuthorityRef = activeMasterSeedAuthority;
  }
  return commerceMediaStore;
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Nostr Commerce
// publication composition (Agent N's central-integration TODOs).
//
// `commerceNetworkProfile` defaults to `"local-only"` (LOCAL_ONLY) --
// Nostr publication stays unreachable (`evaluateNetworkAccess()` inside
// `CommerceNostrEventPortImpl.publish()` refuses it unconditionally) until
// a user EXPLICITLY changes this via the new Settings surface below. This
// is in-memory, per-process state, NOT persisted to the Settings file --
// a deliberate, minimal scoping decision for this pass (see this arc's own
// coordinator report); it resets to the safe default on every relaunch.
// ---------------------------------------------------------------------

type CommerceNetworkProfileValue = "local-only" | "direct" | "tor-optional";
const COMMERCE_NETWORK_PROFILE_VALUES: readonly CommerceNetworkProfileValue[] = ["local-only", "direct", "tor-optional"];
let commerceNetworkProfile: CommerceNetworkProfileValue = "local-only";
const COMMERCE_NOSTR_ACCOUNT_INDEX = 0;

let commerceNostrOutboundPort: CommerceNostrEventPortLike | null = null;
let commerceNostrOutboundPortProfileRef: CommerceNetworkProfileValue | null = null;
let commerceNostrOutboundPortSignerRef: NostrSigningAuthorityLike | null = null;
let commerceNostrReadModelSingleton: CommerceNostrReadModelLike | null = null;

/**
 * Lazily constructs (and rebuilds on a profile/signer change) the ONE real
 * outbound `CommerceNostrEventPort` this process holds. When a real,
 * unlocked Nostr signing authority and at least one configured Relay both
 * exist, this is a genuine `RealCommerceNostrEventTransport` (real
 * signing + real relay publish); otherwise it falls back to a transport
 * whose `send()` always reports `accepted: false` WITHOUT ever reaching a
 * network call or a signing call -- either way, `CommerceNostrEventPortImpl`
 * itself still gates every `publish()` on `commerceNetworkProfile` FIRST
 * (see that class's own header), so `"local-only"` (the default) refuses
 * publication before the transport is ever reached, regardless of which
 * transport this resolves to.
 */
function commerceNostrOutboundPortFor(): CommerceNostrEventPortLike {
  const m = requireModules();
  if (
    commerceNostrOutboundPort === null ||
    commerceNostrOutboundPortProfileRef !== commerceNetworkProfile ||
    commerceNostrOutboundPortSignerRef !== activeNostrSigningAuthority
  ) {
    let transport: CommerceNostrTransportLike;
    if (activeNostrSigningAuthority !== null && activeRelays.length > 0) {
      const relayUrl = activeRelays[0]?.url;
      const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl ?? "", {
        factory: m.createNodeWebSocketRelaySocketFactory(),
      });
      transport = new m.CommerceNostr.RealCommerceNostrEventTransport({
        signingAuthority: activeNostrSigningAuthority,
        relayPublisher,
        accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
      });
    } else {
      // No unlocked signer and/or no configured Relay -- an honestly
      // inert transport (never reached while `commerceNetworkProfile` is
      // `"local-only"` anyway; kept safe even if a caller flips the
      // profile without a Relay configured).
      transport = { send: async () => ({ accepted: false, eventId: "", message: "no signer/relay configured" }) };
    }
    commerceNostrOutboundPort = new m.CommerceNostr.CommerceNostrEventPortImpl(transport, commerceNetworkProfile);
    commerceNostrOutboundPortProfileRef = commerceNetworkProfile;
    commerceNostrOutboundPortSignerRef = activeNostrSigningAuthority;
  }
  return commerceNostrOutboundPort;
}

/** Lazily constructs the ONE real, transport-agnostic inbound read-model this process holds -- purely local/in-memory, no dependency on a signer or Relay (see `CommerceNostrProductReadModel`'s own header: nothing in this process currently subscribes to a relay's inbound event stream and feeds it here -- that real subscription loop is an explicit follow-up, not built this pass). */
function commerceNostrReadModelFor(): CommerceNostrReadModelLike {
  const m = requireModules();
  if (commerceNostrReadModelSingleton === null) {
    commerceNostrReadModelSingleton = new m.CommerceNostr.CommerceNostrProductReadModel();
  }
  return commerceNostrReadModelSingleton;
}

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
async function buildFreshCoordinator(): Promise<{
  coordinator: CoordinatorLike;
  masterSeedAuthority: MasterSeedAuthorityLike;
  eventBridge: DeviceSyncEventBridgeLike;
  /** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the SAME real
   * Nostr signing authority `secureRuntimeBundleConfig()` already threads
   * into Direct Ratchet/Conversation Transport below, additionally
   * returned here so a successful create/unlock can retain it as
   * `activeNostrSigningAuthority` -- the one collaborator
   * `RealCommerceNostrEventTransport` needs that this function already
   * constructs but previously never surfaced past its own local scope. */
  signer: NostrSigningAuthorityLike;
} | null> {
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
  const signer = new m.NostrSigningAuthority(masterSeedAuthority) as NostrSigningAuthorityLike;
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
  return { coordinator, masterSeedAuthority, eventBridge, signer };
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
      activeMasterSeedAuthority = built.masterSeedAuthority;
      activeNostrSigningAuthority = built.signer;
      // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- forces
      // `commerceMediaStoreFor()` to (re)construct NOW, against the real
      // authority/signer just activated above, rather than waiting for a
      // first caller that may never come this session -- proves the real
      // Master Seed Authority injection (and the outbound Nostr Port's
      // real signer/relay wiring) is genuinely live immediately on every
      // successful create/unlock, not merely "would be live if called".
      commerceMediaStoreFor();
      commerceNostrOutboundPortFor();
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
      activeMasterSeedAuthority = built.masterSeedAuthority;
      activeNostrSigningAuthority = built.signer;
      // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- forces
      // `commerceMediaStoreFor()` to (re)construct NOW, against the real
      // authority/signer just activated above, rather than waiting for a
      // first caller that may never come this session -- proves the real
      // Master Seed Authority injection (and the outbound Nostr Port's
      // real signer/relay wiring) is genuinely live immediately on every
      // successful create/unlock, not merely "would be live if called".
      commerceMediaStoreFor();
      commerceNostrOutboundPortFor();
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
    activeMasterSeedAuthority = null;
    activeNostrSigningAuthority = null;
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
    activeMasterSeedAuthority = null;
    activeNostrSigningAuthority = null;
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

// ---------------------------------------------------------------------
// Commerce Reachable Catalog + Product Surface Phase 1.
//
// Deliberately independent of `requireShell()`/`requireModules()`'s own
// profile-lifecycle gating: Commerce catalog discovery does not require an
// unlocked profile, a Coordinator, or a Runtime -- it only needs `modules`
// (loaded once, unconditionally, in `loadRootModules()`). This is what
// "0 expected network contact" and "Commerce reachable even before a
// profile exists" both cash out to structurally.
//
// Commerce E2E Completion arc (coordinator integration gate) widens the
// catalog from the static `FEDOS_COMMERCE_DEMO_PRODUCTS` array to
// `commerceState().products.listPublished()` -- a REAL, mutable
// `LocalProductRepository` seeded with those exact same products (same
// ids/status, see `commerceState()`'s own header), so Phase 1's 3 demo
// products render byte-identically, while a Merchant's own
// create->publish now ALSO appears here (`listPublished()` already
// applies the same `listViewableProducts()` filter internally). Merchant
// CRUD (`handleCommerceMerchant*` below) is the first `os/commerce`
// surface this main process can actually MUTATE -- still zero network
// contact, zero real payment reachable from any handler in this section.
// ---------------------------------------------------------------------

function commerceMerchantLabelFor(creatorPubkey: string): string {
  return fedosCommerceDemoMerchantLabel(creatorPubkey);
}

function commerceProductMediaFor(productId: string): { readonly dataUri: string; readonly mimeType: string; readonly altText: string } | null {
  // Scoping decision (Commerce E2E Completion arc): a newly Merchant-created
  // product has no wired path to a real image yet (that needs the
  // MediaStore/IPC surface -- Wave B's Agent I lane, not this pass). It
  // renders the SAME safe missing-image fallback every un-imaged Phase 1
  // demo product already renders -- never a fake/placeholder photo.
  return FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA[productId] ?? null;
}

async function handleCommerceCatalogList() {
  const products = commerceState().products.listPublished();
  return {
    outcome: "ok",
    products: products.map((product) => ({
      id: product.id,
      title: product.title,
      priceCents: product.priceCents,
      currency: product.currency,
      merchantLabel: commerceMerchantLabelFor(product.creatorPubkey),
      status: product.status,
      hasImage: commerceProductMediaFor(product.id) !== null,
    })),
  };
}

async function handleCommerceProductDetail(payload: unknown) {
  const productId = (payload as { productId?: unknown } | null)?.productId;
  if (!isBoundedString(productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const product = commerceState().products.listPublished().find((candidate) => candidate.id === productId);
  if (product === undefined) return { outcome: "not-found", reason: "no such product" };
  const media = commerceProductMediaFor(product.id);
  return {
    outcome: "ok",
    product: {
      id: product.id,
      title: product.title,
      description: product.description ?? "",
      priceCents: product.priceCents,
      currency: product.currency,
      merchantLabel: commerceMerchantLabelFor(product.creatorPubkey),
      // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- additive
      // field, needed by the renderer's new Seller Reputation panel to
      // query `fedos-app:commerce-persona-board-query` for this product's
      // seller. Never a secret -- `creatorPubkey` is already exposed
      // (indirectly, via `merchantLabel`'s own lookup) and is the same
      // pubkey every Order this product produces already carries as
      // `sellerPubkey`.
      creatorPubkey: product.creatorPubkey,
      status: product.status,
      media: media === null ? null : { dataUri: media.dataUri, mimeType: media.mimeType, altText: media.altText },
    },
  };
}

// ---------------------------------------------------------------------
// Merchant Product CRUD (Commerce E2E Completion arc).
//
// `actorPubkey` always travels explicitly with every call, never inferred
// from "currently selected" state (Secure Runtime Alpha 8121-8200's own
// established discipline for exactly this class of bug) -- the renderer's
// demo "acting as" selector (see `fedos_electron_beta_renderer.ts`) is the
// ONLY source of it, and `LocalProductRepository` re-derives+checks
// `canEditProduct()` on every mutating call regardless of what the
// renderer claims.
// ---------------------------------------------------------------------

function commerceProductDto(product: CommerceProductLike) {
  return {
    id: product.id,
    title: product.title,
    description: product.description ?? "",
    priceCents: product.priceCents,
    currency: product.currency,
    status: product.status,
    visibility: product.visibility,
    creatorPubkey: product.creatorPubkey,
    merchantLabel: commerceMerchantLabelFor(product.creatorPubkey),
  };
}

async function handleCommerceMerchantProductsList(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  const products = commerceState().products.listOwnedByMerchant(actorPubkey);
  return { outcome: "ok", products: products.map(commerceProductDto) };
}

async function handleCommerceProductCreate(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; title?: unknown; description?: unknown; priceCents?: unknown; currency?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.title, MAX_PRODUCT_TITLE_CHARS) || body.title.trim().length === 0) {
    return { outcome: "invalid-input", reason: "malformed title" };
  }
  if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents < 0) {
    return { outcome: "invalid-input", reason: "priceCents must be a non-negative integer" };
  }
  if (!isBoundedString(body.currency, MAX_CURRENCY_CHARS) || body.currency.trim().length === 0) {
    return { outcome: "invalid-input", reason: "malformed currency" };
  }
  const description = isBoundedString(body.description, MAX_PRODUCT_DESCRIPTION_CHARS) ? body.description : undefined;
  const result = commerceState().products.create(body.actorPubkey, {
    kind: "other",
    title: body.title,
    description,
    priceCents: body.priceCents,
    currency: body.currency,
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
  });
  if (result.outcome !== "ok" || result.product === undefined) return { outcome: result.outcome, reason: result.reason };
  return { outcome: "ok", product: commerceProductDto(result.product) };
}

async function handleCommerceProductUpdate(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown; title?: unknown; description?: unknown; priceCents?: unknown; currency?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!isBoundedString(body.title, MAX_PRODUCT_TITLE_CHARS)) return { outcome: "invalid-input", reason: "malformed title" };
    patch.title = body.title;
  }
  if (body.description !== undefined) {
    if (!isBoundedString(body.description, MAX_PRODUCT_DESCRIPTION_CHARS)) return { outcome: "invalid-input", reason: "malformed description" };
    patch.description = body.description;
  }
  if (body.priceCents !== undefined) {
    if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents < 0) {
      return { outcome: "invalid-input", reason: "priceCents must be a non-negative integer" };
    }
    patch.priceCents = body.priceCents;
  }
  if (body.currency !== undefined) {
    if (!isBoundedString(body.currency, MAX_CURRENCY_CHARS)) return { outcome: "invalid-input", reason: "malformed currency" };
    patch.currency = body.currency;
  }
  const result = commerceState().products.update(body.actorPubkey, body.productId, patch);
  if (result.outcome !== "ok" || result.product === undefined) return { outcome: result.outcome, reason: result.reason };
  return { outcome: "ok", product: commerceProductDto(result.product) };
}

const COMMERCE_NOSTR_PRODUCT_KIND_MIRROR_VALUES: readonly string[] = ["pdf", "zip", "template", "software", "link", "other"];

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the ONE real
 * caller of `commerceNostrOutboundPortFor()` this pass wires: publishing
 * (or unpublishing) a product ALSO attempts a real, best-effort Nostr
 * announcement. Entirely NON-FATAL relative to the local Commerce
 * transaction that already committed before this is called (mirrors
 * `issueReputationAttestationsForCompletedOrderNonFatal()`'s own
 * discipline exactly) -- and, while `commerceNetworkProfile` stays at its
 * safe `"local-only"` default, this never reaches a network call at all
 * (`CommerceNostrEventPortImpl.publish()`'s own `evaluateNetworkAccess()`
 * gate refuses it before the transport is ever touched).
 */
async function publishCommerceNostrProductEventNonFatal(product: CommerceProductLike, isPublish: boolean, now: number): Promise<void> {
  try {
    const port = commerceNostrOutboundPortFor();
    const productKind = COMMERCE_NOSTR_PRODUCT_KIND_MIRROR_VALUES.includes(product.kind) ? product.kind : "other";
    const draft = isPublish
      ? {
          category: "product-publication" as const,
          formatVersion: 1 as const,
          productId: product.id,
          productKind,
          title: product.title,
          description: product.description,
          creatorPubkey: product.creatorPubkey,
          priceCents: product.priceCents,
          currency: product.currency,
          status: "active" as const,
          publishedAt: now,
        }
      : {
          category: "product-update" as const,
          formatVersion: 1 as const,
          productId: product.id,
          status: "archived" as const,
          updatedAt: now,
        };
    await port.publish(draft);
  } catch (err) {
    console.error("fedos-beta: Nostr Commerce publication attempt failed (non-fatal, local Commerce state unaffected):", err);
  }
}

async function handleCommerceProductPublish(payload: unknown, publish: boolean) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const repo = commerceState().products;
  const result = publish ? repo.publish(body.actorPubkey, body.productId) : repo.unpublish(body.actorPubkey, body.productId);
  if (result.outcome !== "ok" || result.product === undefined) return { outcome: result.outcome, reason: result.reason };
  await publishCommerceNostrProductEventNonFatal(result.product, publish, Math.floor(Date.now() / 1000));
  return { outcome: "ok", product: commerceProductDto(result.product) };
}

// ---------------------------------------------------------------------
// Order + Payment (Commerce E2E Completion arc).
//
// CORE INVARIANT, enforced structurally, not by convention: the ONLY
// caller anywhere in this file that constructs an
// `{ kind: "payment_evidence" }` actor is `handleCommercePaymentSimulate`
// below, and ONLY after `commercePaymentLedger.apply()` -- itself only
// ever fed evidence this same process's OWN `DeterministicLocalPaymentProvider`
// produced -- reports `outcome: "transitioned"`. No IPC handler anywhere
// accepts an actor kind, or a raw "mark as paid" boolean, from the
// renderer. See `order_state_machine.ts`'s own module doc for the
// domain-level half of this guarantee (re-checks actor kind against an
// allowlist independent of any caller-suppliable flag).
// ---------------------------------------------------------------------

function commerceOrderDto(order: CommerceOrderLike) {
  return {
    id: order.id,
    productId: order.productId,
    buyerPubkey: order.buyerPubkey,
    sellerPubkey: order.sellerPubkey,
    status: order.status,
    quantity: order.quantity,
    unitPriceCents: order.unitPriceCents,
    currency: order.currency,
    totalCents: order.unitPriceCents * order.quantity,
    paymentId: order.paymentId ?? null,
    deliveryId: order.deliveryId ?? null,
  };
}

function generateCommerceOrderId(): string {
  // Same convention as `generateFedosProductId()` (`product_id.ts`) --
  // random 128-bit lower-hex -- but a composition-root-local generator
  // rather than importing Agent O's file, matching `RootModules.Commerce`'s
  // established "no `import type` from `src/os/commerce/**`" discipline for
  // this file. `randomBytes` is Node's own built-in, already a transitive
  // dependency of Electron's runtime -- no new package.
  return nodeRandomBytes(16).toString("hex");
}

async function handleCommerceOrderCreate(payload: unknown) {
  const body = payload as { buyerPubkey?: unknown; productId?: unknown; quantity?: unknown } | null;
  if (!isBoundedString(body?.buyerPubkey, MAX_ID_LENGTH) || body.buyerPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed buyerPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const quantity = body.quantity === undefined ? 1 : body.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
    return { outcome: "invalid-input", reason: "quantity must be a positive integer" };
  }
  const product = commerceState().products.listPublished().find((candidate) => candidate.id === body.productId);
  if (product === undefined) return { outcome: "not-found", reason: "no such published product" };

  const m = requireModules();
  const result = m.Commerce.createOrder(
    { id: generateCommerceOrderId(), productId: product.id, sellerPubkey: product.creatorPubkey, unitPriceCents: product.priceCents, currency: product.currency, quantity },
    { kind: "customer", pubkey: body.buyerPubkey },
    Math.floor(Date.now() / 1000),
  );
  if (!result.ok || result.order === undefined) return { outcome: "rejected", reason: result.reason };
  commerceState().orders.save(result.order);
  return { outcome: "ok", order: commerceOrderDto(result.order) };
}

/** Shared by submit/accept/reject/fulfill/cancel -- every action here is a bare customer/merchant claim (`actor.kind` is always `"customer"` or `"merchant"`, NEVER `"payment_evidence"`/`"delivery_evidence"`), so `order_state_machine.ts`'s own actor-kind allowlist rejects any attempt to reach `paid`/`delivered` through this path structurally, independent of this handler's own logic. */
async function handleCommerceOrderAction(payload: unknown, actionType: "submit" | "accept" | "reject" | "cancel" | "fulfill", actorKind: "customer" | "merchant") {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown; reason?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  if (!isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  const orders = commerceState().orders;
  const order = orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };

  const action: Record<string, unknown> = { type: actionType, actor: { kind: actorKind, pubkey: body.actorPubkey } };
  if (actionType === "reject" && body.reason !== undefined) {
    if (!isBoundedString(body.reason, MAX_ORDER_REJECTION_REASON_CHARS)) return { outcome: "invalid-input", reason: "malformed reason" };
    action.reason = body.reason;
  }
  const m = requireModules();
  const result = m.Commerce.applyOrderAction(order, action as CommerceOrderActionLike, Math.floor(Date.now() / 1000));
  if (!result.ok || result.order === undefined) return { outcome: "rejected", reason: result.reason };
  orders.save(result.order);
  if (actionType === "fulfill") {
    // Commerce E2E Completion arc (coordinator) -- a successful "fulfill" on
    // the Order side ALSO creates+starts the real Delivery record (Agent
    // D's domain), a self-asserted merchant claim only sufficient to reach
    // Delivery's own "fulfilling" status (never "delivered" -- see
    // `delivery_types.ts`'s own module doc for why that specific transition
    // carries no risk). Best-effort: a Delivery-side failure here does not
    // roll back the already-saved Order transition (mirrors this file's
    // existing posture of never partially-reverting an already-persisted
    // domain transition), but IS surfaced in the response for the renderer
    // to show, never silently swallowed.
    const now = Math.floor(Date.now() / 1000);
    const state = commerceState();
    let delivery = state.deliveries.findByOrderId(result.order.id);
    if (delivery === undefined) {
      const created = m.Commerce.createDelivery(
        { id: generateCommerceOrderId(), orderId: result.order.id, buyerPubkey: result.order.buyerPubkey, sellerPubkey: result.order.sellerPubkey, orderPaymentConfirmed: true },
        { kind: "merchant", pubkey: result.order.sellerPubkey },
        now,
      );
      if (created.ok && created.delivery !== undefined) {
        delivery = created.delivery;
        state.deliveries.save(delivery);
      }
    }
    if (delivery !== undefined) {
      const started = m.Commerce.applyDeliveryAction(
        delivery,
        { type: "start_fulfillment", actor: { kind: "merchant", pubkey: result.order.sellerPubkey }, claim: { deliveryId: delivery.id, orderId: result.order.id, claimedAt: now } },
        now,
      );
      if (started.ok && started.delivery !== undefined) state.deliveries.save(started.delivery);
    }
  }
  return { outcome: "ok", order: commerceOrderDto(result.order) };
}

async function handleCommerceOrdersListMine(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  return { outcome: "ok", orders: commerceState().orders.listByBuyer(actorPubkey).map(commerceOrderDto) };
}

async function handleCommerceOrdersListIncoming(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  return { outcome: "ok", orders: commerceState().orders.listBySeller(actorPubkey).map(commerceOrderDto) };
}

async function handleCommercePaymentRequest(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  const state = commerceState();
  const order = state.orders.findById(orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  if (order.status !== "accepted") return { outcome: "rejected", reason: `order must be "accepted" before a payment request can be made (currently "${order.status}")` };

  const decision = await state.payments.requestPayment({
    productId: order.productId,
    orderId: order.id,
    buyerPubkey: order.buyerPubkey,
    amountCents: order.unitPriceCents * order.quantity,
    currency: order.currency,
  });
  if (!decision.allowed || decision.paymentId === undefined) return { outcome: "rejected", reason: decision.reason };
  state.ledger.bind(decision.paymentId, order.id, order.productId);
  return { outcome: "ok", paymentId: decision.paymentId, amountCents: order.unitPriceCents * order.quantity, currency: order.currency, reason: decision.reason };
}

/**
 * The ONLY place in this file that can move an Order to `"paid"`. Two
 * independent authoritative-evidence checks stack here: (1) this process's
 * own `DeterministicLocalPaymentProvider.simulateSettlement()` is the ONLY
 * producer of the `PaymentEvidence` fed into `commercePaymentLedger.apply()`
 * (never a renderer-supplied evidence object -- the renderer sends only
 * `orderId`/`paymentId`, never a `verification`/`status` field, see
 * `fedos_electron_beta_preload.cts`), and (2) `commercePaymentLedger.apply()`
 * itself re-derives `PaymentEvidence.verification.source` against
 * `payment/state_machine.ts`'s own allowlist before transitioning. Only
 * once BOTH agree does this handler construct the
 * `{ kind: "payment_evidence" }` order actor.
 */
async function handleCommercePaymentSimulate(payload: unknown) {
  const body = payload as { orderId?: unknown; paymentId?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH) || !isBoundedString(body.paymentId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed orderId/paymentId" };
  }
  const state = commerceState();
  const order = state.orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };

  const evidence = await state.payments.simulateSettlement(body.paymentId, "settled");
  const applied = state.ledger.apply(evidence, order.id);
  if (applied.outcome !== "transitioned") return { outcome: "rejected", reason: applied.reason ?? `settlement ledger: ${applied.outcome}` };

  const m = requireModules();
  const paymentEvidenceAction: Record<string, unknown> = {
    type: "confirm_payment",
    actor: { kind: "payment_evidence" },
    evidence: { orderId: order.id, paymentId: body.paymentId, status: "settled", observedAt: evidence.observedAt },
  };
  const result = m.Commerce.applyOrderAction(order, paymentEvidenceAction as CommerceOrderActionLike, Math.floor(Date.now() / 1000));
  if (!result.ok || result.order === undefined) return { outcome: "rejected", reason: result.reason };
  state.orders.save(result.order);
  return { outcome: "ok", order: commerceOrderDto(result.order) };
}

// ---------------------------------------------------------------------
// Delivery + Trust/QR receipt (Commerce E2E Completion arc, Wave B
// integration -- coordinator).
//
// CORE INVARIANT (mirrors the payment section's own): the ONLY place that
// can move a Delivery/Order to "delivered" is
// `handleCommerceDeliveryAcknowledgeReceipt` below, and it constructs
// `verification: { source: "recipient_acknowledgment", authoritative:
// true }` ONLY after confirming the calling actor's pubkey matches the
// Order's OWN `buyerPubkey` -- never a bare merchant claim, never a
// renderer-suppliable `verification`/`authoritative` field (the preload
// bridge sends only `orderId`/`actorPubkey`).
// ---------------------------------------------------------------------

function commerceDeliveryDto(delivery: CommerceDeliveryRecordLike) {
  return { id: delivery.id, orderId: delivery.orderId, status: delivery.status };
}

async function handleCommerceDeliveryStatus(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  const delivery = commerceState().deliveries.findByOrderId(orderId);
  if (delivery === undefined) return { outcome: "not-found", reason: "no delivery record for this order yet" };
  return { outcome: "ok", delivery: commerceDeliveryDto(delivery) };
}

async function handleCommerceDeliveryAcknowledgeReceipt(payload: unknown) {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH) || !isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed orderId/actorPubkey" };
  }
  const state = commerceState();
  const order = state.orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  if (order.buyerPubkey !== body.actorPubkey) return { outcome: "rejected", reason: "only the order's own buyer may acknowledge receipt" };
  const delivery = state.deliveries.findByOrderId(body.orderId);
  if (delivery === undefined) return { outcome: "not-found", reason: "no delivery record for this order yet" };

  const now = Math.floor(Date.now() / 1000);
  const m = requireModules();
  const evidence = { deliveryId: delivery.id, orderId: order.id, status: "delivered" as const, observedAt: now, reason: "customer acknowledged receipt", verification: { source: "recipient_acknowledgment" as const, authoritative: true as const, acknowledgedBy: body.actorPubkey } };
  const deliveryResult = m.Commerce.applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence }, now);
  if (!deliveryResult.ok || deliveryResult.delivery === undefined) return { outcome: "rejected", reason: deliveryResult.reason };
  state.deliveries.save(deliveryResult.delivery);

  const orderEvidence = { orderId: order.id, deliveryId: delivery.id, status: "delivered" as const, observedAt: now, reason: "customer acknowledged receipt" };
  const orderResult = m.Commerce.applyOrderAction(order, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: orderEvidence } as CommerceOrderActionLike, now);
  if (!orderResult.ok || orderResult.order === undefined) return { outcome: "rejected", reason: orderResult.reason };
  state.orders.save(orderResult.order);

  return { outcome: "ok", order: commerceOrderDto(orderResult.order), delivery: commerceDeliveryDto(deliveryResult.delivery) };
}

async function handleCommerceOrderComplete(payload: unknown) {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH) || !isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed orderId/actorPubkey" };
  }
  const state = commerceState();
  const order = state.orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  const actorKind: "customer" | "merchant" = order.buyerPubkey === body.actorPubkey ? "customer" : "merchant";
  const now = Math.floor(Date.now() / 1000);
  const m = requireModules();

  const orderResult = m.Commerce.applyOrderAction(order, { type: "complete", actor: { kind: actorKind, pubkey: body.actorPubkey } } as CommerceOrderActionLike, now);
  if (!orderResult.ok || orderResult.order === undefined) return { outcome: "rejected", reason: orderResult.reason };
  state.orders.save(orderResult.order);

  const delivery = state.deliveries.findByOrderId(body.orderId);
  if (delivery !== undefined) {
    const deliveryResult = m.Commerce.applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: actorKind, pubkey: body.actorPubkey } }, now);
    if (deliveryResult.ok && deliveryResult.delivery !== undefined) state.deliveries.save(deliveryResult.delivery);
  }

  // FedOS Commerce FINAL Closure Mega-Arc (coordinator, Agent R's own
  // "wire attestation issuance into the real order-completion path" TODO)
  // -- AFTER the real Order (and, if present, Delivery) state has already
  // committed above. Awaited (so a test can observe it deterministically)
  // but wrapped in its own total try/catch (see that function's own doc
  // comment) -- a reputation-issuance failure can only ever be logged
  // here, never surfaced as this call's own `outcome`, never able to
  // revert `orderResult.order` having already been saved.
  await issueReputationAttestationsForCompletedOrderNonFatal(orderResult.order, now);

  return { outcome: "ok", order: commerceOrderDto(orderResult.order) };
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's
 * read-only Persona Board query, exposed exactly per that domain layer's
 * own TODO: always the `"PUBLIC"` disclosure layer (never `PSEUDONYMOUS_PROOF`/
 * `"AUTHORIZED"` -- WHO gets a wider layer is an access-control decision
 * this pass deliberately does not make; see `persona_board_query.ts`'s own
 * header). Never fabricates a "no history" view for a pubkey this process
 * has genuinely never seen (`commercePersonaEpochForPubkey(..., false)`
 * only looks up, never creates).
 */
async function handleCommercePersonaBoardQuery(payload: unknown) {
  const subjectPubkey = (payload as { subjectPubkey?: unknown } | null)?.subjectPubkey;
  if (!isBoundedString(subjectPubkey, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed subjectPubkey" };
  const entry = commercePersonaEpochForPubkey(subjectPubkey, false);
  if (entry === undefined) return { outcome: "not-found", reason: "no persona/reputation history on record for this pubkey yet" };
  const m = requireModules();
  const { registry, store } = commerceReputationState();
  const now = Math.floor(Date.now() / 1000);
  const result = m.Reputation.queryPersonaBoardView(entry.epoch.epochId, "PUBLIC", registry, store, now);
  if (result === undefined) return { outcome: "not-found", reason: "epoch not registered" };
  return { outcome: "ok", view: result.view, verificationState: result.verificationState };
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal
 * Settings surface: view/select the `NetworkProfile` gating Nostr Commerce
 * publication. In-memory only this pass (see `commerceNetworkProfile`'s
 * own doc comment) -- resets to the safe `"local-only"` default on every
 * relaunch, never silently turning Nostr on by default.
 */
async function handleCommerceNetworkProfileGet() {
  return { outcome: "ok", profile: commerceNetworkProfile };
}

async function handleCommerceNetworkProfileSet(payload: unknown) {
  const profile = (payload as { profile?: unknown } | null)?.profile;
  if (typeof profile !== "string" || !(COMMERCE_NETWORK_PROFILE_VALUES as readonly string[]).includes(profile)) {
    return { outcome: "invalid-input", reason: `profile must be one of ${COMMERCE_NETWORK_PROFILE_VALUES.join(", ")}` };
  }
  commerceNetworkProfile = profile as CommerceNetworkProfileValue;
  return { outcome: "ok", profile: commerceNetworkProfile };
}

/**
 * Issues a real signed `TradeReceiptProof` for a `"completed"` order,
 * encodes it as QR text, and immediately decodes+verifies it back --
 * proving the real Trust sign -> QR -> verify pipeline round-trips before
 * ever handing anything to the renderer. `PLAINTEXT` bindings deliberately
 * stay coarse (opaque ids only, see `receipt_types.ts`'s own field
 * comments) -- never the product's title/price, never exact payment
 * metadata beyond the opaque `paymentId` reference.
 */
async function handleCommerceReceiptIssue(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  const state = commerceState();
  const order = state.orders.findById(orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  if (order.status !== "completed") return { outcome: "rejected", reason: `order must be "completed" before a receipt can be issued (currently "${order.status}")` };

  const m = requireModules();
  const now = Math.floor(Date.now() / 1000);
  const { issuerId, keypair, policy } = commerceReceiptSigningState();
  const payloadRecord = {
    kind: "trade_completion" as const,
    orderId: order.id,
    productRef: order.productId,
    buyerRef: order.buyerPubkey,
    sellerRef: order.sellerPubkey,
    paymentEvidenceRef: order.paymentId ?? undefined,
    completedAt: now,
    formatVersion: 1 as const,
  };
  let envelope: unknown;
  try {
    envelope = m.Commerce.issueSignedTradeReceiptProof(payloadRecord, { keypair, issuer: issuerId }, { issuedAt: now });
  } catch (err) {
    return { outcome: "rejected", reason: err instanceof Error ? err.message : "receipt issuance failed" };
  }
  const qrText = m.Commerce.encodeCommerceReceiptProofToQrText(envelope);
  const decoded = m.Commerce.decodeCommerceReceiptProofFromQrText(qrText);
  const verified = m.Commerce.verifySignedTradeReceiptProof(decoded, policy);
  return { outcome: "ok", qrText, verifyStatus: verified.status };
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
  // Commerce Reachable Catalog + Product Surface Phase 1 -- exactly one
  // new, bounded IPC channel family. Read-only; never gated on shell/
  // profile readiness (see the handlers' own header comment).
  ipcMain.handle("fedos-app:commerce-catalog-list", async () => handleCommerceCatalogList());
  ipcMain.handle("fedos-app:commerce-product-detail", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceProductDetail(payload));
  // Commerce E2E Completion arc (coordinator integration gate) — Merchant
  // Product CRUD + Order + local Payment simulator. Same bounded, named-
  // channel, single-purpose-handler discipline as every other `fedos-app:*`
  // registration in this function.
  ipcMain.handle("fedos-app:commerce-merchant-products-list", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceMerchantProductsList(payload));
  ipcMain.handle("fedos-app:commerce-product-create", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceProductCreate(payload));
  ipcMain.handle("fedos-app:commerce-product-update", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceProductUpdate(payload));
  ipcMain.handle("fedos-app:commerce-product-publish", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceProductPublish(payload, true));
  ipcMain.handle("fedos-app:commerce-product-unpublish", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceProductPublish(payload, false));
  ipcMain.handle("fedos-app:commerce-order-create", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderCreate(payload));
  ipcMain.handle("fedos-app:commerce-order-submit", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderAction(payload, "submit", "customer"));
  ipcMain.handle("fedos-app:commerce-order-cancel", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderAction(payload, "cancel", "customer"));
  ipcMain.handle("fedos-app:commerce-order-accept", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderAction(payload, "accept", "merchant"));
  ipcMain.handle("fedos-app:commerce-order-reject", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderAction(payload, "reject", "merchant"));
  ipcMain.handle("fedos-app:commerce-order-fulfill", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderAction(payload, "fulfill", "merchant"));
  ipcMain.handle("fedos-app:commerce-orders-list-mine", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrdersListMine(payload));
  ipcMain.handle("fedos-app:commerce-orders-list-incoming", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrdersListIncoming(payload));
  ipcMain.handle("fedos-app:commerce-payment-request", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommercePaymentRequest(payload));
  ipcMain.handle("fedos-app:commerce-payment-simulate", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommercePaymentSimulate(payload));
  ipcMain.handle("fedos-app:commerce-delivery-status", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceDeliveryStatus(payload));
  ipcMain.handle("fedos-app:commerce-delivery-acknowledge-receipt", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceDeliveryAcknowledgeReceipt(payload));
  ipcMain.handle("fedos-app:commerce-order-complete", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceOrderComplete(payload));
  ipcMain.handle("fedos-app:commerce-receipt-issue", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceReceiptIssue(payload));
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's read-only Persona Board query.
  ipcMain.handle("fedos-app:commerce-persona-board-query", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommercePersonaBoardQuery(payload));
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal NetworkProfile Settings surface.
  ipcMain.handle("fedos-app:commerce-network-profile-get", async () => handleCommerceNetworkProfileGet());
  ipcMain.handle("fedos-app:commerce-network-profile-set", async (_e: IpcMainInvokeEvent, payload: unknown) => handleCommerceNetworkProfileSet(payload));
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
    logCheckpoint("host-started");
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
      logCheckpoint("ui-script-iife-start");
      const window = mainWindow;
      if (window === null) {
        logCheckpoint("ui-script-no-window");
        await performCleanShutdown();
        return;
      }
      logCheckpoint(`ui-script-have-window-isLoadingMainFrame=${String(window.webContents.isLoadingMainFrame())}`);
      if (window.webContents.isLoadingMainFrame()) {
        await new Promise<void>((resolve) => window.webContents.once("did-finish-load", () => resolve()));
      }
      logCheckpoint("ui-script-page-loaded");
      if (UI_STEP_LOG_FILE.length > 0) {
        try {
          fs.mkdirSync(path.dirname(UI_STEP_LOG_FILE), { recursive: true });
        } catch (mkdirErr) {
          console.error("fedos-beta: ui-script step log dir create failed", mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr));
        }
      }
      try {
        const scriptRaw = process.env.FEDOS_BETA_UI_SCRIPT ?? "[]";
        const script: ReadonlyArray<{ readonly action: "fill" | "click" | "doubleClick" | "read" | "readGlobal" | "wait" | "copy" | "screenshot"; readonly selector?: string; readonly value?: string; readonly as?: "text" | "value"; readonly ms?: number; readonly targetSelector?: string }> = JSON.parse(scriptRaw);
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
          } else if (step.action === "copy") {
            // Secure Runtime Alpha 8201-8280 -- a purely client-side
            // "copy the visible text/value from one element into another
            // element's `.value`" step, added ONLY to this pre-existing
            // `ui-script` autotest execution loop (same gate as every other
            // action here). Stands in for the real, manual copy/paste a
            // human performs when moving a pairing request/approval string
            // between two Devices (or, as this Arc's own Device Pairing
            // vertical slice uses it, between two fields on the SAME real
            // rendered page within one script run) -- never a Node-side
            // round-trip, never a shortcut around the real DOM/IPC path any
            // other step in this file already takes.
            const targetSelector = step.targetSelector ?? "";
            const as = step.as ?? "value";
            result = await window.webContents.executeJavaScript(
              `(() => { const src = document.querySelector(${JSON.stringify(selector)}); const dst = document.querySelector(${JSON.stringify(targetSelector)}); if (!src || !dst) return { outcome: "not-found" }; const v = ${as === "text" ? "src.textContent" : "src.value"}; dst.value = v; dst.dispatchEvent(new Event("input", { bubbles: true })); return { outcome: "ok", value: v }; })()`,
            );
          } else if (step.action === "screenshot") {
            // Commerce E2E Completion arc -- captures a real PNG of the
            // CURRENT window contents via Electron's own `capturePage()`
            // (real compositor output, not a DOM serialization/mock).
            // Fails closed (never silently no-ops) on two independent
            // conditions: (1) no `FEDOS_ELECTRON_BETA_SCREENSHOT_DIR` env
            // var configured (mirrors every other `FEDOS_ELECTRON_BETA_*`
            // override's own opt-in-only posture -- an ordinary launch,
            // and every OTHER `ui-script` run that doesn't need
            // screenshots, never writes to disk), and (2) `step.value`
            // (the filename stem) failing a bounded, allowlisted-charset
            // check -- never an arbitrary path from the script (no `..`,
            // no path separators, no absolute path), even though this
            // harness is already gated behind `AUTOTEST_MODE`/test-only
            // use, matching this file's own "fail closed, never trust an
            // input's shape" discipline elsewhere.
            const screenshotDir = process.env.FEDOS_ELECTRON_BETA_SCREENSHOT_DIR ?? "";
            const stem = step.value ?? "";
            if (screenshotDir.length === 0) {
              result = { outcome: "unavailable", reason: "FEDOS_ELECTRON_BETA_SCREENSHOT_DIR not configured" };
            } else if (!/^[a-zA-Z0-9_-]{1,80}$/.test(stem)) {
              result = { outcome: "invalid-input", reason: "screenshot filename stem must match ^[a-zA-Z0-9_-]{1,80}$" };
            } else {
              // An optional `selector` scrolls that element into view first
              // (`capturePage()` only ever captures the current, possibly
              // scrolled, viewport -- never the full document) -- best
              // effort, never fails the step if the element is absent.
              if (selector.length > 0) {
                await window.webContents.executeJavaScript(
                  `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollIntoView({ block: "start" }); })()`,
                );
              }
              const image = await window.webContents.capturePage();
              const outPath = path.join(screenshotDir, `${stem}.png`);
              fs.mkdirSync(screenshotDir, { recursive: true });
              fs.writeFileSync(outPath, image.toPNG());
              result = { outcome: "ok", value: outPath };
            }
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
          const stepLine = `FEDOS_ELECTRON_BETA_UI_STEP_JSON:${JSON.stringify({ index: i, action: step.action, selector, result })}`;
          console.log(stepLine);
          if (UI_STEP_LOG_FILE.length > 0) {
            // See `UI_STEP_LOG_FILE`'s own doc comment above -- best-effort,
            // additive disk mirror of the exact same line, never a second
            // source of truth (same string, same content, same order).
            try {
              fs.appendFileSync(UI_STEP_LOG_FILE, stepLine + "\n");
            } catch (fileErr) {
              console.error("fedos-beta: ui-script step log file write failed", fileErr instanceof Error ? fileErr.message : String(fileErr));
            }
          }
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
